-- ============================================================================
-- 0030 · Actor-bound, receipt-safe admin moderation
--
-- Privileged mutations now bind the administrator observed by the client to
-- auth.uid() in the same transaction as authorization and the target lock.
-- Actions are retry-safe and cannot record a success for a missing target.
--
-- Rollback (after clients stop using these signatures): revoke/drop the new
-- overloads and restore authenticated grants to the legacy signatures. Do not
-- roll back completed moderation state or its audit log.
-- ============================================================================

revoke all on function public.admin_remove_mark(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_suspend_account(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_resolve_report(uuid, text, text)
  from public, anon, authenticated, service_role;

create or replace function public.admin_remove_mark(
  p_expected_actor_id uuid,
  p_mark_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_status public.mark_status;
begin
  if v_actor is null or p_expected_actor_id is distinct from v_actor then
    raise exception 'ACTOR_MISMATCH' using errcode = '42501';
  end if;
  if not public.is_admin(v_actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_reason is null or btrim(p_reason) = '' or length(p_reason) > 500 then
    raise exception 'MODERATION_REASON_INVALID' using errcode = '22023';
  end if;

  select m.status into v_status
    from public.marks m where m.id = p_mark_id for update;
  if not found then
    raise exception 'MODERATION_ACTION_NOT_ALLOWED' using errcode = '42501';
  end if;
  if v_status = 'removed' then return; end if;

  update public.marks
     set status = 'removed', removed_by = v_actor, removal_reason = 'moderation'
   where id = p_mark_id;
  insert into public.moderation_actions(actor_id, action, target_mark_id, reason)
    values (v_actor, 'remove_mark', p_mark_id, btrim(p_reason));
end
$$;

create or replace function public.admin_suspend_account(
  p_expected_actor_id uuid,
  p_user_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_target_admin boolean;
begin
  if v_actor is null or p_expected_actor_id is distinct from v_actor then
    raise exception 'ACTOR_MISMATCH' using errcode = '42501';
  end if;
  if not public.is_admin(v_actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_reason is null or btrim(p_reason) = '' or length(p_reason) > 500 then
    raise exception 'MODERATION_REASON_INVALID' using errcode = '22023';
  end if;
  if p_user_id = v_actor then
    raise exception 'MODERATION_ACTION_NOT_ALLOWED' using errcode = '42501';
  end if;

  select p.account_status, p.is_admin into v_status, v_target_admin
    from public.profiles p where p.id = p_user_id for update;
  if not found then
    raise exception 'MODERATION_ACTION_NOT_ALLOWED' using errcode = '42501';
  end if;
  if v_target_admin then
    raise exception 'MODERATION_ACTION_NOT_ALLOWED' using errcode = '42501';
  end if;
  if v_status = 'suspended' then return; end if;

  update public.profiles
     set account_status = 'suspended', deactivated_at = clock_timestamp()
   where id = p_user_id;
  insert into public.moderation_actions(actor_id, action, target_user_id, reason)
    values (v_actor, 'suspend_account', p_user_id, btrim(p_reason));
end
$$;

create or replace function public.admin_resolve_report(
  p_expected_actor_id uuid,
  p_report_id uuid,
  p_status text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
begin
  if v_actor is null or p_expected_actor_id is distinct from v_actor then
    raise exception 'ACTOR_MISMATCH' using errcode = '42501';
  end if;
  if not public.is_admin(v_actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status not in ('resolved', 'dismissed') then
    raise exception 'MODERATION_STATUS_INVALID' using errcode = '22023';
  end if;
  if p_reason is null or btrim(p_reason) = '' or length(p_reason) > 500 then
    raise exception 'MODERATION_REASON_INVALID' using errcode = '22023';
  end if;

  select r.status into v_status
    from public.reports r where r.id = p_report_id for update;
  if not found then
    raise exception 'MODERATION_ACTION_NOT_ALLOWED' using errcode = '42501';
  end if;
  if v_status = p_status then return; end if;
  if v_status <> 'open' then
    raise exception 'MODERATION_ACTION_NOT_ALLOWED' using errcode = '42501';
  end if;

  update public.reports
     set status = p_status, resolved_by = v_actor, resolved_at = clock_timestamp()
   where id = p_report_id;
  insert into public.moderation_actions(actor_id, action, report_id, reason)
    values (
      v_actor,
      case when p_status = 'resolved' then 'resolve_report' else 'dismiss_report' end,
      p_report_id,
      btrim(p_reason)
    );
end
$$;

revoke all on function public.admin_remove_mark(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_suspend_account(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_resolve_report(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_remove_mark(uuid, uuid, text) to authenticated;
grant execute on function public.admin_suspend_account(uuid, uuid, text) to authenticated;
grant execute on function public.admin_resolve_report(uuid, uuid, text, text) to authenticated;
