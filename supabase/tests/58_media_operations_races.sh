#!/usr/bin/env bash
set -euo pipefail

export PGPASSWORD="${PGPASSWORD:-postgres}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
TEST_DB="${TEST_DB:-sec001_test}"
PSQL=(psql -X -v ON_ERROR_STOP=1 -qAt -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB")
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

"${PSQL[@]}" -c "insert into media_object_deletions(idempotency_key,bucket_id,object_path,reason,not_before) values('ops:race','mark-media','validated/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/race.m4a','operations_race',clock_timestamp()-interval '1 second');" >/dev/null

"${PSQL[@]}" >"$TMP_DIR/first" <<'SQL' &
begin;
select count(*) from claim_media_object_deletions(1,'58100000-0000-4000-8000-000000000001');
select pg_sleep(1);
commit;
SQL
FIRST_PID=$!
sleep 0.2
"${PSQL[@]}" -c "select count(*) from claim_media_object_deletions(1,'58100000-0000-4000-8000-000000000002');" >"$TMP_DIR/second"
wait "$FIRST_PID"

if [ "$(head -n 1 "$TMP_DIR/first")" != "1" ] || [ "$(cat "$TMP_DIR/second")" != "0" ]; then
  echo "58 FAIL: concurrent scheduler double-claimed a live deletion lease" >&2
  exit 1
fi

result="$("${PSQL[@]}" -c "select d.attempt_count||':'||count(a.*) from media_object_deletions d join media_object_deletion_attempts a on a.deletion_id=d.id where d.reason='operations_race' and d.state='processing' group by d.id,d.attempt_count;")"
if [ "$result" != "1:1" ]; then
  echo "58 FAIL: cleanup claim/history did not linearize" >&2
  exit 1
fi
echo "58 (physical cleanup claim race) : PASS"
