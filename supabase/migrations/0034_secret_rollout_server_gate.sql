-- 0034 · Server-authoritative Secret-Mark creation safety gate.
-- The one-hour Secret expiry contract is not valid until its independent
-- pg_cron cleanup service is installed, exercised, and monitored.
-- This additive migration rejects NEW secret content by default for every
-- actor, including privileged APIs. Existing secret rows remain readable
-- through their separately protected one-time reveal contract.
-- Run independently of the separately gated 0031 deletion migration.

create table if not exists public.secret_mark_rollout (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.secret_mark_rollout(singleton,enabled)
values (true,false) on conflict(singleton) do nothing;
alter table public.secret_mark_rollout enable row level security;
revoke all on table public.secret_mark_rollout from public,anon,authenticated;
grant select,update on table public.secret_mark_rollout to service_role;

create or replace function public.enforce_secret_mark_expiry_gate()
returns trigger language plpgsql security definer
set search_path = pg_catalog,public as $$
begin
  if coalesce(new.secret,false)
     and (tg_op = 'INSERT' or old.secret is distinct from true)
     and not exists (
       select 1 from public.secret_mark_rollout
       where singleton and enabled
     ) then
    raise exception 'SECRET_MARK_EXPIRY_SCHEDULER_REQUIRED' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function public.enforce_secret_mark_expiry_gate() from public,anon,authenticated;

drop trigger if exists a00_secret_mark_expiry_gate on public.marks;
create trigger a00_secret_mark_expiry_gate
  before insert or update of secret on public.marks
  for each row execute function public.enforce_secret_mark_expiry_gate();
