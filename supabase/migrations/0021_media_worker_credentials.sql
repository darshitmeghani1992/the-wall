-- 0021_media_worker_credentials.sql
-- Additive correction for FP-MEDIA-001 worker credential protocol v2.
--
-- The output credentials issued by Supabase Storage remain write-capable for
-- two hours.  The five-minute database lease and two-minute dispatch JWS are
-- therefore never used as cleanup fences.  This migration also makes key
-- state and callback idempotency durable database authorities.

begin;

alter table media_uploads
  add column dispatch_envelope_expires_at timestamptz,
  add column output_credentials_expire_at timestamptz;

alter table media_uploads add constraint media_uploads_worker_credentials_check check (
  (dispatch_nonce_hash is null and completion_nonce_hash is null and envelope_kid is null
    and dispatch_envelope_expires_at is null
    and (output_credentials_expire_at is null or state in ('failed','expired')))
  or
  (dispatch_nonce_hash ~ '^[0-9a-f]{64}$'
    and completion_nonce_hash ~ '^[0-9a-f]{64}$'
    and dispatch_nonce_hash <> completion_nonce_hash
    and envelope_kid ~ '^[A-Za-z0-9_-]{1,32}$'
    and dispatch_envelope_expires_at is not null
    and output_credentials_expire_at is not null)
);

create or replace function guard_media_output_credential_fence()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if new.attempt_id is not distinct from old.attempt_id
     and old.output_credentials_expire_at is not null
     and (new.output_credentials_expire_at is null
       or new.output_credentials_expire_at<old.output_credentials_expire_at) then
    raise exception 'MEDIA_OUTPUT_CREDENTIAL_FENCE_SHRINK' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function guard_media_output_credential_fence() from public,anon,authenticated;
create trigger a1_media_output_credential_fence
  before update of attempt_id,output_credentials_expire_at on media_uploads
  for each row execute function guard_media_output_credential_fence();

create table media_envelope_keys (
  kid text primary key check (kid ~ '^[A-Za-z0-9_-]{1,32}$'),
  status text not null check (status in ('active','retiring','revoked')),
  last_dispatch_exp timestamptz,
  last_completion_exp timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  check ((status='revoked')=(revoked_at is not null))
);
create unique index media_envelope_keys_one_active_idx
  on media_envelope_keys ((status)) where status='active';

create table media_validation_callback_receipts (
  upload_id uuid not null,
  attempt_id uuid not null,
  completion_token_hash text not null check (completion_token_hash ~ '^[0-9a-f]{64}$'),
  envelope_kid text not null check (envelope_kid ~ '^[A-Za-z0-9_-]{1,32}$'),
  outcome text not null check (outcome in ('success','failed')),
  canonical_result_sha256 text not null check (canonical_result_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (upload_id,attempt_id)
);

alter table media_envelope_keys enable row level security;
alter table media_validation_callback_receipts enable row level security;
revoke all on media_envelope_keys,media_validation_callback_receipts
  from public,anon,authenticated,service_role;

create or replace function lock_media_validation_attempt(p_upload_id uuid,p_attempt_id uuid)
returns void language sql volatile security definer set search_path=pg_catalog,public as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('media-attempt:'||p_upload_id::text||':'||p_attempt_id::text,23)
  );
$$;
revoke all on function lock_media_validation_attempt(uuid,uuid) from public,anon,authenticated;

-- Initial provisioning passes NULL as p_current_kid.  Rotation must name the
-- current active key, preventing a stale operator from replacing a newer key.
create or replace function rotate_media_envelope_key(p_current_kid text,p_new_kid text)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_active media_envelope_keys%rowtype;
begin
  if p_new_kid !~ '^[A-Za-z0-9_-]{1,32}$' then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('media-envelope-key-lifecycle',29));
  select * into v_active from media_envelope_keys where status='active' for update;
  if p_current_kid is null then
    if found then return false; end if;
  elsif not found or v_active.kid<>p_current_kid then
    return false;
  end if;
  if exists(select 1 from media_envelope_keys where kid=p_new_kid) then return false; end if;
  if v_active.kid is not null then
    update media_envelope_keys set status='retiring',updated_at=clock_timestamp()
      where kid=v_active.kid;
  end if;
  insert into media_envelope_keys(kid,status) values(p_new_kid,'active');
  return true;
end $$;
revoke all on function rotate_media_envelope_key(text,text) from public,anon,authenticated;
grant execute on function rotate_media_envelope_key(text,text) to service_role;

create or replace function revoke_media_envelope_key(p_kid text)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_key media_envelope_keys%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('media-envelope-key-lifecycle',29));
  select * into v_key from media_envelope_keys where kid=p_kid for update;
  if not found then return false; end if;
  if v_key.status='revoked' then return true; end if;
  update media_envelope_keys set status='revoked',revoked_at=clock_timestamp(),updated_at=clock_timestamp()
    where kid=p_kid;
  -- Emergency revocation stops all new claims under the same transaction.
  update media_kind_controls set processing_enabled=false,updated_at=clock_timestamp()
    where processing_enabled;
  return true;
end $$;
revoke all on function revoke_media_envelope_key(text) from public,anon,authenticated;
grant execute on function revoke_media_envelope_key(text) to service_role;

-- Claiming a replacement attempt first fires the 0020 superseded-attempt
-- trigger, which sees the old attempt and its old output fence.  The new
-- attempt then starts with no dispatchable credential state.
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
     where c.processing_enabled
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

create or replace function bind_media_validation_attempt_credentials(
  p_upload_id uuid,p_attempt_id uuid,p_dispatch_nonce_hash text,
  p_completion_token_hash text,p_kid text,p_dispatch_envelope_expires_at timestamptz,
  p_signed_urls_returned_at timestamptz,p_output_credentials_expire_at timestamptz
) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_key media_envelope_keys%rowtype; v_up media_uploads%rowtype; v_now timestamptz;
begin
  if p_dispatch_nonce_hash is null or p_completion_token_hash is null or p_kid is null
     or p_dispatch_envelope_expires_at is null or p_signed_urls_returned_at is null
     or p_output_credentials_expire_at is null
     or p_dispatch_nonce_hash !~ '^[0-9a-f]{64}$'
     or p_completion_token_hash !~ '^[0-9a-f]{64}$'
     or p_dispatch_nonce_hash=p_completion_token_hash
     or p_kid !~ '^[A-Za-z0-9_-]{1,32}$'
     or p_output_credentials_expire_at<>p_signed_urls_returned_at+interval '2 hours 30 seconds' then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('media-envelope-key-lifecycle',29));
  select * into v_key from media_envelope_keys where kid=p_kid for update;
  if not found or v_key.status<>'active' then return false; end if;
  select * into v_up from media_uploads where id=p_upload_id for update;
  -- Deadline decisions use time observed after the key and attempt rows are
  -- locked. A request that waited behind rotation/revocation/another attempt
  -- must not retain the pre-wait clock value.
  v_now:=clock_timestamp();
  if not found or v_up.state<>'processing' or v_up.attempt_id<>p_attempt_id
     or v_up.uploader_id is null or v_up.wall_id is null
     or v_up.lease_expires_at<=v_now
     or p_dispatch_envelope_expires_at<=v_now
     or p_dispatch_envelope_expires_at>v_now+interval '120 seconds'
     or p_signed_urls_returned_at>v_now+interval '10 seconds'
     or p_signed_urls_returned_at<v_now-interval '2 minutes'
     or not exists(select 1 from media_kind_controls where kind=v_up.kind and processing_enabled) then
    return false;
  end if;
  if v_up.dispatch_nonce_hash is not null then
    if v_up.dispatch_nonce_hash<>p_dispatch_nonce_hash
       or v_up.completion_nonce_hash<>p_completion_token_hash
       or v_up.envelope_kid<>p_kid
       or v_up.dispatch_envelope_expires_at<>p_dispatch_envelope_expires_at
       or p_output_credentials_expire_at<v_up.output_credentials_expire_at then
      return false;
    end if;
  end if;
  update media_envelope_keys set
    last_dispatch_exp=greatest(coalesce(last_dispatch_exp,'-infinity'::timestamptz),p_dispatch_envelope_expires_at),
    last_completion_exp=greatest(coalesce(last_completion_exp,'-infinity'::timestamptz),v_up.lease_expires_at),
    updated_at=v_now where kid=p_kid;
  update media_uploads set dispatch_nonce_hash=p_dispatch_nonce_hash,
    completion_nonce_hash=p_completion_token_hash,envelope_kid=p_kid,
    dispatch_envelope_expires_at=p_dispatch_envelope_expires_at,
    output_credentials_expire_at=greatest(
      coalesce(output_credentials_expire_at,'-infinity'::timestamptz),p_output_credentials_expire_at),
    updated_at=v_now where id=p_upload_id;
  return true;
end $$;
revoke all on function bind_media_validation_attempt_credentials(uuid,uuid,text,text,text,timestamptz,timestamptz,timestamptz)
  from public,anon,authenticated;
grant execute on function bind_media_validation_attempt_credentials(uuid,uuid,text,text,text,timestamptz,timestamptz,timestamptz)
  to service_role;

create or replace function redeem_media_validation_dispatch_nonce(
  p_upload_id uuid,p_attempt_id uuid,p_nonce text,p_kid text
) returns boolean language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare v_key media_envelope_keys%rowtype; v_up media_uploads%rowtype; v_now timestamptz;
begin
  if nullif(p_nonce,'') is null or char_length(p_nonce)>512
     or p_kid !~ '^[A-Za-z0-9_-]{1,32}$' then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('media-envelope-key-lifecycle',29));
  select * into v_key from media_envelope_keys where kid=p_kid for update;
  if not found or v_key.status not in ('active','retiring') then return false; end if;
  select * into v_up from media_uploads where id=p_upload_id for update;
  v_now:=clock_timestamp();
  if not found or v_up.state<>'processing' or v_up.attempt_id<>p_attempt_id
     or v_up.uploader_id is null or v_up.wall_id is null
     or v_key.last_dispatch_exp<v_now
     or v_up.lease_expires_at<=v_now or v_up.dispatch_envelope_expires_at<=v_now
     or v_up.output_credentials_expire_at is null
     or v_up.dispatch_redeemed_at is not null or v_up.envelope_kid<>p_kid
     or not exists(select 1 from media_kind_controls where kind=v_up.kind and processing_enabled)
     or v_up.dispatch_nonce_hash<>encode(extensions.digest(p_nonce,'sha256'),'hex') then return false; end if;
  update media_uploads set dispatch_redeemed_at=v_now,updated_at=v_now where id=p_upload_id;
  return true;
end $$;
revoke all on function redeem_media_validation_dispatch_nonce(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function redeem_media_validation_dispatch_nonce(uuid,uuid,text,text) to service_role;

-- Every attempt-produced output receives the persisted signed-PUT fence.  The
-- staging source is GET-only and remains independently cleanable.
create or replace function fence_media_deletion(p_deletion_id uuid,p_fence timestamptz)
returns void language sql volatile security definer set search_path=pg_catalog,public as $$
  update media_object_deletions set
    not_before=greatest(not_before,coalesce(p_fence,clock_timestamp())),updated_at=clock_timestamp()
  where id=p_deletion_id;
$$;
revoke all on function fence_media_deletion(uuid,timestamptz) from public,anon,authenticated;

create or replace function enqueue_media_upload_attempt_output_cleanup(
  p_upload media_uploads,p_reason text,p_track_quota_release boolean
) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_prefix text; v_key text:=p_reason||':'||p_upload.id::text; v_deletion_id uuid;
begin
  if p_upload.validated_path is null then return; end if;
  if p_upload.validated_path ~ '/full$' and p_upload.attempt_id is not null then
    v_prefix:=p_upload.validated_path;
    if p_upload.kind='photo'::mark_type then
      v_deletion_id:=enqueue_exact_media_object_deletion(v_key||':jpg',v_prefix||'.jpg',
        'validated/'||p_upload.id::text||'/'||p_upload.attempt_id::text||'/thumb.webp',p_reason);
      perform fence_media_deletion(v_deletion_id,p_upload.output_credentials_expire_at);
      perform require_media_upload_cleanup(p_upload.id,v_deletion_id,p_track_quota_release);
      v_deletion_id:=enqueue_exact_media_object_deletion(v_key||':webp',v_prefix||'.webp',null,p_reason);
      perform fence_media_deletion(v_deletion_id,p_upload.output_credentials_expire_at);
      perform require_media_upload_cleanup(p_upload.id,v_deletion_id,p_track_quota_release);
    elsif p_upload.kind='voice'::mark_type then
      v_deletion_id:=enqueue_exact_media_object_deletion(v_key||':m4a',v_prefix||'.m4a',null,p_reason);
      perform fence_media_deletion(v_deletion_id,p_upload.output_credentials_expire_at);
      perform require_media_upload_cleanup(p_upload.id,v_deletion_id,p_track_quota_release);
    else
      v_deletion_id:=enqueue_exact_media_object_deletion(v_key||':mp4',v_prefix||'.mp4',
        'validated/'||p_upload.id::text||'/'||p_upload.attempt_id::text||'/poster.webp',p_reason);
      perform fence_media_deletion(v_deletion_id,p_upload.output_credentials_expire_at);
      perform require_media_upload_cleanup(p_upload.id,v_deletion_id,p_track_quota_release);
    end if;
  else
    v_deletion_id:=enqueue_exact_media_object_deletion(v_key||':canonical',
      p_upload.validated_path,p_upload.preview_path,p_reason);
    perform fence_media_deletion(v_deletion_id,p_upload.output_credentials_expire_at);
    perform require_media_upload_cleanup(p_upload.id,v_deletion_id,p_track_quota_release);
  end if;
end $$;
revoke all on function enqueue_media_upload_attempt_output_cleanup(media_uploads,text,boolean)
  from public,anon,authenticated;

create or replace function release_media_upload_reservation_if_clean(p_upload_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid; v_up media_uploads%rowtype; v_quota media_quota_daily%rowtype;
begin
  if current_user not in ('postgres','service_role') then raise exception 'unavailable' using errcode='42501'; end if;
  select uploader_tombstone_id into v_actor from media_uploads where id=p_upload_id;
  if v_actor is null then return false; end if;
  perform lock_media_actor(v_actor);
  select * into v_up from media_uploads where id=p_upload_id for update;
  if not found then return false; end if;
  if v_up.quota_reservation_released_at is not null then return true; end if;
  if v_up.state not in ('failed','expired')
     or (v_up.output_credentials_expire_at is not null
       and clock_timestamp()<v_up.output_credentials_expire_at) then return false; end if;
  if not exists(select 1 from media_upload_cleanup_requirements r where r.upload_id=v_up.id)
     or exists(select 1 from media_upload_cleanup_requirements r
       join media_object_deletions d on d.id=r.deletion_id where r.upload_id=v_up.id
       and (d.state<>'deleted' or d.object_evidence is null
         or (d.preview_path is not null and d.preview_evidence is null))) then return false; end if;
  perform lock_media_quota(v_up.uploader_tombstone_id,v_up.quota_day);
  select * into v_quota from media_quota_daily
    where user_tombstone_id=v_up.uploader_tombstone_id and quota_day=v_up.quota_day for update;
  if not found then raise exception 'MEDIA_QUOTA_LEDGER_MISSING' using errcode='23503'; end if;
  if v_quota.reserved_bytes<v_up.reserved_charge or v_quota.reservation_count<1
     or (v_up.quota_session_released_at is null and v_quota.open_sessions<1) then
    raise exception 'MEDIA_QUOTA_LEDGER_INVARIANT' using errcode='23514'; end if;
  update media_quota_daily set reserved_bytes=reserved_bytes-v_up.reserved_charge,
    reservation_count=reservation_count-1,
    open_sessions=open_sessions-case when v_up.quota_session_released_at is null then 1 else 0 end,
    updated_at=now()
    where user_tombstone_id=v_up.uploader_tombstone_id and quota_day=v_up.quota_day;
  update media_uploads set quota_reservation_released_at=now(),
    quota_session_released_at=coalesce(quota_session_released_at,now()),updated_at=now()
    where id=v_up.id;
  return true;
end $$;
revoke all on function release_media_upload_reservation_if_clean(uuid) from public,anon,authenticated;

-- Canonicalization returns NULL for schema-invalid results.  JSONB itself
-- supplies a deterministic textual representation for the durable retry hash.
create or replace function canonical_media_validation_result(p_outcome text,p_result jsonb)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare v_keys integer; v_normal jsonb;
begin
  if jsonb_typeof(p_result)<>'object' then return null; end if;
  select count(*) into v_keys from jsonb_object_keys(p_result);
  if p_outcome='failed' then
    if v_keys<>1 or not (p_result ? 'error_code')
       or jsonb_typeof(p_result->'error_code')<>'string'
       or (p_result->>'error_code') !~ '^[A-Z][A-Z0-9_]{0,63}$' then return null; end if;
    return jsonb_build_object('error_code',p_result->>'error_code');
  end if;
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
revoke all on function canonical_media_validation_result(text,jsonb) from public,anon,authenticated;

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
    return v_receipt.completion_token_hash=v_token_hash
      and v_receipt.envelope_kid=p_kid and v_receipt.outcome=p_outcome
      and v_receipt.canonical_result_sha256=v_result_hash;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('media-envelope-key-lifecycle',29));
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

  if p_outcome='success' then
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
       or (v_result->>'validated_bytes')::bigint<=0
       or (v_result->>'sha256') !~ '^[0-9a-f]{64}$'
       or (v_result->>'cache_control_seconds')::integer not between 0 and 60
       or (v_up.kind='photo' and ((v_result->>'detected_mime') not in ('image/jpeg','image/webp')
         or (v_result->>'validated_bytes')::bigint>10485760 or v_result->'duration_ms'<>'null'::jsonb
         or v_result->'width'='null'::jsonb or v_result->'height'='null'::jsonb))
       or (v_up.kind='voice' and ((v_result->>'detected_mime')<>'audio/mp4'
         or (v_result->>'validated_bytes')::bigint>10485760 or v_result->'width'<>'null'::jsonb
         or v_result->'height'<>'null'::jsonb
         or (v_result->>'duration_ms')::integer not between 1 and 60000))
       or (v_up.kind='video' and ((v_result->>'detected_mime')<>'video/mp4'
         or (v_result->>'validated_bytes')::bigint>52428800 or v_result->'width'='null'::jsonb
         or v_result->'height'='null'::jsonb
         or (v_result->>'duration_ms')::integer not between 1 and 30000))
       or coalesce((v_result->>'width')::integer,1)>8192
       or coalesce((v_result->>'height')::integer,1)>8192
       or coalesce((v_result->>'width')::bigint,1)*coalesce((v_result->>'height')::bigint,1)>25000000
       then return false; end if;
  end if;

  insert into media_validation_callback_receipts(upload_id,attempt_id,completion_token_hash,
    envelope_kid,outcome,canonical_result_sha256)
  values(p_upload_id,p_attempt_id,v_token_hash,p_kid,p_outcome,v_result_hash);
  update media_uploads set completion_redeemed_at=v_now,updated_at=v_now where id=p_upload_id;

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
grant execute on function finalize_media_validation_attempt(uuid,uuid,text,text,text,jsonb)
  to service_role;

-- The two-step callback path is no longer callable by Edge/service_role.
revoke execute on function bind_media_validation_attempt_nonces(uuid,uuid,text,text,text) from service_role;
revoke execute on function redeem_media_validation_completion_nonce(uuid,uuid,text,text) from service_role;
revoke execute on function complete_media_validation(uuid,uuid,text,bigint,text,integer,integer,integer,text,text,integer)
  from service_role;
revoke execute on function fail_media_validation(uuid,uuid,text) from service_role;

-- Subject deletion and expiry enqueue output cleanup while the row still holds
-- its attempt fence, then invalidate every attempt credential.
create or replace function enqueue_unconsumed_media_subject_cleanup()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if old.consumed_mark_id is null
     and ((old.uploader_id is not null and new.uploader_id is null)
       or (old.wall_id is not null and new.wall_id is null)) then
    perform enqueue_media_upload_full_cleanup(old,'subject_deleted',true);
    new.state:='expired'; new.session_state:='expired'; new.error_code:='SUBJECT_DELETED';
    new.lease_expires_at:=null; new.attempt_id:=null;
    new.dispatch_nonce_hash:=null; new.completion_nonce_hash:=null;
    new.dispatch_redeemed_at:=null; new.completion_redeemed_at:=null; new.envelope_kid:=null;
    new.dispatch_envelope_expires_at:=null; new.output_credentials_expire_at:=old.output_credentials_expire_at;
    new.updated_at:=now();
  end if;
  return new;
end $$;

create or replace function expire_media_uploads()
returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_count integer:=0; v_up media_uploads%rowtype; v_actor uuid;
begin
  if current_user not in ('postgres','service_role') then raise exception 'unavailable' using errcode='42501'; end if;
  for v_actor in select distinct uploader_tombstone_id from media_uploads
    where state in ('initiated','uploaded','processing','validated')
      and (expires_at<=now() or uploader_id is null or wall_id is null)
    order by uploader_tombstone_id
  loop
    perform lock_media_actor(v_actor);
    for v_up in select * from media_uploads where uploader_tombstone_id=v_actor
      and state in ('initiated','uploaded','processing','validated')
      and (expires_at<=now() or uploader_id is null or wall_id is null)
      order by id for update skip locked
    loop
      perform enqueue_media_upload_full_cleanup(v_up,'upload_expired',true);
      update media_uploads set state='expired',session_state='expired',lease_expires_at=null,
        attempt_id=null,dispatch_nonce_hash=null,completion_nonce_hash=null,
        dispatch_redeemed_at=null,completion_redeemed_at=null,envelope_kid=null,
        dispatch_envelope_expires_at=null,
        error_code=case when uploader_id is null or wall_id is null then 'SUBJECT_DELETED' else error_code end,
        updated_at=now() where id=v_up.id;
      perform release_media_upload_reservation_if_clean(v_up.id);
      v_count:=v_count+1;
    end loop;
  end loop;
  return v_count;
end $$;
revoke all on function expire_media_uploads() from public,anon,authenticated;
grant execute on function expire_media_uploads() to service_role;

-- Canonical Mark deletion must also respect the output credential fence retained
-- by its consumed upload.
create or replace function enqueue_mark_media_deletion()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_fence timestamptz;
begin
  select output_credentials_expire_at into v_fence from media_uploads where id=old.upload_id;
  v_id:=enqueue_exact_media_object_deletion('mark-media:'||old.id::text,
    old.storage_path,old.preview_path,'mark_deleted');
  perform fence_media_deletion(v_id,v_fence);
  return old;
end $$;

commit;
