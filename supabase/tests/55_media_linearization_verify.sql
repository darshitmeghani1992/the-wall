\set ON_ERROR_STOP on
select case when :'scenario'='reservation' then 'true' else 'false' end as is_reservation,
       case when :'scenario'='staging' then 'true' else 'false' end as is_staging,
       case when :'scenario'='transition' then 'true' else 'false' end as is_transition,
       case when :'scenario'='processing' then 'true' else 'false' end as is_processing,
       case when :'scenario'='creation' then 'true' else 'false' end as is_creation,
       case when :'scenario'='expiry' then 'true' else 'false' end as is_expiry
\gset

\if :is_reservation
do $$ begin
 if (select value from media55_results where scenario='reservation')<>'ready'
    or not exists(select 1 from media_uploads where client_upload_id='55000000-0000-0000-0000-000000000110') then
   raise exception '55 FAIL: enabled reservation winner left no side effect'; end if;
end $$;
set role authenticated;
set "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare r jsonb; begin
 r:=begin_media_upload('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo',
   '55000000-0000-0000-0000-000000000111','image/jpeg',1000);
 if r->>'status'<>'unavailable' then raise exception '55 FAIL: disabled reservation loser won %',r; end if;
end $$;
reset role;
\endif

\if :is_staging
do $$ begin
 if (select value from media55_results where scenario='staging')<>'inserted'
    or not exists(select 1 from storage.objects where bucket_id='mark-media' and name like '%000000000001/source') then
   raise exception '55 FAIL: enabled staging winner left no object'; end if;
end $$;
set role authenticated;
set "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare denied boolean:=false; begin
 begin insert into storage.objects(bucket_id,name,metadata) values('mark-media',
  'staging/11111111-1111-1111-1111-111111111111/55000000-0000-0000-0000-000000000002/source','{"size":1000}');
 exception when others then denied:=true; end;
 if not denied then raise exception '55 FAIL: disabled staging loser inserted'; end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='mark-media' and name like '%000000000002/source') then
   raise exception '55 FAIL: staging loser left object side effect'; end if;
end $$;
\endif

\if :is_transition
do $$ begin
 if (select value from media55_results where scenario='transition')<>'uploaded'
    or (select state from media_uploads where id='55000000-0000-0000-0000-000000000003')<>'uploaded' then
   raise exception '55 FAIL: enabled transition winner left no state change'; end if;
end $$;
set role authenticated;
set "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare r jsonb; begin
 r:=mark_media_uploaded('55000000-0000-0000-0000-000000000004');
 if r->>'status'<>'unavailable' then raise exception '55 FAIL: disabled transition loser won %',r; end if;
end $$;
reset role;
do $$ begin
 if (select state from media_uploads where id='55000000-0000-0000-0000-000000000004')<>'initiated'
    or not exists(select 1 from storage.objects where bucket_id='mark-media' and name like '%000000000004/source') then
   raise exception '55 FAIL: transition loser changed row/object'; end if;
end $$;
\endif

\if :is_processing
do $$ begin
 if not exists(select 1 from media55_results where scenario='processing' and value<>'')
    or (select count(*) from media_uploads where state='processing')<>1
    or exists(select 1 from claim_media_validation_jobs(1,'55000000-0000-0000-0000-000000000206')) then
   raise exception '55 FAIL: processing winner/loser side effects incorrect'; end if;
end $$;
\endif

\if :is_creation
do $$ begin
 if ((select value from media55_results where scenario='creation')::jsonb)->>'status'<>'created'
    or (select count(*) from mark_media where upload_id='55000000-0000-0000-0000-000000000007')<>1
    or (select count(*) from notifications n join mark_media m on m.mark_id=n.mark_id
         where m.upload_id='55000000-0000-0000-0000-000000000007')<>1 then
   raise exception '55 FAIL: enabled creation winner was incomplete'; end if;
end $$;
set role authenticated;
set "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare r jsonb; begin
 r:=create_mark('55000000-0000-0000-0000-000000000308','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'photo',null,null,false,false,0,array['55000000-0000-0000-0000-000000000008'::uuid]);
 if r->>'status'<>'unavailable' then raise exception '55 FAIL: disabled creation loser won %',r; end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from mark_media where upload_id='55000000-0000-0000-0000-000000000008') then
   raise exception '55 FAIL: creation loser left relation side effect'; end if;
end $$;
\endif

\if :is_expiry
do $$ begin
 if (select value from media55_results where scenario='expiry')<>'1'
    or (select value from media55_results where scenario='evidence')<>'true'
    or not exists(select 1 from media_uploads where id='55000000-0000-0000-0000-000000000009'
      and state='expired' and quota_reservation_released_at is not null)
    or not exists(select 1 from media_object_deletions where object_path like '%000000000009/source'
      and state='deleted' and object_evidence->>'outcome'='missing') then
   raise exception '55 FAIL: expiry/evidence linearization side effects incorrect'; end if;
end $$;
\endif
