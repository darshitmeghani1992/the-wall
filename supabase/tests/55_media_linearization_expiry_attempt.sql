\set ON_ERROR_STOP on
begin;
insert into media55_results values('expiry',expire_media_uploads()::text);
select pg_sleep(1);
commit;
