#!/usr/bin/env bash
# Applies the final cutover only after proving its reconciliation fail-closed
# gate, then executes post-cutover authorization assertions. Run last because
# direct authenticated INSERT is intentionally unavailable afterward.
set -euo pipefail

export PGPASSWORD="${PGPASSWORD:-postgres}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
TEST_DB="${TEST_DB:-sec001_test}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG="$HERE/../migrations"

# This runner fabricates reconciliation evidence only in its disposable test
# database to validate migration source. It is never deployment authorization.
if [[ "$TEST_DB" == "postgres" ]]; then
  echo "59 cutover REFUSED: synthetic reconciliation cannot run in database postgres"
  exit 1
fi

PSQL=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB" -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -c "
  update media_legacy_reconciliation
     set state='pending',completed_at=null
   where singleton;
" >/dev/null

if "${PSQL[@]}" -f "$MIG/0024_mark_creation_cutover.sql" >/dev/null 2>&1; then
  echo "59 cutover FAIL: incomplete reconciliation did not abort"
  exit 1
fi

"${PSQL[@]}" -c "
  update media_legacy_reconciliation
     set state='complete',completed_at=clock_timestamp()
   where singleton;
" >/dev/null
"${PSQL[@]}" -f "$MIG/0024_mark_creation_cutover.sql" >/dev/null
"${PSQL[@]}" -f "$HERE/59_mark_creation_cutover.sql"
