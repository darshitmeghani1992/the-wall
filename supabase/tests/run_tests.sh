#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# run_tests.sh · SEC-001 security-suite runner.
#
# Resets a throwaway test database, loads the Supabase-compat shim → migrations
# → seed → each area test, and exits NONZERO on the first failed assertion
# (every file uses \set ON_ERROR_STOP on; a raised DO-block assertion aborts).
# Re-runnable: the test DB is dropped and recreated each run.
#
# Env (overridable): PGHOST=localhost PGPORT=5432 PGUSER=postgres
#                    ADMIN_DB=postgres TEST_DB=sec001_test PGPASSWORD=postgres
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail

export PGPASSWORD="${PGPASSWORD:-postgres}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
ADMIN_DB="${ADMIN_DB:-postgres}"
TEST_DB="${TEST_DB:-sec001_test}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG="$HERE/../migrations"

psql_admin() { psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$ADMIN_DB" -v ON_ERROR_STOP=1 -q "$@"; }
psql_test()  { psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB"  -v ON_ERROR_STOP=1 -q "$@"; }

echo "══════════════════════════════════════════════════════════════════════"
echo " SEC-001 security suite · resetting $TEST_DB"
echo "══════════════════════════════════════════════════════════════════════"
psql_admin -c "DROP DATABASE IF EXISTS $TEST_DB WITH (FORCE);"
psql_admin -c "CREATE DATABASE $TEST_DB;"

echo "── load: 00_bootstrap (Supabase-compat shim)"
psql_test -f "$HERE/00_bootstrap.sql" >/dev/null
echo "── load: 0001_init.sql"
psql_test -f "$MIG/0001_init.sql" >/dev/null
echo "── load: 0002_security_foundation.sql"
psql_test -f "$MIG/0002_security_foundation.sql" >/dev/null
echo "── load: 0003_storage_attachments.sql"
psql_test -f "$MIG/0003_storage_attachments.sql" >/dev/null
echo "── load: 01_seed.sql"
psql_test -f "$HERE/01_seed.sql" >/dev/null

echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo " ASSERTIONS"
echo "══════════════════════════════════════════════════════════════════════"
for area in 10_friendships 20_blocking 30_anonymity 40_mark_moderation 50_storage; do
  psql_test -f "$HERE/$area.sql"
  echo ""
done

echo "══════════════════════════════════════════════════════════════════════"
echo " ✔ ALL SEC-001 ASSERTIONS PASSED (AC-S1…AC-S10 + moderator-read + storage)"
echo "══════════════════════════════════════════════════════════════════════"
