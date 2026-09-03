-- 57 · Worker credential protocol v2: post-issuance output fence, private key
-- authority, atomic callback receipts, revocation, and cleanup/quota fencing.
\set ON_ERROR_STOP on

BEGIN;
do $$ begin
  if has_table_privilege('authenticated','public.media_envelope_keys','select')
     or has_table_privilege('service_role','public.media_envelope_keys','select')
     or has_table_privilege('authenticated','public.media_validation_callback_receipts','select')
     or has_table_privilege('service_role','public.media_validation_callback_receipts','select')
     or has_function_privilege('service_role','public.bind_media_validation_attempt_nonces(uuid,uuid,text,text,text)','execute')
     or has_function_privilege('service_role','public.redeem_media_validation_completion_nonce(uuid,uuid,text,text)','execute')
     or has_function_privilege('service_role','public.complete_media_validation(uuid,uuid,text,bigint,text,integer,integer,integer,text,text,integer)','execute')
     or has_function_privilege('service_role','public.fail_media_validation(uuid,uuid,text)','execute') then
    raise exception '57 FAIL: private state or retired two-step callback exposed';
  end if;
  if not has_function_privilege('service_role',
       'public.bind_media_validation_attempt_credentials(uuid,uuid,text,text,text,timestamp with time zone,timestamp with time zone,timestamp with time zone)','execute')
     or not has_function_privilege('service_role',
       'public.finalize_media_validation_attempt(uuid,uuid,text,text,text,jsonb)','execute') then
    raise exception '57 FAIL: v2 service contracts unavailable';
  end if;
end $$;
ROLLBACK;
\echo '57 (private/grant floor)             : PASS'

BEGIN;
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('photo',true,true,true,false,'57 binding');
insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,actual_input_bytes,expires_at,quota_day,reserved_charge)
values('57000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','57000000-0000-0000-0000-000000000002',
 'staging/11111111-1111-1111-1111-111111111111/57000000-0000-0000-0000-000000000001/source',
 'uploaded','closed','image/jpeg',1000,1000,now()+interval '1 hour',current_date,1000);
do $$ declare u media_uploads%rowtype; t timestamptz; shrink_blocked boolean:=false;
  dispatch_hash text:=encode(extensions.digest('dispatch-a','sha256'),'hex');
  completion_hash text:=encode(extensions.digest('completion-a','sha256'),'hex'); begin
  if not rotate_media_envelope_key(null,'key-a') then raise exception '57 FAIL: initial key'; end if;
  select * into strict u from claim_media_validation_jobs(1,'57000000-0000-0000-0000-000000000003');
  t:=clock_timestamp();
  if redeem_media_validation_dispatch_nonce(u.id,u.attempt_id,'dispatch-a','key-a') then
    raise exception '57 FAIL: dispatch redeemed before durable binding'; end if;
  if bind_media_validation_attempt_credentials(u.id,u.attempt_id,dispatch_hash,completion_hash,'key-a',
       t+interval '120 seconds',t,null) then raise exception '57 FAIL: missing fence accepted'; end if;
  if bind_media_validation_attempt_credentials(u.id,u.attempt_id,dispatch_hash,completion_hash,'key-a',
       t+interval '120 seconds',t,t+interval '2 hours 29 seconds') then
    raise exception '57 FAIL: pre-return/short fence accepted'; end if;
  if not bind_media_validation_attempt_credentials(u.id,u.attempt_id,dispatch_hash,completion_hash,'key-a',
       t+interval '120 seconds',t,t+interval '2 hours 30 seconds') then
    raise exception '57 FAIL: valid post-return fence rejected'; end if;
  if bind_media_validation_attempt_credentials(u.id,u.attempt_id,dispatch_hash,completion_hash,'key-a',
       t+interval '120 seconds',t-interval '1 second',t+interval '2 hours 29 minutes 59 seconds') then
    raise exception '57 FAIL: bound fence shrank'; end if;
  perform pg_sleep(0.01);
  t:=clock_timestamp();
  if not bind_media_validation_attempt_credentials(u.id,u.attempt_id,dispatch_hash,completion_hash,'key-a',
       (select dispatch_envelope_expires_at from media_uploads where id=u.id),
       t,t+interval '2 hours 30 seconds') then
    raise exception '57 FAIL: fence extension rejected'; end if;
  if not exists(select 1 from media_uploads where id=u.id
       and output_credentials_expire_at=t+interval '2 hours 30 seconds')
     or not exists(select 1 from media_envelope_keys where kid='key-a' and status='active'
       and last_dispatch_exp is not null and last_completion_exp>=u.lease_expires_at) then
    raise exception '57 FAIL: durable credential/key deadlines missing'; end if;
  begin
    update media_uploads set output_credentials_expire_at=t+interval '2 hours 29 seconds' where id=u.id;
  exception when check_violation then shrink_blocked:=true;
  end;
  if not shrink_blocked then raise exception '57 FAIL: direct same-attempt fence shrink accepted'; end if;
  if not rotate_media_envelope_key('key-a','key-b')
     or bind_media_validation_attempt_credentials(u.id,u.attempt_id,dispatch_hash,completion_hash,'key-a',
       (select dispatch_envelope_expires_at from media_uploads where id=u.id),
       t,t+interval '2 hours 30 seconds')
     or not redeem_media_validation_dispatch_nonce(u.id,u.attempt_id,'dispatch-a','key-a') then
    raise exception '57 FAIL: retiring-key bind/redeem boundary'; end if;
end $$;
ROLLBACK;
\echo '57 (post-issuance/non-shrinking fence): PASS'

BEGIN;
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('photo',true,true,true,false,'57 finalize');
insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,actual_input_bytes,expires_at,quota_day,reserved_charge)
values('57000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','57000000-0000-0000-0000-000000000011',
 'staging/11111111-1111-1111-1111-111111111111/57000000-0000-0000-0000-000000000010/source',
 'uploaded','closed','image/jpeg',1000,1000,now()+interval '1 hour',current_date,1000);
create temp table media57_attempt(upload_id uuid,attempt_id uuid,result jsonb) on commit drop;
do $$ declare u media_uploads%rowtype; t timestamptz; r jsonb; begin
  perform rotate_media_envelope_key(null,'key-final');
  select * into strict u from claim_media_validation_jobs(1,'57000000-0000-0000-0000-000000000012');
  t:=clock_timestamp();
  perform bind_media_validation_attempt_credentials(u.id,u.attempt_id,
    encode(extensions.digest('dispatch-final','sha256'),'hex'),
    encode(extensions.digest('completion-final','sha256'),'hex'),'key-final',
    t+interval '120 seconds',t,t+interval '2 hours 30 seconds');
  perform redeem_media_validation_dispatch_nonce(u.id,u.attempt_id,'dispatch-final','key-final');
  r:=jsonb_build_object('detected_mime','image/jpeg','validated_bytes',900,'sha256',repeat('c',64),
    'width',100,'height',80,'duration_ms',null,'validated_path',u.validated_path||'.jpg',
    'preview_path',null,'cache_control_seconds',60);
  insert into media57_attempt values(u.id,u.attempt_id,r);
end $$;

create function media57_fail_receipt() returns trigger language plpgsql as $$
begin raise exception 'MEDIA57_AFTER_RECEIPT'; end $$;
create trigger media57_after_receipt after insert on media_validation_callback_receipts
  for each row execute function media57_fail_receipt();
do $$ declare a record; denied boolean:=false; begin
  select * into strict a from media57_attempt;
  begin perform finalize_media_validation_attempt(a.upload_id,a.attempt_id,'completion-final','key-final','success',a.result);
  exception when others then denied:=true; end;
  if not denied or exists(select 1 from media_validation_callback_receipts where upload_id=a.upload_id)
     or exists(select 1 from media_uploads where id=a.upload_id and completion_redeemed_at is not null) then
    raise exception '57 FAIL: fault after receipt did not roll back atomically'; end if;
end $$;
drop trigger media57_after_receipt on media_validation_callback_receipts;
drop function media57_fail_receipt();

create function media57_fail_state() returns trigger language plpgsql as $$
begin if new.state is distinct from old.state then raise exception 'MEDIA57_AFTER_STATE'; end if; return new; end $$;
create trigger media57_after_state after update on media_uploads
  for each row execute function media57_fail_state();
do $$ declare a record; denied boolean:=false; begin
  select * into strict a from media57_attempt;
  begin perform finalize_media_validation_attempt(a.upload_id,a.attempt_id,'completion-final','key-final','success',a.result);
  exception when others then denied:=true; end;
  if not denied or exists(select 1 from media_validation_callback_receipts where upload_id=a.upload_id)
     or exists(select 1 from media_uploads where id=a.upload_id and state<>'processing') then
    raise exception '57 FAIL: fault after state mutation did not roll back receipt/state'; end if;
end $$;
drop trigger media57_after_state on media_uploads;
drop function media57_fail_state();

do $$ declare a record; changed jsonb; begin
  select * into strict a from media57_attempt;
  if not finalize_media_validation_attempt(a.upload_id,a.attempt_id,'completion-final','key-final','success',a.result)
     or not finalize_media_validation_attempt(a.upload_id,a.attempt_id,'completion-final','key-final','success',a.result) then
    raise exception '57 FAIL: commit/lost-response retry failed'; end if;
  changed:=jsonb_set(a.result,'{validated_bytes}','901'::jsonb);
  if finalize_media_validation_attempt(a.upload_id,a.attempt_id,'completion-final','key-final','success',changed)
     or finalize_media_validation_attempt(a.upload_id,a.attempt_id,'completion-final','key-final','failed',
       jsonb_build_object('error_code','PROCESSING_FAILED')) then
    raise exception '57 FAIL: mismatched receipt retry accepted'; end if;
  update media_uploads set state='uploaded',attempt_id=gen_random_uuid(),completion_redeemed_at=null,
    dispatch_nonce_hash=null,completion_nonce_hash=null,envelope_kid=null,
    dispatch_envelope_expires_at=null,output_credentials_expire_at=null where id=a.upload_id;
  if not finalize_media_validation_attempt(a.upload_id,a.attempt_id,'completion-final','key-final','success',a.result) then
    raise exception '57 FAIL: durable receipt lost after attempt overwrite'; end if;
  perform revoke_media_envelope_key('key-final');
  if not finalize_media_validation_attempt(a.upload_id,a.attempt_id,'completion-final','key-final','success',a.result) then
    raise exception '57 FAIL: exact committed receipt retry denied after revoke'; end if;
end $$;
ROLLBACK;
\echo '57 (atomic receipt/fault/idempotency) : PASS'

BEGIN;
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('photo',true,true,true,false,'57 cleanup fence');
insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,actual_input_bytes,attempt_count,
 expires_at,quota_day,reserved_charge,quota_session_released_at)
values('57000000-0000-0000-0000-000000000020','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','57000000-0000-0000-0000-000000000021',
 'staging/11111111-1111-1111-1111-111111111111/57000000-0000-0000-0000-000000000020/source',
 'uploaded','closed','image/jpeg',1000,1000,4,now()+interval '1 hour',current_date,1000,now());
insert into media_quota_daily(user_tombstone_id,quota_day,reserved_bytes,ingested_bytes,reservation_count,open_sessions)
values('11111111-1111-1111-1111-111111111111',current_date,1000,1000,1,0);
do $$ declare u media_uploads%rowtype; t timestamptz; source_id uuid; jpg_id uuid; webp_id uuid; begin
  perform rotate_media_envelope_key(null,'key-clean');
  select * into strict u from claim_media_validation_jobs(1,'57000000-0000-0000-0000-000000000022');
  t:=clock_timestamp();
  perform bind_media_validation_attempt_credentials(u.id,u.attempt_id,
    encode(extensions.digest('dispatch-clean','sha256'),'hex'),
    encode(extensions.digest('completion-clean','sha256'),'hex'),'key-clean',
    t+interval '120 seconds',t,t+interval '2 hours 30 seconds');
  perform redeem_media_validation_dispatch_nonce(u.id,u.attempt_id,'dispatch-clean','key-clean');
  if not finalize_media_validation_attempt(u.id,u.attempt_id,'completion-clean','key-clean','failed',
       jsonb_build_object('error_code','DECODER_FAILED')) then raise exception '57 FAIL: terminal failure'; end if;
  select id into strict source_id from media_object_deletions where object_path=u.source_path and reason='validation_failed';
  select id into strict jpg_id from media_object_deletions where object_path=u.validated_path||'.jpg' and reason='validation_failed';
  select id into strict webp_id from media_object_deletions where object_path=u.validated_path||'.webp' and reason='validation_failed';
  if (select not_before from media_object_deletions where id=source_id)>=t+interval '2 hours 30 seconds'
     or exists(select 1 from media_object_deletions where id in (jpg_id,webp_id)
       and not_before<t+interval '2 hours 30 seconds') then
    raise exception '57 FAIL: source/output fence domains incorrect'; end if;
  if record_media_object_deletion(jpg_id,
       jsonb_build_object('path',u.validated_path||'.jpg','outcome','missing',
         'observed_at',(u.lease_expires_at+interval '2 minutes')::text),
       jsonb_build_object('path','validated/'||u.id::text||'/'||u.attempt_id::text||'/thumb.webp',
         'outcome','missing','observed_at',(u.lease_expires_at+interval '2 minutes')::text))
     or release_media_upload_reservation_if_clean(u.id) then
    raise exception '57 FAIL: lease+2m crossed signed-PUT/evidence/release fence'; end if;
  update media_object_deletions set not_before=clock_timestamp()-interval '1 second'
    where id in (source_id,jpg_id,webp_id);
  if not record_media_object_deletion(source_id,
       jsonb_build_object('path',u.source_path,'outcome','missing','observed_at',clock_timestamp()::text),null)
     or not record_media_object_deletion(jpg_id,
       jsonb_build_object('path',u.validated_path||'.jpg','outcome','missing','observed_at',clock_timestamp()::text),
       jsonb_build_object('path','validated/'||u.id::text||'/'||u.attempt_id::text||'/thumb.webp',
         'outcome','missing','observed_at',clock_timestamp()::text))
     or not record_media_object_deletion(webp_id,
       jsonb_build_object('path',u.validated_path||'.webp','outcome','missing','observed_at',clock_timestamp()::text),null) then
    raise exception '57 FAIL: fresh post-fence evidence rejected'; end if;
  -- Simulate actual passage in addition to the outbox clock for the upload-level release guard.
  update media_uploads set attempt_id=gen_random_uuid(),
    output_credentials_expire_at=clock_timestamp()-interval '1 second' where id=u.id;
  if not release_media_upload_reservation_if_clean(u.id)
     or (select reserved_bytes from media_quota_daily where user_tombstone_id=u.uploader_tombstone_id
       and quota_day=u.quota_day)<>0 then raise exception '57 FAIL: post-fence quota release'; end if;
end $$;
ROLLBACK;
\echo '57 (late-PUT/evidence/quota fence)    : PASS'

BEGIN;
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('photo',true,true,true,false,'57 revoke');
insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,actual_input_bytes,expires_at,quota_day,reserved_charge)
values('57000000-0000-0000-0000-000000000030','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','57000000-0000-0000-0000-000000000031',
 'staging/11111111-1111-1111-1111-111111111111/57000000-0000-0000-0000-000000000030/source',
 'uploaded','closed','image/jpeg',1000,1000,now()+interval '1 hour',current_date,1000);
do $$ declare u media_uploads%rowtype; t timestamptz; r jsonb; begin
  perform rotate_media_envelope_key(null,'key-revoke');
  select * into strict u from claim_media_validation_jobs(1,'57000000-0000-0000-0000-000000000032');
  t:=clock_timestamp();
  perform bind_media_validation_attempt_credentials(u.id,u.attempt_id,
    encode(extensions.digest('dispatch-revoke','sha256'),'hex'),
    encode(extensions.digest('completion-revoke','sha256'),'hex'),'key-revoke',
    t+interval '120 seconds',t,t+interval '2 hours 30 seconds');
  perform redeem_media_validation_dispatch_nonce(u.id,u.attempt_id,'dispatch-revoke','key-revoke');
  perform revoke_media_envelope_key('key-revoke');
  r:=jsonb_build_object('detected_mime','image/jpeg','validated_bytes',900,'sha256',repeat('d',64),
    'width',100,'height',80,'duration_ms',null,'validated_path',u.validated_path||'.jpg',
    'preview_path',null,'cache_control_seconds',60);
  if finalize_media_validation_attempt(u.id,u.attempt_id,'completion-revoke','key-revoke','success',r)
     or exists(select 1 from media_kind_controls where processing_enabled) then
    raise exception '57 FAIL: committed emergency revoke allowed later mutation'; end if;
end $$;
ROLLBACK;
\echo '57 (emergency revocation boundary)   : PASS'
