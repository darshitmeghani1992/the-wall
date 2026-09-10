\set ON_ERROR_STOP on
begin;
with claimed as (select * from claim_media_validation_jobs(1,'55000000-0000-0000-0000-000000000205'))
insert into media55_results select 'processing',id::text from claimed;
select pg_sleep(1);
commit;
