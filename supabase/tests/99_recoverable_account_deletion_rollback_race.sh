#!/usr/bin/env bash
# Proves rollback cannot pass its empty-state guard while a request commits.
set -euo pipefail

export PGPASSWORD="${PGPASSWORD:-postgres}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
TEST_DB="${TEST_DB:-sec001_test}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

USER_ID="99200000-0000-4000-8000-000000000001"
psql_test() { psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB" -v ON_ERROR_STOP=1 -q "$@"; }

psql_test <<SQL
insert into auth.users(id,email) values ('$USER_ID','rollback-race@test');
insert into profiles(id,handle,display_name) values ('$USER_ID','rollbackrace','Rollback Race');
SQL

psql_test >"$TMP_DIR/request.out" 2>&1 <<SQL &
begin;
with captured as (select clock_timestamp() as now_at)
insert into account_deletion_requests(user_id,requested_at,purge_after)
select '$USER_ID',now_at,now_at+interval '30 days' from captured;
select pg_sleep(0.8);
commit;
SQL
request_pid=$!
sleep 0.1

set +e
psql_test -f "$HERE/../rollbacks/0031_recoverable_account_deletion_preapply.sql" \
  >"$TMP_DIR/rollback.out" 2>&1
rollback_status=$?
set -e
wait "$request_pid"

if [ "$rollback_status" -eq 0 ] \
  || ! grep -Fq 'ROLLBACK_REQUIRES_EMPTY_ACCOUNT_DELETION_REQUESTS' "$TMP_DIR/rollback.out"; then
  cat "$TMP_DIR/request.out" "$TMP_DIR/rollback.out"
  exit 1
fi

psql_test -Atc "select to_regclass('public.account_deletion_requests') is not null
  and exists(select 1 from account_deletion_requests where user_id='$USER_ID');" \
  | grep -Fxq 't'
psql_test -c "delete from auth.users where id='$USER_ID';"
echo "99 (rollback/request race)          : PASS  (committed request preserved)"
