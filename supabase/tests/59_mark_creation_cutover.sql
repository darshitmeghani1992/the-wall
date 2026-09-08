-- 59 · Post-0024 final Mark creation cutover.
\set ON_ERROR_STOP on

do $$ begin
  if has_table_privilege('authenticated','public.marks','insert')
     or has_table_privilege('service_role','public.marks','insert') then
    raise exception '59 CUTOVER FAIL: direct Mark INSERT grant remains';
  end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='marks' and cmd='INSERT') then
    raise exception '59 CUTOVER FAIL: direct Mark INSERT policy remains';
  end if;
  if has_table_privilege('authenticated','public.mark_media','insert')
     or has_table_privilege('authenticated','public.media_uploads','update')
     or has_table_privilege('authenticated','public.media_object_deletions','insert') then
    raise exception '59 CUTOVER FAIL: private workflow DML exposed';
  end if;
end $$;

BEGIN;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare denied boolean:=false; r jsonb; begin
  begin
    insert into marks(wall_id,author_id,type,text,anonymous)
    values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',auth.uid(),'text','direct cutover bypass',false);
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception '59 CUTOVER FAIL: authenticated direct INSERT succeeded'; end if;
  r:=create_mark('59000000-0000-4000-8000-000000000090','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'text','canonical cutover RPC',null,false,false,0,'{}'::uuid[]);
  if r->>'status'<>'created' then raise exception '59 CUTOVER FAIL: canonical text RPC failed %',r; end if;
end $$;
reset role;
ROLLBACK;

BEGIN;
select set_media_kind_control('photo',true,true,true,true,'59 cutover all-type source validation');
select set_media_kind_control('voice',true,true,true,true,'59 cutover all-type source validation');
select set_media_kind_control('video',true,true,true,true,'59 cutover all-type source validation');
insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,detected_mime,validated_bytes,actual_input_bytes,sha256,
 width,height,duration_ms,validated_path,preview_path,cache_control_seconds,expires_at,validated_at,quota_day,reserved_charge)
values
('59300000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','59300000-0000-4000-8000-000000000011',
 'staging/11111111-1111-1111-1111-111111111111/59300000-0000-4000-8000-000000000001/source',
 'validated','closed','image/jpeg',1000,'image/jpeg',900,1000,repeat('a',64),100,80,null,
 'validated/59300000-0000-4000-8000-000000000001/59300000-0000-4000-8000-000000000101/full.jpg',null,60,
 now()+interval '1 hour',now(),current_date,1000),
('59300000-0000-4000-8000-000000000002','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','voice','59300000-0000-4000-8000-000000000012',
 'staging/11111111-1111-1111-1111-111111111111/59300000-0000-4000-8000-000000000002/source',
 'validated','closed','audio/mp4',1000,'audio/mp4',900,1000,repeat('b',64),null,null,60000,
 'validated/59300000-0000-4000-8000-000000000002/59300000-0000-4000-8000-000000000102/full.m4a',null,60,
 now()+interval '1 hour',now(),current_date,1000),
('59300000-0000-4000-8000-000000000003','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','video','59300000-0000-4000-8000-000000000013',
 'staging/11111111-1111-1111-1111-111111111111/59300000-0000-4000-8000-000000000003/source',
 'validated','closed','video/mp4',1000,'video/mp4',900,1000,repeat('c',64),1920,1080,30000,
 'validated/59300000-0000-4000-8000-000000000003/59300000-0000-4000-8000-000000000103/full.mp4',
 'validated/59300000-0000-4000-8000-000000000003/59300000-0000-4000-8000-000000000103/poster.webp',60,
 now()+interval '1 hour',now(),current_date,1000);
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare p jsonb; v jsonb; m jsonb; begin
  p:=create_mark('59300000-0000-4000-8000-000000000021','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'photo','  cutover photo  ',null,false,false,0,array['59300000-0000-4000-8000-000000000001'::uuid]);
  v:=create_mark('59300000-0000-4000-8000-000000000022','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'voice','cutover voice',null,false,false,0,array['59300000-0000-4000-8000-000000000002'::uuid]);
  m:=create_mark('59300000-0000-4000-8000-000000000023','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'video','cutover video',null,false,false,0,array['59300000-0000-4000-8000-000000000003'::uuid]);
  if p->>'status'<>'created' or v->>'status'<>'created' or m->>'status'<>'created' then
    raise exception '59 CUTOVER FAIL: canonical media RPC failed %, %, %',p,v,m;
  end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from marks where text in ('cutover photo','cutover voice','cutover video'))<>3
     or (select count(*) from mark_media mm join marks m on m.id=mm.mark_id
          where m.text in ('cutover photo','cutover voice','cutover video'))<>3
     or exists(select 1 from marks
          where text in ('cutover photo','cutover voice','cutover video')
            and (media_url is not null or payload is not null))
     or exists(select 1 from mark_media mm join marks m on m.id=mm.mark_id
          where m.text='cutover photo' and (mm.media_type<>'photo' or mm."position"<>0))
     or exists(select 1 from mark_media mm join marks m on m.id=mm.mark_id
          where m.text='cutover voice' and (mm.media_type<>'voice' or mm.duration_ms<>60000))
     or exists(select 1 from mark_media mm join marks m on m.id=mm.mark_id
          where m.text='cutover video' and (mm.media_type<>'video' or mm.duration_ms<>30000)) then
    raise exception '59 CUTOVER FAIL: canonical all-type persistence mismatch';
  end if;
end $$;
select set_media_kind_control('photo',false,false,false,false,'59 cutover source-validation cleanup');
select set_media_kind_control('voice',false,false,false,false,'59 cutover source-validation cleanup');
select set_media_kind_control('video',false,false,false,false,'59 cutover source-validation cleanup');
do $$ begin
  if exists(select 1 from media_kind_controls
      where reservation_enabled or upload_transition_enabled or processing_enabled or creation_enabled) then
    raise exception '59 CUTOVER FAIL: all-type fixture left a media kind enabled';
  end if;
end $$;
ROLLBACK;

BEGIN;
do $$ declare denied boolean:=false; begin
  begin
    insert into marks(wall_id,author_id,type,text,anonymous,media_url)
    values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111',
      'text','privileged legacy injection',false,'https://public.invalid/legacy.jpg');
  exception when check_violation then denied:=true;
  end;
  if not denied then raise exception '59 CUTOVER FAIL: privileged legacy field injection succeeded'; end if;
end $$;
ROLLBACK;

select '59_mark_creation_cutover' as passed;
