-- 0037 · Isolated standard Poll reporting and audited admin removal (DRAFT ONLY).
-- This migration requires unhosted 0035/0036. It DOES NOT activate Polls.
-- Approval, independent security review, hosted migration and device QA remain held.
begin;

-- A standard Poll is private and never has an entry in public.marks.
-- Keep legacy report targets unchanged; add a separate typed target.
alter table public.reports
  add column poll_mark_id uuid references public.mark_polls(mark_id) on delete cascade;
alter table public.reports drop constraint reports_one_target;
alter table public.reports add constraint reports_one_target check (
  num_nonnulls(mark_id, reported_user_id, reported_wall_id, poll_mark_id) = 1
);

alter table public.moderation_actions
  add column target_poll_mark_id uuid references public.mark_polls(mark_id) on delete set null;

-- The legacy authenticated reports INSERT policy only binds reporter_id.
-- Fail closed for direct Poll-target insertion: clients must use the actor-bound
-- routine below, which verifies the same private viewer boundary as v2 reads.
create function public.reject_direct_poll_report()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if new.poll_mark_id is not null and current_user <> 'postgres' then
    raise exception 'POLL_REPORT_NOT_ALLOWED' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger reports_private_poll_insert_guard
  before insert or update of poll_mark_id on public.reports
  for each row execute function public.reject_direct_poll_report();

create function public.report_poll_mark(
  p_expected_actor_id uuid,
  p_poll_mark_id uuid,
  p_reason text,
  p_details text default null
) returns void language plpgsql security definer
set search_path = pg_catalog, public as $$
declare
  v_actor uuid := auth.uid();
  v_poll public.mark_polls%rowtype;
begin
  if v_actor is null or v_actor is distinct from p_expected_actor_id
     or not public.is_active_account(v_actor) then
    raise exception 'POLL_REPORT_NOT_ALLOWED' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in
       ('harassment','hate','sexual','spam','impersonation','privacy','other')
     or (p_details is not null and char_length(p_details) > 2000) then
    raise exception 'POLL_REPORT_INVALID' using errcode = '22023';
  end if;

  select p.* into v_poll from public.mark_polls p
    where p.mark_id = p_poll_mark_id for key share;
  if not found or public.private_poll_envelope_v2(v_poll, v_actor) is null then
    -- No distinction between absent, removed, foreign or private target.
    raise exception 'POLL_REPORT_NOT_ALLOWED' using errcode = '42501';
  end if;

  insert into public.reports(reporter_id,poll_mark_id,reason,details)
  values (v_actor,p_poll_mark_id,p_reason,nullif(btrim(p_details),''));
end
$$;

-- Parallel to 0030's actor-bound admin_remove_mark. This never grants raw
-- authenticated access to the private Poll parent or ballot/voter rows.
create function public.admin_remove_poll_mark(
  p_expected_actor_id uuid,
  p_poll_mark_id uuid,
  p_reason text
) returns void language plpgsql security definer
set search_path = pg_catalog, public as $$
declare
  v_actor uuid := auth.uid();
  v_status public.mark_status;
begin
  if v_actor is null or v_actor is distinct from p_expected_actor_id then
    raise exception 'ACTOR_MISMATCH' using errcode = '42501';
  end if;
  if not public.is_admin(v_actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_reason is null or btrim(p_reason) = '' or char_length(p_reason) > 500 then
    raise exception 'MODERATION_REASON_INVALID' using errcode = '22023';
  end if;

  select p.status into v_status from public.mark_polls p
    where p.mark_id = p_poll_mark_id for update;
  if not found then
    raise exception 'MODERATION_ACTION_NOT_ALLOWED' using errcode = '42501';
  end if;
  if v_status = 'removed' then return; end if;

  update public.mark_polls set status='removed' where mark_id=p_poll_mark_id;
  insert into public.moderation_actions(actor_id,action,target_poll_mark_id,reason)
    values(v_actor,'remove_mark',p_poll_mark_id,btrim(p_reason));
end
$$;

revoke all on function public.reject_direct_poll_report(),
  public.report_poll_mark(uuid,uuid,text,text),
  public.admin_remove_poll_mark(uuid,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.report_poll_mark(uuid,uuid,text,text),
  public.admin_remove_poll_mark(uuid,uuid,text) to authenticated;
commit;
