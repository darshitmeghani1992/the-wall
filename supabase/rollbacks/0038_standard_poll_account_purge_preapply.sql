-- PRE-APPLY rollback ONLY for draft 0038.
-- Stop/disable the account-deletion worker before removing this function.
-- This removes a draft RPC; it cannot undo any actual Poll/account erasure.
begin;
revoke all on function public.prepare_account_deletion_for_purge_with_polls(uuid,timestamptz)
  from public,anon,authenticated,service_role;
drop function if exists public.prepare_account_deletion_for_purge_with_polls(uuid,timestamptz);
commit;
