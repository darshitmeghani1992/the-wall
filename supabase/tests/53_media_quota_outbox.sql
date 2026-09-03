-- 53 · Atomic quota/session accounting and durable exact-path deletion outbox.
\set ON_ERROR_STOP on

BEGIN;
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('photo',true,true,false,false,'C1 quota tests');
insert into media_quota_daily(user_tombstone_id,quota_day,reserved_bytes,ingested_bytes,reservation_count,open_sessions)
values('11111111-1111-1111-1111-111111111111',current_date,524287950,0,0,0);
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare r jsonb; begin
  r:=begin_media_upload('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo',
    '53000000-0000-0000-0000-000000000001','image/jpeg',100);
  if r->>'status'<>'rate_limited' then raise exception '53 FAIL: declared-byte quota crossed %',r; end if;
end $$;
reset role;
do $$ begin
  if (select reserved_bytes from media_quota_daily where user_tombstone_id='11111111-1111-1111-1111-111111111111'
      and quota_day=current_date)<>524287950 then raise exception '53 FAIL: rejected reservation charged quota'; end if;
end $$;
ROLLBACK;
\echo '53 (reservation byte ceiling)      : PASS'

BEGIN;
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('photo',true,true,false,false,'C1 actual-byte tests');
insert into media_quota_daily(user_tombstone_id,quota_day,reserved_bytes,ingested_bytes,reservation_count,open_sessions)
values('11111111-1111-1111-1111-111111111111',current_date,0,524287950,0,0);
create temp table media53(upload_id uuid,path text) on commit drop;
grant insert,select on media53 to authenticated;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare r jsonb; begin
  r:=begin_media_upload('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo',
    '53000000-0000-0000-0000-000000000010','image/jpeg',100);
  if r->>'status'<>'ready' then raise exception '53 FAIL: preflight reservation denied %',r; end if;
  insert into media53 values((r->>'upload_id')::uuid,r->>'path');
  insert into storage.objects(bucket_id,name,metadata) values('mark-media',r->>'path','{"size":100}');
  r:=mark_media_uploaded((r->>'upload_id')::uuid);
  if r->>'status'<>'failed' or r->>'error_code'<>'TOO_LARGE' then
    raise exception '53 FAIL: actual-byte overage accepted %',r; end if;
end $$;
reset role;
do $$ declare uid uuid; p text; begin
  select upload_id,path into strict uid,p from media53;
  if (select ingested_bytes from media_quota_daily where user_tombstone_id='11111111-1111-1111-1111-111111111111'
      and quota_day=current_date)<>524288050 then raise exception '53 FAIL: abusive actual bytes not retained'; end if;
  if (select open_sessions from media_quota_daily where user_tombstone_id='11111111-1111-1111-1111-111111111111'
      and quota_day=current_date)<>1 then raise exception '53 FAIL: failed transition released session before evidence'; end if;
  if not exists(select 1 from media_object_deletions where object_path=p and reason='input_too_large') then
    raise exception '53 FAIL: over-limit source cleanup missing'; end if;
  if not exists(select 1 from media_upload_cleanup_requirements r join media_object_deletions d on d.id=r.deletion_id
      where r.upload_id=uid and d.object_path=p) then
    raise exception '53 FAIL: over-limit ledger cleanup was not evidence-bound'; end if;
end $$;
ROLLBACK;
\echo '53 (actual-byte reconciliation)    : PASS'

BEGIN;
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('voice',true,true,false,false,'C1 expiry tests');
create temp table expiry53(upload_id uuid,path text) on commit drop;
grant insert,select on expiry53 to authenticated;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare r jsonb; begin
  r:=begin_media_upload('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','voice',
    '53000000-0000-0000-0000-000000000020','audio/mp4',1000);
  if r->>'status'<>'ready' then raise exception '53 FAIL: voice reservation denied'; end if;
  insert into expiry53 values((r->>'upload_id')::uuid,r->>'path');
end $$;
reset role;
update media_uploads set expires_at=now()-interval '1 second' where id=(select upload_id from expiry53);
do $$ declare uid uuid; p text; deletion_id uuid; before_ingested bigint; evidence_fence timestamptz; begin
  select upload_id,path into strict uid,p from expiry53;
  if expire_media_uploads()<>1 then raise exception '53 FAIL: expiry count'; end if;
  if (select state from media_uploads where id=uid)<>'expired' then
    raise exception '53 FAIL: expiry state'; end if;
  if not exists(select 1 from media_object_deletions where object_path=p and reason='upload_expired') then
    raise exception '53 FAIL: expired source cleanup missing'; end if;
  -- Expiry queues exact cleanup, but none of the ledger fields may be released
  -- until a trusted worker records delete-or-missing evidence for that path.
  if (select reserved_bytes from media_quota_daily where user_tombstone_id='11111111-1111-1111-1111-111111111111'
      and quota_day=current_date)<>1000
     or (select reservation_count from media_quota_daily where user_tombstone_id='11111111-1111-1111-1111-111111111111'
      and quota_day=current_date)<>1
     or (select open_sessions from media_quota_daily where user_tombstone_id='11111111-1111-1111-1111-111111111111'
      and quota_day=current_date)<>1 then
    raise exception '53 FAIL: expiry released ledger before cleanup evidence'; end if;
  select id into strict deletion_id from media_object_deletions
   where object_path=p and reason='upload_expired';
  select not_before into strict evidence_fence from media_object_deletions where id=deletion_id;
  select ingested_bytes into strict before_ingested from media_quota_daily
   where user_tombstone_id='11111111-1111-1111-1111-111111111111' and quota_day=current_date;
  if record_media_object_deletion(deletion_id,
       jsonb_build_object('path',p,'outcome','missing','observed_at',(evidence_fence-interval '1 microsecond')::text),null)
     or record_media_object_deletion(deletion_id,
       jsonb_build_object('path',p,'outcome','missing','observed_at',(clock_timestamp()+interval '6 minutes')::text),null) then
    raise exception '53 FAIL: stale/future deletion evidence accepted';
  end if;
  if not record_media_object_deletion(deletion_id,
    jsonb_build_object('path',p,'outcome','missing','observed_at',clock_timestamp()::text),null) then
    raise exception '53 FAIL: deletion evidence rejected'; end if;
  if (select reserved_bytes from media_quota_daily where user_tombstone_id='11111111-1111-1111-1111-111111111111'
      and quota_day=current_date)<>0
     or (select reservation_count from media_quota_daily where user_tombstone_id='11111111-1111-1111-1111-111111111111'
      and quota_day=current_date)<>0
     or (select open_sessions from media_quota_daily where user_tombstone_id='11111111-1111-1111-1111-111111111111'
      and quota_day=current_date)<>0
     or (select ingested_bytes from media_quota_daily where user_tombstone_id='11111111-1111-1111-1111-111111111111'
      and quota_day=current_date)<>before_ingested then
    raise exception '53 FAIL: evidence-bound ledger reconciliation incorrect'; end if;
  -- Replay cannot release a second time.
  if not record_media_object_deletion(deletion_id,
    jsonb_build_object('path',p,'outcome','missing','observed_at',clock_timestamp()::text),null)
     or (select reservation_count from media_quota_daily where user_tombstone_id='11111111-1111-1111-1111-111111111111'
       and quota_day=current_date)<>0 then
    raise exception '53 FAIL: deletion-evidence replay was not idempotent'; end if;
end $$;
ROLLBACK;
\echo '53 (evidence-bound expiry release) : PASS'

BEGIN;
-- Hard Mark deletion must enqueue canonical and preview locators before the
-- cascading relation disappears; the evidence row has no deletable FK.
insert into marks(id,wall_id,author_id,type,text,status)
values('53000000-0000-0000-0000-000000000030','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 '11111111-1111-1111-1111-111111111111','photo',null,'active');
insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,detected_mime,validated_bytes,actual_input_bytes,sha256,
 width,height,validated_path,preview_path,cache_control_seconds,attempt_id,dispatch_nonce_hash,
 completion_nonce_hash,envelope_kid,dispatch_envelope_expires_at,output_credentials_expire_at,
 expires_at,validated_at,quota_day,reserved_charge)
values('53000000-0000-0000-0000-000000000031','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','53000000-0000-0000-0000-000000000032',
 'staging/11111111-1111-1111-1111-111111111111/53000000-0000-0000-0000-000000000031/source',
 'validated','closed','image/jpeg',1000,'image/jpeg',900,1000,repeat('d',64),100,80,
 'validated/53000000-0000-0000-0000-000000000031/53000000-0000-0000-0000-000000000033/full.jpg',
 'validated/53000000-0000-0000-0000-000000000031/53000000-0000-0000-0000-000000000033/thumb.webp',60,
 '53000000-0000-0000-0000-000000000033',repeat('e',64),repeat('f',64),'mark-delete-key',
 now()+interval '120 seconds',now()+interval '2 hours 30 seconds',
 now()+interval '1 hour',now(),current_date,1000);
insert into mark_media(mark_id,upload_id,media_type,"position",storage_path,preview_path,mime_type,byte_size,sha256,width,height)
select '53000000-0000-0000-0000-000000000030',id,kind,0,validated_path,preview_path,detected_mime,validated_bytes,sha256,width,height
 from media_uploads where id='53000000-0000-0000-0000-000000000031';
update media_uploads set state='consumed',consumed_mark_id='53000000-0000-0000-0000-000000000030',
 consumed_mark_tombstone_id='53000000-0000-0000-0000-000000000030',consumed_at=now()
where id='53000000-0000-0000-0000-000000000031';
delete from marks where id='53000000-0000-0000-0000-000000000030';
do $$ begin
  if exists(select 1 from mark_media where mark_id='53000000-0000-0000-0000-000000000030') then
    raise exception '53 FAIL: relation did not cascade'; end if;
  if not exists(select 1 from media_object_deletions where
      object_path='validated/53000000-0000-0000-0000-000000000031/53000000-0000-0000-0000-000000000033/full.jpg'
      and preview_path='validated/53000000-0000-0000-0000-000000000031/53000000-0000-0000-0000-000000000033/thumb.webp'
      and reason='mark_deleted'
      and not_before>=(select output_credentials_expire_at from media_uploads
        where id='53000000-0000-0000-0000-000000000031')) then
    raise exception '53 FAIL: exact canonical outbox/fence missing'; end if;
end $$;
ROLLBACK;
\echo '53 (hard-delete durable outbox)    : PASS'

BEGIN;
-- A subject can disappear after a worker has claimed and redeemed dispatch.
-- The FK transaction must terminalize the row, invalidate every credential,
-- durably queue every exact path, and fence "missing" evidence until the old
-- output lease is no longer usable.
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('photo',true,true,true,false,'C1 subject deletion fence');
insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,actual_input_bytes,expires_at,quota_day,
 reserved_charge,quota_session_released_at)
values('53000000-0000-0000-0000-000000000040','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','53000000-0000-0000-0000-000000000041',
 'staging/11111111-1111-1111-1111-111111111111/53000000-0000-0000-0000-000000000040/source',
 'uploaded','closed','image/jpeg',1000,1000,now()+interval '1 hour',current_date,1000,now());
insert into media_quota_daily(user_tombstone_id,quota_day,reserved_bytes,ingested_bytes,reservation_count,open_sessions)
values('11111111-1111-1111-1111-111111111111',current_date,1000,1000,1,0);
insert into storage.objects(bucket_id,name,owner_id,metadata)
values('mark-media','staging/11111111-1111-1111-1111-111111111111/53000000-0000-0000-0000-000000000040/source',
 '11111111-1111-1111-1111-111111111111'::text,'{"size":1000}');
do $$ declare claimed media_uploads%rowtype; source_delete uuid; jpg_delete uuid; webp_delete uuid;
  late_path text; thumb_path text; early jsonb; returned_at timestamptz; begin
  if not rotate_media_envelope_key(null,'media53-kid') then raise exception '53 FAIL: key setup'; end if;
  select * into strict claimed from claim_media_validation_jobs(1,'53000000-0000-0000-0000-000000000042');
  returned_at:=clock_timestamp();
  if not bind_media_validation_attempt_credentials(claimed.id,claimed.attempt_id,
      encode(extensions.digest('media53-dispatch','sha256'),'hex'),
      encode(extensions.digest('media53-completion','sha256'),'hex'),'media53-kid',
      returned_at+interval '120 seconds',returned_at,returned_at+interval '2 hours 30 seconds')
     or not redeem_media_validation_dispatch_nonce(claimed.id,claimed.attempt_id,'media53-dispatch','media53-kid') then
    raise exception '53 FAIL: claimed-attempt baseline failed';
  end if;

  update media_uploads set uploader_id=null where id=claimed.id;
  if not exists(select 1 from media_uploads where id=claimed.id and state='expired'
      and session_state='expired' and error_code='SUBJECT_DELETED' and uploader_id is null
      and attempt_id is null and lease_expires_at is null and dispatch_nonce_hash is null
      and completion_nonce_hash is null and envelope_kid is null) then
    raise exception '53 FAIL: subject deletion did not terminalize/invalidate claim';
  end if;
  if finalize_media_validation_attempt(claimed.id,claimed.attempt_id,'media53-completion','media53-kid','success',
       jsonb_build_object('detected_mime','image/jpeg','validated_bytes',900,'sha256',repeat('e',64),
         'width',100,'height',80,'duration_ms',null,'validated_path',claimed.validated_path||'.jpg',
         'preview_path',null,'cache_control_seconds',60))
     or exists(select 1 from claim_media_validation_jobs(1,'53000000-0000-0000-0000-000000000043')
       where id=claimed.id) then
    raise exception '53 FAIL: deleted-subject worker path remained live';
  end if;

  select d.id into strict source_delete from media_object_deletions d
    where d.object_path=claimed.source_path and d.reason='subject_deleted';
  select d.id into strict jpg_delete from media_object_deletions d
    where d.object_path=claimed.validated_path||'.jpg' and d.reason='subject_deleted';
  select d.id into strict webp_delete from media_object_deletions d
    where d.object_path=claimed.validated_path||'.webp' and d.reason='subject_deleted';
  if exists(select 1 from media_object_deletions d where d.id in (jpg_delete,webp_delete)
      and d.not_before<(select output_credentials_expire_at from media_uploads where id=claimed.id)) then
    raise exception '53 FAIL: subject-deleted output escaped credential fence'; end if;
  if record_media_object_deletion(jpg_delete,
       jsonb_build_object('path',claimed.validated_path||'.jpg','outcome','missing','observed_at',clock_timestamp()::text),
       jsonb_build_object('path','validated/'||claimed.id::text||'/'||claimed.attempt_id::text||'/thumb.webp',
         'outcome','missing','observed_at',clock_timestamp()::text)) then
    raise exception '53 FAIL: premature missing evidence crossed live-worker fence';
  end if;

  -- Simulate the already-dispatched worker's last permitted exact-path write.
  late_path:=claimed.validated_path||'.jpg';
  thumb_path:='validated/'||claimed.id::text||'/'||claimed.attempt_id::text||'/thumb.webp';
  insert into storage.objects(bucket_id,name,metadata) values('mark-media',late_path,'{"size":900}');
  if not exists(select 1 from storage.objects where bucket_id='mark-media' and name=late_path) then
    raise exception '53 FAIL: late-worker adversarial setup was vacuous';
  end if;

  -- Advance the durable fence as the cleanup worker would observe after the
  -- old signed credential/lease expires, then delete and prove exact paths.
  update media_object_deletions set not_before=clock_timestamp()-interval '1 second'
    where id in (source_delete,jpg_delete,webp_delete);
  delete from storage.objects where bucket_id='mark-media' and name in (claimed.source_path,late_path);
  if not record_media_object_deletion(source_delete,
       jsonb_build_object('path',claimed.source_path,'outcome','deleted','observed_at',clock_timestamp()::text),null)
     or not record_media_object_deletion(jpg_delete,
       jsonb_build_object('path',late_path,'outcome','deleted','observed_at',clock_timestamp()::text),
       jsonb_build_object('path',thumb_path,'outcome','missing','observed_at',clock_timestamp()::text))
     or not record_media_object_deletion(webp_delete,
       jsonb_build_object('path',claimed.validated_path||'.webp','outcome','missing','observed_at',clock_timestamp()::text),null) then
    raise exception '53 FAIL: post-fence exact cleanup evidence rejected';
  end if;
  if exists(select 1 from storage.objects where bucket_id='mark-media' and name in (claimed.source_path,late_path))
     or (select quota_reservation_released_at from media_uploads where id=claimed.id) is null then
    raise exception '53 FAIL: late path survived or quota release did not follow complete evidence';
  end if;
end $$;
ROLLBACK;
\echo '53 (claimed subject deletion fence): PASS'

BEGIN;
-- Expiry must revoke an already claimed and fully redeemed processing attempt,
-- then reject proof observed before the old destination credential's fence.
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('photo',true,true,true,false,'C1 processing expiry fence');
insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,actual_input_bytes,expires_at,quota_day,
 reserved_charge,quota_session_released_at)
values('53000000-0000-0000-0000-000000000050','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','53000000-0000-0000-0000-000000000051',
 'staging/11111111-1111-1111-1111-111111111111/53000000-0000-0000-0000-000000000050/source',
 'uploaded','closed','image/jpeg',1000,1000,now()+interval '1 hour',current_date,1000,now());
insert into media_quota_daily(user_tombstone_id,quota_day,reserved_bytes,ingested_bytes,reservation_count,open_sessions)
values('11111111-1111-1111-1111-111111111111',current_date,1000,1000,1,0);
insert into storage.objects(bucket_id,name,owner_id,metadata)
values('mark-media','staging/11111111-1111-1111-1111-111111111111/53000000-0000-0000-0000-000000000050/source',
 '11111111-1111-1111-1111-111111111111'::text,'{"size":1000}');
do $$ declare
  claimed media_uploads%rowtype;
  source_delete uuid;
  jpg_delete uuid;
  webp_delete uuid;
  late_path text;
  thumb_path text;
  stale_object jsonb;
  stale_preview jsonb;
  returned_at timestamptz;
begin
  if not rotate_media_envelope_key(null,'media53-expiry-kid') then raise exception '53 FAIL: expiry key setup'; end if;
  select * into strict claimed from claim_media_validation_jobs(1,'53000000-0000-0000-0000-000000000052');
  returned_at:=clock_timestamp();
  if not bind_media_validation_attempt_credentials(claimed.id,claimed.attempt_id,
      encode(extensions.digest('media53-expiry-dispatch','sha256'),'hex'),
      encode(extensions.digest('media53-expiry-completion','sha256'),'hex'),'media53-expiry-kid',
      returned_at+interval '120 seconds',returned_at,returned_at+interval '2 hours 30 seconds')
     or not redeem_media_validation_dispatch_nonce(
       claimed.id,claimed.attempt_id,'media53-expiry-dispatch','media53-expiry-kid')
     then
    raise exception '53 FAIL: processing-expiry redeemed baseline failed';
  end if;

  update media_uploads set expires_at=now()-interval '1 second' where id=claimed.id;
  if expire_media_uploads()<>1 then raise exception '53 FAIL: processing expiry count'; end if;
  if not exists(select 1 from media_uploads where id=claimed.id and state='expired'
      and session_state='expired' and attempt_id is null and lease_expires_at is null
      and dispatch_nonce_hash is null and completion_nonce_hash is null
      and dispatch_redeemed_at is null and completion_redeemed_at is null and envelope_kid is null) then
    raise exception '53 FAIL: processing expiry did not terminalize/invalidate attempt';
  end if;
  if redeem_media_validation_dispatch_nonce(
       claimed.id,claimed.attempt_id,'media53-expiry-dispatch','media53-expiry-kid')
     or finalize_media_validation_attempt(claimed.id,claimed.attempt_id,'media53-expiry-completion',
       'media53-expiry-kid','success',jsonb_build_object('detected_mime','image/jpeg',
         'validated_bytes',900,'sha256',repeat('f',64),'width',100,'height',80,'duration_ms',null,
         'validated_path',claimed.validated_path||'.jpg','preview_path',null,'cache_control_seconds',60)) then
    raise exception '53 FAIL: expired worker credential remained live';
  end if;

  late_path:=claimed.validated_path||'.jpg';
  thumb_path:='validated/'||claimed.id::text||'/'||claimed.attempt_id::text||'/thumb.webp';
  select id into strict source_delete from media_object_deletions
    where object_path=claimed.source_path and reason='upload_expired';
  select id into strict jpg_delete from media_object_deletions
    where object_path=late_path and reason='upload_expired';
  select id into strict webp_delete from media_object_deletions
    where object_path=claimed.validated_path||'.webp' and reason='upload_expired';
  if exists(select 1 from media_object_deletions d where d.id in (jpg_delete,webp_delete)
      and d.not_before<(select output_credentials_expire_at from media_uploads where id=claimed.id)) then
    raise exception '53 FAIL: expired output escaped credential fence'; end if;
  if exists(select 1 from media_object_deletions where id in (jpg_delete,webp_delete)
      and not_before<=clock_timestamp()) then
    raise exception '53 FAIL: processing cleanup was not fenced past live credential';
  end if;

  stale_object:=jsonb_build_object('path',late_path,'outcome','missing','observed_at',clock_timestamp()::text);
  stale_preview:=jsonb_build_object('path',thumb_path,'outcome','missing','observed_at',clock_timestamp()::text);
  if record_media_object_deletion(jpg_delete,stale_object,stale_preview) then
    raise exception '53 FAIL: pre-fence processing-expiry evidence accepted';
  end if;

  -- The already-dispatched worker performs its last exact-path write after the
  -- upload is terminal. This is the race the evidence timestamp must fence.
  insert into storage.objects(bucket_id,name,metadata) values('mark-media',late_path,'{"size":900}');
  if not exists(select 1 from storage.objects where bucket_id='mark-media' and name=late_path) then
    raise exception '53 FAIL: processing-expiry late-write setup was vacuous';
  end if;

  -- Simulate passage of the real credential fence without a multi-minute test.
  -- The stale observation remains earlier than the simulated safe instant and
  -- must still fail even though it is submitted after not_before.
  perform pg_sleep(0.05);
  update media_object_deletions set not_before=clock_timestamp()-interval '0.01 seconds'
    where id in (source_delete,jpg_delete,webp_delete);
  if record_media_object_deletion(jpg_delete,stale_object,stale_preview) then
    raise exception '53 FAIL: stale pre-fence evidence completed after fence';
  end if;

  delete from storage.objects where bucket_id='mark-media' and name in (claimed.source_path,late_path);
  if not record_media_object_deletion(source_delete,
       jsonb_build_object('path',claimed.source_path,'outcome','deleted','observed_at',clock_timestamp()::text),null)
     or not record_media_object_deletion(jpg_delete,
       jsonb_build_object('path',late_path,'outcome','deleted','observed_at',clock_timestamp()::text),
       jsonb_build_object('path',thumb_path,'outcome','missing','observed_at',clock_timestamp()::text))
     or not record_media_object_deletion(webp_delete,
       jsonb_build_object('path',claimed.validated_path||'.webp','outcome','missing',
         'observed_at',clock_timestamp()::text),null) then
    raise exception '53 FAIL: fresh post-fence processing-expiry evidence rejected';
  end if;
  if exists(select 1 from storage.objects where bucket_id='mark-media'
       and name in (claimed.source_path,late_path))
     or (select quota_reservation_released_at from media_uploads where id=claimed.id) is null then
    raise exception '53 FAIL: processing-expiry cleanup/release incomplete';
  end if;
end $$;
ROLLBACK;
\echo '53 (redeemed processing expiry fence): PASS'

BEGIN;
do $$ declare blocked boolean:=false; begin
  begin
    update media_legacy_reconciliation set inventory_count=1,state='complete',completed_at=now() where singleton;
  exception when check_violation then blocked:=true;
  end;
  if not blocked then raise exception '53 FAIL: incomplete legacy gate completed'; end if;
end $$;
ROLLBACK;
\echo '53 (legacy reconciliation gate)   : PASS'
