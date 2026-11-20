-- STAGING RUNBOOK ONLY — NOT AN AUTOMATIC DB MIGRATION.
-- Requires separately approved DevOps scheduling gate and pg_cron extension.
-- Run as a trusted administrative role AFTER verifying 0032 ACL hardening,
-- independent security review and test-restore evidence. Never run by app role.
-- Once installed, one-minute scheduling enforces deletion of expired Secret
-- payloads independently of client reads, preserving the 1-hour promise.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    RAISE EXCEPTION 'TW_CRON_NOT_CONFIGURED: enable pg_cron via Supabase integration first';
  END IF;
  IF has_function_privilege('anon','public.expire_secret_marks()','EXECUTE')
     OR has_function_privilege('authenticated','public.expire_secret_marks()','EXECUTE')
     OR NOT has_function_privilege('service_role','public.expire_secret_marks()','EXECUTE') THEN
    RAISE EXCEPTION 'TW_SECRET_EXPIRY_ACL_UNSAFE: 0032 not verified';
  END IF;
END $$;

SELECT cron.schedule(
  'the-wall-expire-secret-marks-v1',
  '* * * * *',
  'SELECT public.expire_secret_marks();'
);

-- Verification after commit:
-- SELECT jobid, jobname, schedule, command, active
--   FROM cron.job WHERE jobname='the-wall-expire-secret-marks-v1';
-- Check last-run success via cron.job_run_details, test with synthetic expired
-- Secret Marks in a disposable environment, and monitor failed runs.
