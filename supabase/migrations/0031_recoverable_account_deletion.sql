-- ============================================================================
-- 0031 · Recoverable permanent account deletion (PRD/FP-ACL-002, ADR-016)
--
-- Permanent deletion is deliberately separate from reversible deactivation.
-- The authenticated request is actor-bound, blocked by owned Shared Walls, and
-- receives one immutable server-owned 30-day deadline. Reactivation cancels the
-- request in the same transaction. Finalization is service-only and refuses to
-- run until public avatar objects have been removed through the Storage API.
--
-- This migration does not configure a hosted scheduler or apply itself.
-- ============================================================================

create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null,
  purge_after timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  check (purge_after = requested_at + interval '30 days')
);

alter table public.account_deletion_requests enable row level security;
revoke all on table public.account_deletion_requests
  from public, anon, authenticated, service_role;

-- A deactivated bearer token must not be able to create or replace avatar
-- objects indefinitely and thereby race/delay the final cleanup worker.
drop policy if exists "attachments insert avatars only" on storage.objects;
create policy "attachments insert avatars only"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.current_user_is_active_account()
  );

drop policy if exists "attachments modify own nonmark" on storage.objects;
create policy "attachments modify own nonmark"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'attachments'
    and owner = auth.uid()
    and coalesce((storage.foldername(name))[1], '') <> 'marks'
    and public.current_user_is_active_account()
  )
  with check (
    bucket_id = 'attachments'
    and owner = auth.uid()
    and coalesce((storage.foldername(name))[1], '') <> 'marks'
    and public.current_user_is_active_account()
  );

create or replace function public.request_account_deletion(
  p_expected_actor_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_account_status text;
  v_existing public.account_deletion_requests%rowtype;
  v_requested_at timestamptz;
  v_owned_shared_wall_count integer;
begin
  -- Identity checks precede confirmation/profile/ownership checks so an invalid
  -- caller cannot use response differences to inspect another account.
  if v_actor is null or p_expected_actor_id is distinct from v_actor then
    raise exception 'ACTOR_MISMATCH' using errcode = '42501';
  end if;

  if p_confirmation is distinct from 'DELETE' then
    return jsonb_build_object('status', 'invalid_confirmation');
  end if;

  select p.account_status
    into v_account_status
    from public.profiles p
   where p.id = v_actor
   for update;

  if not found or v_account_status = 'suspended' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select *
    into v_existing
    from public.account_deletion_requests r
   where r.user_id = v_actor
   for update;

  if found then
    return jsonb_build_object(
      'status', 'scheduled',
      'requested_at', v_existing.requested_at,
      'purge_after', v_existing.purge_after
    );
  end if;

  if v_account_status <> 'active' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select count(*)::integer
    into v_owned_shared_wall_count
    from public.walls w
   where w.owner_id = v_actor
     and w.type = 'shared';

  if v_owned_shared_wall_count > 0 then
    return jsonb_build_object(
      'status', 'owner_action_required',
      'owned_shared_wall_count', v_owned_shared_wall_count
    );
  end if;

  v_requested_at := clock_timestamp();
  insert into public.account_deletion_requests(user_id, requested_at, purge_after)
  values (v_actor, v_requested_at, v_requested_at + interval '30 days');

  update public.profiles
     set account_status = 'deactivated',
         deactivated_at = v_requested_at
   where id = v_actor;

  return jsonb_build_object(
    'status', 'scheduled',
    'requested_at', v_requested_at,
    'purge_after', v_requested_at + interval '30 days'
  );
end
$$;

revoke all on function public.request_account_deletion(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.request_account_deletion(uuid, text)
  to authenticated;

create or replace function public.get_my_account_deletion()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.account_deletion_requests%rowtype;
begin
  if v_actor is null then
    raise exception 'ACCOUNT_ACTION_NOT_ALLOWED' using errcode = '42501';
  end if;

  select *
    into v_request
    from public.account_deletion_requests r
   where r.user_id = v_actor;

  if not found then
    return jsonb_build_object('status', 'none');
  end if;

  return jsonb_build_object(
    'status', 'scheduled',
    'requested_at', v_request.requested_at,
    'purge_after', v_request.purge_after
  );
end
$$;

revoke all on function public.get_my_account_deletion()
  from public, anon, authenticated, service_role;
grant execute on function public.get_my_account_deletion()
  to authenticated;

-- A hosted operations worker discovers bounded due work through this RPC. It
-- receives only immutable identifiers/timestamps; duplicate workers are safe
-- because Storage removal is idempotent and purge preparation locks/rechecks state.
create or replace function public.list_due_account_deletions(p_limit integer)
returns table(user_id uuid, requested_at timestamptz, purge_after timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_limit is null or p_limit not between 1 and 50 then
    return;
  end if;

  return query
    select r.user_id, r.requested_at, r.purge_after
      from public.account_deletion_requests r
      join public.profiles p on p.id = r.user_id
     where r.purge_after <= clock_timestamp()
       and p.account_status = 'deactivated'
       and not exists (
         select 1 from public.walls w
          where w.owner_id = r.user_id and w.type = 'shared'
       )
     order by r.purge_after, r.user_id
     limit p_limit;
end
$$;

revoke all on function public.list_due_account_deletions(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.list_due_account_deletions(integer)
  to service_role;

-- Recovery cancels a pending deletion and restores the account in one locked
-- transaction. Active retries also clear an impossible/stale request safely.
create or replace function public.reactivate_account(p_expected_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_account_status text;
  v_purge_after timestamptz;
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

  select r.purge_after
    into v_purge_after
    from public.account_deletion_requests r
   where r.user_id = v_actor
   for update;

  if found and v_purge_after <= clock_timestamp() then
    raise exception 'ACCOUNT_DELETION_EXPIRED' using errcode = '42501';
  end if;

  if v_account_status = 'deactivated' then
    delete from public.account_deletion_requests where user_id = v_actor;
    update public.profiles
       set account_status = 'active',
           deactivated_at = null
     where id = v_actor;
  elsif v_account_status = 'active' then
    delete from public.account_deletion_requests where user_id = v_actor;
  else
    raise exception 'ACCOUNT_ACTION_NOT_ALLOWED' using errcode = '42501';
  end if;
end
$$;

revoke all on function public.reactivate_account(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.reactivate_account(uuid) to authenticated;

-- Called only after a privileged operations worker has removed every public
-- avatar under attachments/avatars/<user-id>/ through the Storage API. Direct
-- SQL deletion of storage.objects is intentionally forbidden because it would
-- orphan the underlying object.
create or replace function public.prepare_account_deletion_for_purge(
  p_user_id uuid,
  p_expected_requested_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, storage, auth
as $$
declare
  v_request public.account_deletion_requests%rowtype;
  v_account_status text;
begin
  -- Profile -> request matches the lifecycle mutation lock order and avoids a
  -- purge-preparation/recovery deadlock at the deadline boundary.
  select p.account_status
    into v_account_status
    from public.profiles p
   where p.id = p_user_id
   for update;

  if not found or v_account_status <> 'deactivated' then
    return false;
  end if;

  select *
    into v_request
    from public.account_deletion_requests r
   where r.user_id = p_user_id
   for update;

  if not found
     or v_request.requested_at is distinct from p_expected_requested_at
     or v_request.purge_after > clock_timestamp() then
    return false;
  end if;

  -- A late ownership change must never turn auth deletion into a Shared-Wall
  -- cascade. The operator can retry only after ownership is resolved.
  if exists (
    select 1 from public.walls w
     where w.owner_id = p_user_id and w.type = 'shared'
  ) then
    return false;
  end if;

  if exists (
    select 1
      from storage.objects o
     where o.bucket_id = 'attachments'
       and (o.name = 'avatars/' || p_user_id::text
         or o.name like 'avatars/' || p_user_id::text || '/%')
  ) then
    return false;
  end if;

  -- This explicit delete is required because marks.author_id otherwise uses
  -- ON DELETE SET NULL. Cascading mark_media deletes enqueue exact-path cleanup.
  delete from public.marks where author_id = p_user_id;

  -- Historical moderation receipts survive without retaining the deleted
  -- identity. This FK predates the explicit ON DELETE behavior used elsewhere.
  update public.reports set resolved_by = null where resolved_by = p_user_id;
  delete from public.wall_ownership_transfer_authorizations
   where old_owner_id = p_user_id or new_owner_id = p_user_id;

  -- The hosted worker performs the final identity removal with Supabase Auth's
  -- server-only Admin API after this transaction commits. A retry is safe: the
  -- cleanup above is idempotent and the request remains until auth deletion
  -- cascades it.
  return true;
end
$$;

revoke all on function public.prepare_account_deletion_for_purge(uuid, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.prepare_account_deletion_for_purge(uuid, timestamptz)
  to service_role;
