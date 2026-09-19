-- Cross-day reservation state is intentionally constructed on two quota days.
-- `begin_media_upload` must count all live sessions, not only the current day.
\set ON_ERROR_STOP on

begin;
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('photo',true,true,false,false,'C1 midnight boundary test');
insert into wall_members(wall_id,user_id,role,status)
values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','member','accepted');
with rows as (
  select gen_random_uuid() as id, gen_random_uuid() as client_upload_id, n
    from generate_series(1,10) as n
)
insert into media_uploads(
  id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
  source_path,state,session_state,declared_mime,declared_bytes,expires_at,quota_day,reserved_charge,created_at
)
select id,'22222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo',client_upload_id,
  'staging/22222222-2222-2222-2222-222222222222/'||id::text||'/source',
  'initiated','open','image/jpeg',100,now()+interval '2 hours',
  case when n=10 then current_date-1 else current_date end,100,
  case when n=10 then now()-interval '30 minutes' else now() end
from rows;
insert into media_quota_daily(user_tombstone_id,quota_day,reserved_bytes,ingested_bytes,reservation_count,open_sessions)
values
  ('22222222-2222-2222-2222-222222222222',current_date,900,0,9,9),
  ('22222222-2222-2222-2222-222222222222',current_date-1,100,0,1,1);
set local role authenticated;
set local "test.uid"='22222222-2222-2222-2222-222222222222';
do $$ declare r jsonb; begin
  r:=begin_media_upload('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo',
    '54000000-0000-0000-0000-000000000003','image/jpeg',100);
  if r->>'status'<>'rate_limited' then
    raise exception '54 FAIL: cross-day active session bypassed limit %',r;
  end if;
end $$;

-- A separate actor has no active sessions but twenty reservations inside the
-- rolling hour. One is attributed to the prior quota day to prove that the
-- actor-wide lock covers cross-day rolling-window inspection as well.
reset role;
insert into wall_members(wall_id,user_id,role,status)
values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','77777777-7777-7777-7777-777777777777','member','accepted');
with rows as (
  select gen_random_uuid() as id, gen_random_uuid() as client_upload_id, n
    from generate_series(1,20) as n
)
insert into media_uploads(
  id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
  source_path,state,session_state,declared_mime,declared_bytes,expires_at,quota_day,reserved_charge,created_at
)
select id,'77777777-7777-7777-7777-777777777777','77777777-7777-7777-7777-777777777777',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo',client_upload_id,
  'staging/77777777-7777-7777-7777-777777777777/'||id::text||'/source',
  'expired','expired','image/jpeg',100,now()-interval '1 minute',
  case when n=20 then current_date-1 else current_date end,100,now()-interval '30 minutes'
from rows;
set local role authenticated;
set local "test.uid"='77777777-7777-7777-7777-777777777777';
do $$ declare r jsonb; begin
  r:=begin_media_upload('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo',
    '54000000-0000-0000-0000-000000000004','image/jpeg',100);
  if r->>'status'<>'rate_limited' then
    raise exception '54 FAIL: cross-day rolling-hour bypassed limit %',r;
  end if;
end $$;
rollback;
\echo '54 (cross-day active/hour boundary): PASS'
