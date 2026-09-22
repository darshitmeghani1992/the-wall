-- ============================================================================
-- 0029 · Actor-bound account reactivation
--
-- The expected actor observed by the client is checked against auth.uid()
-- inside the same transaction as the profile lock and state transition. This
-- closes the delayed A -> B session-switch window left by the legacy no-arg RPC.
--
-- Rollback (only after deployed clients stop using the uuid signature): revoke
-- and drop reactivate_account(uuid), then grant the legacy no-arg function to
-- authenticated. Completed reactivations remain valid; no data rollback is due.
-- ============================================================================

-- Retain the old function for catalog compatibility, but remove every API role.
revoke all on function public.reactivate_account()
  from public, anon, authenticated, service_role;

create or replace function public.reactivate_account(p_expected_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_account_status text;
begin
  if v_actor is null or p_expected_actor_id is distinct from v_actor then
    raise exception 'ACTOR_MISMATCH' using errcode = '42501';
  end if;

  select p.account_status
    into v_account_status
    from public.profiles p
   where p.id = v_actor
   for update;

  if not found or v_account_status = 'suspended' then
    raise exception 'ACCOUNT_ACTION_NOT_ALLOWED' using errcode = '42501';
  end if;

  if v_account_status = 'deactivated' then
    update public.profiles
       set account_status = 'active',
           deactivated_at = null
     where id = v_actor;
  elsif v_account_status <> 'active' then
    raise exception 'ACCOUNT_ACTION_NOT_ALLOWED' using errcode = '42501';
  end if;
end
$$;

revoke all on function public.reactivate_account(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.reactivate_account(uuid) to authenticated;
