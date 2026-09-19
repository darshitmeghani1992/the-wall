\set ON_ERROR_STOP on
truncate table media_validation_callback_receipts,media_envelope_keys,
  media_upload_cleanup_requirements,media_object_deletions,mark_media,
  mark_creation_requests,media_uploads,media_quota_daily restart identity cascade;
update media_legacy_reconciliation set state='complete',completed_at=now() where singleton;
select set_media_kind_control('photo',true,true,true,false,'57 physical races');
drop table if exists media57_race_results;
create table media57_race_results(name text primary key,value boolean not null);
create table media57_race_times(name text primary key,started_at timestamptz not null);
create table media57_race_ready(lock_id bigint primary key);
create function media57_wait_ready(p_lock_id bigint) returns void language plpgsql as $$
begin
  for i in 1..1000 loop
    if exists(select 1 from media57_race_ready where lock_id=p_lock_id) then return; end if;
    perform pg_sleep(0.01);
  end loop;
  raise exception '57 RACE FAIL: setup handshake timeout %',p_lock_id;
end $$;

insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,actual_input_bytes,expires_at,quota_day,reserved_charge)
select id,'11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','photo',client_id,
 'staging/11111111-1111-1111-1111-111111111111/'||id::text||'/source',
 'uploaded','closed','image/jpeg',1000,1000,now()+interval '1 hour',current_date,1000
from (values
 ('57100000-0000-0000-0000-000000000001'::uuid,'57100000-0000-0000-0000-000000000011'::uuid),
 ('57100000-0000-0000-0000-000000000002'::uuid,'57100000-0000-0000-0000-000000000012'::uuid),
 ('57100000-0000-0000-0000-000000000003'::uuid,'57100000-0000-0000-0000-000000000013'::uuid),
 ('57100000-0000-0000-0000-000000000004'::uuid,'57100000-0000-0000-0000-000000000014'::uuid),
 ('57100000-0000-0000-0000-000000000005'::uuid,'57100000-0000-0000-0000-000000000015'::uuid)) v(id,client_id);

select rotate_media_envelope_key(null,'race-a');
create table media57_claims(slot integer primary key,upload_id uuid,attempt_id uuid,validated_path text);
insert into media57_claims
select row_number() over(order by id),id,attempt_id,validated_path
from claim_media_validation_jobs(5,'57100000-0000-0000-0000-000000000020');
