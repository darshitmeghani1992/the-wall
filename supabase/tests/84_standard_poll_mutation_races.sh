#!/usr/bin/env bash
# Run only from the disposable PostgreSQL security suite.
set -euo pipefail
export PGPASSWORD="${PGPASSWORD:-postgres}"
TEST_DB="${TEST_DB:-sec001_test}"
OWNER=84000000-0000-4000-8000-000000000001
AUTHOR=84000000-0000-4000-8000-000000000002
VOTER=84000000-0000-4000-8000-000000000003
WALL=84000000-0000-4000-8000-000000000004
TMP_DIR="$(mktemp -d)"

psql_test() {
  psql -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" \
    -d "$TEST_DB" -v ON_ERROR_STOP=1 -q "$@"
}
cleanup() {
  set +e
  if [[ -n "${BLOCKER_PID:-}" ]]; then wait "$BLOCKER_PID"; fi
  if [[ -n "${CONTENDER_PID:-}" ]]; then wait "$CONTENDER_PID"; fi
  psql_test >/dev/null <<SQL
update public.mark_poll_rollout set creation_enabled=false,voting_enabled=false where singleton;
delete from public.walls where id='$WALL';
delete from auth.users where id in ('$OWNER','$AUTHOR','$VOTER');
SQL
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

psql_test >/dev/null <<SQL
insert into auth.users(id,email) values
  ('$OWNER','poll84-owner@test'),('$AUTHOR','poll84-author@test'),('$VOTER','poll84-voter@test');
insert into public.profiles(id,handle,display_name) values
  ('$OWNER','poll84_owner','Poll owner'),('$AUTHOR','poll84_author','Poll author'),('$VOTER','poll84_voter','Poll voter');
insert into public.walls(id,owner_id,type,name,visibility)
  values ('$WALL','$OWNER','shared','Disposable poll race fixture','private');
insert into public.wall_members(wall_id,user_id,role,status) values
  ('$WALL','$AUTHOR','member','accepted'),('$WALL','$VOTER','member','accepted');
update public.mark_poll_rollout set creation_enabled=true,voting_enabled=true where singleton;
SQL

POLL="$(psql_test -At <<SQL
begin;
set local role authenticated;
set local "test.uid"='$AUTHOR';
select public.create_poll_mark('$AUTHOR','84000000-0000-4000-8000-000000000005',
  '$WALL','single','Race fixture',array['A','B'],false,false)->>'mark_id';
commit;
SQL
)"
[[ "$POLL" =~ ^[a-f0-9-]{36}$ ]]
OPTION="$(psql_test -Atc "select option_id from public.mark_poll_options where mark_id='$POLL' and position=0;")"
[[ "$OPTION" =~ ^[a-f0-9-]{36}$ ]]

launch() {
  local name="$1" actor="$2" sql="$3"
  psql_test -At >"$TMP_DIR/$name.out" 2>&1 <<SQL &
begin;
set local application_name='poll84_$name';
set local statement_timeout='8s';
set local lock_timeout='6s';
set local role authenticated;
set local "test.uid"='$actor';
$sql
commit;
SQL
  SESSION_PID=$!
}
await_state() {
  local name="$1" key="$2" value="$3" count attempt
  for attempt in $(seq 1 55); do
    count="$(psql_test -Atc "select count(*) from pg_catalog.pg_stat_activity where application_name='poll84_$name' and $key='$value';")"
    if [[ "$count" == 1 ]]; then return; fi
    sleep 0.05
  done
  cat "$TMP_DIR/$name.out"
  echo "84 FAIL: $name did not reach $key=$value" >&2
  return 1
}
await_success() {
  local name="$1" pid="$2"
  if ! wait "$pid" || grep -Eqi 'deadlock detected|lock timeout|statement timeout' "$TMP_DIR/$name.out"; then
    cat "$TMP_DIR/$name.out"
    return 1
  fi
}
assert_unavailable() {
  if ! grep -Fxq 'unavailable' "$TMP_DIR/$1.out"; then
    cat "$TMP_DIR/$1.out"
    echo "84 FAIL: $1 did not fail closed" >&2
    return 1
  fi
}

# Blocking and voting touch the author–voter pair even on a Shared Wall.
launch block_author "$AUTHOR" "insert into public.blocks(blocker_id,blocked_id) values ('$AUTHOR','$VOTER'); select pg_sleep(4);"
BLOCKER_PID=$SESSION_PID
await_state block_author wait_event PgSleep
launch vote "$VOTER" "select public.replace_poll_ballot('$VOTER','84000000-0000-4000-8000-000000000006',
 '$WALL','$POLL',1,0,array['$OPTION']::uuid[])->>'status';"
CONTENDER_PID=$SESSION_PID
await_state vote wait_event_type Lock
await_success block_author "$BLOCKER_PID"
await_success vote "$CONTENDER_PID"
assert_unavailable vote
BLOCKER_PID=
CONTENDER_PID=

# An actor's in-flight deactivation keeps close from consuming an old active snapshot.
launch deactivate "$AUTHOR" "select public.deactivate_account('$AUTHOR'); select pg_sleep(4);"
BLOCKER_PID=$SESSION_PID
await_state deactivate wait_event PgSleep
launch close "$AUTHOR" "select public.close_poll_mark('$AUTHOR','84000000-0000-4000-8000-000000000007',
 '$WALL','$POLL',1)->>'status';"
CONTENDER_PID=$SESSION_PID
await_success close "$CONTENDER_PID"
assert_unavailable close
await_success deactivate "$BLOCKER_PID"
BLOCKER_PID=
CONTENDER_PID=

# The safety remove path can hold parent Mark then owner profile. Close must
# decline the contested parent without waiting on a reversed row lock order.
psql_test -c "update public.profiles set account_status='active',deactivated_at=null where id='$AUTHOR';" >/dev/null
launch remove "$OWNER" "select public.remove_mark('$OWNER','$POLL','safety'); select pg_sleep(4);"
BLOCKER_PID=$SESSION_PID
await_state remove wait_event PgSleep
launch close_removed "$AUTHOR" "select public.close_poll_mark('$AUTHOR','84000000-0000-4000-8000-000000000008',
 '$WALL','$POLL',1)->>'status';"
CONTENDER_PID=$SESSION_PID
await_success close_removed "$CONTENDER_PID"
assert_unavailable close_removed
await_success remove "$BLOCKER_PID"
BLOCKER_PID=
CONTENDER_PID=

RESULT="$(psql_test -Atc "select (
  not exists (select 1 from public.mark_poll_ballots where mark_id='$POLL')
  and not exists (select 1 from public.mark_poll_mutation_requests where mark_id='$POLL')
  and exists (select 1 from public.mark_polls where mark_id='$POLL' and revision=1 and closed_at is null)
  and exists (select 1 from public.marks where id='$POLL' and status='removed')
);")"
[[ "$RESULT" == t ]]
echo '84 (poll authorization: pair, lifecycle and parent races) : PASS'
