#!/usr/bin/env bash
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

"${PSQL[@]}" -f "$HERE/57_media_worker_credentials_race_setup.sql" >/dev/null

# Bind linearizes before rotation: rotation waits for the key-row transaction,
# then retires the key without losing its issued deadlines.
"${PSQL[@]}" >"$TMP_DIR/bind" <<'SQL' &
select pg_advisory_lock(57001);
insert into media57_race_ready values(57001);
begin;
with timing as (select clock_timestamp() as t)
insert into media57_race_results
select 'bind_before_rotate',bind_media_validation_attempt_credentials(upload_id,attempt_id,
  encode(extensions.digest('race-bind-dispatch','sha256'),'hex'),
  encode(extensions.digest('race-bind-complete','sha256'),'hex'),'race-a',
  t+interval '120 seconds',t,t+interval '2 hours 30 seconds')
from media57_claims,timing where slot=1;
select pg_advisory_unlock(57001);
select pg_sleep(1);
commit;
SQL
A_PID=$!
"${PSQL[@]}" -c "select media57_wait_ready(57001); select pg_advisory_lock(57001); select pg_advisory_unlock(57001);" >/dev/null
"${PSQL[@]}" -c "insert into media57_race_results values('rotate_after_bind',rotate_media_envelope_key('race-a','race-b'));" >"$TMP_DIR/rotate" &
B_PID=$!
wait "$A_PID"
wait "$B_PID"

# A retiring key cannot bind a new attempt after rotation has committed.
"${PSQL[@]}" -c "with timing as (select clock_timestamp() t) insert into media57_race_results select 'bind_after_rotate',bind_media_validation_attempt_credentials(upload_id,attempt_id,repeat('a',64),repeat('b',64),'race-a',t+interval '120 seconds',t,t+interval '2 hours 30 seconds') from media57_claims,timing where slot=2;" >/dev/null

# Prepare a current-key attempt. Redemption linearizes before emergency revoke;
# revoke waits, then disables processing and blocks every later mutation.
"${PSQL[@]}" -c "with timing as (select clock_timestamp() t) select bind_media_validation_attempt_credentials(upload_id,attempt_id,encode(extensions.digest('race-redeem','sha256'),'hex'),encode(extensions.digest('race-redeem-complete','sha256'),'hex'),'race-b',t+interval '120 seconds',t,t+interval '2 hours 30 seconds') from media57_claims,timing where slot=2;" >/dev/null
"${PSQL[@]}" >"$TMP_DIR/redeem" <<'SQL' &
select pg_advisory_lock(57002);
insert into media57_race_ready values(57002);
begin;
insert into media57_race_results
select 'redeem_before_revoke',redeem_media_validation_dispatch_nonce(upload_id,attempt_id,'race-redeem','race-b')
from media57_claims where slot=2;
select pg_advisory_unlock(57002);
select pg_sleep(1);
commit;
SQL
A_PID=$!
"${PSQL[@]}" -c "select media57_wait_ready(57002); select pg_advisory_lock(57002); select pg_advisory_unlock(57002);" >/dev/null
"${PSQL[@]}" -c "insert into media57_race_results values('revoke_after_redeem',revoke_media_envelope_key('race-b'));" >"$TMP_DIR/revoke" &
B_PID=$!
wait "$A_PID"
wait "$B_PID"

# Re-enable processing and provision a fresh key after the emergency stop.
"${PSQL[@]}" -c "select set_media_kind_control('photo',true,true,true,false,'57 resume after revoke'); select rotate_media_envelope_key(null,'race-c');" >/dev/null
"${PSQL[@]}" -c "with timing as (select clock_timestamp() t) select bind_media_validation_attempt_credentials(upload_id,attempt_id,encode(extensions.digest('race-final-dispatch','sha256'),'hex'),encode(extensions.digest('race-final-complete','sha256'),'hex'),'race-c',t+interval '120 seconds',t,t+interval '2 hours 30 seconds') from media57_claims,timing where slot=3; select redeem_media_validation_dispatch_nonce(upload_id,attempt_id,'race-final-dispatch','race-c') from media57_claims where slot=3;" >/dev/null

# Finalize commits its durable receipt before revoke can linearize. The exact
# callback remains idempotent afterward, while a new/mismatched callback cannot.
"${PSQL[@]}" >"$TMP_DIR/finalize" <<'SQL' &
select pg_advisory_lock(57003);
insert into media57_race_ready values(57003);
begin;
insert into media57_race_results
select 'finalize_before_revoke',finalize_media_validation_attempt(upload_id,attempt_id,
  'race-final-complete','race-c','success',jsonb_build_object(
    'detected_mime','image/jpeg','validated_bytes',900,'sha256',repeat('e',64),
    'width',100,'height',80,'duration_ms',null,'validated_path',validated_path||'.jpg',
    'preview_path',null,'cache_control_seconds',60))
from media57_claims where slot=3;
select pg_advisory_unlock(57003);
select pg_sleep(1);
commit;
SQL
A_PID=$!
"${PSQL[@]}" -c "select media57_wait_ready(57003); select pg_advisory_lock(57003); select pg_advisory_unlock(57003);" >/dev/null
"${PSQL[@]}" -c "insert into media57_race_results values('revoke_after_finalize',revoke_media_envelope_key('race-c'));" >"$TMP_DIR/final-revoke" &
B_PID=$!
wait "$A_PID"
wait "$B_PID"

# A dispatch call begins before its envelope expiry but waits behind the key
# row. Its authorization point is after the wait, so it must observe expiry.
"${PSQL[@]}" -c "select set_media_kind_control('photo',true,true,true,false,'57 dispatch expiry race'); select rotate_media_envelope_key(null,'race-exp-dispatch'); with timing as (select clock_timestamp() t) select bind_media_validation_attempt_credentials(upload_id,attempt_id,encode(extensions.digest('race-exp-dispatch-nonce','sha256'),'hex'),encode(extensions.digest('race-exp-dispatch-complete','sha256'),'hex'),'race-exp-dispatch',t+interval '3 seconds',t,t+interval '2 hours 30 seconds') from media57_claims,timing where slot=4;" >/dev/null
"${PSQL[@]}" >"$TMP_DIR/dispatch-expiry-lock" <<'SQL' &
select pg_advisory_lock(57004);
insert into media57_race_ready values(57004);
begin;
select kid from media_envelope_keys where kid='race-exp-dispatch' for update;
select pg_advisory_unlock(57004);
select pg_sleep(4);
commit;
SQL
A_PID=$!
"${PSQL[@]}" -c "select media57_wait_ready(57004); select pg_advisory_lock(57004); select pg_advisory_unlock(57004);" >/dev/null
"${PSQL[@]}" >"$TMP_DIR/dispatch-expiry" <<'SQL' &
begin;
insert into media57_race_times values('dispatch_expired_while_waiting',clock_timestamp());
insert into media57_race_results select 'dispatch_expired_while_waiting',
  redeem_media_validation_dispatch_nonce(upload_id,attempt_id,'race-exp-dispatch-nonce','race-exp-dispatch')
from media57_claims where slot=4;
commit;
SQL
B_PID=$!
wait "$A_PID"
wait "$B_PID"

# The same crossing is required for completion leases. The callback starts
# live, waits behind the key row, and may not mutate or create a receipt after
# its database authorization point observes the expired lease.
"${PSQL[@]}" -c "select rotate_media_envelope_key('race-exp-dispatch','race-exp-final'); update media_uploads set lease_expires_at=clock_timestamp()+interval '3 seconds' where id=(select upload_id from media57_claims where slot=5); with timing as (select clock_timestamp() t) select bind_media_validation_attempt_credentials(upload_id,attempt_id,encode(extensions.digest('race-exp-final-dispatch','sha256'),'hex'),encode(extensions.digest('race-exp-final-complete','sha256'),'hex'),'race-exp-final',t+interval '120 seconds',t,t+interval '2 hours 30 seconds') from media57_claims,timing where slot=5; select redeem_media_validation_dispatch_nonce(upload_id,attempt_id,'race-exp-final-dispatch','race-exp-final') from media57_claims where slot=5;" >/dev/null
"${PSQL[@]}" >"$TMP_DIR/final-expiry-lock" <<'SQL' &
select pg_advisory_lock(57005);
insert into media57_race_ready values(57005);
begin;
select kid from media_envelope_keys where kid='race-exp-final' for update;
select pg_advisory_unlock(57005);
select pg_sleep(4);
commit;
SQL
A_PID=$!
"${PSQL[@]}" -c "select media57_wait_ready(57005); select pg_advisory_lock(57005); select pg_advisory_unlock(57005);" >/dev/null
"${PSQL[@]}" >"$TMP_DIR/final-expiry" <<'SQL' &
begin;
insert into media57_race_times values('finalize_expired_while_waiting',clock_timestamp());
insert into media57_race_results
select 'finalize_expired_while_waiting',finalize_media_validation_attempt(upload_id,attempt_id,
  'race-exp-final-complete','race-exp-final','success',jsonb_build_object(
    'detected_mime','image/jpeg','validated_bytes',900,'sha256',repeat('f',64),
    'width',100,'height',80,'duration_ms',null,'validated_path',validated_path||'.jpg',
    'preview_path',null,'cache_control_seconds',60))
from media57_claims where slot=5;
commit;
SQL
B_PID=$!
wait "$A_PID"
wait "$B_PID"

"${PSQL[@]}" -f "$HERE/57_media_worker_credentials_races_verify.sql"
