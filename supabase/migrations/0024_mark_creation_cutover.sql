-- 0024_mark_creation_cutover.sql
-- Final canonical Mark-creation cutover (FP-MEDIA-001 / ADR-012 C7).
--
-- This migration intentionally aborts unless legacy reconciliation is fully
-- evidenced. Rollback is a reviewed additive forward migration; private media
-- is never republished and the direct compatibility writer is never restored.

begin;

do $$
declare v_gate media_legacy_reconciliation%rowtype;
begin
  select * into v_gate from media_legacy_reconciliation where singleton for update;
  if not found or v_gate.state<>'complete' or v_gate.completed_at is null
     or v_gate.inventory_count<>v_gate.migrated_count+v_gate.quarantined_count+v_gate.missing_count
     or v_gate.remaining_legacy_url_count<>0
     or v_gate.public_deletion_count<>v_gate.inventory_count
     or v_gate.fresh_denial_proof_count<>v_gate.inventory_count then
    raise exception 'MEDIA_LEGACY_RECONCILIATION_INCOMPLETE' using errcode='55000';
  end if;
end $$;

-- The SECURITY DEFINER RPC is now the sole runtime creator. Existing update
-- and delete policies remain available for their separately approved actions.
drop policy if exists "marks insert contributor" on marks;
drop policy if exists "marks insert text compatibility" on marks;
revoke insert on table marks from public,anon,authenticated,service_role;

-- Defense in depth for privileged maintenance: no newly inserted canonical
-- Mark may put content or permanent URLs back into retired legacy fields.
create or replace function marks_compat_insert_guard()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if new.media_url is not null or new.payload is not null then
    raise exception 'MARK_LEGACY_MEDIA_FIELDS_FORBIDDEN' using errcode='23514';
  end if;
  return new;
end $$;

-- Reassert the private writer surface after the cutover. Table/Storage workflow
-- objects remain unavailable to app roles; only actor-bound RPCs are granted.
revoke all on table mark_media,media_uploads,mark_creation_requests,
  media_quota_daily,media_upload_cleanup_requirements,media_object_deletions,
  media_object_deletion_attempts,media_validation_callback_receipts,media_envelope_keys
  from public,anon,authenticated;

revoke all on function begin_media_upload(uuid,mark_type,uuid,text,bigint) from public,anon,authenticated;
revoke all on function mark_media_uploaded(uuid) from public,anon,authenticated;
revoke all on function get_media_upload_status(uuid[]) from public,anon,authenticated;
revoke all on function cancel_media_upload(uuid) from public,anon,authenticated;
revoke all on function create_mark(uuid,uuid,mark_type,text,text,boolean,boolean,real,uuid[])
  from public,anon,authenticated;

grant execute on function begin_media_upload(uuid,mark_type,uuid,text,bigint) to authenticated;
grant execute on function mark_media_uploaded(uuid) to authenticated;
grant execute on function get_media_upload_status(uuid[]) to authenticated;
grant execute on function cancel_media_upload(uuid) to authenticated;
grant execute on function create_mark(uuid,uuid,mark_type,text,text,boolean,boolean,real,uuid[])
  to authenticated;

-- Required by the private Storage INSERT policy; it is policy-only and exposes
-- a boolean for the caller's exact path, never another actor or workflow row.
revoke all on function current_user_can_upload_mark_media_path(text) from public,anon,authenticated;
grant execute on function current_user_can_upload_mark_media_path(text) to authenticated;

commit;
