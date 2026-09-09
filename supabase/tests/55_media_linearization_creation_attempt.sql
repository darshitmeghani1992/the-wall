\set ON_ERROR_STOP on
begin;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
insert into media55_results values('creation',create_mark(
 '55000000-0000-0000-0000-000000000307','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo',
 null,null,false,false,0,array['55000000-0000-0000-0000-000000000007'::uuid])::text);
select pg_sleep(1);
commit;
