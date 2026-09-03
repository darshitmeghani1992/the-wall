\set ON_ERROR_STOP on
begin;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
insert into storage.objects(bucket_id,name,metadata) values(
 'mark-media','staging/11111111-1111-1111-1111-111111111111/55000000-0000-0000-0000-000000000001/source','{"size":1000}');
insert into media55_results values('staging','inserted');
select pg_sleep(1);
commit;
