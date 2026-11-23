-- 0037 · Standard Poll reporting and administrative removal (draft only).
-- Requires reviewed 0035 + 0036. Never apply to hosted staging without gates.
begin;

alter table public.reports
  add column reported_poll_id uuid references public.mark_polls(mark_id) on delete cascade;

-- Exactly one content/user/Wall/Poll target; retain existing reason/status checks.
alter table public.reports drop constraint reports_one_target;
alter table public.reports add constraint reports_one_target
  check (num_nonnulls(mark_id, reported_user_id, reported_wall_id, reported_poll_id) = 1);

-- Owner-executed helper is necessary: ordinary clients have no direct SELECT
-- grant on private mark_polls. Bind the supplied actor to auth.uid() so this
-- helper cannot serve as an arbitrary-user Poll existence oracle.
create function public.can_report_poll(p_mark_id uuid, p_actor_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $poll_report$
  select p_actor_id is not null and p_actor_id = auth.uid()
    and public.is_active_account(p_actor_id)
    and exists (
      select 1 from public.mark_polls p
      where p.mark_id = p_mark_id and p.status = 'active'
        and public.can_view_wall(p.wall_id, p_actor_id)
    )
$poll_report$;
revoke all on function public.can_report_poll(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.can_report_poll(uuid,uuid) to authenticated;

-- Preserve ordinary reporting; Poll reporters must be active and authorized
-- to view the target Wall. A report cannot grant access to its Poll.
drop policy if exists "reports insert self" on public.reports;
create policy "reports insert self" on public.reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and (reported_poll_id is null or
      public.can_report_poll(reported_poll_id, auth.uid()))
  );

alter table public.moderation_actions
  add column target_poll_id uuid references public.mark_polls(mark_id) on delete set null;
alter table public.moderation_actions
  drop constraint moderation_actions_action_check;
alter table public.moderation_actions
  add constraint moderation_actions_action_check
  check (action in ('remove_mark','remove_poll','suspend_account','resolve_report','dismiss_report'));

-- A separate RPC prevents a Poll UUID from being treated as an ordinary Mark.
-- The action and audit receipt are atomic. Missing targets never create receipts.
create function public.admin_remove_poll(
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
  if v_actor is null or p_expected_actor_id is distinct from v_actor
    or not public.is_admin(v_actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_mark_id is null or p_reason is null or btrim(p_reason) = ''
    or length(p_reason) > 500 then
    raise exception 'MODERATION_REASON_INVALID' using errcode = '22023';
  end if;
  select p.status into v_status
    from public.mark_polls p where p.mark_id = p_mark_id for update;
  if not found then
    raise exception 'MODERATION_ACTION_NOT_ALLOWED' using errcode = '42501';
  end if;
  if v_status = 'removed' then return; end if;
  if v_status <> 'active' then
    raise exception 'MODERATION_ACTION_NOT_ALLOWED' using errcode = '42501';
  end if;
  update public.mark_polls set status = 'removed'
    where mark_id = p_mark_id;
  insert into public.moderation_actions(actor_id, action, target_poll_id, reason)
    values (v_actor, 'remove_poll', p_mark_id, btrim(p_reason));
end
$$;

revoke all on function public.admin_remove_poll(uuid,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.admin_remove_poll(uuid,uuid,text) to authenticated;

commit;
