\set ON_ERROR_STOP on
begin;
-- Wait behind expiry's actor-wide transaction, then observe and evidence only
-- the committed exact-path outbox row.
select lock_media_actor('11111111-1111-1111-1111-111111111111');
with target as (
 select id,object_path from media_object_deletions
  where object_path='staging/11111111-1111-1111-1111-111111111111/55000000-0000-0000-0000-000000000009/source'
    and reason='upload_expired'
)
insert into media55_results
select 'evidence',record_media_object_deletion(id,
 jsonb_build_object('path',object_path,'outcome','missing','observed_at',clock_timestamp()::text),null)::text from target;
commit;
