\set ON_ERROR_STOP on

do $$
begin
  if has_function_privilege('authenticated','public.claim_media_object_deletions(integer,uuid)','execute')
     or has_function_privilege('anon','public.finalize_media_object_deletion_attempt(uuid,uuid,text,jsonb,jsonb,text)','execute')
     or has_function_privilege('service_role','public.record_media_object_deletion(uuid,jsonb,jsonb)','execute') then
    raise exception 'operations privilege boundary is open';
  end if;
  if exists(select 1 from media_kind_controls where reservation_enabled or upload_transition_enabled
      or processing_enabled or creation_enabled) then
    raise exception '0022 must preserve default-off media controls';
  end if;
end $$;

do $$
declare
  d uuid;
  first_claim record;
  replacement record;
  before_state media_object_deletions%rowtype;
  after_state media_object_deletions%rowtype;
  observed timestamptz;
begin
  insert into media_object_deletions(idempotency_key,bucket_id,object_path,reason,not_before)
  values('ops:reclaim','mark-media',
    'validated/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/full.jpg',
    'test',clock_timestamp()-interval '1 second') returning id into d;

  select * into strict first_claim from claim_media_object_deletions(1,'58000000-0000-4000-8000-000000000001');
  if first_claim.deletion_id<>d or first_claim.attempt_id is null
     or first_claim.lease_expires_at<=clock_timestamp() then
    raise exception 'initial cleanup claim is not live';
  end if;
  if exists(select 1 from claim_media_object_deletions(1,'58000000-0000-4000-8000-000000000099')) then
    raise exception 'live cleanup lease was reclaimed early';
  end if;
  update media_object_deletions set lease_expires_at=clock_timestamp()-interval '1 second' where id=d;
  select * into strict replacement from claim_media_object_deletions(1,'58000000-0000-4000-8000-000000000002');
  if replacement.attempt_id=first_claim.attempt_id then raise exception 'reclaim reused attempt identity'; end if;
  if not exists(select 1 from media_object_deletion_attempts
      where deletion_id=d and attempt_id=first_claim.attempt_id and state='expired') then
    raise exception 'expired attempt history missing';
  end if;

  select * into before_state from media_object_deletions where id=d;
  if finalize_media_object_deletion_attempt(d,first_claim.attempt_id,'deleted',
      jsonb_build_object('path',before_state.object_path,'outcome','deleted','observed_at',clock_timestamp()),
      null,null) then raise exception 'superseded callback accepted'; end if;
  select * into after_state from media_object_deletions where id=d;
  if after_state is distinct from before_state then raise exception 'stale callback mutated current row'; end if;

  observed:=clock_timestamp();
  if not finalize_media_object_deletion_attempt(d,replacement.attempt_id,'deleted',
      jsonb_build_object('path',replacement.object_path,'outcome','deleted','observed_at',observed),
      null,null) then raise exception 'current exact evidence rejected'; end if;
  if not exists(select 1 from media_object_deletions where id=d and state='deleted'
      and object_evidence->>'path'=replacement.object_path) then
    raise exception 'exact evidence was not persisted';
  end if;
end $$;

do $$
declare
  d uuid;
  c record;
  i integer;
begin
  insert into media_object_deletions(idempotency_key,bucket_id,object_path,reason,not_before)
  values('ops:six-attempts','mark-media',
    'staging/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cccccccc-cccc-4ccc-8ccc-cccccccccccc/source',
    'test',clock_timestamp()-interval '1 second') returning id into d;
  for i in 1..6 loop
    select * into strict c from claim_media_object_deletions(1,
      ('58000000-0000-4000-8000-'||lpad((100+i)::text,12,'0'))::uuid);
    if c.deletion_id<>d then raise exception 'wrong retry claim'; end if;
    if not finalize_media_object_deletion_attempt(d,c.attempt_id,'failed',null,null,'STORAGE_DELETE_FAILED') then
      raise exception 'failed attempt % rejected',i;
    end if;
  end loop;
  if not exists(select 1 from media_object_deletions where id=d and state='failed' and attempt_count=6)
     or (select count(*) from media_object_deletion_attempts where deletion_id=d)<>6 then
    raise exception 'inclusive six-attempt terminal boundary failed';
  end if;
  if exists(select 1 from claim_media_object_deletions(5,'58000000-0000-4000-8000-000000000200') where deletion_id=d) then
    raise exception 'terminal deletion was reclaimed';
  end if;
end $$;

do $$
declare
  younger uuid;
  older uuid;
  claimed record;
  returned_count integer:=0;
  reference_time constant timestamptz:='2026-09-08 12:00:00+00';
  younger_state text;
  older_state text;
  younger_attempts integer;
  older_attempts integer;
begin
  if media_object_deletion_is_terminal_at(reference_time-interval '24 hours'+interval '1 microsecond',0,reference_time)
     or not media_object_deletion_is_terminal_at(reference_time-interval '24 hours',0,reference_time)
     or not media_object_deletion_is_terminal_at(reference_time-interval '24 hours'-interval '1 microsecond',0,reference_time) then
    raise exception '24-hour terminal predicate failed younger/exact/older frozen-time matrix';
  end if;
  insert into media_object_deletions(
    idempotency_key,bucket_id,object_path,reason,not_before,created_at,updated_at
  ) values(
    'ops:age-younger','mark-media',
    'validated/dddddddd-dddd-4ddd-8ddd-dddddddddddd/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/full.m4a',
    'test',clock_timestamp()-interval '1 second',clock_timestamp()-interval '23 hours',clock_timestamp()
  ) returning id into younger;
  insert into media_object_deletions(
    idempotency_key,bucket_id,object_path,reason,not_before,created_at,updated_at
  ) values(
    'ops:age-older','mark-media',
    'validated/dddddddd-dddd-4ddd-8ddd-dddddddddddd/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/poster.webp',
    'test',clock_timestamp()-interval '1 second',clock_timestamp()-interval '25 hours',clock_timestamp()
  ) returning id into older;

  for claimed in select * from claim_media_object_deletions(5,'58000000-0000-4000-8000-000000000300') loop
    returned_count:=returned_count+1;
    if claimed.deletion_id<>younger then
      raise exception 'age matrix returned unexpected deletion %',claimed.deletion_id;
    end if;
  end loop;
  select state,attempt_count into younger_state,younger_attempts from media_object_deletions where id=younger;
  select state,attempt_count into older_state,older_attempts from media_object_deletions where id=older;
  if returned_count<>1 or younger_state<>'processing' or younger_attempts<>1
     or older_state<>'failed' or older_attempts<>0 then
    raise exception '24-hour integration matrix failed: returned %, younger %/% older %/%',
      returned_count,younger_state,younger_attempts,older_state,older_attempts;
  end if;
end $$;

do $$
declare d uuid; c record; snapshot media_object_deletions%rowtype; after_snapshot media_object_deletions%rowtype;
begin
  insert into media_object_deletions(idempotency_key,bucket_id,object_path,reason,not_before)
  values('ops:expired-callback','mark-media',
    'validated/ffffffff-ffff-4fff-8fff-ffffffffffff/99999999-9999-4999-8999-999999999999/full.mp4',
    'test',clock_timestamp()-interval '1 second') returning id into d;
  select * into strict c from claim_media_object_deletions(1,'58000000-0000-4000-8000-000000000400');
  update media_object_deletions set lease_expires_at=clock_timestamp() where id=d;
  select * into snapshot from media_object_deletions where id=d;
  if finalize_media_object_deletion_attempt(d,c.attempt_id,'failed',null,null,'STORAGE_DELETE_FAILED') then
    raise exception 'expired callback accepted';
  end if;
  select * into after_snapshot from media_object_deletions where id=d;
  if after_snapshot is distinct from snapshot then
    raise exception 'expired callback mutated row';
  end if;
end $$;

delete from media_object_deletion_attempts where deletion_id in (
  select id from media_object_deletions where reason='test'
);
delete from media_object_deletions where reason='test';

select '58_media_operations' as passed;
