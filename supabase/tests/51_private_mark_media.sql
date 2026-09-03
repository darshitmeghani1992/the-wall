-- 51 · Private Mark-media contracts: default-off gates, private staging,
-- trusted validation, atomic creation, immutable relation, and path secrecy.
\set ON_ERROR_STOP on

BEGIN;
do $$ begin
  if exists(select 1 from media_kind_controls where reservation_enabled or upload_transition_enabled
    or processing_enabled or creation_enabled) then
    raise exception '51 FAIL: a media kind did not default off';
  end if;
  if not exists(select 1 from storage.buckets where id='mark-media' and not public
    and file_size_limit=52428800) then raise exception '51 FAIL: private bucket contract'; end if;
  if (select format_type(a.atttypid,a.atttypmod) from pg_attribute a
       where a.attrelid='storage.objects'::regclass and a.attname='owner_id' and not a.attisdropped)<>'text' then
    raise exception '51 FAIL: hosted Storage owner_id type drift';
  end if;
  if has_table_privilege('authenticated','public.media_uploads','select')
     or has_table_privilege('authenticated','public.mark_media','select')
     or has_function_privilege('authenticated','public.resolve_mark_media_for_signing(uuid,uuid,uuid)','execute')
     or has_function_privilege('authenticated','public.bind_media_validation_attempt_nonces(uuid,uuid,text,text,text)','execute')
     or has_function_privilege('authenticated','public.redeem_media_validation_dispatch_nonce(uuid,uuid,text,text)','execute')
     or has_function_privilege('authenticated','public.redeem_media_validation_completion_nonce(uuid,uuid,text,text)','execute')
     or has_function_privilege('authenticated','public.record_media_object_deletion(uuid,jsonb,jsonb)','execute')
     or has_table_privilege('authenticated','public.media_upload_cleanup_requirements','select') then
    raise exception '51 FAIL: private workflow/path surface exposed';
  end if;
end $$;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare r jsonb; denied boolean:=false; begin
  r:=begin_media_upload('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo',
    '51000000-0000-0000-0000-000000000001','image/jpeg',1024);
  if r<>jsonb_build_object('status','unavailable') then raise exception '51 FAIL: reservation switch bypass'; end if;
  begin insert into storage.objects(bucket_id,name,metadata) values('mark-media','staging/arbitrary/source','{"size":1024}');
  exception when others then denied:=true; end;
  if not denied then raise exception '51 FAIL: arbitrary staging path accepted'; end if;
end $$;
ROLLBACK;
\echo '51 (default-off/private floor)     : PASS'

BEGIN;
-- Each server switch must block at its own boundary even when a caller has
-- already crossed an earlier boundary. A forged client flag is irrelevant.
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
create temp table media51_switch(upload_id uuid,path text) on commit drop;
grant select,insert on media51_switch to authenticated;
grant select on media51_switch to service_role;
set local role service_role;
select set_media_kind_control('photo',true,false,false,false,'C1 switch boundary test');
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare r jsonb; begin
  r:=begin_media_upload('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo',
    '51000000-0000-0000-0000-000000000090','image/jpeg',1024);
  if r->>'status'<>'ready' then raise exception '51 FAIL: reservation boundary setup denied %',r; end if;
  insert into media51_switch values((r->>'upload_id')::uuid,r->>'path');
end $$;
reset role;
do $$ declare uid uuid; p text; begin
  select upload_id,path into strict uid,p from media51_switch;
  insert into storage.objects(bucket_id,name,owner_id,metadata)
    values('mark-media',p,'11111111-1111-1111-1111-111111111111'::text,'{"size":1024}');
end $$;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare uid uuid; r jsonb; begin
  select upload_id into strict uid from media51_switch;
  r:=mark_media_uploaded(uid);
  if r->>'status'<>'unavailable' then raise exception '51 FAIL: upload-transition switch bypass %',r; end if;
end $$;
reset role;
set local role service_role;
select set_media_kind_control('photo',true,true,false,false,'C1 processing switch test');
do $$ declare uid uuid; p text; begin
  select upload_id,path into strict uid,p from media51_switch;
  update media_uploads set state='uploaded',session_state='closed',actual_input_bytes=1024,
    quota_session_released_at=now() where id=uid;
  update media_quota_daily set open_sessions=open_sessions-1
    where user_tombstone_id='11111111-1111-1111-1111-111111111111' and quota_day=current_date;
  if exists(select 1 from claim_media_validation_jobs(1,'51000000-0000-0000-0000-000000000091')) then
    raise exception '51 FAIL: processing switch bypass'; end if;
end $$;
ROLLBACK;
\echo '51 (four server switch boundaries) : PASS'

BEGIN;
-- Test-only enablement satisfies the mechanical legacy gate with empty inventory.
update media_legacy_reconciliation set state='complete',completed_at=now(),completed_by=null where singleton;
create temp table media51(upload_id uuid,mark_id uuid) on commit drop;
grant select,insert,update on media51 to authenticated;
grant select on media51 to service_role;
set local role service_role;
select set_media_kind_control('photo',true,true,true,false,'C1 test') ;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare r jsonb; uid uuid; p text; wrong_owner_denied boolean:=false; affected bigint; begin
  if begin_media_upload('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo',
    '51000000-0000-0000-0000-000000000099','text/plain',1024)->>'status'<>'invalid' then
    raise exception '51 FAIL: kind/MIME mismatch accepted'; end if;
  r:=begin_media_upload('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo',
    '51000000-0000-0000-0000-000000000001','image/jpeg',1024);
  if r->>'status'<>'ready' then raise exception '51 FAIL: valid reservation denied %',r; end if;
  uid:=(r->>'upload_id')::uuid; p:=r->>'path';
  insert into media51(upload_id) values(uid);
  -- A caller may not write a valid reservation path while choosing another
  -- Storage owner; the transition must never be asked to clean up that
  -- avoidable substitution attempt.
  begin
    insert into storage.objects(bucket_id,name,owner_id,metadata)
      values('mark-media',p,'22222222-2222-2222-2222-222222222222'::text,'{"size":1024}');
  exception when others then wrong_owner_denied:=true;
  end;
  if not wrong_owner_denied then raise exception '51 FAIL: staging owner binding bypass'; end if;
  insert into storage.objects(bucket_id,name,metadata) values('mark-media',p,'{"size":1024}');
  -- The inherited attachment policies must not let this same owner mutate,
  -- move, or delete a private staging object after upload.
  update storage.objects set metadata='{"size":2048}' where bucket_id='mark-media' and name=p;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception '51 FAIL: uploader mutated staging metadata'; end if;
  update storage.objects set name=p||'-moved' where bucket_id='mark-media' and name=p;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception '51 FAIL: uploader moved staging object'; end if;
  delete from storage.objects where bucket_id='mark-media' and name=p;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception '51 FAIL: uploader deleted staging object'; end if;
  r:=mark_media_uploaded(uid);
  if r->>'status'<>'uploaded' then raise exception '51 FAIL: transition denied %',r; end if;
  if mark_media_uploaded(uid)->>'status'<>'uploaded' then raise exception '51 FAIL: transition retry not idempotent'; end if;
end $$;
reset role;
do $$ declare u media_uploads%rowtype; claimed media_uploads%rowtype; ok boolean; begin
  select * into strict u from media_uploads where client_upload_id='51000000-0000-0000-0000-000000000001';
  select * into strict claimed from claim_media_validation_jobs(1,'51000000-0000-0000-0000-000000000010');
  if claimed.id<>u.id or claimed.validated_path not like 'validated/'||u.id::text||'/'||claimed.attempt_id::text||'/full' then
    raise exception '51 FAIL: claim path not bound to attempt'; end if;
  if not bind_media_validation_attempt_nonces(claimed.id,claimed.attempt_id,
      encode(extensions.digest('media51-dispatch','sha256'),'hex'),
      encode(extensions.digest('media51-completion','sha256'),'hex'),'media51-kid') then
    raise exception '51 FAIL: service nonce binding rejected'; end if;
  if not redeem_media_validation_dispatch_nonce(claimed.id,claimed.attempt_id,'media51-dispatch','media51-kid')
     or redeem_media_validation_dispatch_nonce(claimed.id,claimed.attempt_id,'media51-dispatch','media51-kid') then
    raise exception '51 FAIL: dispatch nonce was not exactly one-use'; end if;
  if not redeem_media_validation_completion_nonce(claimed.id,claimed.attempt_id,'media51-completion','media51-kid')
     or redeem_media_validation_completion_nonce(claimed.id,claimed.attempt_id,'media51-completion','media51-kid') then
    raise exception '51 FAIL: completion nonce was not exactly one-use'; end if;
  ok:=complete_media_validation(claimed.id,claimed.attempt_id,'image/jpeg',900,repeat('a',64),
    100,80,null,claimed.validated_path||'.jpg',
    'validated/'||claimed.id::text||'/'||claimed.attempt_id::text||'/thumb.webp',60);
  if not ok then raise exception '51 FAIL: valid completion rejected'; end if;
  if not exists(select 1 from media_object_deletions where object_path=claimed.source_path and reason='source_validated') then
    raise exception '51 FAIL: validated source cleanup not durable'; end if;
end $$;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare r jsonb; uid uuid; begin
  select upload_id into strict uid from media51;
  r:=create_mark('51000000-0000-0000-0000-000000000020','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'photo',null,null,false,false,1.25,array[uid]);
  if r->>'status'<>'unavailable' then raise exception '51 FAIL: creation switch bypass %',r; end if;
end $$;
reset role;
set local role service_role;
select set_media_kind_control('photo',true,true,true,true,'C1 test create');
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare r jsonb; uid uuid; mid uuid; denied boolean:=false; begin
  select upload_id into strict uid from media51;
  r:=create_mark('51000000-0000-0000-0000-000000000020','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'photo',null,null,false,false,1.25,array[uid]);
  if r->>'status'<>'created' then raise exception '51 FAIL: canonical create failed %',r; end if;
  mid:=(r->>'mark_id')::uuid;
  update media51 set mark_id=mid;
  r:=create_mark('51000000-0000-0000-0000-000000000020','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'photo',null,null,false,false,-2,array[uid]);
  if r->>'status'<>'existing' or (r->>'mark_id')::uuid<>mid then raise exception '51 FAIL: idempotent retry duplicated'; end if;
  begin update mark_media set "position"=1 where mark_id=mid; exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception '51 FAIL: app mutated mark_media'; end if;
end $$;
reset role;
do $$ declare mid uuid; alert_count integer; begin
  select mark_id into strict mid from media51;
  if (select count(*) from mark_media where mark_id=mid)<>1
     or exists(select 1 from marks where id=mid and (media_url is not null or payload is not null)) then
    raise exception '51 FAIL: canonical relation/legacy-null invariant'; end if;
  select count(*) into alert_count from notifications where mark_id=mid;
  if alert_count<>1 then raise exception '51 FAIL: expected one Alert, got %',alert_count; end if;
end $$;
set local role service_role;
do $$ declare mid uuid; allowed_count integer; missing_count integer; blocked_count integer; begin
  select mark_id into strict mid from media51;
  select count(*) into allowed_count from resolve_mark_media_for_signing(
    '11111111-1111-1111-1111-111111111111',mid,'51000000-0000-0000-0000-000000000024');
  if allowed_count<>1 then raise exception '51 FAIL: resolver denied permitted viewer'; end if;
  select count(*) into missing_count from resolve_mark_media_for_signing(
    '11111111-1111-1111-1111-111111111111','51000000-0000-0000-0000-000000000025',
    '51000000-0000-0000-0000-000000000026');
  if missing_count<>0 then raise exception '51 FAIL: resolver exposed missing Mark'; end if;
  insert into blocks(blocker_id,blocked_id) values
    ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111');
  select count(*) into blocked_count from resolve_mark_media_for_signing(
    '11111111-1111-1111-1111-111111111111',mid,'51000000-0000-0000-0000-000000000027');
  if blocked_count<>0 then raise exception '51 FAIL: resolver exposed blocked Mark media'; end if;
end $$;
ROLLBACK;
\echo '51 (staging/validation/create)     : PASS'

BEGIN;
-- Secret media must fail before any Mark, relation, or Alert side effect.
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('photo',true,true,true,true,'C1 secret rejection');
insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,detected_mime,validated_bytes,actual_input_bytes,
 sha256,width,height,validated_path,cache_control_seconds,expires_at,validated_at,quota_day,reserved_charge)
values('51000000-0000-0000-0000-000000000030','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','51000000-0000-0000-0000-000000000031',
 'staging/11111111-1111-1111-1111-111111111111/51000000-0000-0000-0000-000000000030/source',
 'validated','closed','image/jpeg',1000,'image/jpeg',900,1000,repeat('b',64),100,80,
 'validated/51000000-0000-0000-0000-000000000030/51000000-0000-0000-0000-000000000032/full.jpg',60,
 now()+interval '1 hour',now(),current_date,1000);
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare r jsonb; begin
  r:=create_mark('51000000-0000-0000-0000-000000000033','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'photo',null,null,false,true,0,array['51000000-0000-0000-0000-000000000030'::uuid]);
  if r->>'status'<>'invalid' then raise exception '51 FAIL: Secret media accepted'; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from mark_creation_requests where request_id='51000000-0000-0000-0000-000000000033')
     or exists(select 1 from mark_media where upload_id='51000000-0000-0000-0000-000000000030') then
    raise exception '51 FAIL: Secret rejection left partial state'; end if;
end $$;
ROLLBACK;
\echo '51 (Secret media atomic reject)    : PASS'
