-- 52 · Mark-media retry/race invariants. These deterministic checks exercise
-- the serialization outcomes; the independent hosted pass must additionally
-- run the same-key and same-upload cases from two physical sessions.
\set ON_ERROR_STOP on

BEGIN;
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('photo',true,true,true,true,'C1 race tests');

-- Lease replacement: a stale attempt cannot complete or overwrite the winner.
insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,actual_input_bytes,expires_at,quota_day,reserved_charge)
values('52000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','52000000-0000-0000-0000-000000000002',
 'staging/11111111-1111-1111-1111-111111111111/52000000-0000-0000-0000-000000000001/source',
 'uploaded','closed','image/jpeg',1000,1000,now()+interval '1 hour',current_date,1000);
do $$ declare first_try media_uploads%rowtype; second_try media_uploads%rowtype; begin
  select * into strict first_try from claim_media_validation_jobs(1,'52000000-0000-0000-0000-000000000010');
  if not bind_media_validation_attempt_nonces(first_try.id,first_try.attempt_id,
      encode(extensions.digest('media52-first-dispatch','sha256'),'hex'),
      encode(extensions.digest('media52-first-completion','sha256'),'hex'),'media52-kid') then
    raise exception '52 FAIL: first attempt nonce bind rejected'; end if;
  update media_uploads set lease_expires_at=now()-interval '1 second' where id=first_try.id;
  select * into strict second_try from claim_media_validation_jobs(1,'52000000-0000-0000-0000-000000000011');
  if first_try.attempt_id=second_try.attempt_id then raise exception '52 FAIL: retry reused attempt identity'; end if;
  if not bind_media_validation_attempt_nonces(second_try.id,second_try.attempt_id,
      encode(extensions.digest('media52-second-dispatch','sha256'),'hex'),
      encode(extensions.digest('media52-second-completion','sha256'),'hex'),'media52-kid')
     or not redeem_media_validation_dispatch_nonce(second_try.id,second_try.attempt_id,'media52-second-dispatch','media52-kid')
     or not redeem_media_validation_completion_nonce(second_try.id,second_try.attempt_id,'media52-second-completion','media52-kid') then
    raise exception '52 FAIL: current attempt nonce lifecycle rejected'; end if;
  if complete_media_validation(first_try.id,first_try.attempt_id,'image/jpeg',900,repeat('a',64),100,80,null,
      first_try.validated_path||'.jpg',null,60) then raise exception '52 FAIL: stale completion won'; end if;
  if not complete_media_validation(second_try.id,second_try.attempt_id,'image/jpeg',900,repeat('b',64),100,80,null,
      second_try.validated_path||'.jpg',null,60) then raise exception '52 FAIL: current completion lost'; end if;
  if complete_media_validation(second_try.id,second_try.attempt_id,'image/jpeg',900,repeat('b',64),100,80,null,
      second_try.validated_path||'.jpg',null,60) then raise exception '52 FAIL: completion replay accepted'; end if;
  if not exists(select 1 from media_object_deletions
    where reason='superseded_attempt_'||first_try.attempt_id::text) then
    raise exception '52 FAIL: superseded attempt cleanup missing'; end if;
  -- A lease replacement reuses the one staging source. Only the old attempt's
  -- output candidates may be deleted; queueing source would break the winner.
  if exists(select 1 from media_object_deletions
      where reason='superseded_attempt_'||first_try.attempt_id::text
        and object_path=first_try.source_path) then
    raise exception '52 FAIL: superseded attempt queued shared source';
  end if;
  if exists(select 1 from media_upload_cleanup_requirements r
      join media_object_deletions d on d.id=r.deletion_id
     where r.upload_id=first_try.id and d.reason='superseded_attempt_'||first_try.attempt_id::text) then
    raise exception '52 FAIL: superseded attempt became full-upload cleanup';
  end if;
  if second_try.source_path<>first_try.source_path
     or not exists(select 1 from media_uploads where id=second_try.id
       and source_path=first_try.source_path and state='validated') then
    raise exception '52 FAIL: replacement lost readable shared source';
  end if;
end $$;
ROLLBACK;
\echo '52 (attempt lease/replay)           : PASS'

BEGIN;
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('photo',true,true,true,false,'C1 terminal validation cleanup');

-- Simulate a processor that wrote only the JPG + thumbnail before reporting a
-- fifth-attempt failure. The source, partial output, and every possible
-- same-attempt candidate must still be queued as exact deletion targets.
insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,actual_input_bytes,attempt_count,expires_at,quota_day,reserved_charge,
 quota_session_released_at)
values('52000000-0000-0000-0000-000000000011','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','52000000-0000-0000-0000-000000000012',
 'staging/11111111-1111-1111-1111-111111111111/52000000-0000-0000-0000-000000000011/source',
 'uploaded','closed','image/jpeg',1000,1000,4,now()+interval '1 hour',current_date,1000,now());
insert into media_quota_daily(user_tombstone_id,quota_day,reserved_bytes,ingested_bytes,reservation_count,open_sessions)
values('11111111-1111-1111-1111-111111111111',current_date,1000,0,1,0);
do $$ declare claimed media_uploads%rowtype; source_path text; jpg_path text; thumb_path text; webp_path text;
  source_delete uuid; jpg_delete uuid; webp_delete uuid; begin
  select * into strict claimed from claim_media_validation_jobs(1,'52000000-0000-0000-0000-000000000013');
  source_path:=claimed.source_path;
  jpg_path:=claimed.validated_path||'.jpg';
  thumb_path:='validated/'||claimed.id::text||'/'||claimed.attempt_id::text||'/thumb.webp';
  webp_path:=claimed.validated_path||'.webp';
  if not fail_media_validation(claimed.id,claimed.attempt_id,'DECODER_FAILED') then
    raise exception '52 FAIL: terminal failure callback rejected'; end if;
  if (select state from media_uploads where id=claimed.id)<>'failed' then
    raise exception '52 FAIL: terminal failure did not persist'; end if;
  if not exists(select 1 from media_object_deletions where object_path=source_path and reason='validation_failed')
     or not exists(select 1 from media_object_deletions where object_path=jpg_path and preview_path=thumb_path and reason='validation_failed')
     or not exists(select 1 from media_object_deletions where object_path=webp_path and reason='validation_failed') then
    raise exception '52 FAIL: terminal partial-output cleanup was incomplete';
  end if;
  if (select count(*) from media_upload_cleanup_requirements where upload_id=claimed.id)<>3 then
    raise exception '52 FAIL: terminal cleanup evidence requirements incomplete'; end if;
  select id into strict source_delete from media_object_deletions where object_path=source_path and reason='validation_failed';
  select id into strict jpg_delete from media_object_deletions where object_path=jpg_path and reason='validation_failed';
  select id into strict webp_delete from media_object_deletions where object_path=webp_path and reason='validation_failed';
  if not record_media_object_deletion(source_delete,
       jsonb_build_object('path',source_path,'outcome','missing','observed_at',clock_timestamp()::text),null)
     or not record_media_object_deletion(jpg_delete,
       jsonb_build_object('path',jpg_path,'outcome','deleted','observed_at',clock_timestamp()::text),
       jsonb_build_object('path',thumb_path,'outcome','missing','observed_at',clock_timestamp()::text)) then
    raise exception '52 FAIL: partial terminal cleanup evidence rejected'; end if;
  if (select quota_reservation_released_at from media_uploads where id=claimed.id) is not null then
    raise exception '52 FAIL: partial output cleanup released quota early'; end if;
  if not record_media_object_deletion(webp_delete,
       jsonb_build_object('path',webp_path,'outcome','missing','observed_at',clock_timestamp()::text),null)
     or (select quota_reservation_released_at from media_uploads where id=claimed.id) is null then
    raise exception '52 FAIL: complete terminal cleanup did not release quota'; end if;
end $$;
ROLLBACK;
\echo '52 (terminal partial-output cleanup): PASS'

BEGIN;
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('photo',true,true,true,true,'C1 create races');
insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,detected_mime,validated_bytes,actual_input_bytes,sha256,
 width,height,validated_path,cache_control_seconds,expires_at,validated_at,quota_day,reserved_charge)
values('52000000-0000-0000-0000-000000000020','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','52000000-0000-0000-0000-000000000021',
 'staging/11111111-1111-1111-1111-111111111111/52000000-0000-0000-0000-000000000020/source',
 'validated','closed','image/jpeg',1000,'image/jpeg',900,1000,repeat('c',64),100,80,
 'validated/52000000-0000-0000-0000-000000000020/52000000-0000-0000-0000-000000000022/full.jpg',60,
 now()+interval '1 hour',now(),current_date,1000);
create temp table media52(first_result jsonb) on commit drop;
grant select,insert on media52 to authenticated;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare a jsonb; b jsonb; c jsonb; begin
  a:=create_mark('52000000-0000-0000-0000-000000000030','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'photo',null,null,false,false,0,array['52000000-0000-0000-0000-000000000020'::uuid]);
  b:=create_mark('52000000-0000-0000-0000-000000000030','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'photo',null,null,false,false,2,array['52000000-0000-0000-0000-000000000020'::uuid]);
  c:=create_mark('52000000-0000-0000-0000-000000000031','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'photo',null,null,false,false,0,array['52000000-0000-0000-0000-000000000020'::uuid]);
  if a->>'status'<>'created' or b->>'status'<>'existing' or a->>'mark_id'<>b->>'mark_id' then
    raise exception '52 FAIL: same-key retry did not converge'; end if;
  if c->>'status'<>'media_not_ready' then raise exception '52 FAIL: upload consumed twice %',c; end if;
  if create_mark('52000000-0000-0000-0000-000000000030','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'photo',null,null,true,false,0,array['52000000-0000-0000-0000-000000000020'::uuid])->>'status'<>'request_id_reused' then
    raise exception '52 FAIL: same key/different fingerprint accepted'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from mark_creation_requests where request_id='52000000-0000-0000-0000-000000000030')<>1
     or (select count(*) from mark_media where upload_id='52000000-0000-0000-0000-000000000020')<>1 then
    raise exception '52 FAIL: serialized creation cardinality'; end if;
end $$;
ROLLBACK;
\echo '52 (request/upload serialization)  : PASS'

BEGIN;
-- A failure after the request insert rolls back request, Mark, Secret/Anonymous
-- provenance, media relation, and Alert together.
create or replace function media52_forced_failure() returns trigger language plpgsql as $$
begin raise exception 'MEDIA52_INDUCED'; end $$;
create trigger zy_media52_forced_failure after insert on marks
  for each row when (new.text='media52 rollback') execute function media52_forced_failure();
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare denied boolean:=false; begin
  begin perform create_mark('52000000-0000-0000-0000-000000000040','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'text','media52 rollback',null,false,false,0,'{}'::uuid[]);
  exception when others then denied:=true; end;
  if not denied then raise exception '52 FAIL: induced failure did not fire'; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from mark_creation_requests where request_id='52000000-0000-0000-0000-000000000040')
     or exists(select 1 from marks where text='media52 rollback') then
    raise exception '52 FAIL: induced rollback left partial state'; end if;
end $$;
ROLLBACK;
\echo '52 (transaction rollback)          : PASS'

BEGIN;
-- Completed request becomes a permanent deleted tombstone and cannot recreate.
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare a jsonb; b jsonb; mid uuid; begin
  a:=create_mark('52000000-0000-0000-0000-000000000050','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'text','delete retry',null,false,false,0,'{}'::uuid[]);
  mid:=(a->>'mark_id')::uuid;
  delete from marks where id=mid;
  b:=create_mark('52000000-0000-0000-0000-000000000050','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'text','delete retry',null,false,false,0,'{}'::uuid[]);
  if b->>'status'<>'deleted' or (b->>'mark_id')::uuid<>mid then raise exception '52 FAIL: deleted retry recreated'; end if;
end $$;
ROLLBACK;
\echo '52 (post-delete tombstone)         : PASS'
