-- 0038 · Atomic standard Poll erasure at approved account purge (DRAFT ONLY).
-- Must follow unhosted 0035/0036 and the reviewed 0031 account deletion lifecycle.
-- NEVER apply to hosted without separate Founder/Reviewer/QA authorization.
begin;

-- Do not replace or weaken 0031's due-deadline, ownership, avatar and
-- account-status checks. Calling it inside this *same database transaction*
-- ensures legacy Mark cleanup and private Poll erasure commit/rollback together.
-- The Edge worker must call ONLY this stronger wrapper after it is installed.
create function public.prepare_account_deletion_for_purge_with_polls(
  p_user_id uuid,
  p_expected_requested_at timestamptz
) returns boolean language plpgsql security definer
set search_path = pg_catalog, public, auth, storage
as $$
begin
  -- Service-owned 0031 takes the profile then deletion-request locks, rejects
  -- recovery/changed request/deadline/late Shared-Wall ownership/avatars, and
  -- removes normal and Anonymous authored Marks before returning true.
  if not public.prepare_account_deletion_for_purge(
    p_user_id, p_expected_requested_at
  ) then
    return false;
  end if;

  -- The header delete cascades choices, including ballots on already-closed
  -- polls. Aggregate counts are computed on live ballot rows, not snapshots.
  delete from public.mark_poll_ballots
    where voter_id = p_user_id;

  -- Authored private Polls are not in public.marks. Remove them before Auth
  -- Admin deletion just as 0031 removes ordinary/Anonymous authored Marks;
  -- options, remaining ballots, receipts and typed Poll reports cascade.
  delete from public.mark_polls
    where author_id = p_user_id;

  -- Remove this account's own idempotency receipts before Auth Admin deletion.
  -- Their Auth FKs also cascade as a final safety net on identity removal.
  delete from public.mark_poll_creation_requests
    where actor_id = p_user_id;
  delete from public.mark_poll_mutation_requests
    where actor_id = p_user_id;

  return true;
end
$$;

revoke all on function public.prepare_account_deletion_for_purge_with_polls(uuid,timestamptz)
  from public,anon,authenticated,service_role;
grant execute on function public.prepare_account_deletion_for_purge_with_polls(uuid,timestamptz)
  to service_role;
commit;
