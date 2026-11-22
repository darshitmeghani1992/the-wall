import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// These are source/runbook guard tests, NOT a substitute for transactional
// Postgres/cron testing or permission to run the operator script on staging.
const sql = readFileSync(new URL('../supabase/operations/secret-expiry-unschedule.sql', import.meta.url), 'utf8');

test('Secret creation is disabled and independently committed before any cleanup shutdown', () => {
  const disable = sql.indexOf('UPDATE public.secret_mark_rollout');
  const firstCommit = sql.indexOf('COMMIT;', disable);
  const unschedule = sql.indexOf('SELECT cron.unschedule(jobid)');
  assert.ok(disable >= 0 && firstCommit > disable && unschedule > firstCommit);
  assert.match(sql, /SET enabled = false, updated_at = now\(\)/);
  assert.match(sql, /WHERE singleton/);
});

test('unscheduling is transactional, blocks concurrent Secret insertions, and refuses remaining payloads', () => {
  const guardStart = sql.indexOf('LOCK TABLE public.marks');
  const payloadLock = sql.indexOf('LOCK TABLE public.mark_secrets');
  const backlog = sql.indexOf('IF EXISTS (SELECT 1 FROM public.mark_secrets)');
  const unschedule = sql.indexOf('SELECT cron.unschedule(jobid)');
  const finalCommit = sql.lastIndexOf('COMMIT;');
  assert.ok(guardStart >= 0 && payloadLock > guardStart && backlog > payloadLock);
  assert.ok(unschedule > backlog && finalCommit > unschedule);
  assert.match(sql, /LOCK TABLE public\.marks IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(sql, /LOCK TABLE public\.mark_secrets IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(sql, /RAISE EXCEPTION 'TW_SECRET_EXPIRY_PAYLOADS_REMAIN/);
});

test('only the exact expiry job can be stopped after cron and rollout sanity checks', () => {
  assert.match(sql, /SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'/);
  assert.match(sql, /count\(\*\) FROM cron\.job[\s\S]*?jobname = 'the-wall-expire-secret-marks-v1'/);
  assert.match(sql, /IF EXISTS \(SELECT 1 FROM public\.secret_mark_rollout[\s\S]*?WHERE singleton AND enabled/);
  assert.match(sql, /SELECT cron\.unschedule\(jobid\)[\s\S]*?WHERE jobname = 'the-wall-expire-secret-marks-v1'/);
  assert.match(sql, /STAGING \/ DEVOPS ROLLBACK RUNBOOK ONLY/);
});

test('a missing rollout singleton cannot silently authorize cron shutdown', () => {
  const disableGuard = sql.indexOf('DO $disable_guard$');
  const disableCommit = sql.indexOf('COMMIT;', disableGuard);
  const transaction2 = sql.indexOf('BEGIN;', disableCommit);
  const unscheduleGuard = sql.indexOf('DO $unschedule_guard$', transaction2);
  const unschedule = sql.indexOf('SELECT cron.unschedule(jobid)');
  assert.ok(disableGuard >= 0 && disableGuard < disableCommit && disableCommit < transaction2);
  assert.ok(unscheduleGuard > transaction2 && unschedule > unscheduleGuard);
  const missingGuards = sql.match(/RAISE EXCEPTION 'TW_SECRET_ROLLOUT_ROW_MISSING'/g) ?? [];
  assert.equal(missingGuards.length, 2, 'both stages must refuse an absent or malformed singleton');
  assert.match(sql, /\(SELECT count\(\*\) FROM public\.secret_mark_rollout\s+WHERE singleton AND NOT enabled\) <> 1/);
});

test('the Secret rollout switch cannot flip during final backlog and cron checks', () => {
  const stage2 = sql.indexOf('BEGIN;', sql.indexOf('COMMIT;') + 1);
  const rolloutLock = sql.indexOf('LOCK TABLE public.secret_mark_rollout IN SHARE ROW EXCLUSIVE MODE', stage2);
  const marksLock = sql.indexOf('LOCK TABLE public.marks IN SHARE ROW EXCLUSIVE MODE', stage2);
  const secretsLock = sql.indexOf('LOCK TABLE public.mark_secrets IN SHARE ROW EXCLUSIVE MODE', stage2);
  const guard = sql.indexOf('DO $unschedule_guard$', stage2);
  assert.ok(stage2 >= 0 && rolloutLock > stage2 && marksLock > rolloutLock);
  assert.ok(secretsLock > marksLock && guard > secretsLock);
});
