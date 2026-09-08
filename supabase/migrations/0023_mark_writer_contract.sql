-- 0023_mark_writer_contract.sql
-- C1.3 protected-media writer correction (FP-MEDIA-001 / ADR-012).
--
-- This migration is additive and leaves every media-kind switch off. It binds
-- cancellation, redacts draft status, normalizes worker failure codes, and
-- permits the approved optional media caption in the existing create_mark RPC.

begin;

alter table media_uploads
  add column cancel_requested_at timestamptz,
  add column cancelled_at timestamptz;

alter table media_uploads add constraint media_uploads_cancellation_check check (
  cancelled_at is null
  or (cancel_requested_at is not null and cancelled_at>=cancel_requested_at and state='expired')
);

create index media_uploads_cancellation_idx
  on media_uploads(cancel_requested_at,cancelled_at,lease_expires_at)
  where cancel_requested_at is not null and cancelled_at is null;

-- Cancellation must respect every credential/session fence. Attempt outputs
-- wait for the later of the live worker lease and signed-PUT lifetime.
create or replace function enqueue_media_upload_attempt_output_cleanup(
  p_upload media_uploads,p_reason text,p_track_quota_release boolean
) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_prefix text;
  v_key text:=p_reason||':'||p_upload.id::text;
  v_deletion_id uuid;
  v_fence timestamptz:=greatest(
    coalesce(p_upload.output_credentials_expire_at,'-infinity'::timestamptz),
    coalesce(p_upload.lease_expires_at,'-infinity'::timestamptz),
    clock_timestamp());
begin
  if p_upload.validated_path is null then return; end if;
  if p_upload.validated_path ~ '/full$' and p_upload.attempt_id is not null then
    v_prefix:=p_upload.validated_path;
    if p_upload.kind='photo'::mark_type then
      v_deletion_id:=enqueue_exact_media_object_deletion(v_key||':jpg',v_prefix||'.jpg',
        'validated/'||p_upload.id::text||'/'||p_upload.attempt_id::text||'/thumb.webp',p_reason);
      perform fence_media_deletion(v_deletion_id,v_fence);
      perform require_media_upload_cleanup(p_upload.id,v_deletion_id,p_track_quota_release);
      v_deletion_id:=enqueue_exact_media_object_deletion(v_key||':webp',v_prefix||'.webp',null,p_reason);
      perform fence_media_deletion(v_deletion_id,v_fence);
      perform require_media_upload_cleanup(p_upload.id,v_deletion_id,p_track_quota_release);
    elsif p_upload.kind='voice'::mark_type then
      v_deletion_id:=enqueue_exact_media_object_deletion(v_key||':m4a',v_prefix||'.m4a',null,p_reason);
      perform fence_media_deletion(v_deletion_id,v_fence);
      perform require_media_upload_cleanup(p_upload.id,v_deletion_id,p_track_quota_release);
    else
      v_deletion_id:=enqueue_exact_media_object_deletion(v_key||':mp4',v_prefix||'.mp4',
        'validated/'||p_upload.id::text||'/'||p_upload.attempt_id::text||'/poster.webp',p_reason);
      perform fence_media_deletion(v_deletion_id,v_fence);
      perform require_media_upload_cleanup(p_upload.id,v_deletion_id,p_track_quota_release);
    end if;
  else
    v_deletion_id:=enqueue_exact_media_object_deletion(v_key||':canonical',
      p_upload.validated_path,p_upload.preview_path,p_reason);
    perform fence_media_deletion(v_deletion_id,v_fence);
    perform require_media_upload_cleanup(p_upload.id,v_deletion_id,p_track_quota_release);
  end if;
end $$;
revoke all on function enqueue_media_upload_attempt_output_cleanup(media_uploads,text,boolean)
  from public,anon,authenticated,service_role;

-- Source credentials/TUS sessions can remain usable until reservation expiry,
-- even after cancellation closes all new app transitions. Cleanup evidence is
-- accepted only after that source fence and all attempt fences.
create or replace function enqueue_cancelled_media_upload_cleanup(p_upload media_uploads)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_deletion_id uuid;
begin
  v_deletion_id:=enqueue_exact_media_object_deletion(
    'upload_cancelled:'||p_upload.id::text||':source',p_upload.source_path,null,'upload_cancelled');
  perform fence_media_deletion(v_deletion_id,p_upload.expires_at);
  perform require_media_upload_cleanup(p_upload.id,v_deletion_id,true);
  perform enqueue_media_upload_attempt_output_cleanup(p_upload,'upload_cancelled',true);
end $$;
revoke all on function enqueue_cancelled_media_upload_cleanup(media_uploads)
  from public,anon,authenticated,service_role;

create or replace function normalize_media_failure_code(p_error_code text)
returns text language sql immutable set search_path=pg_catalog,public as $$
  select case when p_error_code in (
    'UNSUPPORTED_FORMAT','TOO_LARGE','TOO_LONG','INVALID_MEDIA','PROCESSING_FAILED'
  ) then p_error_code else 'PROCESSING_FAILED' end;
$$;
revoke all on function normalize_media_failure_code(text) from public,anon,authenticated,service_role;

-- Failure results are canonicalized before hashing, receipt comparison, or
-- persistence. Raw parser/subprocess diagnostics never enter workflow state.
create or replace function canonical_media_validation_result(p_outcome text,p_result jsonb)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare v_keys integer; v_normal jsonb;
begin
  if p_outcome='failed' then
    if jsonb_typeof(p_result)='object' then
      select count(*) into v_keys from jsonb_object_keys(p_result);
    end if;
    return jsonb_build_object(
      'error_code',normalize_media_failure_code(case
        when v_keys=1 and p_result ? 'error_code'
          and jsonb_typeof(p_result->'error_code')='string'
        then p_result->>'error_code'
        else null
      end));
  end if;
  if jsonb_typeof(p_result)<>'object' then return null; end if;
  select count(*) into v_keys from jsonb_object_keys(p_result);
  if p_outcome<>'success' or v_keys<>9
     or not (p_result ?& array['detected_mime','validated_bytes','sha256','width','height',
       'duration_ms','validated_path','preview_path','cache_control_seconds'])
     or jsonb_typeof(p_result->'detected_mime')<>'string'
     or jsonb_typeof(p_result->'validated_bytes')<>'number'
     or jsonb_typeof(p_result->'sha256')<>'string'
     or jsonb_typeof(p_result->'cache_control_seconds')<>'number'
     or jsonb_typeof(p_result->'validated_path')<>'string'
     or jsonb_typeof(p_result->'width') not in ('number','null')
     or jsonb_typeof(p_result->'height') not in ('number','null')
     or jsonb_typeof(p_result->'duration_ms') not in ('number','null')
     or jsonb_typeof(p_result->'preview_path') not in ('string','null') then return null; end if;
  v_normal:=jsonb_build_object(
    'detected_mime',p_result->>'detected_mime',
    'validated_bytes',(p_result->>'validated_bytes')::bigint,
    'sha256',p_result->>'sha256',
    'width',case when p_result->'width'='null'::jsonb then null else (p_result->>'width')::integer end,
    'height',case when p_result->'height'='null'::jsonb then null else (p_result->>'height')::integer end,
    'duration_ms',case when p_result->'duration_ms'='null'::jsonb then null else (p_result->>'duration_ms')::integer end,
    'validated_path',p_result->>'validated_path',
    'preview_path',case when p_result->'preview_path'='null'::jsonb then null else p_result->>'preview_path' end,
    'cache_control_seconds',(p_result->>'cache_control_seconds')::integer);
  return v_normal;
exception when invalid_text_representation or numeric_value_out_of_range then
  return null;
end $$;
revoke all on function canonical_media_validation_result(text,jsonb)
  from public,anon,authenticated,service_role;

-- Cancelled rows can never be claimed or reclaimed by a processor.
create or replace function claim_media_validation_jobs(p_limit integer,p_worker_execution_id uuid)
returns setof media_uploads language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if current_user not in ('postgres','service_role') or p_limit not between 1 and 5 or p_worker_execution_id is null then
    raise exception 'unavailable' using errcode='42501';
  end if;
  perform 1 from media_kind_controls where processing_enabled order by kind for share;
  return query with candidates as (
    select u.id,gen_random_uuid() as next_attempt_id
      from media_uploads u join media_kind_controls c on c.kind=u.kind
     where c.processing_enabled and u.cancel_requested_at is null
       and (u.state='uploaded' or (u.state='processing' and u.lease_expires_at<=now()))
       and u.expires_at>now() and u.attempt_count<5
       and u.uploader_id is not null and u.wall_id is not null
     order by u.created_at for update of u skip locked limit p_limit
  )
  update media_uploads u set state='processing',attempt_id=c.next_attempt_id,
    attempt_count=u.attempt_count+1,lease_expires_at=now()+interval '5 minutes',
    validated_path='validated/'||u.id::text||'/'||c.next_attempt_id::text||'/full',
    dispatch_nonce_hash=null,completion_nonce_hash=null,envelope_kid=null,
    dispatch_envelope_expires_at=null,output_credentials_expire_at=null,
    dispatch_redeemed_at=null,completion_redeemed_at=null,updated_at=now()
  from candidates c where u.id=c.id returning u.*;
end $$;
revoke all on function claim_media_validation_jobs(integer,uuid) from public,anon,authenticated;
grant execute on function claim_media_validation_jobs(integer,uuid) to service_role;

-- Actor-bound draft status: consumed, missing, and inaccessible IDs are all
-- omitted. Internal lifecycle codes are never projected.
create or replace function get_media_upload_status(p_upload_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or p_upload_ids is null or cardinality(p_upload_ids)>5 then
    return jsonb_build_object('status','unavailable');
  end if;
  return coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'upload_id',u.id,
      'state',case
        when u.cancelled_at is not null then 'cancelled'
        when u.cancel_requested_at is not null then 'cancelling'
        else u.state
      end,
      'error_code',case
        when u.state='failed' and u.error_code in (
          'UNSUPPORTED_FORMAT','TOO_LARGE','TOO_LONG','INVALID_MEDIA','PROCESSING_FAILED'
        ) then u.error_code
      end
    )) order by x.ord)
      from unnest(p_upload_ids) with ordinality x(id,ord)
      join media_uploads u on u.id=x.id
       and u.uploader_id=v_actor and u.state<>'consumed'
  ),'[]'::jsonb);
end $$;
revoke all on function get_media_upload_status(uuid[]) from public,anon;
grant execute on function get_media_upload_status(uuid[]) to authenticated;

create or replace function cancel_media_upload(p_upload_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_actor uuid:=auth.uid();
  v_up media_uploads%rowtype;
  v_now timestamptz;
begin
  -- Authentication precedes every protected workflow lookup.
  if v_actor is null or p_upload_id is null then
    return jsonb_build_object('status','unavailable');
  end if;
  perform lock_media_actor(v_actor);
  select * into v_up from media_uploads
   where id=p_upload_id and uploader_id=v_actor for update;
  if not found or v_up.state='consumed' then
    return jsonb_build_object('status','unavailable');
  end if;
  perform lock_media_quota(v_up.uploader_tombstone_id,v_up.quota_day);
  perform 1 from media_quota_daily
   where user_tombstone_id=v_up.uploader_tombstone_id and quota_day=v_up.quota_day for update;
  if not found then
    raise exception 'MEDIA_QUOTA_LEDGER_MISSING' using errcode='23503';
  end if;
  v_now:=clock_timestamp();

  if v_up.cancelled_at is not null then
    return jsonb_build_object('status','cancelled');
  end if;

  update media_uploads set cancel_requested_at=coalesce(cancel_requested_at,v_now),updated_at=v_now
   where id=v_up.id;
  v_up.cancel_requested_at:=coalesce(v_up.cancel_requested_at,v_now);

  if v_up.state='processing' and v_up.lease_expires_at>v_now then
    return jsonb_build_object('status','cancelling');
  end if;

  perform enqueue_cancelled_media_upload_cleanup(v_up);
  update media_uploads set state='expired',session_state='expired',
    cancel_requested_at=v_up.cancel_requested_at,cancelled_at=v_now,
    lease_expires_at=null,error_code=null,updated_at=v_now
   where id=v_up.id;
  return jsonb_build_object('status','cancelled');
end $$;
revoke all on function cancel_media_upload(uuid) from public,anon;
grant execute on function cancel_media_upload(uuid) to authenticated;

-- Upload transition closes immediately once cancellation is recorded.
create or replace function current_user_can_upload_mark_media_path(p_path text)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog,public,storage as $$
declare v_kind mark_type;
begin
  if auth.uid() is null then return false; end if;
  select u.kind into v_kind from public.media_uploads u
   where u.source_path=p_path and u.uploader_id=auth.uid() and u.cancel_requested_at is null;
  if v_kind is null then return false; end if;
  perform 1 from public.media_kind_controls where kind=v_kind for share;
  return exists(
    select 1 from public.media_uploads u join public.media_kind_controls c on c.kind=u.kind
     where u.source_path=p_path and u.uploader_id=auth.uid() and u.state='initiated'
       and u.cancel_requested_at is null and u.session_state='open' and u.expires_at>now()
       and c.upload_transition_enabled and public.is_active_account(auth.uid())
       and public.can_contribute(u.wall_id,auth.uid())
  );
end;
$$;
revoke all on function current_user_can_upload_mark_media_path(text) from public,anon;
grant execute on function current_user_can_upload_mark_media_path(text) to authenticated;

create or replace function mark_media_uploaded(p_upload_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare v_actor uuid:=auth.uid(); v_up media_uploads%rowtype; v_owner text; v_size bigint; v_kind mark_type;
begin
  if v_actor is null then return jsonb_build_object('status','unavailable'); end if;
  select kind into v_kind from media_uploads
   where id=p_upload_id and uploader_id=v_actor and cancel_requested_at is null;
  if v_kind is null then return jsonb_build_object('status','unavailable'); end if;
  perform 1 from media_kind_controls where kind=v_kind for share;
  perform lock_media_actor(v_actor);
  select * into v_up from media_uploads
   where id=p_upload_id and uploader_id=v_actor and cancel_requested_at is null for update;
  if not found then return jsonb_build_object('status','unavailable'); end if;
  if v_up.state in ('uploaded','processing','validated') then return jsonb_build_object('status',v_up.state); end if;
  if v_up.state<>'initiated' or v_up.expires_at<=now() or not public.can_contribute(v_up.wall_id,v_actor)
     or not exists(select 1 from media_kind_controls where kind=v_up.kind and upload_transition_enabled) then
    return jsonb_build_object('status','unavailable');
  end if;
  select o.owner_id,coalesce(nullif(o.metadata->>'size','')::bigint,0)
    into v_owner,v_size from storage.objects o
   where o.bucket_id='mark-media' and o.name=v_up.source_path;
  if not found or v_owner is null or v_owner<>v_actor::text or v_size<=0 then
    return jsonb_build_object('status','unavailable');
  end if;
  perform lock_media_quota(v_actor,v_up.quota_day);
  update media_quota_daily set ingested_bytes=ingested_bytes+v_size,updated_at=now()
   where user_tombstone_id=v_actor and quota_day=v_up.quota_day;
  if v_size>media_kind_limit(v_up.kind)
     or (select ingested_bytes from media_quota_daily
          where user_tombstone_id=v_actor and quota_day=v_up.quota_day)>524288000 then
    perform enqueue_media_upload_full_cleanup(v_up,'input_too_large',true);
    update media_uploads set state='failed',session_state='closed',actual_input_bytes=v_size,
      error_code='TOO_LARGE',updated_at=now() where id=v_up.id;
    return jsonb_build_object('status','failed','error_code','TOO_LARGE');
  end if;
  update media_uploads set state='uploaded',session_state='closed',actual_input_bytes=v_size,
    quota_session_released_at=now(),updated_at=now() where id=v_up.id;
  update media_quota_daily set open_sessions=greatest(open_sessions-1,0),updated_at=now()
   where user_tombstone_id=v_actor and quota_day=v_up.quota_day;
  return jsonb_build_object('status','uploaded');
end $$;
revoke all on function mark_media_uploaded(uuid) from public,anon;
grant execute on function mark_media_uploaded(uuid) to authenticated;

-- Rolling active-reservation counts exclude a cancellation request immediately;
-- historical hour/day counts and ledger charges deliberately do not.
create or replace function begin_media_upload(
  p_wall_id uuid,p_kind mark_type,p_client_upload_id uuid,p_declared_mime text,p_declared_bytes bigint
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_actor uuid:=auth.uid(); v_existing media_uploads%rowtype; v_id uuid:=gen_random_uuid();
  v_path text; v_day date:=timezone('utc',now())::date; v_exp timestamptz;
  v_limit bigint; v_active integer; v_hour integer; v_day_count integer; v_quota media_quota_daily%rowtype;
begin
  if v_actor is null or not public.is_active_account(v_actor) then return jsonb_build_object('status','unavailable'); end if;
  if p_kind not in ('photo'::mark_type,'voice'::mark_type,'video'::mark_type) or p_client_upload_id is null
     or nullif(trim(p_declared_mime),'') is null or p_declared_bytes is null or p_declared_bytes<=0 then
    return jsonb_build_object('status','invalid');
  end if;
  if not ((p_kind='photo'::mark_type and lower(trim(p_declared_mime)) in ('image/jpeg','image/png','image/webp','image/heic'))
       or (p_kind='voice'::mark_type and lower(trim(p_declared_mime)) in ('audio/m4a','audio/mp4','audio/mpeg','audio/wav'))
       or (p_kind='video'::mark_type and lower(trim(p_declared_mime)) in ('video/mp4','video/quicktime'))) then
    return jsonb_build_object('status','invalid');
  end if;
  perform 1 from media_kind_controls where kind=p_kind for share;
  if not exists(select 1 from media_kind_controls where kind=p_kind and reservation_enabled)
     or not public.can_contribute(p_wall_id,v_actor) then return jsonb_build_object('status','unavailable'); end if;
  v_limit:=media_kind_limit(p_kind);
  if p_declared_bytes>v_limit then return jsonb_build_object('status','invalid'); end if;
  perform lock_media_actor(v_actor);
  perform lock_media_quota(v_actor,v_day);
  select * into v_existing from media_uploads
   where uploader_tombstone_id=v_actor and client_upload_id=p_client_upload_id for update;
  if found then
    if v_existing.wall_tombstone_id<>p_wall_id or v_existing.kind<>p_kind
       or v_existing.declared_mime<>lower(trim(p_declared_mime)) or v_existing.declared_bytes<>p_declared_bytes then
      return jsonb_build_object('status','invalid');
    end if;
    if v_existing.state='initiated' and v_existing.cancel_requested_at is null and v_existing.expires_at>now() then
      return jsonb_build_object('status','ready','upload_id',v_existing.id,'bucket','mark-media',
        'path',v_existing.source_path,'expires_at',v_existing.expires_at);
    end if;
    return jsonb_build_object('status','unavailable');
  end if;
  select count(*) filter(where state in ('initiated','uploaded','processing','validated') and cancel_requested_at is null),
         count(*) filter(where created_at>now()-interval '1 hour'),
         count(*) filter(where created_at>=date_trunc('day',now() at time zone 'utc') at time zone 'utc')
    into v_active,v_hour,v_day_count from media_uploads where uploader_tombstone_id=v_actor;
  if v_active>=10 or v_hour>=20 or v_day_count>=100 then return jsonb_build_object('status','rate_limited'); end if;
  insert into media_quota_daily(user_tombstone_id,quota_day) values(v_actor,v_day) on conflict do nothing;
  select * into strict v_quota from media_quota_daily
   where user_tombstone_id=v_actor and quota_day=v_day for update;
  if v_quota.open_sessions>=10 or v_quota.reservation_count>=100
     or v_quota.reserved_bytes+p_declared_bytes>524288000 then
    return jsonb_build_object('status','rate_limited');
  end if;
  v_path:='staging/'||v_actor::text||'/'||v_id::text||'/source';
  v_exp:=now()+case when p_kind='photo'::mark_type then interval '2 hours' else interval '24 hours' end;
  update media_quota_daily set reserved_bytes=reserved_bytes+p_declared_bytes,
    reservation_count=reservation_count+1,open_sessions=open_sessions+1,updated_at=now()
   where user_tombstone_id=v_actor and quota_day=v_day;
  insert into media_uploads(id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,
    client_upload_id,source_path,declared_mime,declared_bytes,expires_at,quota_day,reserved_charge)
  values(v_id,v_actor,v_actor,p_wall_id,p_wall_id,p_kind,p_client_upload_id,v_path,lower(trim(p_declared_mime)),
    p_declared_bytes,v_exp,v_day,p_declared_bytes);
  return jsonb_build_object('status','ready','upload_id',v_id,'bucket','mark-media','path',v_path,'expires_at',v_exp);
exception when others then
  if sqlstate in ('23503','23514','22P02') then return jsonb_build_object('status','invalid'); end if;
  raise;
end $$;
revoke all on function begin_media_upload(uuid,mark_type,uuid,text,bigint) from public,anon;
grant execute on function begin_media_upload(uuid,mark_type,uuid,text,bigint) to authenticated;

-- The existing signature remains stable. Optional normalized media text is
-- stored only in marks.text and participates in the versioned fingerprint.
create or replace function create_mark(
  p_request_id uuid,p_wall_id uuid,p_type mark_type,p_text text,p_color text,p_anonymous boolean,
  p_secret boolean,p_rotation real,p_upload_ids uuid[]
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare
  v_actor uuid:=auth.uid(); v_text text:=nullif(btrim(p_text),''); v_color text:=nullif(btrim(p_color),'');
  v_uploads uuid[]:=coalesce(p_upload_ids,'{}'::uuid[]); v_hash text; v_req mark_creation_requests%rowtype;
  v_mark_id uuid:=gen_random_uuid(); v_status mark_status; v_expected integer; v_count integer; v_up media_uploads%rowtype;
  v_pos integer:=0; v_uid uuid; v_new_request boolean:=false;
begin
  if v_actor is null or p_request_id is null or p_wall_id is null or p_type is null
     or not public.is_active_account(v_actor) then return jsonb_build_object('status','unavailable'); end if;
  if p_type not in ('text'::mark_type,'photo'::mark_type,'voice'::mark_type,'video'::mark_type)
     or p_anonymous is null or p_secret is null then return jsonb_build_object('status','invalid'); end if;

  -- Secret media fails before request locking or any upload lookup/side effect.
  if p_type<>'text' and p_secret then return jsonb_build_object('status','invalid'); end if;

  v_color:=case when p_type='text' and lower(v_color) in ('#ffe14d','#ffb3c1','#c6f26b','#a9d8ff') then lower(v_color)
                when v_color is null then null else '__invalid__' end;
  if v_color='__invalid__' or (v_text is not null and char_length(v_text)>500)
     or (p_type='text' and v_text is null) or cardinality(v_uploads)>5
     or cardinality(v_uploads)<>(select count(distinct x) from unnest(v_uploads) x) then
    return jsonb_build_object('status','invalid');
  end if;
  v_expected:=case when p_type='text' then 0 when p_type='photo' then cardinality(v_uploads) else 1 end;
  if (p_type='photo' and v_expected not between 1 and 5)
     or (p_type in ('voice','video') and cardinality(v_uploads)<>1)
     or (p_type='text' and cardinality(v_uploads)<>0) then return jsonb_build_object('status','invalid'); end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_request_id::text,21));
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('fingerprint_version',1,'wall_id',p_wall_id,
    'type',p_type::text,'text',v_text,'color',v_color,'anonymous',p_anonymous,'secret',p_secret,
    'upload_ids',to_jsonb(v_uploads))::text,'UTF8'),'sha256'),'hex');
  select * into v_req from mark_creation_requests where actor_id=v_actor and request_id=p_request_id for update;
  if found then
    if v_req.fingerprint_version<>1 or v_req.request_sha256<>v_hash then return jsonb_build_object('status','request_id_reused'); end if;
    if v_req.state='completed' then return jsonb_build_object('status','existing','mark_id',v_req.result_mark_id,
      'mark_status',(select status from marks where id=v_req.mark_id)); end if;
    if v_req.state='deleted' then return jsonb_build_object('status','deleted','mark_id',v_req.result_mark_id); end if;
  else
    v_new_request:=true;
  end if;

  select owner_id into v_uid from walls where id=p_wall_id for share;
  if v_uid is null then return jsonb_build_object('status','unavailable'); end if;
  if (select type from walls where id=p_wall_id)='personal' then perform public.lock_user_pair(v_actor,v_uid); end if;
  if not public.can_contribute(p_wall_id,v_actor) then return jsonb_build_object('status','unavailable'); end if;
  if p_anonymous and not (select allow_anonymous from walls where id=p_wall_id) then return jsonb_build_object('status','invalid'); end if;
  if p_type<>'text' then perform 1 from media_kind_controls where kind=p_type for share; end if;
  if p_type<>'text' and not exists(select 1 from media_kind_controls where kind=p_type and creation_enabled) then
    return jsonb_build_object('status','unavailable');
  end if;
  for v_uid in select x.id from unnest(v_uploads) as x(id) order by x.id loop
    perform 1 from media_uploads where id=v_uid for update;
  end loop;
  select count(*) into v_count from media_uploads u where u.id=any(v_uploads)
    and u.uploader_id=v_actor and u.wall_id=p_wall_id and u.kind=p_type and u.state='validated'
    and u.cancel_requested_at is null and u.expires_at>now()
    and u.consumed_mark_id is null and u.validated_path is not null;
  if v_count<>v_expected then return jsonb_build_object('status','media_not_ready'); end if;
  if v_new_request then
    insert into mark_creation_requests(actor_id,request_id,fingerprint_version,request_sha256)
      values(v_actor,p_request_id,1,v_hash);
  end if;
  insert into marks(id,wall_id,author_id,type,text,color,anonymous,secret,media_url,payload,rotation)
  values(v_mark_id,p_wall_id,v_actor,p_type,v_text,v_color,p_anonymous,p_secret,null,null,
    greatest(-2.5::real,least(2.5::real,coalesce(p_rotation,0)))) returning status into v_status;
  if p_type<>'text' then
    foreach v_uid in array v_uploads loop
      select * into strict v_up from media_uploads where id=v_uid;
      insert into mark_media(mark_id,upload_id,media_type,"position",storage_path,preview_path,mime_type,
        byte_size,sha256,width,height,duration_ms)
      values(v_mark_id,v_up.id,v_up.kind,v_pos,v_up.validated_path,v_up.preview_path,v_up.detected_mime,
        v_up.validated_bytes,v_up.sha256,v_up.width,v_up.height,v_up.duration_ms);
      update media_uploads set state='consumed',consumed_mark_id=v_mark_id,
        consumed_mark_tombstone_id=v_mark_id,consumed_at=now(),updated_at=now() where id=v_up.id;
      v_pos:=v_pos+1;
    end loop;
  end if;
  update mark_creation_requests set state='completed',mark_id=v_mark_id,result_mark_id=v_mark_id,
    completed_at=now() where actor_id=v_actor and request_id=p_request_id;
  return jsonb_build_object('status','created','mark_id',v_mark_id,'mark_status',v_status);
end $$;
revoke all on function create_mark(uuid,uuid,mark_type,text,text,boolean,boolean,real,uuid[]) from public,anon;
grant execute on function create_mark(uuid,uuid,mark_type,text,text,boolean,boolean,real,uuid[]) to authenticated;

-- Finalization linearizes on the same upload row as cancel/create. A cancelled
-- attempt can record its idempotency receipt but can never publish media.
create or replace function finalize_media_validation_attempt(
  p_upload_id uuid,p_attempt_id uuid,p_raw_completion_token text,p_kid text,
  p_outcome text,p_result jsonb
) returns boolean language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare
  v_now timestamptz; v_token_hash text; v_result jsonb; v_result_hash text;
  v_receipt media_validation_callback_receipts%rowtype;
  v_key media_envelope_keys%rowtype; v_up media_uploads%rowtype;
  v_expected_path text; v_expected_preview text; v_terminal boolean; v_deletion_id uuid;
begin
  if nullif(p_raw_completion_token,'') is null or char_length(p_raw_completion_token)>512
     or p_kid is null or p_kid !~ '^[A-Za-z0-9_-]{1,32}$'
     or p_outcome is null or p_outcome not in ('success','failed') then return false; end if;
  v_result:=canonical_media_validation_result(p_outcome,p_result);
  if v_result is null then return false; end if;
  v_token_hash:=encode(extensions.digest(p_raw_completion_token,'sha256'),'hex');
  v_result_hash:=encode(extensions.digest(convert_to(v_result::text,'UTF8'),'sha256'),'hex');
  perform lock_media_validation_attempt(p_upload_id,p_attempt_id);
  select * into v_receipt from media_validation_callback_receipts
   where upload_id=p_upload_id and attempt_id=p_attempt_id;
  if found then
    return v_receipt.completion_token_hash=v_token_hash and v_receipt.envelope_kid=p_kid
      and v_receipt.outcome=p_outcome and v_receipt.canonical_result_sha256=v_result_hash;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('media-envelope-key-lifecycle',29));
  select * into v_key from media_envelope_keys where kid=p_kid for update;
  if not found or v_key.status not in ('active','retiring') then return false; end if;
  select * into v_up from media_uploads where id=p_upload_id for update;
  v_now:=clock_timestamp();
  if not found or v_up.state<>'processing' or v_up.attempt_id<>p_attempt_id
     or v_up.uploader_id is null or v_up.wall_id is null
     or v_key.last_completion_exp<v_now or v_up.lease_expires_at<=v_now
     or v_up.dispatch_redeemed_at is null or v_up.completion_redeemed_at is not null
     or v_up.envelope_kid<>p_kid or v_up.completion_nonce_hash<>v_token_hash
     or v_up.output_credentials_expire_at is null
     or not exists(select 1 from media_kind_controls where kind=v_up.kind and processing_enabled) then return false; end if;

  if v_up.cancel_requested_at is null and p_outcome='success' then
    if v_up.kind='photo'::mark_type then
      v_expected_path:=v_up.validated_path||case v_result->>'detected_mime'
        when 'image/jpeg' then '.jpg' when 'image/webp' then '.webp' else '.invalid' end;
      if v_result->'preview_path'<>'null'::jsonb then
        v_expected_preview:='validated/'||v_up.id::text||'/'||v_up.attempt_id::text||'/thumb.webp';
      end if;
    elsif v_up.kind='voice'::mark_type then v_expected_path:=v_up.validated_path||'.m4a';
    else
      v_expected_path:=v_up.validated_path||'.mp4';
      if v_result->'preview_path'<>'null'::jsonb then
        v_expected_preview:='validated/'||v_up.id::text||'/'||v_up.attempt_id::text||'/poster.webp';
      end if;
    end if;
    if v_result->>'validated_path'<>v_expected_path
       or (case when v_result->'preview_path'='null'::jsonb then null else v_result->>'preview_path' end)
          is distinct from v_expected_preview
       or (v_result->>'validated_bytes')::bigint<=0 or (v_result->>'sha256') !~ '^[0-9a-f]{64}$'
       or (v_result->>'cache_control_seconds')::integer not between 0 and 60
       or (v_up.kind='photo' and ((v_result->>'detected_mime') not in ('image/jpeg','image/webp')
         or (v_result->>'validated_bytes')::bigint>10485760 or v_result->'duration_ms'<>'null'::jsonb
         or v_result->'width'='null'::jsonb or v_result->'height'='null'::jsonb))
       or (v_up.kind='voice' and ((v_result->>'detected_mime')<>'audio/mp4'
         or (v_result->>'validated_bytes')::bigint>10485760 or v_result->'width'<>'null'::jsonb
         or v_result->'height'<>'null'::jsonb or (v_result->>'duration_ms')::integer not between 1 and 60000))
       or (v_up.kind='video' and ((v_result->>'detected_mime')<>'video/mp4'
         or (v_result->>'validated_bytes')::bigint>52428800 or v_result->'width'='null'::jsonb
         or v_result->'height'='null'::jsonb or (v_result->>'duration_ms')::integer not between 1 and 30000))
       or coalesce((v_result->>'width')::integer,1)>8192
       or coalesce((v_result->>'height')::integer,1)>8192
       or coalesce((v_result->>'width')::bigint,1)*coalesce((v_result->>'height')::bigint,1)>25000000
       then return false; end if;
  end if;

  insert into media_validation_callback_receipts(upload_id,attempt_id,completion_token_hash,
    envelope_kid,outcome,canonical_result_sha256)
  values(p_upload_id,p_attempt_id,v_token_hash,p_kid,p_outcome,v_result_hash);
  update media_uploads set completion_redeemed_at=v_now,updated_at=v_now where id=p_upload_id;

  if v_up.cancel_requested_at is not null then
    perform enqueue_cancelled_media_upload_cleanup(v_up);
    update media_uploads set state='expired',session_state='expired',cancelled_at=v_now,
      lease_expires_at=null,error_code=null,updated_at=v_now where id=p_upload_id;
    return true;
  end if;
  if p_outcome='success' then
    update media_uploads set state='validated',detected_mime=v_result->>'detected_mime',
      validated_bytes=(v_result->>'validated_bytes')::bigint,sha256=v_result->>'sha256',
      width=case when v_result->'width'='null'::jsonb then null else (v_result->>'width')::integer end,
      height=case when v_result->'height'='null'::jsonb then null else (v_result->>'height')::integer end,
      duration_ms=case when v_result->'duration_ms'='null'::jsonb then null else (v_result->>'duration_ms')::integer end,
      validated_path=v_result->>'validated_path',
      preview_path=case when v_result->'preview_path'='null'::jsonb then null else v_result->>'preview_path' end,
      cache_control_seconds=(v_result->>'cache_control_seconds')::integer,validated_at=v_now,
      expires_at=now()+interval '24 hours',lease_expires_at=null,updated_at=v_now where id=p_upload_id;
    insert into media_object_deletions(idempotency_key,bucket_id,object_path,reason)
      values('validated-upload:'||v_up.id::text||':source','mark-media',v_up.source_path,'source_validated')
      on conflict do nothing;
    if v_up.kind='photo'::mark_type then
      v_deletion_id:=enqueue_exact_media_object_deletion('validated-upload:'||v_up.id::text||':unused',
        v_up.validated_path||case v_result->>'detected_mime' when 'image/jpeg' then '.webp' else '.jpg' end,
        null,'unused_canonical_candidate');
      perform fence_media_deletion(v_deletion_id,v_up.output_credentials_expire_at);
    end if;
  else
    v_terminal:=v_up.attempt_count>=5 or v_up.expires_at<=now();
    update media_uploads set state=case when v_terminal then 'failed' else 'uploaded' end,
      error_code=case when v_terminal then v_result->>'error_code' else null end,
      lease_expires_at=null,updated_at=v_now where id=p_upload_id;
    if v_terminal then perform enqueue_media_upload_full_cleanup(v_up,'validation_failed',true); end if;
  end if;
  return true;
end $$;
revoke all on function finalize_media_validation_attempt(uuid,uuid,text,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function finalize_media_validation_attempt(uuid,uuid,text,text,text,jsonb) to service_role;

-- Expired cancellation requests are terminalized without starting a new
-- processing attempt. Ordinary expiry behavior remains unchanged.
create or replace function expire_media_uploads()
returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_count integer:=0; v_up media_uploads%rowtype; v_actor uuid; v_now timestamptz;
begin
  if current_user not in ('postgres','service_role') then raise exception 'unavailable' using errcode='42501'; end if;
  for v_actor in select distinct uploader_tombstone_id from media_uploads
   where state in ('initiated','uploaded','processing','validated') and (
     expires_at<=now() or uploader_id is null or wall_id is null
     or (cancel_requested_at is not null and cancelled_at is null
       and state='processing' and lease_expires_at<=now()))
   order by uploader_tombstone_id
  loop
    perform lock_media_actor(v_actor);
    for v_up in select * from media_uploads where uploader_tombstone_id=v_actor
      and state in ('initiated','uploaded','processing','validated') and (
        expires_at<=now() or uploader_id is null or wall_id is null
        or (cancel_requested_at is not null and cancelled_at is null
          and state='processing' and lease_expires_at<=now()))
      order by id for update skip locked
    loop
      v_now:=clock_timestamp();
      if v_up.cancel_requested_at is not null then
        perform enqueue_cancelled_media_upload_cleanup(v_up);
      else
        perform enqueue_media_upload_full_cleanup(v_up,'upload_expired',true);
      end if;
      -- Terminal expiry invalidates every reusable worker credential while
      -- retaining output_credentials_expire_at as the cleanup safety fence.
      update media_uploads set state='expired',session_state='expired',lease_expires_at=null,
        attempt_id=null,dispatch_nonce_hash=null,completion_nonce_hash=null,
        dispatch_redeemed_at=null,completion_redeemed_at=null,envelope_kid=null,
        dispatch_envelope_expires_at=null,
        cancelled_at=case when v_up.cancel_requested_at is not null then v_now else cancelled_at end,
        error_code=case when uploader_id is null or wall_id is null then 'SUBJECT_DELETED'
                        when v_up.cancel_requested_at is not null then null else error_code end,
        updated_at=v_now where id=v_up.id;
      perform release_media_upload_reservation_if_clean(v_up.id);
      v_count:=v_count+1;
    end loop;
  end loop;
  return v_count;
end $$;
revoke all on function expire_media_uploads() from public,anon,authenticated;
grant execute on function expire_media_uploads() to service_role;

-- Obsolete two-step failure entry point stays unusable.
revoke execute on function fail_media_validation(uuid,uuid,text) from service_role;

commit;
