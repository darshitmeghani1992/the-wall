\set ON_ERROR_STOP on

drop table if exists media59_race_results;
create table media59_race_results(scenario text primary key,result jsonb not null);
grant select,insert on media59_race_results to authenticated;
drop table if exists media59_race_latches;
create table media59_race_latches(name text primary key);
create or replace function media59_wait_latch(p_name text)
returns void language plpgsql set search_path=pg_catalog,public as $$
declare v_deadline timestamptz:=clock_timestamp()+interval '30 seconds';
begin
  loop
    if exists(select 1 from media59_race_latches where name=p_name) then
      return;
    end if;
    if clock_timestamp()>=v_deadline then
      raise exception '59 RACE FAIL: latch timeout %',p_name;
    end if;
    perform pg_sleep(0.02);
  end loop;
end $$;

update media_legacy_reconciliation set state='complete',completed_at=clock_timestamp() where singleton;
select set_media_kind_control('photo',true,true,true,true,'59 writer races');

insert into media_quota_daily(user_tombstone_id,quota_day,reserved_bytes,reservation_count,open_sessions)
values('11111111-1111-1111-1111-111111111111',current_date,4000,4,1)
on conflict (user_tombstone_id,quota_day) do update
set reserved_bytes=excluded.reserved_bytes,reservation_count=excluded.reservation_count,
    open_sessions=excluded.open_sessions;

insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,detected_mime,validated_bytes,actual_input_bytes,sha256,
 width,height,validated_path,cache_control_seconds,expires_at,validated_at,quota_day,reserved_charge)
values
('59100000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','59100000-0000-4000-8000-000000000011',
 'staging/11111111-1111-1111-1111-111111111111/59100000-0000-4000-8000-000000000001/source',
 'validated','closed','image/jpeg',1000,'image/jpeg',900,1000,repeat('a',64),100,80,
 'validated/59100000-0000-4000-8000-000000000001/59100000-0000-4000-8000-000000000101/full.jpg',60,
 now()+interval '1 hour',now(),current_date,1000),
('59100000-0000-4000-8000-000000000002','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','59100000-0000-4000-8000-000000000012',
 'staging/11111111-1111-1111-1111-111111111111/59100000-0000-4000-8000-000000000002/source',
 'validated','closed','image/jpeg',1000,'image/jpeg',900,1000,repeat('b',64),100,80,
 'validated/59100000-0000-4000-8000-000000000002/59100000-0000-4000-8000-000000000102/full.jpg',60,
 now()+interval '1 hour',now(),current_date,1000),
('59100000-0000-4000-8000-000000000003','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','59100000-0000-4000-8000-000000000013',
 'staging/11111111-1111-1111-1111-111111111111/59100000-0000-4000-8000-000000000003/source',
 'uploaded','closed','image/jpeg',1000,null,null,1000,null,null,null,null,null,
 now()+interval '1 hour',null,current_date,1000),
('59100000-0000-4000-8000-000000000004','11111111-1111-1111-1111-111111111111',
 '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo','59100000-0000-4000-8000-000000000014',
 'staging/11111111-1111-1111-1111-111111111111/59100000-0000-4000-8000-000000000004/source',
 'uploaded','closed','image/jpeg',1000,null,null,1000,null,null,null,null,null,
 now()+interval '1 hour',null,current_date,1000);
update media_uploads set created_at='2000-01-01 00:00:00+00'
 where id='59100000-0000-4000-8000-000000000003';
update media_uploads set created_at='2000-01-01 00:00:01+00'
 where id='59100000-0000-4000-8000-000000000004';

do $$ declare v_active text; begin
  select kid into v_active from media_envelope_keys where status='active';
  if not rotate_media_envelope_key(v_active,'writer-race-key') then
    raise exception '59 RACE FAIL: key provisioning failed';
  end if;
end $$;
create table media59_worker_claim as
select * from claim_media_validation_jobs(2,'59100000-0000-4000-8000-000000000020');
do $$ declare u media_uploads%rowtype; t timestamptz:=clock_timestamp(); begin
  for u in select * from media59_worker_claim order by id loop
    if not bind_media_validation_attempt_credentials(u.id,u.attempt_id,
        encode(extensions.digest('writer-race-dispatch-'||u.id::text,'sha256'),'hex'),
        encode(extensions.digest('writer-race-completion-'||u.id::text,'sha256'),'hex'),'writer-race-key',
        t+interval '120 seconds',t,t+interval '2 hours 30 seconds')
       or not redeem_media_validation_dispatch_nonce(u.id,u.attempt_id,
         'writer-race-dispatch-'||u.id::text,'writer-race-key') then
      raise exception '59 RACE FAIL: worker setup failed %',u.id;
    end if;
  end loop;
end $$;
