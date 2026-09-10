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
TARGET_ID="58200000-0000-4000-8000-000000000001"

# Earlier physical suites intentionally leave durable outbox fixtures behind.
# Fence only their due work into the future so this final-suite race has one
# eligible target without deleting evidence, history, or quota state.
"${PSQL[@]}" -c "drop table if exists media58_race_latches; create table media58_race_latches(name text primary key,target_count integer); update media_object_deletions set not_before=greatest(not_before,clock_timestamp()+interval '1 hour') where state in ('pending','processing'); insert into media_object_deletions(id,idempotency_key,bucket_id,object_path,reason,not_before,created_at,updated_at) values('$TARGET_ID','ops:race','mark-media','validated/58200000-0000-4000-8000-000000000001/58300000-0000-4000-8000-000000000001/full.m4a','operations_race',clock_timestamp()-interval '1 second',clock_timestamp()-interval '23 hours',clock_timestamp());" >/dev/null

"${PSQL[@]}" >"$TMP_DIR/first" <<'SQL' &
select pg_advisory_lock(58001);
insert into media58_race_latches(name) values('first_ready');
begin;
select deletion_id::text||':'||attempt_id::text
  from claim_media_object_deletions(1,'58100000-0000-4000-8000-000000000001');
select pg_advisory_unlock(58001);
do $$
declare deadline timestamptz:=clock_timestamp()+interval '30 seconds';
begin
  loop
    exit when exists(select 1 from media58_race_latches where name='second_done');
    if clock_timestamp()>=deadline then
      raise exception '58 session-one timeout waiting for second_done';
    end if;
    -- Polling backoff only; the committed marker, not elapsed time, releases
    -- the target row lock and permits session one to commit.
    perform pg_sleep(0.02);
  end loop;
end $$;
commit;
SQL
FIRST_PID=$!

# The committed first_ready marker prevents the main session from winning the
# advisory latch before session one. Acquiring that latch proves session one has
# completed its exact claim and is waiting for second_done while still in the
# transaction that owns the target row lock.
"${PSQL[@]}" >/dev/null <<'SQL'
do $$
declare deadline timestamptz:=clock_timestamp()+interval '30 seconds';
begin
  loop
    exit when exists(select 1 from media58_race_latches where name='first_ready');
    if clock_timestamp()>=deadline then
      raise exception '58 main-session timeout waiting for first_ready';
    end if;
    perform pg_sleep(0.02);
  end loop;
end $$;
select pg_advisory_lock(58001);
select pg_advisory_unlock(58001);
SQL

# Commit second_done in the same transaction as session two's claim result.
# Session one cannot commit until this exact result becomes visible.
"${PSQL[@]}" >"$TMP_DIR/second" <<SQL
begin;
with target_claim as materialized (
  select * from claim_media_object_deletions(1,'58100000-0000-4000-8000-000000000002')
   where deletion_id='$TARGET_ID'
)
insert into media58_race_latches(name,target_count)
select 'second_done',count(*)::integer from target_claim
returning target_count;
commit;
SQL
wait "$FIRST_PID"

first_claim="$(grep -E "^${TARGET_ID}:[0-9a-f-]{36}$" "$TMP_DIR/first" || true)"
second_count="$(grep -E '^[0-9]+$' "$TMP_DIR/second" || true)"
if [ -z "$first_claim" ] || [ "$second_count" != "0" ]; then
  echo "58 FAIL: exact target concurrency gate; first=${first_claim:-missing} second=${second_count:-missing}" >&2
  exit 1
fi
FIRST_ATTEMPT="${first_claim#*:}"

result="$("${PSQL[@]}" -c "select d.id::text||':'||d.attempt_id::text||':'||d.attempt_count::text||':'||count(a.*)::text from media_object_deletions d join media_object_deletion_attempts a on a.deletion_id=d.id and a.attempt_id=d.attempt_id and a.state='processing' and a.attempt_number=1 where d.id='$TARGET_ID' and d.state='processing' group by d.id,d.attempt_id,d.attempt_count;")"
expected="$TARGET_ID:$FIRST_ATTEMPT:1:1"
if [ "$result" != "$expected" ]; then
  diagnostic="$("${PSQL[@]}" -c "select d.id::text||':'||d.state||':'||coalesce(d.attempt_id::text,'null')||':'||d.attempt_count::text||':'||count(a.*)::text from media_object_deletions d left join media_object_deletion_attempts a on a.deletion_id=d.id where d.id='$TARGET_ID' group by d.id,d.state,d.attempt_id,d.attempt_count;")"
  echo "58 FAIL: exact claim/history mismatch; expected=$expected actual=${result:-missing} diagnostic=${diagnostic:-missing}" >&2
  exit 1
fi
echo "58 (physical cleanup claim race) : PASS"
