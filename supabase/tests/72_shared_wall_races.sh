#!/usr/bin/env bash
# Deterministic two-session races against the lifecycle lock order.
set -euo pipefail

export PGPASSWORD="${PGPASSWORD:-postgres}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
TEST_DB="${TEST_DB:-sec001_test}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

psql_test() { psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB" -v ON_ERROR_STOP=1 -q "$@"; }
run_session() {
  local name="$1" uid="$2" sql="$3"
  psql_test >"$TMP_DIR/$name.out" 2>&1 <<SQL &
begin;
set local role authenticated;
set local "test.uid"='$uid';
$sql
commit;
SQL
  LAST_PID=$!
}
await_pair() {
  local p1="$1" p2="$2"
  wait "$p1" || { cat "$TMP_DIR"/*.out; return 1; }
  wait "$p2" || { cat "$TMP_DIR"/*.out; return 1; }
}

psql_test -f "$HERE/72_shared_wall_races_setup.sql" >/dev/null

# 1 remove / join: removal owns the Wall first; tombstone defeats delayed join.
run_session r1a 44444444-4444-4444-4444-444444444444 \
 "select * from walls where id='72000000-0000-4000-8000-000000000001' for update; select pg_sleep(0.8); select remove_shared_wall_member('72000000-0000-4000-8000-000000000001','88888888-8888-8888-8888-888888888888');"
p1=$LAST_PID; sleep 0.1
run_session r1b 88888888-8888-8888-8888-888888888888 \
 "select join_shared_wall('72000000-0000-4000-8000-000000000001');"
p2=$LAST_PID; await_pair "$p1" "$p2"

# 2 block / join: pair lock commits before join revalidation.
run_session r2a 11111111-1111-1111-1111-111111111111 \
 "insert into blocks(blocker_id,blocked_id) values(auth.uid(),'22222222-2222-2222-2222-222222222222'); select pg_sleep(0.8);"
p1=$LAST_PID; sleep 0.1
run_session r2b 22222222-2222-2222-2222-222222222222 \
 "select join_shared_wall('72000000-0000-4000-8000-000000000002');"
p2=$LAST_PID; await_pair "$p1" "$p2"

# 3 close / join.
run_session r3a 44444444-4444-4444-4444-444444444444 \
 "select update_shared_wall_settings('72000000-0000-4000-8000-000000000003','close-join','public',false,false); select pg_sleep(0.8);"
p1=$LAST_PID; sleep 0.1
run_session r3b 88888888-8888-8888-8888-888888888888 \
 "select join_shared_wall('72000000-0000-4000-8000-000000000003');"
p2=$LAST_PID; await_pair "$p1" "$p2"

# 4 delete / join.
run_session r4a 44444444-4444-4444-4444-444444444444 \
 "select delete_shared_wall('72000000-0000-4000-8000-000000000004','delete-join'); select pg_sleep(0.8);"
p1=$LAST_PID; sleep 0.1
run_session r4b 88888888-8888-8888-8888-888888888888 \
 "select join_shared_wall('72000000-0000-4000-8000-000000000004');"
p2=$LAST_PID; await_pair "$p1" "$p2"

# 5 transfer / target leave.
run_session r5a 44444444-4444-4444-4444-444444444444 \
 "select transfer_shared_wall_ownership('72000000-0000-4000-8000-000000000005','22222222-2222-2222-2222-222222222222'); select pg_sleep(0.8);"
p1=$LAST_PID; sleep 0.1
run_session r5b 22222222-2222-2222-2222-222222222222 \
 "select leave_shared_wall('72000000-0000-4000-8000-000000000005');"
p2=$LAST_PID; await_pair "$p1" "$p2"

# 6 accept / owner revoke: owner sees accepted after serialization and removes.
run_session r6a 77777777-7777-7777-7777-777777777777 \
 "select respond_shared_wall_invite('72000000-0000-4000-8000-000000000006',true); select pg_sleep(0.8);"
p1=$LAST_PID; sleep 0.1
run_session r6b 44444444-4444-4444-4444-444444444444 \
 "select remove_shared_wall_member('72000000-0000-4000-8000-000000000006','77777777-7777-7777-7777-777777777777');"
p2=$LAST_PID; await_pair "$p1" "$p2"

# 7 deactivation / join: profile row lock forces post-wait active revalidation.
run_session r7a 66666666-6666-6666-6666-666666666666 \
 "select deactivate_account(); select pg_sleep(0.8);"
p1=$LAST_PID; sleep 0.1
run_session r7b 66666666-6666-6666-6666-666666666666 \
 "select join_shared_wall('72000000-0000-4000-8000-000000000007');"
p2=$LAST_PID; await_pair "$p1" "$p2"

# 8 duplicate join: same actor, same Wall, one row and idempotent second result.
run_session r8a 88888888-8888-8888-8888-888888888888 \
 "select join_shared_wall('72000000-0000-4000-8000-000000000008'); select pg_sleep(0.8);"
p1=$LAST_PID; sleep 0.1
run_session r8b 88888888-8888-8888-8888-888888888888 \
 "select join_shared_wall('72000000-0000-4000-8000-000000000008');"
p2=$LAST_PID; await_pair "$p1" "$p2"

psql_test -f "$HERE/72_shared_wall_races_verify.sql"
