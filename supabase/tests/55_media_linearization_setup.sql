\set ON_ERROR_STOP on
begin;
truncate table media_upload_cleanup_requirements, media_object_deletions, mark_media,
  mark_creation_requests, media_uploads, media_quota_daily restart identity cascade;
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('photo',true,true,true,true,'C1 physical linearization setup');

insert into media_quota_daily(user_tombstone_id,quota_day,reserved_bytes,ingested_bytes,reservation_count,open_sessions)
values('11111111-1111-1111-1111-111111111111',current_date,9000,4000,9,5);
create table if not exists media55_results(scenario text primary key,value text not null);
truncate table media55_results;
grant select,insert on media55_results to authenticated;

-- Two initiated staging fixtures, two transition fixtures, two processing
-- fixtures, two creation fixtures, and one expiry/evidence fixture.
insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,actual_input_bytes,expires_at,quota_day,
 reserved_charge,quota_session_released_at,detected_mime,validated_bytes,sha256,width,height,
 validated_path,cache_control_seconds,validated_at)
values
 ('55000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','55000000-0000-0000-0000-000000000101','staging/11111111-1111-1111-1111-111111111111/55000000-0000-0000-0000-000000000001/source','initiated','open','image/jpeg',1000,null,now()+interval '1 hour',current_date,1000,null,null,null,null,null,null,null,null,null),
 ('55000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','55000000-0000-0000-0000-000000000102','staging/11111111-1111-1111-1111-111111111111/55000000-0000-0000-0000-000000000002/source','initiated','open','image/jpeg',1000,null,now()+interval '1 hour',current_date,1000,null,null,null,null,null,null,null,null,null),
 ('55000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','55000000-0000-0000-0000-000000000103','staging/11111111-1111-1111-1111-111111111111/55000000-0000-0000-0000-000000000003/source','initiated','open','image/jpeg',1000,null,now()+interval '1 hour',current_date,1000,null,null,null,null,null,null,null,null,null),
 ('55000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','55000000-0000-0000-0000-000000000104','staging/11111111-1111-1111-1111-111111111111/55000000-0000-0000-0000-000000000004/source','initiated','open','image/jpeg',1000,null,now()+interval '1 hour',current_date,1000,null,null,null,null,null,null,null,null,null),
 ('55000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','55000000-0000-0000-0000-000000000105','staging/11111111-1111-1111-1111-111111111111/55000000-0000-0000-0000-000000000005/source','uploaded','closed','image/jpeg',1000,1000,now()+interval '1 hour',current_date,1000,now(),null,null,null,null,null,null,null,null),
 ('55000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','55000000-0000-0000-0000-000000000106','staging/11111111-1111-1111-1111-111111111111/55000000-0000-0000-0000-000000000006/source','uploaded','closed','image/jpeg',1000,1000,now()+interval '1 hour',current_date,1000,now(),null,null,null,null,null,null,null,null),
 ('55000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','55000000-0000-0000-0000-000000000107','staging/11111111-1111-1111-1111-111111111111/55000000-0000-0000-0000-000000000007/source','validated','closed','image/jpeg',1000,1000,now()+interval '1 hour',current_date,1000,now(),'image/jpeg',900,repeat('7',64),100,80,'validated/55000000-0000-0000-0000-000000000007/55000000-0000-0000-0000-000000000207/full.jpg',60,now()),
 ('55000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','55000000-0000-0000-0000-000000000108','staging/11111111-1111-1111-1111-111111111111/55000000-0000-0000-0000-000000000008/source','validated','closed','image/jpeg',1000,1000,now()+interval '1 hour',current_date,1000,now(),'image/jpeg',900,repeat('8',64),100,80,'validated/55000000-0000-0000-0000-000000000008/55000000-0000-0000-0000-000000000208/full.jpg',60,now()),
 ('55000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','55000000-0000-0000-0000-000000000109','staging/11111111-1111-1111-1111-111111111111/55000000-0000-0000-0000-000000000009/source','initiated','open','image/jpeg',1000,null,now()-interval '1 second',current_date,1000,null,null,null,null,null,null,null,null,null);

-- Transition tests are non-vacuous: both exact source objects really exist.
insert into storage.objects(bucket_id,name,owner_id,metadata) values
 ('mark-media','staging/11111111-1111-1111-1111-111111111111/55000000-0000-0000-0000-000000000003/source','11111111-1111-1111-1111-111111111111'::text,'{"size":1000}'),
 ('mark-media','staging/11111111-1111-1111-1111-111111111111/55000000-0000-0000-0000-000000000004/source','11111111-1111-1111-1111-111111111111'::text,'{"size":1000}');
commit;
