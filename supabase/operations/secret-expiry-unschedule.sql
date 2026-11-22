-- STAGING / DEVOPS ROLLBACK RUNBOOK ONLY. Requires separate Founder,
-- independent Reviewer/QA, and operational authorization. DO NOT run as a
-- beta CI job or automatically apply to any hosted database.
--
-- A Secret's one-hour payload deletion promise survives a feature shutdown.
-- Turning off NEW Secret creation does NOT authorize stopping the scheduled
-- cleanup while any prior secret payloads still exist.
--
-- Stage 1: stop new Secrets immediately. Commit this independently so a
-- later unschedule failure never re-enables Secret creation.
BEGIN;
UPDATE public.secret_mark_rollout
   SET enabled = false, updated_at = now()
 WHERE singleton;
-- Missing/altered rollout rows are an inconsistent configuration, not an
-- authorization to stop the one-hour cleanup timer.
DO $disable_guard$
BEGIN
  IF (SELECT count(*) FROM public.secret_mark_rollout
      WHERE singleton AND NOT enabled) <> 1 THEN
    RAISE EXCEPTION 'TW_SECRET_ROLLOUT_ROW_MISSING';
  END IF;
END
$disable_guard$;
COMMIT;

-- Stage 2: refuse to stop cleanup unless the backlog is empty. Locks keep a
-- concurrent mark creation/Secret payload insertion from racing this check.
-- If ANY existing secret payload remains (opened, expired or unexpired), this
-- transaction aborts and the cron job keeps running. Wait for deletion proof
-- and retry only under the same release controls; never force-clear content.
BEGIN;
-- Hold the rollout flag stable through the backlog check and cron shutdown:
-- otherwise a concurrent administrator can flip creation ON between checks.
LOCK TABLE public.secret_mark_rollout IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.marks IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.mark_secrets IN SHARE ROW EXCLUSIVE MODE;

DO $unschedule_guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'TW_SECRET_EXPIRY_CRON_MISSING';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mark_secrets) THEN
    RAISE EXCEPTION 'TW_SECRET_EXPIRY_PAYLOADS_REMAIN: cleanup must continue';
  END IF;
  IF (SELECT count(*) FROM cron.job
      WHERE jobname = 'the-wall-expire-secret-marks-v1') <> 1 THEN
    RAISE EXCEPTION 'TW_SECRET_EXPIRY_JOB_NOT_UNIQUE';
  END IF;
  IF (SELECT count(*) FROM public.secret_mark_rollout
      WHERE singleton AND NOT enabled) <> 1 THEN
    RAISE EXCEPTION 'TW_SECRET_ROLLOUT_ROW_MISSING';
  END IF;
  IF EXISTS (SELECT 1 FROM public.secret_mark_rollout
             WHERE singleton AND enabled) THEN
    RAISE EXCEPTION 'TW_SECRET_CREATION_STILL_ENABLED';
  END IF;
END
$unschedule_guard$;

SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'the-wall-expire-secret-marks-v1';
COMMIT;

-- Post-operation proof (read-only, performed independently):
-- SELECT enabled FROM public.secret_mark_rollout WHERE singleton;
-- SELECT count(*) FROM public.mark_secrets; -- must be 0
-- SELECT count(*) FROM cron.job
--  WHERE jobname = 'the-wall-expire-secret-marks-v1'; -- must be 0
-- If these cannot be verified, retain NO-GO and do not enable Secret Marks.
