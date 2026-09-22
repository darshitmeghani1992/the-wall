#!/usr/bin/env bash
# 54 · Two physical psql sessions prove the actor-wide lock serializes the
# cross-day active/rolling-window reservation checks. The SQL suite has already
# loaded the database; this script only runs its adversarial transactions.
set -euo pipefail

export PGPASSWORD="${PGPASSWORD:-postgres}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
TEST_DB="${TEST_DB:-sec001_test}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PSQL=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB" -v ON_ERROR_STOP=1 -q -A -t)
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

"${PSQL[@]}" -f "$HERE/54_media_quota_concurrency_setup.sql" >/dev/null
"${PSQL[@]}" -f "$HERE/54_media_quota_concurrency_a.sql" >"$TMP_DIR/a" &
PID_A=$!
# Session A acquires the actor lock before calling the RPC. This short delay
# starts B while A still holds the lock, making the interleaving reproducible.
sleep 0.2
"${PSQL[@]}" -f "$HERE/54_media_quota_concurrency_b.sql" >"$TMP_DIR/b" &
PID_B=$!
wait "$PID_A"
wait "$PID_B"

STATUS_A="$(grep -E '^(ready|rate_limited)$' "$TMP_DIR/a" | tail -n 1 || true)"
STATUS_B="$(grep -E '^(ready|rate_limited)$' "$TMP_DIR/b" | tail -n 1 || true)"
if [[ "$STATUS_A" != "ready" || "$STATUS_B" != "rate_limited" ]]; then
  echo "54 FAIL: actor-wide reservation serialization A=$STATUS_A B=$STATUS_B" >&2
  exit 1
fi

"${PSQL[@]}" -f "$HERE/54_media_quota_midnight.sql"

# 54 commits fixtures so its physical sessions can see them. Remove only the
# media-domain fixtures before 55 reuses the same actor/day ledger.
"${PSQL[@]}" -c "truncate table media_upload_cleanup_requirements, media_object_deletions, mark_media, mark_creation_requests, media_uploads, media_quota_daily restart identity cascade" >/dev/null
echo '54 (two-session actor-wide lock)  : PASS'
