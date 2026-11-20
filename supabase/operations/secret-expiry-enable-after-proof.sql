-- DEVOPS RELEASE GATE ONLY. DO NOT RUN until the Secret expiry job has been
-- independently tested, at least one successful scheduler run has been
-- observed, and alerting/monitoring are configured and verified.
-- Requires explicit Founder approval for enabling Secret Marks.
DO $$
begin
  if not exists (select 1 from pg_extension where extname='pg_cron') then
    raise exception 'SECRET_ROLLOUT_CRON_MISSING';
  end if;
  if not exists (
    select 1 from cron.job
    where jobname='the-wall-expire-secret-marks-v1'
      and schedule='* * * * *'
      and command='SELECT public.expire_secret_marks();'
      and active
  ) then
    raise exception 'SECRET_ROLLOUT_JOB_MISSING';
  end if;
  if not exists (
    select 1 from cron.job_run_details r join cron.job j on j.jobid=r.jobid
    where j.jobname='the-wall-expire-secret-marks-v1'
      and r.status='succeeded' and r.end_time>now()-interval '10 minutes'
  ) then
    raise exception 'SECRET_ROLLOUT_JOB_SUCCESS_UNPROVEN';
  end if;
  if has_function_privilege('authenticated','public.expire_secret_marks()','EXECUTE')
     or has_function_privilege('anon','public.expire_secret_marks()','EXECUTE') then
    raise exception 'SECRET_ROLLOUT_CLEANUP_ACL_UNSAFE';
  end if;
  update public.secret_mark_rollout set enabled=true,updated_at=now()
    where singleton;
end $$;
