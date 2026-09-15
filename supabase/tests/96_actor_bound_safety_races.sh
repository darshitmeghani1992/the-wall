#!/usr/bin/env bash
# Deterministic physical-session races for the 0027 Mark -> profile lock order.
set -euo pipefail

export PGPASSWORD="${PGPASSWORD:-postgres}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
TEST_DB="${TEST_DB:-sec001_test}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

OWNER="44444444-4444-4444-4444-444444444444"
AUTHOR="11111111-1111-1111-1111-111111111111"
WALL="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

psql_test() { psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB" -v ON_ERROR_STOP=1 -q "$@"; }

run_session() {
  local name="$1" uid="$2" sql="$3"
  psql_test >"$TMP_DIR/$name.out" 2>&1 <<SQL &
begin;
set local statement_timeout='5s';
set local lock_timeout='4s';
set local role authenticated;
set local "test.uid"='$uid';
$sql
commit;
SQL
  LAST_PID=$!
}

await_success() {
  local pid="$1" name="$2"
  if ! wait "$pid"; then
    cat "$TMP_DIR/$name.out"
    return 1
  fi
  if grep -Eqi 'deadlock detected|lock timeout|statement timeout' "$TMP_DIR/$name.out"; then
    cat "$TMP_DIR/$name.out"
    return 1
  fi
}

await_error() {
  local pid="$1" name="$2" expected="$3"
  local status=0
  wait "$pid" || status=$?
  if [ "$status" -eq 0 ] \
     || ! grep -Fq "ERROR:  $expected" "$TMP_DIR/$name.out" \
     || grep -Eqi 'deadlock detected|lock timeout|statement timeout' "$TMP_DIR/$name.out"; then
    cat "$TMP_DIR/$name.out"
    return 1
  fi
}

setup_quota() {
  psql_test <<SQL
delete from public.marks where id::text like '96100000-0000-4000-8000-%';
update public.profiles set account_status='active',deactivated_at=null where id='$OWNER';
insert into public.marks(id,wall_id,author_id,type,text,status,removed_by,removed_at,removal_reason) values
 ('96100000-0000-4000-8000-000000000001','$WALL','$AUTHOR','text','prior-1','removed','$OWNER',clock_timestamp(),'normal'),
 ('96100000-0000-4000-8000-000000000002','$WALL','$AUTHOR','text','prior-2','removed','$OWNER',clock_timestamp(),'normal'),
 ('96100000-0000-4000-8000-000000000003','$WALL','$AUTHOR','text','candidate-3','active',null,null,null),
 ('96100000-0000-4000-8000-000000000004','$WALL','$AUTHOR','text','candidate-4','active',null,null,null);
SQL
}

verify_candidate() {
  local removed_id="$1" active_id="$2"
  psql_test -c "do \$\$ begin
    if (select status from public.marks where id='$removed_id')<>'removed'
       or (select status from public.marks where id='$active_id')<>'active'
       or (select count(*) from public.marks where removed_by='$OWNER' and removal_reason='normal'
             and removed_at > now()-interval '30 days')<>3 then
      raise exception '96 RACE FAIL: concurrent third/fourth quota state';
    end if;
  end \$\$;"
}

# Concurrent third/fourth normal removal, first ordering.
setup_quota
run_session quota_a "$OWNER" \
  "select public.remove_mark('$OWNER','96100000-0000-4000-8000-000000000003','normal'); select pg_sleep(0.8);"
p1=$LAST_PID; sleep 0.1
run_session quota_b "$OWNER" \
  "select public.remove_mark('$OWNER','96100000-0000-4000-8000-000000000004','normal');"
p2=$LAST_PID
await_success "$p1" quota_a
await_error "$p2" quota_b "MARK_REMOVAL_QUOTA: normal removal limit (3 per 30 days) reached"
verify_candidate '96100000-0000-4000-8000-000000000003' '96100000-0000-4000-8000-000000000004'

# Same quota race, reverse ordering.
setup_quota
run_session quota_rev_a "$OWNER" \
  "select public.remove_mark('$OWNER','96100000-0000-4000-8000-000000000004','normal'); select pg_sleep(0.8);"
p1=$LAST_PID; sleep 0.1
run_session quota_rev_b "$OWNER" \
  "select public.remove_mark('$OWNER','96100000-0000-4000-8000-000000000003','normal');"
p2=$LAST_PID
await_success "$p1" quota_rev_a
await_error "$p2" quota_rev_b "MARK_REMOVAL_QUOTA: normal removal limit (3 per 30 days) reached"
verify_candidate '96100000-0000-4000-8000-000000000004' '96100000-0000-4000-8000-000000000003'

setup_lifecycle() {
  local mark_id="$1"
  psql_test <<SQL
delete from public.marks where id='$mark_id';
update public.profiles set account_status='active',deactivated_at=null,is_admin=false where id='$OWNER';
insert into public.marks(id,wall_id,author_id,type,text)
values('$mark_id','$WALL','$AUTHOR','text','lifecycle-race');
SQL
}

verify_lifecycle() {
  local mark_id="$1" expected_mark="$2" expected_account="$3"
  psql_test -c "do \$\$ begin
    if (select status from public.marks where id='$mark_id')<>'$expected_mark'
       or (select account_status from public.profiles where id='$OWNER')<>'$expected_account' then
      raise exception '96 RACE FAIL: lifecycle final state';
    end if;
  end \$\$;"
}

# Removal wins before deactivation: removal commits, then account deactivates.
setup_lifecycle '96100000-0000-4000-8000-000000000011'
run_session remove_deactivate_a "$OWNER" \
  "select public.remove_mark('$OWNER','96100000-0000-4000-8000-000000000011','safety'); select pg_sleep(0.8);"
p1=$LAST_PID; sleep 0.1
run_session remove_deactivate_b "$OWNER" \
  "select public.deactivate_account('$OWNER');"
p2=$LAST_PID
await_success "$p1" remove_deactivate_a
await_success "$p2" remove_deactivate_b
verify_lifecycle '96100000-0000-4000-8000-000000000011' 'removed' 'deactivated'

# Deactivation wins first: delayed removal revalidates the profile and fails.
setup_lifecycle '96100000-0000-4000-8000-000000000012'
run_session deactivate_remove_a "$OWNER" \
  "select public.deactivate_account('$OWNER'); select pg_sleep(0.8);"
p1=$LAST_PID; sleep 0.1
run_session deactivate_remove_b "$OWNER" \
  "select public.remove_mark('$OWNER','96100000-0000-4000-8000-000000000012','safety');"
p2=$LAST_PID
await_success "$p1" deactivate_remove_a
await_error "$p2" deactivate_remove_b "ACTOR_NOT_ACTIVE"
verify_lifecycle '96100000-0000-4000-8000-000000000012' 'active' 'deactivated'

# Removal wins before an admin self-suspension.
setup_lifecycle '96100000-0000-4000-8000-000000000021'
psql_test -c "update public.profiles set is_admin=true where id='$OWNER';"
run_session remove_suspend_a "$OWNER" \
  "select public.remove_mark('$OWNER','96100000-0000-4000-8000-000000000021','safety'); select pg_sleep(0.8);"
p1=$LAST_PID; sleep 0.1
run_session remove_suspend_b "$OWNER" \
  "select public.admin_suspend_account('$OWNER','race');"
p2=$LAST_PID
await_success "$p1" remove_suspend_a
await_success "$p2" remove_suspend_b
verify_lifecycle '96100000-0000-4000-8000-000000000021' 'removed' 'suspended'

# Admin suspension wins first: delayed removal fails active-state revalidation.
setup_lifecycle '96100000-0000-4000-8000-000000000022'
psql_test -c "update public.profiles set is_admin=true where id='$OWNER';"
run_session suspend_remove_a "$OWNER" \
  "select public.admin_suspend_account('$OWNER','race'); select pg_sleep(0.8);"
p1=$LAST_PID; sleep 0.1
run_session suspend_remove_b "$OWNER" \
  "select public.remove_mark('$OWNER','96100000-0000-4000-8000-000000000022','safety');"
p2=$LAST_PID
await_success "$p1" suspend_remove_a
await_error "$p2" suspend_remove_b "ACTOR_NOT_ACTIVE"
verify_lifecycle '96100000-0000-4000-8000-000000000022' 'active' 'suspended'

psql_test <<SQL
delete from public.marks where id::text like '96100000-0000-4000-8000-%';
delete from public.moderation_actions where target_user_id='$OWNER' and reason='race';
update public.profiles set account_status='active',deactivated_at=null,is_admin=false where id='$OWNER';
SQL

echo "96 (6 physical actor-bound races) : PASS  (quota + deactivate + suspend; both orders)"
