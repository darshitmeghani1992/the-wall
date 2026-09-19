-- 0031 pre-application rollback.
--
-- Safe only while no account-deletion requests exist. Once a request has been
-- accepted, preserve lifecycle state and ship a forward fix instead of dropping
-- the request table or weakening recovery semantics.
\set ON_ERROR_STOP on

do $$ begin
  if exists(select 1 from public.account_deletion_requests) then
    raise exception 'ROLLBACK_REQUIRES_EMPTY_ACCOUNT_DELETION_REQUESTS';
  end if;
end $$;

drop function if exists public.prepare_account_deletion_for_purge(uuid,timestamptz);
drop function if exists public.list_due_account_deletions(integer);
drop function if exists public.get_my_account_deletion();
drop function if exists public.request_account_deletion(uuid,text);
drop table if exists public.account_deletion_requests;

-- Restore the actor-bound reactivation contract from migration 0029.
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
       set account_status = 'active', deactivated_at = null
     where id = v_actor;
  elsif v_account_status <> 'active' then
    raise exception 'ACCOUNT_ACTION_NOT_ALLOWED' using errcode = '42501';
  end if;
end
$$;

revoke all on function public.reactivate_account(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.reactivate_account(uuid) to authenticated;

-- Restore the exact pre-0031 avatar policies from migrations 0018/0020.
drop policy if exists "attachments insert avatars only" on storage.objects;
create policy "attachments insert avatars only"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "attachments modify own nonmark" on storage.objects;
create policy "attachments modify own nonmark"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'attachments'
    and owner = auth.uid()
    and coalesce((storage.foldername(name))[1], '') <> 'marks'
  )
  with check (
    bucket_id = 'attachments'
    and owner = auth.uid()
    and coalesce((storage.foldername(name))[1], '') <> 'marks'
  );
