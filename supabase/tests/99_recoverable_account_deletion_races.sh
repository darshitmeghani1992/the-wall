#!/usr/bin/env bash
# Two physical-session lifecycle races for recoverable account deletion.
set -euo pipefail

export PGPASSWORD="${PGPASSWORD:-postgres}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
TEST_DB="${TEST_DB:-sec001_test}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

RECOVER="99100000-0000-4000-8000-000000000001"
PURGE="99100000-0000-4000-8000-000000000002"
psql_test() { psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB" -v ON_ERROR_STOP=1 -q "$@"; }

run_session() {
  local name="$1" role="$2" uid="$3" sql="$4"
  psql_test -At >"$TMP_DIR/$name.out" 2>&1 <<SQL &
begin;
set local statement_timeout='8s';
set local lock_timeout='6s';
set local role $role;
set local "test.uid"='$uid';
$sql
commit;
SQL
  LAST_PID=$!
}

await_success() {
  local pid="$1" name="$2"
  if ! wait "$pid"; then cat "$TMP_DIR/$name.out"; return 1; fi
  if grep -Eqi 'deadlock detected|lock timeout|statement timeout' "$TMP_DIR/$name.out"; then
    cat "$TMP_DIR/$name.out"; return 1
  fi
}

psql_test <<SQL
insert into auth.users(id,email) values
 ('$RECOVER','recover-race@test'),('$PURGE','purge-race@test');
insert into profiles(id,handle,display_name) values
 ('$RECOVER','recoverrace','Recover Race'),('$PURGE','purgerace','Purge Race');
update profiles set account_status='deactivated',deactivated_at=clock_timestamp()
 where id in('$RECOVER','$PURGE');
with captured as (select clock_timestamp() as now_at)
insert into account_deletion_requests(user_id,requested_at,purge_after)
select '$RECOVER'::uuid,now_at,now_at+interval '30 days' from captured
union all
select '$PURGE'::uuid,now_at-interval '31 days',now_at-interval '1 day' from captured;
SQL

# Reactivation owns the profile lock first; delayed purge must observe the
# committed active/no-request state and fail closed.
recover_requested_at="$(psql_test -Atc "select requested_at from account_deletion_requests where user_id='$RECOVER';")"
run_session recover_a authenticated "$RECOVER" \
  "select 1 from profiles where id='$RECOVER' for update; select pg_sleep(0.8); select reactivate_account('$RECOVER');"
p1=$LAST_PID; sleep 0.1
run_session recover_b service_role "$PURGE" \
  "select prepare_account_deletion_for_purge('$RECOVER','$recover_requested_at');"
p2=$LAST_PID
await_success "$p1" recover_a
await_success "$p2" recover_b
if ! grep -Fxq 'f' "$TMP_DIR/recover_b.out"; then cat "$TMP_DIR/recover_b.out"; exit 1; fi

# Duplicate due workers serialize on the same profile/request locks and both
# complete idempotently without deadlock or widening authorization.
requested_at="$(psql_test -Atc "select requested_at from account_deletion_requests where user_id='$PURGE';")"
run_session purge_a service_role "$PURGE" \
  "select 1 from profiles where id='$PURGE' for update; select pg_sleep(0.8); select prepare_account_deletion_for_purge('$PURGE','$requested_at');"
p1=$LAST_PID; sleep 0.1
run_session purge_b service_role "$PURGE" \
  "select prepare_account_deletion_for_purge('$PURGE','$requested_at');"
p2=$LAST_PID
await_success "$p1" purge_a
await_success "$p2" purge_b
if ! grep -Fxq 't' "$TMP_DIR/purge_a.out" || ! grep -Fxq 't' "$TMP_DIR/purge_b.out"; then
  cat "$TMP_DIR/purge_a.out" "$TMP_DIR/purge_b.out"; exit 1
fi

psql_test -c "delete from auth.users where id in('$RECOVER','$PURGE');"
echo "99 (2 physical deletion races)      : PASS  (recovery/purge + duplicate workers)"
