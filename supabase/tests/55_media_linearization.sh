#!/usr/bin/env bash
# 55 · Physical-session proof that enabled work and kill-switch/cleanup actions
# have one serial order. Each winner holds its transaction for one second;
# the competing disable/evidence session starts while that lock is held.
set -euo pipefail

export PGPASSWORD="${PGPASSWORD:-postgres}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
TEST_DB="${TEST_DB:-sec001_test}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PSQL=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB" -v ON_ERROR_STOP=1 -q)
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

"${PSQL[@]}" -f "$HERE/55_media_linearization_setup.sql" >/dev/null

run_control_race() {
  local scenario="$1"
  "${PSQL[@]}" -f "$HERE/55_media_linearization_restore.sql" >/dev/null
  "${PSQL[@]}" -f "$HERE/55_media_linearization_${scenario}_attempt.sql" >"$TMP_DIR/${scenario}-winner" &
  local winner_pid=$!
  sleep 0.2
  "${PSQL[@]}" -f "$HERE/55_media_linearization_${scenario}_disable.sql" >"$TMP_DIR/${scenario}-loser" &
  local loser_pid=$!
  wait "$winner_pid"
  wait "$loser_pid"
  "${PSQL[@]}" -v scenario="$scenario" -f "$HERE/55_media_linearization_verify.sql" >/dev/null
}

run_control_race reservation
run_control_race staging
run_control_race transition
run_control_race processing
run_control_race creation

"${PSQL[@]}" -f "$HERE/55_media_linearization_expiry_attempt.sql" >"$TMP_DIR/expiry-winner" &
EXPIRY_PID=$!
sleep 0.2
"${PSQL[@]}" -f "$HERE/55_media_linearization_record_evidence.sql" >"$TMP_DIR/evidence-loser" &
EVIDENCE_PID=$!
wait "$EXPIRY_PID"
wait "$EVIDENCE_PID"
"${PSQL[@]}" -v scenario=expiry -f "$HERE/55_media_linearization_verify.sql" >/dev/null

echo '55 (physical linearization matrix) : PASS'
