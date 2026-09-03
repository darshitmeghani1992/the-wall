\set ON_ERROR_STOP on
begin;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
insert into media55_results values('reservation',begin_media_upload(
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','55000000-0000-0000-0000-000000000110','image/jpeg',1000)->>'status');
select pg_sleep(1);
commit;
