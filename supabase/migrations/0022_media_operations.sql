-- C3.1: private operations control plane for worker dispatch and exact-object
-- cleanup. This migration does not enable any media kind or change creation.

create table media_object_deletion_attempts (
  deletion_id uuid not null references media_object_deletions(id) on delete restrict,
  attempt_id uuid not null,
  attempt_number smallint not null check (attempt_number between 1 and 20),
  worker_execution_id uuid not null,
  state text not null check (state in ('processing','deleted','failed','expired')),
  error_code text check (error_code is null or error_code in ('STORAGE_DELETE_FAILED','OPERATIONS_UNAVAILABLE')),
  started_at timestamptz not null,
  lease_expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (deletion_id,attempt_id),
  unique (deletion_id,attempt_number),
  check ((state='processing' and completed_at is null and error_code is null)
      or (state='deleted' and completed_at is not null and error_code is null)
      or (state in ('failed','expired') and completed_at is not null))
);
create index media_object_deletion_attempts_execution_idx
  on media_object_deletion_attempts(worker_execution_id,created_at);
alter table media_object_deletion_attempts enable row level security;
revoke all on media_object_deletion_attempts from public,anon,authenticated;
grant select,insert,update,delete on media_object_deletion_attempts to service_role;

-- Claim only due exact-object records. An expired lease is a failed delivery
-- attempt; it is durably closed before a fresh attempt identity is installed.
create or replace function claim_media_object_deletions(
  p_limit integer,p_worker_execution_id uuid
) returns table(
  deletion_id uuid,attempt_id uuid,bucket_id text,object_path text,
  preview_path text,lease_expires_at timestamptz
) language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_row media_object_deletions%rowtype;
  v_now timestamptz;
  v_attempt_id uuid;
  v_lease timestamptz;
  v_claimed integer:=0;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'unavailable' using errcode='42501';
  end if;
  if p_limit is null or p_limit<1 or p_limit>5 or p_worker_execution_id is null then
    raise exception 'unavailable' using errcode='22023';
  end if;

  for v_row in
    select d.* from media_object_deletions d
     where d.not_before<=clock_timestamp()
       and (d.state='pending' or (d.state='processing' and d.lease_expires_at<=clock_timestamp()))
     order by d.created_at,d.id
     for update skip locked
  loop
    exit when v_claimed>=p_limit;
    v_now:=clock_timestamp();

    if v_row.state='processing' then
      update media_object_deletion_attempts a
         set state='expired',error_code='OPERATIONS_UNAVAILABLE',completed_at=v_now,updated_at=v_now
       where a.deletion_id=v_row.id and a.attempt_id=v_row.attempt_id and a.state='processing';
    end if;

    -- Six completed/expired attempts or 24 hours of age is terminal. A pending
    -- row at attempt_count=5 may still receive its sixth and final attempt.
    if v_row.created_at<=v_now-interval '24 hours' or v_row.attempt_count>=6 then
      update media_object_deletions
         set state='failed',attempt_id=null,lease_expires_at=null,updated_at=v_now
       where id=v_row.id;
      continue;
    end if;

    v_attempt_id:=gen_random_uuid();
    v_lease:=v_now+interval '5 minutes';
    update media_object_deletions
       set state='processing',attempt_id=v_attempt_id,attempt_count=attempt_count+1,
           lease_expires_at=v_lease,updated_at=v_now
     where id=v_row.id;
    insert into media_object_deletion_attempts(
      deletion_id,attempt_id,attempt_number,worker_execution_id,state,started_at,lease_expires_at
    ) values(
      v_row.id,v_attempt_id,v_row.attempt_count+1,p_worker_execution_id,'processing',v_now,v_lease
    );
    deletion_id:=v_row.id;
    attempt_id:=v_attempt_id;
    bucket_id:=v_row.bucket_id;
    object_path:=v_row.object_path;
    preview_path:=v_row.preview_path;
    lease_expires_at:=v_lease;
    v_claimed:=v_claimed+1;
    return next;
  end loop;
end $$;

revoke all on function claim_media_object_deletions(integer,uuid) from public,anon,authenticated;
grant execute on function claim_media_object_deletions(integer,uuid) to service_role;

-- Complete only the current live attempt. A stale, expired, or superseded
-- callback returns false before changing evidence, quota, attempt history, or
-- current state. Successful evidence remains validated by C1's exact-path and
-- not-before fence.
create or replace function finalize_media_object_deletion_attempt(
  p_deletion_id uuid,p_attempt_id uuid,p_outcome text,
  p_object_evidence jsonb,p_preview_evidence jsonb,p_error_code text default null
) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_row media_object_deletions%rowtype;
  v_now timestamptz;
  v_recorded boolean;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'unavailable' using errcode='42501';
  end if;
  select * into v_row from media_object_deletions where id=p_deletion_id for update;
  if not found then return false; end if;
  v_now:=clock_timestamp();
  if v_row.state<>'processing' or v_row.attempt_id is distinct from p_attempt_id
     or v_row.lease_expires_at is null or v_row.lease_expires_at<=v_now then
    return false;
  end if;
  if not exists(
    select 1 from media_object_deletion_attempts a
     where a.deletion_id=p_deletion_id and a.attempt_id=p_attempt_id
       and a.state='processing' and a.lease_expires_at=v_row.lease_expires_at
  ) then return false; end if;

  if p_outcome='deleted' then
    if p_error_code is not null then return false; end if;
    v_recorded:=record_media_object_deletion(p_deletion_id,p_object_evidence,p_preview_evidence);
    if not v_recorded then return false; end if;
    update media_object_deletion_attempts
       set state='deleted',completed_at=v_now,updated_at=v_now
     where deletion_id=p_deletion_id and attempt_id=p_attempt_id and state='processing';
    update media_object_deletions set attempt_id=null,updated_at=v_now where id=p_deletion_id;
    return true;
  end if;

  if p_outcome<>'failed' or p_object_evidence is not null or p_preview_evidence is not null
     or p_error_code not in ('STORAGE_DELETE_FAILED','OPERATIONS_UNAVAILABLE') then
    return false;
  end if;
  update media_object_deletion_attempts
     set state='failed',error_code=p_error_code,completed_at=v_now,updated_at=v_now
   where deletion_id=p_deletion_id and attempt_id=p_attempt_id and state='processing';
  update media_object_deletions
     set state=case when attempt_count>=6 or created_at<=v_now-interval '24 hours'
                    then 'failed' else 'pending' end,
         attempt_id=null,lease_expires_at=null,updated_at=v_now
   where id=p_deletion_id;
  return true;
end $$;

revoke all on function finalize_media_object_deletion_attempt(uuid,uuid,text,jsonb,jsonb,text)
  from public,anon,authenticated;
grant execute on function finalize_media_object_deletion_attempt(uuid,uuid,text,jsonb,jsonb,text)
  to service_role;

-- Service callers must use the attempt-bound finalizer above. The owner keeps
-- direct access for migration/test maintenance and nested SECURITY DEFINER use.
revoke execute on function record_media_object_deletion(uuid,jsonb,jsonb) from service_role;

-- No scheduler is installed and no media-kind control is changed here. The
-- existing default-off controls remain the cutover boundary.
