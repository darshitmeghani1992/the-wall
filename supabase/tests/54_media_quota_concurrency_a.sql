\set ON_ERROR_STOP on
begin;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
-- Match lock_media_actor exactly. Holding it first makes the two-session
-- serialization deterministic rather than timing-dependent.
select pg_advisory_xact_lock(hashtextextended(
  'media-upload-actor:11111111-1111-1111-1111-111111111111',19));
select begin_media_upload('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo',
  '54000000-0000-0000-0000-000000000001','image/jpeg',100)->>'status';
select pg_sleep(1.0);
commit;
