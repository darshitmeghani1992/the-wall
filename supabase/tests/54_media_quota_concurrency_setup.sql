-- 54 setup · keeps one real test database alive while the companion shell
-- script opens two physical psql sessions against it.
\set ON_ERROR_STOP on

begin;
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('photo',true,true,false,false,'C1 physical concurrency test');

-- Nine active reservations leave exactly one slot. Both physical sessions race
-- for that last slot; actor-wide locking permits exactly one reservation.
with rows as (
  select gen_random_uuid() as id, gen_random_uuid() as client_upload_id
    from generate_series(1,9)
)
insert into media_uploads(
  id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
  source_path,state,session_state,declared_mime,declared_bytes,expires_at,quota_day,reserved_charge
)
select id,'11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo',client_upload_id,
  'staging/11111111-1111-1111-1111-111111111111/'||id::text||'/source',
  'initiated','open','image/jpeg',100,now()+interval '2 hours',current_date,100
from rows;
insert into media_quota_daily(user_tombstone_id,quota_day,reserved_bytes,ingested_bytes,reservation_count,open_sessions)
values('11111111-1111-1111-1111-111111111111',current_date,900,0,9,9);
commit;
