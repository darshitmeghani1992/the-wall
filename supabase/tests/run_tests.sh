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

# ── Regression guard: no migration may issue an ownership-gated op on
# storage.objects. On hosted Supabase that table is owned by
# supabase_storage_admin, so `ALTER TABLE storage.objects …` (e.g. ENABLE ROW
# LEVEL SECURITY) fails with `42501: must be owner of table objects` and rolls
# back the whole transaction. RLS is platform-managed there; CREATE POLICY is
# permitted, ALTER TABLE is not. This guard fails the suite deterministically if
# that hosted-incompatible assumption is ever reintroduced. (case-insensitive,
# whitespace-tolerant)
echo "── guard: no ownership-gated ALTER on storage.objects in migrations"
# SQL line-comments (-- …) are stripped before matching so this flags only real
# STATEMENTS, not the explanatory prose in a migration header that names the
# forbidden operation on purpose.
GUARD_HIT=0
for f in "$MIG"/*.sql; do
  stripped="$(sed 's/--.*$//' "$f")"
  if printf '%s\n' "$stripped" | grep -niE 'alter[[:space:]]+table[[:space:]]+storage\.objects' >/dev/null; then
    echo "   OFFENDING FILE: $f"
    echo "$(printf '%s\n' "$stripped" | grep -niE 'alter[[:space:]]+table[[:space:]]+storage\.objects')"
    GUARD_HIT=1
  fi
  # Belt-and-suspenders: an 'enable row level security' that targets
  # storage.objects even if worded slightly differently on the same line.
  if printf '%s\n' "$stripped" | grep -niE 'storage\.objects[[:space:]]+enable[[:space:]]+row[[:space:]]+level[[:space:]]+security' >/dev/null; then
    echo "   OFFENDING FILE: $f (enables RLS on storage.objects)"
    GUARD_HIT=1
  fi
done
if [ "$GUARD_HIT" -ne 0 ]; then
  echo ""
  echo "!! REGRESSION GUARD FAILED: a migration issues an ownership-gated op on"
  echo "   storage.objects. That table is owned by supabase_storage_admin on hosted"
  echo "   Supabase; ALTER TABLE (incl. ENABLE ROW LEVEL SECURITY) fails there with"
  echo "   42501: must be owner of table objects, and rolls back the whole migration"
  echo "   transaction. RLS is platform-managed — do NOT toggle it from a migration."
  echo "   Use CREATE POLICY only (not ownership-gated). See 0003 header."
  exit 1
fi
echo "   PASS (no migration toggles RLS / ALTERs storage.objects)"

echo "── load: 00_bootstrap (Supabase-compat shim)"
psql_test -f "$HERE/00_bootstrap.sql" >/dev/null
echo "── load: 0001_init.sql"
psql_test -f "$MIG/0001_init.sql" >/dev/null
echo "── load: 0002_security_foundation.sql"
psql_test -f "$MIG/0002_security_foundation.sql" >/dev/null
echo "── load: 0003_storage_attachments.sql"
psql_test -f "$MIG/0003_storage_attachments.sql" >/dev/null
echo "── load: 0004_secret_marks.sql"
psql_test -f "$MIG/0004_secret_marks.sql" >/dev/null
echo "── load: 0005_wall_members.sql"
psql_test -f "$MIG/0005_wall_members.sql" >/dev/null
echo "── load: 0006_notification_triggers.sql"
psql_test -f "$MIG/0006_notification_triggers.sql" >/dev/null
echo "── load: 0007_profile_social_links.sql"
psql_test -f "$MIG/0007_profile_social_links.sql" >/dev/null
echo "── load: 0008_friendships_guard_hardening.sql"
psql_test -f "$MIG/0008_friendships_guard_hardening.sql" >/dev/null
echo "── load: 0009_walls_view_membership.sql"
psql_test -f "$MIG/0009_walls_view_membership.sql" >/dev/null
echo "── load: 0010_secret_reveal_lifecycle.sql"
psql_test -f "$MIG/0010_secret_reveal_lifecycle.sql" >/dev/null
echo "── load: 0011_mark_model_reconciliation.sql"
psql_test -f "$MIG/0011_mark_model_reconciliation.sql" >/dev/null
echo "── load: 0012_mark_lifecycle.sql"
psql_test -f "$MIG/0012_mark_lifecycle.sql" >/dev/null
echo "── load: 0013_account_lifecycle.sql"
psql_test -f "$MIG/0013_account_lifecycle.sql" >/dev/null
echo "── load: 0014_follows.sql"
psql_test -f "$MIG/0014_follows.sql" >/dev/null
echo "── load: 0015_approved_writers.sql"
psql_test -f "$MIG/0015_approved_writers.sql" >/dev/null
echo "── load: 0016_reactions_single.sql"
psql_test -f "$MIG/0016_reactions_single.sql" >/dev/null
echo "── load: 0017_moderation.sql"
psql_test -f "$MIG/0017_moderation.sql" >/dev/null
echo "── load: 0018_p0_authorization_contract.sql"
psql_test -f "$MIG/0018_p0_authorization_contract.sql" >/dev/null
echo "── load: 0019_disable_excluded_surfaces.sql"
psql_test -f "$MIG/0019_disable_excluded_surfaces.sql" >/dev/null
echo "── load: 01_seed.sql"
psql_test -f "$HERE/01_seed.sql" >/dev/null

echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo " ASSERTIONS"
echo "══════════════════════════════════════════════════════════════════════"
for area in 05_excluded_surfaces 10_friendships 15_follows 20_blocking 21_blocking_full_boundary 25_reactions 26_reaction_access 30_anonymity 40_mark_moderation 45_mark_lifecycle 55_approved_writers 56_personal_contribution_contract 50_storage \
            60_secret_marks 61_secret_reveal 70_wall_members 80_notifications 85_moderation 90_profile_links \
            95_account_lifecycle; do
  psql_test -f "$HERE/$area.sql"
  echo ""
done

echo "══════════════════════════════════════════════════════════════════════"
echo " ✔ ALL ASSERTIONS PASSED"
echo "   SEC-001 (AC-S1…AC-S10 + moderator-read + storage)"
echo "   FP-C2  (secret isolation + F1 lifecycle, membership gating, 5"
echo "           notification triggers, profile links)"
echo "══════════════════════════════════════════════════════════════════════"
