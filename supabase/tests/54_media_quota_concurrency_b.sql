\set ON_ERROR_STOP on
begin;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
select begin_media_upload('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo',
  '54000000-0000-0000-0000-000000000002','image/jpeg',100)->>'status';
commit;
