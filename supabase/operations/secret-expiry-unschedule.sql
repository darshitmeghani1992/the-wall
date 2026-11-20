-- STAGING / DEVOPS ROLLBACK RUNBOOK ONLY.
-- Stops future Secret Mark expiry jobs; it does NOT restore already expired
-- content or weaken the service-only execute privilege.
-- Unscheduling while Secret creation remains ON would violate the 1-hour
-- deletion promise. Disable Secret creation *before* unscheduling.
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname='the-wall-expire-secret-marks-v1';
