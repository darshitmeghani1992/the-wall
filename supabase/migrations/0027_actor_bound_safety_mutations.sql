-- ============================================================================
-- 0027 · Actor-bound safety mutations
--
-- The caller supplies the actor identity observed by the client. Each RPC
-- compares it with the request token's auth.uid() inside the same database
-- transaction as the mutation, closing the account-switch TOCTOU window.
--
-- Lock order for owner Mark removal is canonical: marks row -> actor profile.
-- The a0 trigger sorts before marks_moderation, so the active-account check is
-- serialized before quota/stamping logic without weakening that existing guard.
--
-- Rollback (after the client no longer depends on these signatures): revoke and
-- drop remove_mark(uuid,uuid,text); drop a0_marks_removal_actor_state and its
-- guard function; drop deactivate_account(uuid); then grant the legacy no-arg
-- deactivate_account() to authenticated only. Do not change stored account/Mark
-- state: completed mutations remain valid and no data rollback is required.
-- ============================================================================

-- Retire the parameterless API. Keeping the function is migration-safe for
-- catalog dependants, but no API role can execute it after this cutover.
revoke all on function public.deactivate_account()
  from public, anon, authenticated, service_role;

create or replace function public.deactivate_account(p_expected_actor_id uuid)
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

  if v_account_status = 'active' then
    update public.profiles
       set account_status = 'deactivated',
           deactivated_at = clock_timestamp()
     where id = v_actor;
  elsif v_account_status <> 'deactivated' then
    raise exception 'ACCOUNT_ACTION_NOT_ALLOWED' using errcode = '42501';
  end if;
end
$$;

revoke all on function public.deactivate_account(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.deactivate_account(uuid) to authenticated;

create or replace function public.guard_mark_removal_actor_state()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_account_status text;
begin
  if new.status = 'removed'
     and old.status is distinct from 'removed'
     and v_actor is not null
     and exists (
       select 1
         from public.walls w
        where w.id = old.wall_id
          and w.owner_id = v_actor
     ) then
    select p.account_status
      into v_account_status
      from public.profiles p
     where p.id = v_actor
     for update;

    if not found or v_account_status <> 'active' then
      raise exception 'ACTOR_NOT_ACTIVE' using errcode = '42501';
    end if;
  end if;

  return new;
end
$$;

revoke all on function public.guard_mark_removal_actor_state()
  from public, anon, authenticated, service_role;

drop trigger if exists a0_marks_removal_actor_state on public.marks;
create trigger a0_marks_removal_actor_state
before update on public.marks
for each row execute function public.guard_mark_removal_actor_state();

create or replace function public.remove_mark(
  p_expected_actor_id uuid,
  p_mark_id uuid,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_rows integer;
begin
  if v_actor is null or p_expected_actor_id is distinct from v_actor then
    raise exception 'ACTOR_MISMATCH' using errcode = '42501';
  end if;

  if p_reason is null or p_reason not in ('normal', 'safety') then
    raise exception 'MARK_REMOVAL_REASON' using errcode = '22023';
  end if;

  update public.marks m
     set status = 'removed',
         removal_reason = p_reason
   where m.id = p_mark_id
     and exists (
       select 1
         from public.walls w
        where w.id = m.wall_id
          and w.owner_id = v_actor
     );

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'MARK_ACTION_NOT_ALLOWED' using errcode = '42501';
  end if;
end
$$;

revoke all on function public.remove_mark(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.remove_mark(uuid, uuid, text) to authenticated;
