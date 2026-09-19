\set ON_ERROR_STOP on

do $$ begin
  if (select result->>'status' from media59_race_results where scenario='create_first')<>'created'
     or (select result->>'status' from media59_race_results where scenario='cancel_after_create')<>'unavailable'
     or not exists(select 1 from media_uploads
       where id='59100000-0000-4000-8000-000000000001' and state='consumed' and cancel_requested_at is null) then
    raise exception '59 RACE FAIL: create-first did not protect consumed canonical media';
  end if;
  if (select result->>'status' from media59_race_results where scenario='cancel_first')<>'cancelled'
     or (select result->>'status' from media59_race_results where scenario='create_after_cancel')<>'media_not_ready'
     or not exists(select 1 from media_uploads
       where id='59100000-0000-4000-8000-000000000002' and state='expired' and cancelled_at is not null)
     or exists(select 1 from mark_media where upload_id='59100000-0000-4000-8000-000000000002') then
    raise exception '59 RACE FAIL: cancel-first did not close creation';
  end if;
  if (select result->>'status' from media59_race_results where scenario='cancel_processing')<>'cancelling'
     or (select result->>'accepted' from media59_race_results where scenario='finalize_after_cancel')<>'true'
     or not exists(select 1 from media_uploads
       where id='59100000-0000-4000-8000-000000000003' and state='expired' and cancelled_at is not null)
     or not exists(select 1 from media_validation_callback_receipts
       where upload_id='59100000-0000-4000-8000-000000000003')
     or exists(select 1 from media_uploads
       where id='59100000-0000-4000-8000-000000000003' and state='validated')
     or exists(select 1 from media_object_deletions d
       join media_uploads u on u.id='59100000-0000-4000-8000-000000000003'
       where d.idempotency_key like 'upload_cancelled:59100000-0000-4000-8000-000000000003:%'
         and d.object_path like 'validated/%'
         and d.not_before<u.output_credentials_expire_at) then
    raise exception '59 RACE FAIL: cancelled live worker published validation';
  end if;
  if (select result->>'accepted' from media59_race_results where scenario='finalize_first')<>'true'
     or (select result->>'status' from media59_race_results where scenario='cancel_after_finalize')<>'cancelled'
     or not exists(select 1 from media_uploads
       where id='59100000-0000-4000-8000-000000000004' and state='expired' and cancelled_at is not null)
     or exists(select 1 from mark_media where upload_id='59100000-0000-4000-8000-000000000004') then
    raise exception '59 RACE FAIL: finalize-first cancellation boundary';
  end if;
  if not exists(select 1 from media_object_deletions d
      join media_upload_cleanup_requirements r on r.deletion_id=d.id
      join media_uploads u on u.id=r.upload_id
      where r.upload_id='59100000-0000-4000-8000-000000000004'
        and d.idempotency_key='upload_cancelled:59100000-0000-4000-8000-000000000004:canonical'
        and d.object_path=u.validated_path and d.not_before>=u.output_credentials_expire_at)
     or not exists(select 1 from media_object_deletions d
      join media_upload_cleanup_requirements r on r.deletion_id=d.id
      join media_uploads u on u.id=r.upload_id
      where r.upload_id='59100000-0000-4000-8000-000000000004'
        and d.idempotency_key='upload_cancelled:59100000-0000-4000-8000-000000000004:source'
        and d.object_path=u.source_path and d.not_before>=u.expires_at) then
    raise exception '59 RACE FAIL: finalize-first exact cleanup fence';
  end if;
end $$;

drop table media59_worker_claim;
drop table media59_race_results;
drop function media59_wait_latch(text);
drop table media59_race_latches;
delete from media_validation_callback_receipts where upload_id::text like '59100000-%';
delete from media_upload_cleanup_requirements where upload_id in (
  '59100000-0000-4000-8000-000000000002','59100000-0000-4000-8000-000000000003',
  '59100000-0000-4000-8000-000000000004');
delete from mark_media where upload_id::text like '59100000-%';
delete from mark_creation_requests where request_id::text like '59100000-%';
delete from marks where text in ('race create first','race create after cancel');
delete from media_object_deletion_attempts where deletion_id in (
  select id from media_object_deletions
   where idempotency_key like 'upload_cancelled:59100000-%');
delete from media_object_deletions
 where idempotency_key like 'upload_cancelled:59100000-%';
delete from media_uploads where id::text like '59100000-%';
delete from media_envelope_keys where kid='writer-race-key';
delete from media_quota_daily
 where user_tombstone_id='11111111-1111-1111-1111-111111111111' and quota_day=current_date;
select set_media_kind_control('photo',false,false,false,false,'59 writer race cleanup');
do $$ begin
  if exists(select 1 from media_kind_controls
      where reservation_enabled or upload_transition_enabled or processing_enabled or creation_enabled) then
    raise exception '59 RACE FAIL: fixture left a media kind enabled';
  end if;
end $$;

select '59_media_writer_races' as passed;
