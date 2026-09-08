-- 59 · C1.3 protected-media writer contract: captions, cancellation,
-- status redaction, failure-code normalization, and grants.
\set ON_ERROR_STOP on

BEGIN;
do $$ begin
  if not has_function_privilege('authenticated','public.begin_media_upload(uuid,mark_type,uuid,text,bigint)','execute')
     or not has_function_privilege('authenticated','public.mark_media_uploaded(uuid)','execute')
     or not has_function_privilege('authenticated','public.get_media_upload_status(uuid[])','execute')
     or not has_function_privilege('authenticated','public.cancel_media_upload(uuid)','execute')
     or not has_function_privilege('authenticated',
       'public.create_mark(uuid,uuid,mark_type,text,text,boolean,boolean,real,uuid[])','execute')
     or not has_function_privilege('authenticated',
       'public.current_user_can_upload_mark_media_path(text)','execute') then
    raise exception '59 FAIL: actor-bound writer surface missing';
  end if;
  if has_function_privilege('anon','public.cancel_media_upload(uuid)','execute')
     or has_function_privilege('authenticated','public.normalize_media_failure_code(text)','execute')
     or has_function_privilege('authenticated','public.canonical_media_validation_result(text,jsonb)','execute')
     or has_table_privilege('authenticated','public.media_uploads','select')
     or has_table_privilege('authenticated','public.media_object_deletions','insert')
     or has_function_privilege('service_role','public.fail_media_validation(uuid,uuid,text)','execute') then
    raise exception '59 FAIL: private writer internals exposed';
  end if;
  if current_user_can_upload_mark_media_path('staging/foreign/guessed/source') then
    raise exception '59 FAIL: policy-only path helper became an oracle';
  end if;
end $$;
ROLLBACK;
\echo '59 (writer grant boundary)           : PASS'

BEGIN;
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('photo',true,true,true,true,'59 caption');
insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,detected_mime,validated_bytes,actual_input_bytes,sha256,
 width,height,validated_path,cache_control_seconds,expires_at,validated_at,quota_day,reserved_charge)
values
('59000000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','59000000-0000-4000-8000-000000000011',
 'staging/11111111-1111-1111-1111-111111111111/59000000-0000-4000-8000-000000000001/source',
 'validated','closed','image/jpeg',1000,'image/jpeg',900,1000,repeat('a',64),100,80,
 'validated/59000000-0000-4000-8000-000000000001/59000000-0000-4000-8000-000000000101/full.jpg',60,
 now()+interval '1 hour',now(),current_date,1000),
('59000000-0000-4000-8000-000000000002','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','59000000-0000-4000-8000-000000000012',
 'staging/11111111-1111-1111-1111-111111111111/59000000-0000-4000-8000-000000000002/source',
 'validated','closed','image/jpeg',1000,'image/jpeg',900,1000,repeat('b',64),100,80,
 'validated/59000000-0000-4000-8000-000000000002/59000000-0000-4000-8000-000000000102/full.jpg',60,
 now()+interval '1 hour',now(),current_date,1000),
('59000000-0000-4000-8000-000000000003','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','59000000-0000-4000-8000-000000000013',
 'staging/11111111-1111-1111-1111-111111111111/59000000-0000-4000-8000-000000000003/source',
 'validated','closed','image/jpeg',1000,'image/jpeg',900,1000,repeat('c',64),100,80,
 'validated/59000000-0000-4000-8000-000000000003/59000000-0000-4000-8000-000000000103/full.jpg',60,
 now()+interval '1 hour',now(),current_date,1000);
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare a jsonb; b jsonb; c jsonb; replay jsonb; mismatch jsonb; begin
  a:=create_mark('59000000-0000-4000-8000-000000000021','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'photo','  full frame  ',null,false,false,0,array['59000000-0000-4000-8000-000000000001'::uuid]);
  if a->>'status'<>'created' or (select text from marks where id=(a->>'mark_id')::uuid)<>'full frame' then
    raise exception '59 FAIL: normalized caption not stored in marks.text only %',a;
  end if;
  if exists(select 1 from marks where id=(a->>'mark_id')::uuid and (payload is not null or media_url is not null)) then
    raise exception '59 FAIL: caption leaked into legacy media fields';
  end if;
  replay:=create_mark('59000000-0000-4000-8000-000000000021','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'photo',E'\tfull frame\n',null,false,false,2,array['59000000-0000-4000-8000-000000000001'::uuid]);
  mismatch:=create_mark('59000000-0000-4000-8000-000000000021','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'photo','different',null,false,false,0,array['59000000-0000-4000-8000-000000000001'::uuid]);
  if replay->>'status'<>'existing' or replay->>'mark_id'<>a->>'mark_id'
     or mismatch<>jsonb_build_object('status','request_id_reused') then
    raise exception '59 FAIL: normalized caption fingerprint/idempotency mismatch %, %',replay,mismatch;
  end if;
  b:=create_mark('59000000-0000-4000-8000-000000000022','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'photo',repeat('x',500),null,false,false,0,array['59000000-0000-4000-8000-000000000002'::uuid]);
  if b->>'status'<>'created' then raise exception '59 FAIL: 500-character caption rejected %',b; end if;
  c:=create_mark('59000000-0000-4000-8000-000000000023','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'photo',repeat('x',501),null,false,false,0,array['59000000-0000-4000-8000-000000000003'::uuid]);
  if c<>jsonb_build_object('status','invalid') then raise exception '59 FAIL: 501-character caption accepted %',c; end if;
end $$;
reset role;
ROLLBACK;
\echo '59 (caption normalization/boundary) : PASS'

BEGIN;
-- Secret media rejection precedes request/upload lookup for nonexistent,
-- valid owned, and valid foreign bindings, and leaves no side effect.
create temp table media59_secret_baseline on commit drop as
select (select count(*) from marks) mark_count,
       (select count(*) from mark_creation_requests) request_count,
       (select count(*) from mark_media) media_count,
       (select count(*) from notifications) notification_count,
       (select count(*) from notification_origins) origin_count;
insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,detected_mime,validated_bytes,actual_input_bytes,sha256,
 width,height,validated_path,cache_control_seconds,expires_at,validated_at,quota_day,reserved_charge)
values
('59000000-0000-4000-8000-000000000031','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','59000000-0000-4000-8000-000000000032',
 'staging/11111111-1111-1111-1111-111111111111/59000000-0000-4000-8000-000000000031/source',
 'validated','closed','image/jpeg',1000,'image/jpeg',900,1000,repeat('a',64),100,80,
 'validated/59000000-0000-4000-8000-000000000031/59000000-0000-4000-8000-000000000036/full.jpg',60,
 now()+interval '1 hour',now(),current_date,1000),
('59000000-0000-4000-8000-000000000033','22222222-2222-2222-2222-222222222222',
 '22222222-2222-2222-2222-222222222222','dddddddd-dddd-dddd-dddd-dddddddddddd',
 'dddddddd-dddd-dddd-dddd-dddddddddddd','photo','59000000-0000-4000-8000-000000000034',
 'staging/22222222-2222-2222-2222-222222222222/59000000-0000-4000-8000-000000000033/source',
 'validated','closed','image/jpeg',1000,'image/jpeg',900,1000,repeat('b',64),100,80,
 'validated/59000000-0000-4000-8000-000000000033/59000000-0000-4000-8000-000000000037/full.jpg',60,
 now()+interval '1 hour',now(),current_date,1000);
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare r jsonb; begin
  r:=create_mark('59000000-0000-4000-8000-000000000030','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'photo','secret caption',null,false,true,0,array['ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid]);
  if r<>jsonb_build_object('status','invalid') then raise exception '59 FAIL: nonexistent Secret binding %',r; end if;
  r:=create_mark('59000000-0000-4000-8000-000000000035','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'photo','secret owned caption',null,false,true,0,array['59000000-0000-4000-8000-000000000031'::uuid]);
  if r<>jsonb_build_object('status','invalid') then raise exception '59 FAIL: owned Secret binding %',r; end if;
  r:=create_mark('59000000-0000-4000-8000-000000000038','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'photo','secret foreign caption',null,false,true,0,array['59000000-0000-4000-8000-000000000033'::uuid]);
  if r<>jsonb_build_object('status','invalid') then raise exception '59 FAIL: foreign Secret binding %',r; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from mark_creation_requests where request_id in (
       '59000000-0000-4000-8000-000000000030','59000000-0000-4000-8000-000000000035',
       '59000000-0000-4000-8000-000000000038'))
     or exists(select 1 from marks
       where text in ('secret caption','secret owned caption','secret foreign caption'))
     or exists(select 1 from mark_media
       where upload_id in ('59000000-0000-4000-8000-000000000031','59000000-0000-4000-8000-000000000033'))
     or exists(select 1 from media_uploads
       where id in ('59000000-0000-4000-8000-000000000031','59000000-0000-4000-8000-000000000033')
         and (state<>'validated' or consumed_mark_id is not null or consumed_at is not null))
     or exists(select 1 from media59_secret_baseline b
       where b.mark_count<>(select count(*) from marks)
          or b.request_count<>(select count(*) from mark_creation_requests)
          or b.media_count<>(select count(*) from mark_media)
          or b.notification_count<>(select count(*) from notifications)
          or b.origin_count<>(select count(*) from notification_origins)) then
    raise exception '59 FAIL: Secret media created a side effect';
  end if;
end $$;
ROLLBACK;
\echo '59 (Secret media early rejection)   : PASS'

BEGIN;
insert into media_quota_daily(user_tombstone_id,quota_day,reserved_bytes,reservation_count,open_sessions)
values('11111111-1111-1111-1111-111111111111',current_date,3000,3,3);
insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,expires_at,quota_day,reserved_charge)
values
('59000000-0000-4000-8000-000000000040','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','59000000-0000-4000-8000-000000000041',
 'staging/11111111-1111-1111-1111-111111111111/59000000-0000-4000-8000-000000000040/source',
 'initiated','open','image/jpeg',1000,now()+interval '1 hour',current_date,1000),
('59000000-0000-4000-8000-000000000042','22222222-2222-2222-2222-222222222222',
 '22222222-2222-2222-2222-222222222222','dddddddd-dddd-dddd-dddd-dddddddddddd',
 'dddddddd-dddd-dddd-dddd-dddddddddddd','photo','59000000-0000-4000-8000-000000000043',
 'staging/22222222-2222-2222-2222-222222222222/59000000-0000-4000-8000-000000000042/source',
 'initiated','open','image/jpeg',1000,now()+interval '1 hour',current_date,1000),
('59000000-0000-4000-8000-000000000044','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','59000000-0000-4000-8000-000000000045',
 'staging/11111111-1111-1111-1111-111111111111/59000000-0000-4000-8000-000000000044/source',
 'processing','closed','image/jpeg',1000,now()+interval '1 hour',current_date,1000),
('59000000-0000-4000-8000-000000000046','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','59000000-0000-4000-8000-000000000047',
 'staging/11111111-1111-1111-1111-111111111111/59000000-0000-4000-8000-000000000046/source',
 'uploaded','closed','image/jpeg',1000,now()+interval '1 hour',current_date,1000),
('59000000-0000-4000-8000-000000000048','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','59000000-0000-4000-8000-000000000049',
 'staging/11111111-1111-1111-1111-111111111111/59000000-0000-4000-8000-000000000048/source',
 'failed','closed','image/jpeg',1000,now()+interval '1 hour',current_date,1000),
('59000000-0000-4000-8000-000000000050','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','59000000-0000-4000-8000-000000000051',
 'staging/11111111-1111-1111-1111-111111111111/59000000-0000-4000-8000-000000000050/source',
 'expired','expired','image/jpeg',1000,now()-interval '1 second',current_date,1000),
('59000000-0000-4000-8000-000000000054','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','59000000-0000-4000-8000-000000000055',
 'staging/11111111-1111-1111-1111-111111111111/59000000-0000-4000-8000-000000000054/source',
 'processing','closed','image/jpeg',1000,now()-interval '1 second',current_date,1000);
insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,detected_mime,validated_bytes,actual_input_bytes,sha256,
 width,height,validated_path,cache_control_seconds,expires_at,validated_at,quota_day,reserved_charge)
values('59000000-0000-4000-8000-000000000052','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','59000000-0000-4000-8000-000000000053',
 'staging/11111111-1111-1111-1111-111111111111/59000000-0000-4000-8000-000000000052/source',
 'validated','closed','image/jpeg',1000,'image/jpeg',900,1000,repeat('d',64),100,80,
 'validated/59000000-0000-4000-8000-000000000052/59000000-0000-4000-8000-000000000054/full.jpg',60,
 now()+interval '1 hour',now(),current_date,1000);
update media_uploads set attempt_id='59000000-0000-4000-8000-000000000046',attempt_count=1,
 lease_expires_at=now()+interval '5 minutes',
 validated_path='validated/59000000-0000-4000-8000-000000000044/59000000-0000-4000-8000-000000000046/full',
 dispatch_nonce_hash=repeat('a',64),completion_nonce_hash=repeat('b',64),
 dispatch_redeemed_at=now(),completion_redeemed_at=now(),envelope_kid='media59-cancel',
 dispatch_envelope_expires_at=now()+interval '2 minutes',
 output_credentials_expire_at='2099-01-01 00:00:01+00'::timestamptz
 where id='59000000-0000-4000-8000-000000000044';
update media_uploads set attempt_id='59000000-0000-4000-8000-000000000056',attempt_count=1,
 lease_expires_at=now()-interval '1 second',
 validated_path='validated/59000000-0000-4000-8000-000000000054/59000000-0000-4000-8000-000000000056/full',
 dispatch_nonce_hash=repeat('c',64),completion_nonce_hash=repeat('d',64),
 dispatch_redeemed_at=now(),completion_redeemed_at=now(),envelope_kid='media59-expiry',
 dispatch_envelope_expires_at=now()+interval '2 minutes',
 output_credentials_expire_at='2099-01-01 00:00:02+00'::timestamptz
 where id='59000000-0000-4000-8000-000000000054';
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare a jsonb; b jsonb; c jsonb; s jsonb; state_id uuid; state_result jsonb; begin
  a:=cancel_media_upload('59000000-0000-4000-8000-000000000040');
  b:=cancel_media_upload('59000000-0000-4000-8000-000000000040');
  if a<>jsonb_build_object('status','cancelled') or b<>a then
    raise exception '59 FAIL: immediate cancellation not idempotent %, %',a,b;
  end if;
  if cancel_media_upload('59000000-0000-4000-8000-000000000042')
       <>jsonb_build_object('status','unavailable')
     or cancel_media_upload('ffffffff-ffff-4fff-8fff-ffffffffffff')
       <>jsonb_build_object('status','unavailable') then
    raise exception '59 FAIL: missing/foreign cancellation oracle';
  end if;
  c:=cancel_media_upload('59000000-0000-4000-8000-000000000044');
  if c<>jsonb_build_object('status','cancelling') then raise exception '59 FAIL: live processing cancelled early %',c; end if;
  foreach state_id in array array[
    '59000000-0000-4000-8000-000000000046'::uuid,
    '59000000-0000-4000-8000-000000000048'::uuid,
    '59000000-0000-4000-8000-000000000050'::uuid,
    '59000000-0000-4000-8000-000000000052'::uuid
  ] loop
    state_result:=cancel_media_upload(state_id);
    if state_result<>jsonb_build_object('status','cancelled')
       or cancel_media_upload(state_id)<>state_result then
      raise exception '59 FAIL: state cancellation not idempotent %, %',state_id,state_result;
    end if;
  end loop;
  s:=get_media_upload_status(array[
    '59000000-0000-4000-8000-000000000040'::uuid,
    '59000000-0000-4000-8000-000000000044'::uuid,
    '59000000-0000-4000-8000-000000000042'::uuid]);
  if s<>jsonb_build_array(
      jsonb_build_object('upload_id','59000000-0000-4000-8000-000000000040','state','cancelled'),
      jsonb_build_object('upload_id','59000000-0000-4000-8000-000000000044','state','cancelling')) then
    raise exception '59 FAIL: cancellation status/redaction mismatch %',s;
  end if;
end $$;
reset role;
do $$ begin
  if not exists(select 1 from media_object_deletions
      where object_path='staging/11111111-1111-1111-1111-111111111111/59000000-0000-4000-8000-000000000040/source'
        and reason='upload_cancelled'
        and not_before>=(select expires_at from media_uploads
          where id='59000000-0000-4000-8000-000000000040')) then
    raise exception '59 FAIL: exact source cleanup not queued';
  end if;
  if (select reserved_bytes from media_quota_daily
      where user_tombstone_id='11111111-1111-1111-1111-111111111111' and quota_day=current_date)<>3000 then
    raise exception '59 FAIL: cancellation refunded quota without cleanup evidence';
  end if;
  update media_uploads set lease_expires_at=clock_timestamp()-interval '1 second'
   where id='59000000-0000-4000-8000-000000000044';
  perform expire_media_uploads();
  if not exists(select 1 from media_uploads where id='59000000-0000-4000-8000-000000000044'
      and state='expired' and cancelled_at is not null and attempt_id is null and lease_expires_at is null
      and dispatch_nonce_hash is null and completion_nonce_hash is null
      and dispatch_redeemed_at is null and completion_redeemed_at is null and envelope_kid is null
      and dispatch_envelope_expires_at is null
      and output_credentials_expire_at='2099-01-01 00:00:01+00'::timestamptz) then
    raise exception '59 FAIL: expired processing cancellation retained a worker credential';
  end if;
  if not exists(select 1 from media_uploads where id='59000000-0000-4000-8000-000000000054'
      and state='expired' and cancelled_at is null and attempt_id is null and lease_expires_at is null
      and dispatch_nonce_hash is null and completion_nonce_hash is null
      and dispatch_redeemed_at is null and completion_redeemed_at is null and envelope_kid is null
      and dispatch_envelope_expires_at is null
      and output_credentials_expire_at='2099-01-01 00:00:02+00'::timestamptz) then
    raise exception '59 FAIL: ordinary processing expiry retained a worker credential';
  end if;
  if (select count(*) from media_object_deletions d
      join media_upload_cleanup_requirements r on r.deletion_id=d.id
      where r.upload_id='59000000-0000-4000-8000-000000000044'
        and d.idempotency_key like 'upload_cancelled:59000000-0000-4000-8000-000000000044:%'
        and d.object_path like 'validated/%'
        and d.not_before>='2099-01-01 00:00:01+00'::timestamptz)<>2 then
    raise exception '59 FAIL: cancellation attempt cleanup lost its exact output fence';
  end if;
  if (select count(*) from media_object_deletions d
      join media_upload_cleanup_requirements r on r.deletion_id=d.id
      where r.upload_id='59000000-0000-4000-8000-000000000054'
        and d.idempotency_key like 'upload_expired:59000000-0000-4000-8000-000000000054:%'
        and d.object_path like 'validated/%'
        and d.not_before>='2099-01-01 00:00:02+00'::timestamptz)<>2 then
    raise exception '59 FAIL: ordinary expiry attempt cleanup lost its exact output fence';
  end if;
end $$;
ROLLBACK;
\echo '59 (cancel/status/quota boundary)    : PASS'

BEGIN;
do $$ declare c jsonb; begin
  if normalize_media_failure_code('TOO_LONG')<>'TOO_LONG'
     or normalize_media_failure_code('too_long')<>'PROCESSING_FAILED'
     or normalize_media_failure_code(repeat('X',1000))<>'PROCESSING_FAILED'
     or normalize_media_failure_code(null)<>'PROCESSING_FAILED' then
    raise exception '59 FAIL: failure-code allow-list';
  end if;
  c:=canonical_media_validation_result('failed',jsonb_build_object('error_code','raw decoder stack'));
  if c<>jsonb_build_object('error_code','PROCESSING_FAILED') then
    raise exception '59 FAIL: raw failure detail was not normalized %',c;
  end if;
end $$;
ROLLBACK;
\echo '59 (safe failure-code projection)   : PASS'

BEGIN;
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('photo',true,true,true,false,'59 failure persistence');
create temp table media59_failure_cases(
  upload_id uuid primary key,
  result jsonb,
  expected_code text not null
) on commit drop;
insert into media59_failure_cases values
('59200000-0000-4000-8000-000000000001',jsonb_build_object('error_code','UNSUPPORTED_FORMAT'),'UNSUPPORTED_FORMAT'),
('59200000-0000-4000-8000-000000000002',jsonb_build_object('error_code','TOO_LARGE'),'TOO_LARGE'),
('59200000-0000-4000-8000-000000000003',jsonb_build_object('error_code','TOO_LONG'),'TOO_LONG'),
('59200000-0000-4000-8000-000000000004',jsonb_build_object('error_code','INVALID_MEDIA'),'INVALID_MEDIA'),
('59200000-0000-4000-8000-000000000005',jsonb_build_object('error_code','PROCESSING_FAILED'),'PROCESSING_FAILED'),
('59200000-0000-4000-8000-000000000006',jsonb_build_object('error_code','DECODER_FAILED'),'PROCESSING_FAILED'),
('59200000-0000-4000-8000-000000000007',jsonb_build_object('error_code','too_long'),'PROCESSING_FAILED'),
('59200000-0000-4000-8000-000000000008',jsonb_build_object('error_code',repeat('X',1000)),'PROCESSING_FAILED'),
('59200000-0000-4000-8000-000000000009',jsonb_build_object('error_code','TOO_LONG','raw','decoder stack'),'PROCESSING_FAILED'),
('59200000-0000-4000-8000-000000000010',jsonb_build_object('error_code',7),'PROCESSING_FAILED'),
('59200000-0000-4000-8000-000000000011',null,'PROCESSING_FAILED');
insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,actual_input_bytes,attempt_count,
 expires_at,quota_day,reserved_charge,created_at)
select c.upload_id,'11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo',gen_random_uuid(),
 'staging/11111111-1111-1111-1111-111111111111/'||c.upload_id::text||'/source',
 'uploaded','closed','image/jpeg',1000,1000,4,now()+interval '1 hour',current_date,1000,
 '1990-01-01 00:00:00+00'::timestamptz
   +(row_number() over(order by c.upload_id))*interval '1 millisecond'
from media59_failure_cases c;
do $$ declare
  v_active text;
  v_case media59_failure_cases%rowtype;
  v_up media_uploads%rowtype;
  v_returned timestamptz;
  v_dispatch text;
  v_completion text;
  v_expected_hash text;
begin
  select kid into v_active from media_envelope_keys where status='active';
  if not rotate_media_envelope_key(v_active,'failure-codes') then
    raise exception '59 FAIL: failure-code key provisioning';
  end if;
  perform * from claim_media_validation_jobs(5,'59200000-0000-4000-8000-000000000020');
  perform * from claim_media_validation_jobs(5,'59200000-0000-4000-8000-000000000021');
  perform * from claim_media_validation_jobs(1,'59200000-0000-4000-8000-000000000022');
  for v_case in select * from media59_failure_cases order by upload_id loop
    select * into strict v_up from media_uploads where id=v_case.upload_id;
    if v_up.state<>'processing' or v_up.attempt_count<>5 then
      raise exception '59 FAIL: terminal failure fixture not claimed %',v_case.upload_id;
    end if;
    v_returned:=clock_timestamp();
    v_dispatch:='dispatch-'||v_case.upload_id::text;
    v_completion:='completion-'||v_case.upload_id::text;
    if not bind_media_validation_attempt_credentials(v_up.id,v_up.attempt_id,
        encode(extensions.digest(v_dispatch,'sha256'),'hex'),
        encode(extensions.digest(v_completion,'sha256'),'hex'),'failure-codes',
        v_returned+interval '120 seconds',v_returned,v_returned+interval '2 hours 30 seconds')
       or not redeem_media_validation_dispatch_nonce(v_up.id,v_up.attempt_id,v_dispatch,'failure-codes')
       or not finalize_media_validation_attempt(v_up.id,v_up.attempt_id,v_completion,'failure-codes',
         'failed',v_case.result) then
      raise exception '59 FAIL: failure finalizer rejected case %',v_case.upload_id;
    end if;
    if not finalize_media_validation_attempt(v_up.id,v_up.attempt_id,v_completion,'failure-codes',
         'failed',v_case.result)
       or finalize_media_validation_attempt(v_up.id,v_up.attempt_id,v_completion,'failure-codes',
         'failed',jsonb_build_object('error_code',case
           when v_case.expected_code='TOO_LONG' then 'INVALID_MEDIA' else 'TOO_LONG' end))
       or finalize_media_validation_attempt(v_up.id,v_up.attempt_id,v_completion,'failure-codes',
         'success',jsonb_build_object(
           'detected_mime','image/jpeg','validated_bytes',900,'sha256',repeat('f',64),
           'width',100,'height',80,'duration_ms',null,'validated_path','validated/retry/full.jpg',
           'preview_path',null,'cache_control_seconds',60)) then
      raise exception '59 FAIL: failure finalizer canonical retry boundary %',v_case.upload_id;
    end if;
    v_expected_hash:=encode(extensions.digest(convert_to(
      jsonb_build_object('error_code',v_case.expected_code)::text,'UTF8'),'sha256'),'hex');
    if not exists(select 1 from media_uploads
        where id=v_up.id and state='failed' and error_code=v_case.expected_code)
       or not exists(select 1 from media_validation_callback_receipts
        where upload_id=v_up.id and attempt_id=v_up.attempt_id
          and canonical_result_sha256=v_expected_hash) then
      raise exception '59 FAIL: failure persistence/hash mismatch %, %',v_case.upload_id,v_case.expected_code;
    end if;
  end loop;
end $$;
ROLLBACK;
\echo '59 (failure finalize/hash allow-list): PASS'
