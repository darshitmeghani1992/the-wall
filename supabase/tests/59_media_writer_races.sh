#!/usr/bin/env bash
# Two-session proof that create/cancel/finalize linearize on the upload row.
set -euo pipefail

export PGPASSWORD="${PGPASSWORD:-postgres}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
TEST_DB="${TEST_DB:-sec001_test}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PSQL=(psql -X -v ON_ERROR_STOP=1 -q -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB")
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

"${PSQL[@]}" -f "$HERE/59_media_writer_races_setup.sql" >/dev/null

# Create commits while holding the upload lock; cancellation then observes consumed.
"${PSQL[@]}" >"$TMP_DIR/create-first" <<'SQL' &
select pg_advisory_lock(59101);
insert into media59_race_latches values('create_first_ready');
begin;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
insert into media59_race_results values('create_first',create_mark(
  '59100000-0000-4000-8000-000000000031','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'photo','race create first',null,false,false,0,array['59100000-0000-4000-8000-000000000001'::uuid]));
reset role;
select pg_advisory_unlock(59101);
select media59_wait_latch('cancel_after_create_started');
commit;
SQL
A_PID=$!
"${PSQL[@]}" -c "select media59_wait_latch('create_first_ready'); select pg_advisory_lock(59101); select pg_advisory_unlock(59101);" >/dev/null
"${PSQL[@]}" >"$TMP_DIR/cancel-after-create" <<'SQL' &
insert into media59_race_latches values('cancel_after_create_started');
set role authenticated;
set "test.uid"='11111111-1111-1111-1111-111111111111';
insert into media59_race_results values('cancel_after_create',
  cancel_media_upload('59100000-0000-4000-8000-000000000001'));
SQL
B_PID=$!
wait "$A_PID"
wait "$B_PID"

# Cancellation commits while holding the upload lock; creation then sees not-ready.
"${PSQL[@]}" >"$TMP_DIR/cancel-first" <<'SQL' &
select pg_advisory_lock(59102);
insert into media59_race_latches values('cancel_first_ready');
begin;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
insert into media59_race_results values('cancel_first',
  cancel_media_upload('59100000-0000-4000-8000-000000000002'));
reset role;
select pg_advisory_unlock(59102);
select media59_wait_latch('create_after_cancel_started');
commit;
SQL
A_PID=$!
"${PSQL[@]}" -c "select media59_wait_latch('cancel_first_ready'); select pg_advisory_lock(59102); select pg_advisory_unlock(59102);" >/dev/null
"${PSQL[@]}" >"$TMP_DIR/create-after-cancel" <<'SQL' &
insert into media59_race_latches values('create_after_cancel_started');
set role authenticated;
set "test.uid"='11111111-1111-1111-1111-111111111111';
insert into media59_race_results values('create_after_cancel',create_mark(
  '59100000-0000-4000-8000-000000000032','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'photo','race create after cancel',null,false,false,0,array['59100000-0000-4000-8000-000000000002'::uuid]));
SQL
B_PID=$!
wait "$A_PID"
wait "$B_PID"

# A live processing cancellation commits first. The callback may record an
# exact idempotency receipt but must terminalize cancellation, never validate.
"${PSQL[@]}" >"$TMP_DIR/cancel-processing" <<'SQL' &
select pg_advisory_lock(59103);
insert into media59_race_latches values('cancel_processing_ready');
begin;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
insert into media59_race_results values('cancel_processing',
  cancel_media_upload('59100000-0000-4000-8000-000000000003'));
reset role;
select pg_advisory_unlock(59103);
select media59_wait_latch('finalize_after_cancel_started');
commit;
SQL
A_PID=$!
"${PSQL[@]}" -c "select media59_wait_latch('cancel_processing_ready'); select pg_advisory_lock(59103); select pg_advisory_unlock(59103);" >/dev/null
"${PSQL[@]}" >"$TMP_DIR/finalize-after-cancel" <<'SQL' &
insert into media59_race_latches values('finalize_after_cancel_started');
insert into media59_race_results
select 'finalize_after_cancel',jsonb_build_object('accepted',finalize_media_validation_attempt(
  id,attempt_id,'writer-race-completion-'||id::text,'writer-race-key','success',jsonb_build_object(
    'detected_mime','image/jpeg','validated_bytes',900,'sha256',repeat('c',64),
    'width',100,'height',80,'duration_ms',null,'validated_path',validated_path||'.jpg',
    'preview_path',null,'cache_control_seconds',60)))
from media59_worker_claim where id='59100000-0000-4000-8000-000000000003';
SQL
B_PID=$!
wait "$A_PID"
wait "$B_PID"

# Finalization commits first; cancellation then terminalizes the validated
# draft and queues its exact canonical output without ever linking a Mark.
"${PSQL[@]}" >"$TMP_DIR/finalize-first" <<'SQL' &
select pg_advisory_lock(59104);
insert into media59_race_latches values('finalize_first_ready');
begin;
insert into media59_race_results
select 'finalize_first',jsonb_build_object('accepted',finalize_media_validation_attempt(
  id,attempt_id,'writer-race-completion-'||id::text,'writer-race-key','success',jsonb_build_object(
    'detected_mime','image/jpeg','validated_bytes',900,'sha256',repeat('d',64),
    'width',100,'height',80,'duration_ms',null,'validated_path',validated_path||'.jpg',
    'preview_path',null,'cache_control_seconds',60)))
from media59_worker_claim where id='59100000-0000-4000-8000-000000000004';
select pg_advisory_unlock(59104);
select media59_wait_latch('cancel_after_finalize_started');
commit;
SQL
A_PID=$!
"${PSQL[@]}" -c "select media59_wait_latch('finalize_first_ready'); select pg_advisory_lock(59104); select pg_advisory_unlock(59104);" >/dev/null
"${PSQL[@]}" >"$TMP_DIR/cancel-after-finalize" <<'SQL' &
insert into media59_race_latches values('cancel_after_finalize_started');
set role authenticated;
set "test.uid"='11111111-1111-1111-1111-111111111111';
insert into media59_race_results values('cancel_after_finalize',
  cancel_media_upload('59100000-0000-4000-8000-000000000004'));
SQL
B_PID=$!
wait "$A_PID"
wait "$B_PID"

"${PSQL[@]}" -f "$HERE/59_media_writer_races_verify.sql"
