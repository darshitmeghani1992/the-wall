-- ============================================================================
-- 0020 · Protected private Mark-media foundation (FP-MEDIA-001 / ADR-012 C1)
--
-- Additive, default-off foundation only. This migration does not enable a media
-- kind, migrate legacy public objects, remove 0018's direct text compatibility
-- writer, or deploy a processor. App-facing functions derive the actor from
-- auth.uid(); privileged functions are service-role only.
-- ============================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ── Server controls and audit ───────────────────────────────────────────────
create table media_kind_controls (
  kind mark_type primary key check (kind in ('photo','voice','video')),
  reservation_enabled boolean not null default false,
  upload_transition_enabled boolean not null default false,
  processing_enabled boolean not null default false,
  creation_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  reason text not null default 'default-off'
);

insert into media_kind_controls(kind) values ('photo'),('voice'),('video')
on conflict (kind) do nothing;

create table media_kind_control_audit (
  id bigint generated always as identity primary key,
  kind mark_type not null,
  old_value jsonb not null,
  new_value jsonb not null,
  changed_by uuid,
  reason text not null,
  created_at timestamptz not null default now()
);

-- ── Legacy reconciliation gate ──────────────────────────────────────────────
create table media_legacy_reconciliation (
  singleton boolean primary key default true check (singleton),
  state text not null default 'pending' check (state in ('pending','running','complete','failed')),
  inventory_count bigint not null default 0 check (inventory_count >= 0),
  migrated_count bigint not null default 0 check (migrated_count >= 0),
  quarantined_count bigint not null default 0 check (quarantined_count >= 0),
  missing_count bigint not null default 0 check (missing_count >= 0),
  remaining_legacy_url_count bigint not null default 0 check (remaining_legacy_url_count >= 0),
  public_deletion_count bigint not null default 0 check (public_deletion_count >= 0),
  fresh_denial_proof_count bigint not null default 0 check (fresh_denial_proof_count >= 0),
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (
    state <> 'complete' or (
      completed_at is not null
      and inventory_count = migrated_count + quarantined_count + missing_count
      and remaining_legacy_url_count = 0
      and public_deletion_count = inventory_count
      and fresh_denial_proof_count = inventory_count
    )
  )
);
insert into media_legacy_reconciliation(singleton) values (true) on conflict do nothing;

create table legacy_media_migrations (
  mark_id uuid primary key references marks(id) on delete restrict,
  source_url text not null,
  source_bucket text,
  source_path text,
  source_bytes bigint check (source_bytes is null or source_bytes >= 0),
  source_mime text,
  source_etag text,
  source_sha256 text check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
  private_staging_sha256 text check (private_staging_sha256 is null or private_staging_sha256 ~ '^[0-9a-f]{64}$'),
  canonical_sha256 text check (canonical_sha256 is null or canonical_sha256 ~ '^[0-9a-f]{64}$'),
  canonical_path text,
  state text not null default 'inventoried'
    check (state in ('inventoried','quarantined','staged','processed','linked','public_deleted','proved','failed')),
  read_proved_at timestamptz,
  public_deleted_at timestamptz,
  cdn_purged_at timestamptz,
  fresh_denial_proved_at timestamptz,
  denial_evidence jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Atomic quota and upload workflow ────────────────────────────────────────
create table media_quota_daily (
  user_tombstone_id uuid not null,
  quota_day date not null,
  reserved_bytes bigint not null default 0 check (reserved_bytes >= 0),
  ingested_bytes bigint not null default 0 check (ingested_bytes >= 0),
  reservation_count integer not null default 0 check (reservation_count >= 0),
  open_sessions integer not null default 0 check (open_sessions >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_tombstone_id, quota_day)
);

create table media_uploads (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid references auth.users(id) on delete set null,
  uploader_tombstone_id uuid not null,
  wall_id uuid references walls(id) on delete set null,
  wall_tombstone_id uuid not null,
  kind mark_type not null check (kind in ('photo','voice','video')),
  client_upload_id uuid not null,
  source_path text not null unique,
  state text not null default 'initiated'
    check (state in ('initiated','uploaded','processing','validated','consumed','failed','expired')),
  session_state text not null default 'open' check (session_state in ('open','closed','expired')),
  declared_mime text not null,
  declared_bytes bigint not null check (declared_bytes > 0),
  detected_mime text,
  validated_bytes bigint,
  actual_input_bytes bigint,
  sha256 text,
  width integer,
  height integer,
  duration_ms integer,
  validated_path text unique,
  preview_path text,
  cache_control_seconds integer,
  attempt_id uuid,
  lease_expires_at timestamptz,
  attempt_count smallint not null default 0 check (attempt_count between 0 and 5),
  error_code text,
  expires_at timestamptz not null,
  consumed_mark_id uuid references marks(id) on delete set null,
  consumed_mark_tombstone_id uuid,
  quota_day date not null,
  reserved_charge bigint not null check (reserved_charge > 0),
  dispatch_nonce_hash text,
  completion_nonce_hash text,
  dispatch_redeemed_at timestamptz,
  completion_redeemed_at timestamptz,
  envelope_kid text,
  validated_at timestamptz,
  consumed_at timestamptz,
  -- A reservation remains charged until its exact cleanup requirements have
  -- durable delete-or-missing evidence.  Session release is tracked
  -- separately because a successfully completed upload closes its transport
  -- session before its daily reservation expires.
  quota_reservation_released_at timestamptz,
  quota_session_released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (uploader_tombstone_id, client_upload_id),
  unique (consumed_mark_id),
  check (uploader_id is null or uploader_id = uploader_tombstone_id),
  check (wall_id is null or wall_id = wall_tombstone_id),
  check (consumed_mark_id is null or consumed_mark_tombstone_id = consumed_mark_id),
  check (source_path = 'staging/' || uploader_tombstone_id::text || '/' || id::text || '/source'),
  check (source_path !~ E'[\\x00-\\x1f\\x7f]' and source_path !~ '(^|/)\\.\\.?(/|$)'),
  check (validated_path is null or
         (validated_path like 'validated/' || id::text || '/%' and validated_path !~ E'[\\x00-\\x1f\\x7f]'
          and validated_path !~ '(^|/)\\.\\.?(/|$)')),
  check (preview_path is null or
         (preview_path like 'validated/' || id::text || '/%' and preview_path !~ E'[\\x00-\\x1f\\x7f]'
          and preview_path !~ '(^|/)\\.\\.?(/|$)')),
  check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  check (validated_bytes is null or validated_bytes > 0),
  check (actual_input_bytes is null or actual_input_bytes > 0),
  check (cache_control_seconds is null or cache_control_seconds between 0 and 60),
  check (
    (kind='photo' and declared_bytes <= 6291456 and duration_ms is null)
    or (kind='voice' and declared_bytes <= 8388608 and (duration_ms is null or duration_ms between 1 and 60000))
    or (kind='video' and declared_bytes <= 41943040 and (duration_ms is null or duration_ms between 1 and 30000))
  ),
  check (width is null or width between 1 and 8192),
  check (height is null or height between 1 and 8192),
  check (width is null or height is null or width::bigint * height::bigint <= 25000000),
  check (
    state not in ('validated','consumed') or
    (detected_mime is not null and validated_bytes is not null and sha256 is not null
     and validated_path is not null and validated_at is not null and cache_control_seconds is not null)
  ),
  check (validated_bytes is null or
    (kind='photo' and validated_bytes<=10485760) or
    (kind='voice' and validated_bytes<=10485760) or
    (kind='video' and validated_bytes<=52428800)),
  check (detected_mime is null or
    (kind='photo' and detected_mime in ('image/jpeg','image/webp')) or
    (kind='voice' and detected_mime='audio/mp4') or
    (kind='video' and detected_mime='video/mp4')),
  check (state not in ('validated','consumed') or
    (kind='photo' and width is not null and height is not null and duration_ms is null)
    or (kind='voice' and width is null and height is null and duration_ms between 1 and 60000)
    or (kind='video' and width is not null and height is not null and duration_ms between 1 and 30000))
);

create index media_uploads_claim_idx on media_uploads(state, lease_expires_at);
create index media_uploads_cleanup_idx on media_uploads(state, expires_at);
create index media_uploads_uploader_idx on media_uploads(uploader_id, created_at desc);
create index media_uploads_wall_idx on media_uploads(wall_id, created_at desc);

-- ── Canonical media and creation idempotency ────────────────────────────────
create table mark_media (
  id uuid primary key default gen_random_uuid(),
  mark_id uuid not null references marks(id) on delete cascade,
  upload_id uuid not null unique references media_uploads(id) on delete restrict,
  media_type mark_type not null check (media_type in ('photo','voice','video')),
  "position" smallint not null check ("position" between 0 and 4),
  storage_path text not null unique,
  preview_path text,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  width integer,
  height integer,
  duration_ms integer,
  created_at timestamptz not null default now(),
  unique (mark_id, "position"),
  check ((media_type='photo' and duration_ms is null and "position" between 0 and 4)
      or (media_type='voice' and "position"=0 and duration_ms between 1 and 60000)
      or (media_type='video' and "position"=0 and duration_ms between 1 and 30000)),
  check (width is null or width between 1 and 8192),
  check (height is null or height between 1 and 8192),
  check (width is null or height is null or width::bigint * height::bigint <= 25000000),
  check ((media_type='photo' and mime_type in ('image/jpeg','image/webp') and byte_size<=10485760)
      or (media_type='voice' and mime_type='audio/mp4' and byte_size<=10485760)
      or (media_type='video' and mime_type='video/mp4' and byte_size<=52428800))
);
create index mark_media_mark_idx on mark_media(mark_id, "position");

create table mark_creation_requests (
  actor_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  fingerprint_version integer not null check (fingerprint_version = 1),
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  state text not null default 'pending' check (state in ('pending','completed','deleted')),
  mark_id uuid references marks(id) on delete set null,
  result_mark_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz,
  primary key (actor_id, request_id),
  check ((state='pending' and mark_id is null and result_mark_id is null and completed_at is null and deleted_at is null)
      or (state='completed' and mark_id is not null and result_mark_id=mark_id and completed_at is not null and deleted_at is null)
      or (state='deleted' and mark_id is null and result_mark_id is not null and completed_at is not null and deleted_at is not null))
);
create unique index mark_creation_requests_live_mark_idx on mark_creation_requests(mark_id) where mark_id is not null;

-- ── Exact-path deletion outbox ──────────────────────────────────────────────
create table media_object_deletions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  bucket_id text not null check (bucket_id='mark-media'),
  object_path text not null check (object_path <> '' and object_path !~ E'[\\x00-\\x1f\\x7f]' and object_path !~ '(^|/)\\.\\.?(/|$)'),
  preview_path text check (preview_path is null or (preview_path <> '' and preview_path !~ E'[\\x00-\\x1f\\x7f]' and preview_path !~ '(^|/)\\.\\.?(/|$)')),
  reason text not null,
  state text not null default 'pending' check (state in ('pending','processing','deleted','failed')),
  attempt_id uuid,
  attempt_count smallint not null default 0 check (attempt_count between 0 and 20),
  lease_expires_at timestamptz,
  -- Do not accept delete/missing evidence while an already-issued worker
  -- output credential can still write this exact attempt path.
  not_before timestamptz not null default now(),
  object_deleted_at timestamptz,
  preview_deleted_at timestamptz,
  object_evidence jsonb,
  preview_evidence jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index media_object_deletions_work_idx
  on media_object_deletions(state, not_before, lease_expires_at, created_at);

-- An expired/terminal unconsumed reservation may release its ledger charge
-- only after every exact object cleanup it requires is durably evidenced. This
-- table deliberately links audit-stable workflow rows, not users/Walls/Marks.
create table media_upload_cleanup_requirements (
  upload_id uuid not null references media_uploads(id) on delete restrict,
  deletion_id uuid not null references media_object_deletions(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (upload_id, deletion_id)
);
create index media_upload_cleanup_requirements_deletion_idx
  on media_upload_cleanup_requirements(deletion_id);

-- Persist one exact object deletion and return its durable outbox ID. Existing
-- idempotency keys must name exactly the same object; otherwise a programming
-- bug would silently turn an old cleanup request into a new target.
create or replace function enqueue_exact_media_object_deletion(
  p_idempotency_key text,p_object_path text,p_preview_path text,p_reason text
) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid; v_existing media_object_deletions%rowtype;
begin
  insert into media_object_deletions(idempotency_key,bucket_id,object_path,preview_path,reason)
    values(p_idempotency_key,'mark-media',p_object_path,p_preview_path,p_reason)
    on conflict (idempotency_key) do nothing
    returning id into v_id;
  if v_id is not null then return v_id; end if;
  select * into strict v_existing from media_object_deletions where idempotency_key=p_idempotency_key;
  if v_existing.object_path<>p_object_path
     or v_existing.preview_path is distinct from p_preview_path
     or v_existing.reason<>p_reason then
    raise exception 'MEDIA_DELETION_IDEMPOTENCY_CONFLICT' using errcode='23505';
  end if;
  return v_existing.id;
end $$;
revoke all on function enqueue_exact_media_object_deletion(text,text,text,text) from public,anon,authenticated;

create or replace function require_media_upload_cleanup(
  p_upload_id uuid,p_deletion_id uuid,p_track_quota_release boolean
) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if p_track_quota_release then
    insert into media_upload_cleanup_requirements(upload_id,deletion_id)
      values(p_upload_id,p_deletion_id) on conflict do nothing;
  end if;
end $$;
revoke all on function require_media_upload_cleanup(uuid,uuid,boolean) from public,anon,authenticated;

-- This helper is intentionally limited to attempt-produced objects. A stale
-- worker attempt may have emitted its canonical/preview candidates, but its
-- immutable staging source belongs to the whole upload and must remain readable
-- for the replacement lease. Never add source cleanup here.
create or replace function enqueue_media_upload_attempt_output_cleanup(
  p_upload media_uploads,p_reason text,p_track_quota_release boolean
) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_prefix text; v_key text:=p_reason||':'||p_upload.id::text; v_deletion_id uuid;
begin
  if p_upload.validated_path is null then return; end if;
  if p_upload.validated_path ~ '/full$' and p_upload.attempt_id is not null then
    v_prefix:=p_upload.validated_path;
    if p_upload.kind='photo'::mark_type then
      v_deletion_id:=enqueue_exact_media_object_deletion(
        v_key||':jpg',v_prefix||'.jpg',
        'validated/'||p_upload.id::text||'/'||p_upload.attempt_id::text||'/thumb.webp',p_reason);
      perform require_media_upload_cleanup(p_upload.id,v_deletion_id,p_track_quota_release);
      v_deletion_id:=enqueue_exact_media_object_deletion(v_key||':webp',v_prefix||'.webp',null,p_reason);
      perform require_media_upload_cleanup(p_upload.id,v_deletion_id,p_track_quota_release);
    elsif p_upload.kind='voice'::mark_type then
      v_deletion_id:=enqueue_exact_media_object_deletion(v_key||':m4a',v_prefix||'.m4a',null,p_reason);
      perform require_media_upload_cleanup(p_upload.id,v_deletion_id,p_track_quota_release);
    else
      v_deletion_id:=enqueue_exact_media_object_deletion(
        v_key||':mp4',v_prefix||'.mp4',
        'validated/'||p_upload.id::text||'/'||p_upload.attempt_id::text||'/poster.webp',p_reason);
      perform require_media_upload_cleanup(p_upload.id,v_deletion_id,p_track_quota_release);
    end if;
  else
    v_deletion_id:=enqueue_exact_media_object_deletion(
      v_key||':canonical',p_upload.validated_path,p_upload.preview_path,p_reason);
    perform require_media_upload_cleanup(p_upload.id,v_deletion_id,p_track_quota_release);
  end if;
end $$;
revoke all on function enqueue_media_upload_attempt_output_cleanup(media_uploads,text,boolean)
  from public,anon,authenticated;

-- Full cleanup is used only when the complete upload is terminal/expired or
-- the subject disappears. It queues the staging source plus all known exact
-- canonical candidates. Superseded attempts must call the narrower helper.
create or replace function enqueue_media_upload_full_cleanup(
  p_upload media_uploads,p_reason text,p_track_quota_release boolean
) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_deletion_id uuid; v_key text:=p_reason||':'||p_upload.id::text;
begin
  v_deletion_id:=enqueue_exact_media_object_deletion(v_key||':source',p_upload.source_path,null,p_reason);
  perform require_media_upload_cleanup(p_upload.id,v_deletion_id,p_track_quota_release);
  perform enqueue_media_upload_attempt_output_cleanup(p_upload,p_reason,p_track_quota_release);
end $$;
revoke all on function enqueue_media_upload_full_cleanup(media_uploads,text,boolean)
  from public,anon,authenticated;

create or replace function enqueue_superseded_media_attempt()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if old.attempt_id is not null and new.attempt_id is distinct from old.attempt_id
     and new.state='processing' then
    perform enqueue_media_upload_attempt_output_cleanup(
      old,'superseded_attempt_'||old.attempt_id::text,false);
  end if;
  return new;
end $$;
drop trigger if exists a0_media_upload_attempt_cleanup on media_uploads;
create trigger a0_media_upload_attempt_cleanup before update of attempt_id on media_uploads
  for each row execute function enqueue_superseded_media_attempt();

create table media_signing_rate_limits (
  actor_id uuid primary key references auth.users(id) on delete cascade,
  tokens numeric not null default 20 check (tokens >= 0 and tokens <= 20),
  refilled_at timestamptz not null default now()
);

-- ── RLS and privilege floor ─────────────────────────────────────────────────
alter table media_kind_controls enable row level security;
alter table media_kind_control_audit enable row level security;
alter table media_legacy_reconciliation enable row level security;
alter table legacy_media_migrations enable row level security;
alter table media_quota_daily enable row level security;
alter table media_uploads enable row level security;
alter table mark_media enable row level security;
alter table mark_creation_requests enable row level security;
alter table media_object_deletions enable row level security;
alter table media_upload_cleanup_requirements enable row level security;
alter table media_signing_rate_limits enable row level security;

revoke all on media_kind_controls, media_kind_control_audit,
  media_legacy_reconciliation, legacy_media_migrations, media_quota_daily,
  media_uploads, mark_media, mark_creation_requests, media_object_deletions,
  media_upload_cleanup_requirements, media_signing_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on media_kind_controls, media_kind_control_audit,
  media_legacy_reconciliation, legacy_media_migrations, media_quota_daily,
  media_uploads, mark_media, mark_creation_requests, media_object_deletions,
  media_upload_cleanup_requirements, media_signing_rate_limits to service_role;

-- Private bucket. Do not ALTER storage.objects: hosted Supabase owns that table.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('mark-media','mark-media',false,52428800,
  array['image/jpeg','image/png','image/webp','image/heic','audio/m4a','audio/mp4','audio/mpeg','audio/wav','video/mp4','video/quicktime'])
on conflict (id) do update set public=false, file_size_limit=52428800,
  allowed_mime_types=excluded.allowed_mime_types;

-- 0018's owner-only UPDATE/DELETE policies were accidentally bucket-agnostic.
-- Once this bucket exists they would let an uploader alter, move, or delete a
-- staged source behind the workflow. Retain avatar behavior, scoped exactly to
-- the legacy public attachments bucket.
drop policy if exists "attachments modify own nonmark" on storage.objects;
create policy "attachments modify own nonmark" on storage.objects for update to authenticated
  using (bucket_id='attachments' and owner=auth.uid()
    and coalesce((storage.foldername(name))[1], '') <> 'marks')
  with check (bucket_id='attachments' and owner=auth.uid()
    and coalesce((storage.foldername(name))[1], '') <> 'marks');
drop policy if exists "attachments delete own nonmark" on storage.objects;
create policy "attachments delete own nonmark" on storage.objects for delete to authenticated
  using (bucket_id='attachments' and owner=auth.uid()
    and coalesce((storage.foldername(name))[1], '') <> 'marks');

-- ── Small internal helpers ──────────────────────────────────────────────────
create or replace function media_kind_limit(p_kind mark_type)
returns bigint language sql immutable set search_path=pg_catalog,public as $$
  select case p_kind when 'photo'::mark_type then 6291456
                     when 'voice'::mark_type then 8388608
                     when 'video'::mark_type then 41943040 else 0 end;
$$;
revoke all on function media_kind_limit(mark_type) from public,anon,authenticated;

create or replace function lock_media_quota(p_actor uuid,p_day date)
returns void language sql volatile security definer set search_path=pg_catalog,public as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text || ':' || p_day::text, 20));
$$;
revoke all on function lock_media_quota(uuid,date) from public,anon,authenticated;

-- Cross-day active-session and rolling-window limits cannot be protected by a
-- day-row lock alone. Every reservation/state cleanup takes this actor-wide
-- lock before acquiring a day ledger lock, giving a stable lock order.
create or replace function lock_media_actor(p_actor uuid)
returns void language sql volatile security definer set search_path=pg_catalog,public as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('media-upload-actor:' || p_actor::text, 19)
  );
$$;
revoke all on function lock_media_actor(uuid) from public,anon,authenticated;

-- A successfully deleted object and a proven-missing object are both terminal
-- cleanup outcomes. The trusted deletion worker must bind its durable evidence
-- to the exact path it was assigned; callers never provide a wildcard or an
-- upload-selected replacement path.
create or replace function media_deletion_evidence_matches(p_evidence jsonb,p_path text)
returns boolean language plpgsql immutable set search_path=pg_catalog,public as $$
begin
  if jsonb_typeof(p_evidence)<>'object'
     or p_evidence->>'path' is distinct from p_path
     or coalesce(p_evidence->>'outcome','') not in ('deleted','missing')
     or nullif(p_evidence->>'observed_at','') is null then
    return false;
  end if;
  perform (p_evidence->>'observed_at')::timestamptz;
  return true;
exception when others then
  return false;
end $$;
revoke all on function media_deletion_evidence_matches(jsonb,text) from public,anon,authenticated;

-- Release only an expired/terminal reservation whose exact cleanup evidence is
-- complete. `ingested_bytes` is intentionally retained as abuse accounting;
-- reserved bytes, reservation count, and an unreleased open-session charge are
-- reconciled once and only once.
create or replace function release_media_upload_reservation_if_clean(p_upload_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid; v_up media_uploads%rowtype; v_quota media_quota_daily%rowtype;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'unavailable' using errcode='42501';
  end if;
  select uploader_tombstone_id into v_actor from media_uploads where id=p_upload_id;
  if v_actor is null then return false; end if;
  perform lock_media_actor(v_actor);
  select * into v_up from media_uploads where id=p_upload_id for update;
  if not found then return false; end if;
  if v_up.quota_reservation_released_at is not null then return true; end if;
  if v_up.state not in ('failed','expired') then return false; end if;
  if not exists(select 1 from media_upload_cleanup_requirements r where r.upload_id=v_up.id) then
    return false;
  end if;
  if exists(
    select 1
      from media_upload_cleanup_requirements r
      join media_object_deletions d on d.id=r.deletion_id
     where r.upload_id=v_up.id
       and (d.state<>'deleted' or d.object_evidence is null
         or (d.preview_path is not null and d.preview_evidence is null))
  ) then
    return false;
  end if;
  perform lock_media_quota(v_up.uploader_tombstone_id,v_up.quota_day);
  select * into v_quota from media_quota_daily
   where user_tombstone_id=v_up.uploader_tombstone_id and quota_day=v_up.quota_day for update;
  if not found then
    raise exception 'MEDIA_QUOTA_LEDGER_MISSING' using errcode='23503';
  end if;
  if v_quota.reserved_bytes<v_up.reserved_charge or v_quota.reservation_count<1
     or (v_up.quota_session_released_at is null and v_quota.open_sessions<1) then
    raise exception 'MEDIA_QUOTA_LEDGER_INVARIANT' using errcode='23514';
  end if;
  update media_quota_daily
     set reserved_bytes=reserved_bytes-v_up.reserved_charge,
         reservation_count=reservation_count-1,
         open_sessions=open_sessions-case when v_up.quota_session_released_at is null then 1 else 0 end,
         updated_at=now()
   where user_tombstone_id=v_up.uploader_tombstone_id and quota_day=v_up.quota_day;
  update media_uploads
     set quota_reservation_released_at=now(),
         quota_session_released_at=coalesce(quota_session_released_at,now()),
         updated_at=now()
   where id=v_up.id;
  return true;
end $$;
revoke all on function release_media_upload_reservation_if_clean(uuid) from public,anon,authenticated;

-- C1 persists the deletion/missing proof; C2's Storage worker will call this
-- after an exact delete plus fresh HEAD/missing check. Marking the outbox row
-- deleted can release a reservation only through the evidence-bound function.
create or replace function record_media_object_deletion(
  p_deletion_id uuid,p_object_evidence jsonb,p_preview_evidence jsonb
) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_deletion media_object_deletions%rowtype;
  v_checked_at timestamptz;
  v_object_observed_at timestamptz;
  v_preview_observed_at timestamptz;
  v_upload_id uuid;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'unavailable' using errcode='42501';
  end if;
  select * into v_deletion from media_object_deletions where id=p_deletion_id for update;
  if not found then return false; end if;
  if v_deletion.state='deleted' then
    for v_upload_id in
      select r.upload_id from media_upload_cleanup_requirements r
       where r.deletion_id=v_deletion.id
    loop
      perform release_media_upload_reservation_if_clean(v_upload_id);
    end loop;
    return true;
  end if;
  v_checked_at:=clock_timestamp();
  if v_checked_at<v_deletion.not_before then return false; end if;
  if not media_deletion_evidence_matches(p_object_evidence,v_deletion.object_path)
     or (v_deletion.preview_path is null and p_preview_evidence is not null)
     or (v_deletion.preview_path is not null
       and not media_deletion_evidence_matches(p_preview_evidence,v_deletion.preview_path)) then
    return false;
  end if;
  v_object_observed_at:=(p_object_evidence->>'observed_at')::timestamptz;
  if v_object_observed_at<v_deletion.not_before
     or v_object_observed_at>v_checked_at+interval '5 minutes' then
    return false;
  end if;
  if v_deletion.preview_path is not null then
    v_preview_observed_at:=(p_preview_evidence->>'observed_at')::timestamptz;
    if v_preview_observed_at<v_deletion.not_before
       or v_preview_observed_at>v_checked_at+interval '5 minutes' then
      return false;
    end if;
  end if;
  update media_object_deletions
     set state='deleted',object_deleted_at=v_checked_at,preview_deleted_at=case
           when v_deletion.preview_path is null then null else v_checked_at end,
         object_evidence=p_object_evidence,preview_evidence=p_preview_evidence,lease_expires_at=null,
         updated_at=now()
   where id=v_deletion.id;
  -- Make the evidence -> ledger transition explicit. A deletion row is
  -- normally upload-specific, but the schema permits more than one dependent
  -- upload, so release each dependency through an explicit procedural call.
  for v_upload_id in
    select r.upload_id from media_upload_cleanup_requirements r
     where r.deletion_id=v_deletion.id
  loop
    perform release_media_upload_reservation_if_clean(v_upload_id);
  end loop;
  return true;
end $$;
revoke all on function record_media_object_deletion(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function record_media_object_deletion(uuid,jsonb,jsonb) to service_role;

create or replace function set_media_kind_control(
  p_kind mark_type,
  p_reservation_enabled boolean,
  p_upload_transition_enabled boolean,
  p_processing_enabled boolean,
  p_creation_enabled boolean,
  p_reason text
) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_old media_kind_controls%rowtype; v_actor uuid:=auth.uid();
begin
  if current_user not in ('postgres','service_role') then raise exception 'unavailable' using errcode='42501'; end if;
  if p_kind not in ('photo'::mark_type,'voice'::mark_type,'video'::mark_type) or nullif(trim(p_reason),'') is null then
    raise exception 'invalid' using errcode='22023';
  end if;
  if p_creation_enabled and not exists(select 1 from media_legacy_reconciliation where singleton and state='complete') then
    raise exception 'legacy_reconciliation_incomplete' using errcode='55000';
  end if;
  select * into strict v_old from media_kind_controls where kind=p_kind for update;
  update media_kind_controls set reservation_enabled=p_reservation_enabled,
    upload_transition_enabled=p_upload_transition_enabled,processing_enabled=p_processing_enabled,
    creation_enabled=p_creation_enabled,updated_at=now(),updated_by=v_actor,reason=trim(p_reason)
   where kind=p_kind;
  insert into media_kind_control_audit(kind,old_value,new_value,changed_by,reason)
  values(p_kind,to_jsonb(v_old),
    jsonb_build_object('reservation_enabled',p_reservation_enabled,'upload_transition_enabled',p_upload_transition_enabled,
      'processing_enabled',p_processing_enabled,'creation_enabled',p_creation_enabled),v_actor,trim(p_reason));
end $$;
revoke all on function set_media_kind_control(mark_type,boolean,boolean,boolean,boolean,text) from public,anon,authenticated;
grant execute on function set_media_kind_control(mark_type,boolean,boolean,boolean,boolean,text) to service_role;

-- ── Auth-bound reservation and Storage authorization ────────────────────────
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
     or nullif(trim(p_declared_mime),'') is null or p_declared_bytes is null or p_declared_bytes <= 0 then
    return jsonb_build_object('status','invalid');
  end if;
  if not ((p_kind='photo'::mark_type and lower(trim(p_declared_mime)) in ('image/jpeg','image/png','image/webp','image/heic'))
       or (p_kind='voice'::mark_type and lower(trim(p_declared_mime)) in ('audio/m4a','audio/mp4','audio/mpeg','audio/wav'))
       or (p_kind='video'::mark_type and lower(trim(p_declared_mime)) in ('video/mp4','video/quicktime'))) then
    return jsonb_build_object('status','invalid');
  end if;
  -- Control-row SHARE is the action linearization point. A disable either wins
  -- first (this call rejects) or waits until this transaction commits.
  perform 1 from media_kind_controls where kind=p_kind for share;
  if not exists(select 1 from media_kind_controls where kind=p_kind and reservation_enabled) then
    return jsonb_build_object('status','unavailable');
  end if;
  if not public.can_contribute(p_wall_id,v_actor) then return jsonb_build_object('status','unavailable'); end if;
  v_limit:=media_kind_limit(p_kind);
  if p_declared_bytes > v_limit then return jsonb_build_object('status','invalid'); end if;

  -- Lock ordering is actor-wide first, then the current UTC-day ledger. The
  -- actor lock covers the cross-day active and rolling-hour queries below;
  -- without it two concurrent reservations could both observe stale headroom.
  perform lock_media_actor(v_actor);
  perform lock_media_quota(v_actor,v_day);
  select * into v_existing from media_uploads
   where uploader_tombstone_id=v_actor and client_upload_id=p_client_upload_id for update;
  if found then
    if v_existing.wall_tombstone_id<>p_wall_id or v_existing.kind<>p_kind
       or v_existing.declared_mime<>lower(trim(p_declared_mime)) or v_existing.declared_bytes<>p_declared_bytes then
      return jsonb_build_object('status','invalid');
    end if;
    if v_existing.state='initiated' and v_existing.expires_at>now() then
      return jsonb_build_object('status','ready','upload_id',v_existing.id,'bucket','mark-media',
        'path',v_existing.source_path,'expires_at',v_existing.expires_at);
    end if;
    return jsonb_build_object('status','unavailable');
  end if;

  select count(*) filter(where state in ('initiated','uploaded','processing','validated')),
         count(*) filter(where created_at>now()-interval '1 hour'),
         count(*) filter(where created_at>=date_trunc('day',now() at time zone 'utc') at time zone 'utc')
    into v_active,v_hour,v_day_count from media_uploads where uploader_tombstone_id=v_actor;
  if v_active>=10 or v_hour>=20 or v_day_count>=100 then return jsonb_build_object('status','rate_limited'); end if;

  insert into media_quota_daily(user_tombstone_id,quota_day) values(v_actor,v_day)
    on conflict do nothing;
  select * into strict v_quota from media_quota_daily where user_tombstone_id=v_actor and quota_day=v_day for update;
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

create or replace function current_user_can_upload_mark_media_path(p_path text)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog,public,storage as $$
declare v_kind mark_type;
begin
  if auth.uid() is null then return false; end if;
  select u.kind into v_kind from public.media_uploads u
   where u.source_path=p_path and u.uploader_id=auth.uid();
  if v_kind is null then return false; end if;
  perform 1 from public.media_kind_controls where kind=v_kind for share;
  return exists(
    select 1 from public.media_uploads u join public.media_kind_controls c on c.kind=u.kind
     where u.source_path=p_path and u.uploader_id=auth.uid() and u.state='initiated'
       and u.session_state='open' and u.expires_at>now() and c.upload_transition_enabled
       and public.is_active_account(auth.uid()) and public.can_contribute(u.wall_id,auth.uid())
  );
end;
$$;
revoke all on function current_user_can_upload_mark_media_path(text) from public,anon;
grant execute on function current_user_can_upload_mark_media_path(text) to authenticated;

drop policy if exists "mark-media staging insert" on storage.objects;
create policy "mark-media staging insert" on storage.objects for insert to authenticated
  with check (
    bucket_id='mark-media'
    -- The path helper binds this object to one live reservation. Bind the
    -- Storage owner as well: the transition rejects null/service ownership,
    -- but accepting it here would leave an avoidable substitution/DoS path.
    and owner_id=auth.uid()::text
    and public.current_user_can_upload_mark_media_path(name)
  );

create or replace function mark_media_uploaded(p_upload_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare v_actor uuid:=auth.uid(); v_up media_uploads%rowtype; v_owner text; v_size bigint; v_kind mark_type;
begin
  if v_actor is null then return jsonb_build_object('status','unavailable'); end if;
  select kind into v_kind from media_uploads where id=p_upload_id and uploader_id=v_actor;
  if v_kind is null then return jsonb_build_object('status','unavailable'); end if;
  perform 1 from media_kind_controls where kind=v_kind for share;
  -- Keep the actor → upload-row → day-ledger order shared by reservation and
  -- cleanup paths. Taking the upload row first can deadlock against an expiry
  -- worker that is releasing the same reservation.
  perform lock_media_actor(v_actor);
  select * into v_up from media_uploads where id=p_upload_id and uploader_id=v_actor for update;
  if not found then return jsonb_build_object('status','unavailable'); end if;
  if v_up.state in ('uploaded','processing','validated') then return jsonb_build_object('status',v_up.state); end if;
  if v_up.state<>'initiated' or v_up.expires_at<=now() or not public.can_contribute(v_up.wall_id,v_actor)
     or not exists(select 1 from media_kind_controls where kind=v_up.kind and upload_transition_enabled) then
    return jsonb_build_object('status','unavailable');
  end if;
  select o.owner_id, coalesce(nullif(o.metadata->>'size','')::bigint,0)
    into v_owner,v_size from storage.objects o
   where o.bucket_id='mark-media' and o.name=v_up.source_path;
  if not found or v_owner is null or v_owner<>v_actor::text or v_size<=0 then
    return jsonb_build_object('status','unavailable');
  end if;
  perform lock_media_quota(v_actor,v_up.quota_day);
  update media_quota_daily set ingested_bytes=ingested_bytes+v_size,updated_at=now()
   where user_tombstone_id=v_actor and quota_day=v_up.quota_day;
  if v_size>media_kind_limit(v_up.kind)
     or (select ingested_bytes from media_quota_daily where user_tombstone_id=v_actor and quota_day=v_up.quota_day)>524288000 then
    -- The source exists and is therefore a reservation cleanup requirement.
    -- Keep all ledger charges until the deletion worker records exact evidence.
    perform enqueue_media_upload_full_cleanup(v_up,'input_too_large',true);
    update media_uploads set state='failed',session_state='closed',actual_input_bytes=v_size,
      error_code='TOO_LARGE',updated_at=now() where id=v_up.id;
    return jsonb_build_object('status','failed','error_code','TOO_LARGE');
  end if;
  update media_uploads set state='uploaded',session_state='closed',actual_input_bytes=v_size,
    quota_session_released_at=now(),updated_at=now()
   where id=v_up.id;
  update media_quota_daily set open_sessions=greatest(open_sessions-1,0),updated_at=now()
   where user_tombstone_id=v_actor and quota_day=v_up.quota_day;
  return jsonb_build_object('status','uploaded');
end $$;
revoke all on function mark_media_uploaded(uuid) from public,anon;
grant execute on function mark_media_uploaded(uuid) to authenticated;

create or replace function get_media_upload_status(p_upload_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or p_upload_ids is null or cardinality(p_upload_ids)>5 then
    return jsonb_build_object('status','unavailable');
  end if;
  return coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('upload_id',u.id,'state',u.state,
      'error_code',case when u.state='failed' then u.error_code end)) order by x.ord)
    from unnest(p_upload_ids) with ordinality x(id,ord)
    join media_uploads u on u.id=x.id and u.uploader_id=v_actor),'[]'::jsonb);
end $$;
revoke all on function get_media_upload_status(uuid[]) from public,anon;
grant execute on function get_media_upload_status(uuid[]) to authenticated;

-- ── Worker lifecycle (service-only) ─────────────────────────────────────────
create or replace function claim_media_validation_jobs(p_limit integer,p_worker_execution_id uuid)
returns setof media_uploads language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if current_user not in ('postgres','service_role') or p_limit not between 1 and 5 or p_worker_execution_id is null then
    raise exception 'unavailable' using errcode='42501';
  end if;
  perform 1 from media_kind_controls where processing_enabled order by kind for share;
  -- Each claim gets one attempt identity. The path base embeds that same
  -- identity; C2 may sign only the kind-specific exact suffixes beneath it.
  return query with candidates as (
    select u.id, gen_random_uuid() as next_attempt_id
      from media_uploads u join media_kind_controls c on c.kind=u.kind
     where c.processing_enabled and
       (u.state='uploaded' or (u.state='processing' and u.lease_expires_at<=now()))
       and u.expires_at>now() and u.attempt_count<5
       and u.uploader_id is not null and u.wall_id is not null
     order by u.created_at for update of u skip locked limit p_limit
  )
  update media_uploads u set state='processing',attempt_id=c.next_attempt_id,
    attempt_count=u.attempt_count+1,lease_expires_at=now()+interval '5 minutes',
    validated_path='validated/'||u.id::text||'/'||c.next_attempt_id::text||'/full',
    -- C2 generates random one-use nonces outside Postgres, hashes them, then
    -- binds both hashes through the service-only function below before issuing
    -- the worker envelope. Do not generate opaque hashes here: no caller would
    -- know the matching raw nonce to redeem.
    dispatch_nonce_hash=null,completion_nonce_hash=null,envelope_kid=null,
    dispatch_redeemed_at=null,completion_redeemed_at=null,updated_at=now()
  from candidates c where u.id=c.id returning u.*;
end $$;
revoke all on function claim_media_validation_jobs(integer,uuid) from public,anon,authenticated;
grant execute on function claim_media_validation_jobs(integer,uuid) to service_role;

-- Edge owns raw nonce generation and the signed envelope. Postgres persists
-- only SHA-256 digests, binds them to the current attempt, and atomically marks
-- each bearer nonce spent. This keeps replay protection in the same durable
-- state machine as the lease while keeping raw secrets out of the database.
create or replace function bind_media_validation_attempt_nonces(
  p_upload_id uuid,p_attempt_id uuid,p_dispatch_nonce_hash text,
  p_completion_nonce_hash text,p_kid text
) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_up media_uploads%rowtype; v_kind mark_type;
begin
  if current_user not in ('postgres','service_role') then raise exception 'unavailable' using errcode='42501'; end if;
  if p_dispatch_nonce_hash !~ '^[0-9a-f]{64}$' or p_completion_nonce_hash !~ '^[0-9a-f]{64}$'
     or p_dispatch_nonce_hash=p_completion_nonce_hash or nullif(trim(p_kid),'') is null
     or char_length(p_kid)>128 then return false; end if;
  select kind into v_kind from media_uploads where id=p_upload_id;
  if v_kind is null then return false; end if;
  perform 1 from media_kind_controls where kind=v_kind for share;
  select * into v_up from media_uploads where id=p_upload_id for update;
  if not found or v_up.state<>'processing' or v_up.attempt_id<>p_attempt_id
     or v_up.uploader_id is null or v_up.wall_id is null
     or v_up.lease_expires_at<=now() or v_up.dispatch_nonce_hash is not null
     or v_up.completion_nonce_hash is not null or not exists(
       select 1 from media_kind_controls where kind=v_up.kind and processing_enabled
     ) then return false; end if;
  update media_uploads set dispatch_nonce_hash=p_dispatch_nonce_hash,
    completion_nonce_hash=p_completion_nonce_hash,envelope_kid=trim(p_kid),updated_at=now()
   where id=p_upload_id;
  return true;
end $$;
revoke all on function bind_media_validation_attempt_nonces(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function bind_media_validation_attempt_nonces(uuid,uuid,text,text,text) to service_role;

create or replace function redeem_media_validation_dispatch_nonce(
  p_upload_id uuid,p_attempt_id uuid,p_nonce text,p_kid text
) returns boolean language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare v_up media_uploads%rowtype; v_kind mark_type;
begin
  if current_user not in ('postgres','service_role') then raise exception 'unavailable' using errcode='42501'; end if;
  if nullif(p_nonce,'') is null or char_length(p_nonce)>512 or nullif(trim(p_kid),'') is null then return false; end if;
  select kind into v_kind from media_uploads where id=p_upload_id;
  if v_kind is null then return false; end if;
  perform 1 from media_kind_controls where kind=v_kind for share;
  select * into v_up from media_uploads where id=p_upload_id for update;
  if not found or v_up.state<>'processing' or v_up.attempt_id<>p_attempt_id
     or v_up.uploader_id is null or v_up.wall_id is null
     or v_up.lease_expires_at<=now() or v_up.dispatch_redeemed_at is not null
     or v_up.envelope_kid is distinct from trim(p_kid)
     or not exists(select 1 from media_kind_controls where kind=v_up.kind and processing_enabled)
     or v_up.dispatch_nonce_hash is distinct from encode(extensions.digest(p_nonce,'sha256'),'hex') then return false; end if;
  update media_uploads set dispatch_redeemed_at=now(),updated_at=now() where id=p_upload_id;
  return true;
end $$;
revoke all on function redeem_media_validation_dispatch_nonce(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function redeem_media_validation_dispatch_nonce(uuid,uuid,text,text) to service_role;

create or replace function redeem_media_validation_completion_nonce(
  p_upload_id uuid,p_attempt_id uuid,p_nonce text,p_kid text
) returns boolean language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare v_up media_uploads%rowtype; v_kind mark_type;
begin
  if current_user not in ('postgres','service_role') then raise exception 'unavailable' using errcode='42501'; end if;
  if nullif(p_nonce,'') is null or char_length(p_nonce)>512 or nullif(trim(p_kid),'') is null then return false; end if;
  select kind into v_kind from media_uploads where id=p_upload_id;
  if v_kind is null then return false; end if;
  perform 1 from media_kind_controls where kind=v_kind for share;
  select * into v_up from media_uploads where id=p_upload_id for update;
  if not found or v_up.state<>'processing' or v_up.attempt_id<>p_attempt_id
     or v_up.uploader_id is null or v_up.wall_id is null
     or v_up.lease_expires_at<=now() or v_up.dispatch_redeemed_at is null
     or v_up.completion_redeemed_at is not null or v_up.envelope_kid is distinct from trim(p_kid)
     or not exists(select 1 from media_kind_controls where kind=v_up.kind and processing_enabled)
     or v_up.completion_nonce_hash is distinct from encode(extensions.digest(p_nonce,'sha256'),'hex') then return false; end if;
  update media_uploads set completion_redeemed_at=now(),updated_at=now() where id=p_upload_id;
  return true;
end $$;
revoke all on function redeem_media_validation_completion_nonce(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function redeem_media_validation_completion_nonce(uuid,uuid,text,text) to service_role;

create or replace function complete_media_validation(
  p_upload_id uuid,p_attempt_id uuid,p_detected_mime text,p_validated_bytes bigint,p_sha256 text,
  p_width integer,p_height integer,p_duration_ms integer,p_validated_path text,p_preview_path text,p_cache_control_seconds integer
) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_up media_uploads%rowtype;
  v_kind mark_type;
  v_expected_validated_path text;
  v_expected_preview_path text;
begin
  if current_user not in ('postgres','service_role') then raise exception 'unavailable' using errcode='42501'; end if;
  select kind into v_kind from media_uploads where id=p_upload_id;
  if v_kind is null then return false; end if;
  perform 1 from media_kind_controls where kind=v_kind for share;
  select * into v_up from media_uploads where id=p_upload_id for update;
  if not found or v_up.state<>'processing' or v_up.attempt_id<>p_attempt_id or v_up.lease_expires_at<=now()
     or v_up.uploader_id is null or v_up.wall_id is null
     or v_up.dispatch_redeemed_at is null or v_up.completion_redeemed_at is null
     or not exists(select 1 from media_kind_controls where kind=v_up.kind and processing_enabled) then return false; end if;

  if v_up.kind='photo'::mark_type then
    if p_detected_mime='image/jpeg' then
      v_expected_validated_path := v_up.validated_path||'.jpg';
    else
      v_expected_validated_path := v_up.validated_path||'.webp';
    end if;
    if p_preview_path is not null then
      v_expected_preview_path := 'validated/'||v_up.id::text||'/'||v_up.attempt_id::text||'/thumb.webp';
    end if;
  elsif v_up.kind='voice'::mark_type then
    v_expected_validated_path := v_up.validated_path||'.m4a';
  elsif v_up.kind='video'::mark_type then
    v_expected_validated_path := v_up.validated_path||'.mp4';
    if p_preview_path is not null then
      v_expected_preview_path := 'validated/'||v_up.id::text||'/'||v_up.attempt_id::text||'/poster.webp';
    end if;
  end if;

  if p_validated_path <> v_expected_validated_path
     or p_preview_path is distinct from v_expected_preview_path
     or p_validated_bytes<=0
     or p_sha256 !~ '^[0-9a-f]{64}$' or p_cache_control_seconds not between 0 and 60 then return false; end if;
  if (v_up.kind='photo' and (p_detected_mime not in ('image/jpeg','image/webp') or p_validated_bytes>10485760
       or p_duration_ms is not null or p_width is null or p_height is null))
     or (v_up.kind='voice' and (p_detected_mime<>'audio/mp4' or p_validated_bytes>10485760
       or p_width is not null or p_height is not null or p_duration_ms not between 1 and 60000))
     or (v_up.kind='video' and (p_detected_mime<>'video/mp4' or p_validated_bytes>52428800
       or p_width is null or p_height is null or p_duration_ms not between 1 and 30000))
     or p_width>8192 or p_height>8192
     or (p_width is not null and p_height is not null and p_width::bigint*p_height::bigint>25000000)
     then return false; end if;
  update media_uploads set state='validated',detected_mime=p_detected_mime,validated_bytes=p_validated_bytes,
    sha256=p_sha256,width=p_width,height=p_height,duration_ms=p_duration_ms,validated_path=p_validated_path,
    preview_path=p_preview_path,cache_control_seconds=p_cache_control_seconds,validated_at=now(),
    expires_at=now()+interval '24 hours',lease_expires_at=null,updated_at=now() where id=p_upload_id;
  insert into media_object_deletions(idempotency_key,bucket_id,object_path,reason)
    values('validated-upload:'||v_up.id::text||':source','mark-media',v_up.source_path,'source_validated')
    on conflict do nothing;
  -- A photo attempt offers two exact canonical suffixes so the trusted decoder
  -- can preserve alpha. Delete the unused candidate without wildcarding.
  if v_up.kind='photo'::mark_type then
    insert into media_object_deletions(idempotency_key,bucket_id,object_path,reason)
      values('validated-upload:'||v_up.id::text||':unused','mark-media',
        v_up.validated_path||case p_detected_mime when 'image/jpeg' then '.webp' else '.jpg' end,
        'unused_canonical_candidate') on conflict do nothing;
  end if;
  return true;
end $$;
revoke all on function complete_media_validation(uuid,uuid,text,bigint,text,integer,integer,integer,text,text,integer) from public,anon,authenticated;
grant execute on function complete_media_validation(uuid,uuid,text,bigint,text,integer,integer,integer,text,text,integer) to service_role;

create or replace function fail_media_validation(p_upload_id uuid,p_attempt_id uuid,p_error_code text)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_up media_uploads%rowtype; v_terminal boolean; v_kind mark_type;
begin
  if current_user not in ('postgres','service_role') then raise exception 'unavailable' using errcode='42501'; end if;
  select kind into v_kind from media_uploads where id=p_upload_id;
  if v_kind is null then return false; end if;
  perform 1 from media_kind_controls where kind=v_kind for share;
  select * into v_up from media_uploads where id=p_upload_id for update;
  if not found or v_up.state<>'processing' or v_up.attempt_id<>p_attempt_id
     or v_up.uploader_id is null or v_up.wall_id is null
     or v_up.lease_expires_at<=now() then return false; end if;
  v_terminal:=v_up.attempt_count>=5 or v_up.expires_at<=now();
  update media_uploads set state=case when v_terminal then 'failed' else 'uploaded' end,
    error_code=case when v_terminal then left(coalesce(p_error_code,'PROCESSING_FAILED'),64) else null end,
    lease_expires_at=null,updated_at=now() where id=p_upload_id;
  if v_terminal then
    -- The processor may have emitted only a canonical object, only a preview,
    -- or both before failing. Queue the current attempt's complete exact
    -- candidate set plus source; deletion is safely idempotent for absent paths.
    perform enqueue_media_upload_full_cleanup(v_up,'validation_failed',true);
  end if;
  return true;
end $$;
revoke all on function fail_media_validation(uuid,uuid,text) from public,anon,authenticated;
grant execute on function fail_media_validation(uuid,uuid,text) to service_role;

-- ── Canonical atomic creation ────────────────────────────────────────────────
create or replace function guard_mark_media_integrity()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_type mark_type; v_count integer; v_up media_uploads%rowtype;
begin
  select type into v_type from marks where id=new.mark_id;
  if v_type is null or v_type<>new.media_type then raise exception 'invalid' using errcode='23514'; end if;
  if new.media_type in ('voice'::mark_type,'video'::mark_type) and new."position"<>0 then
    raise exception 'invalid' using errcode='23514';
  end if;
  select count(*) into v_count from mark_media where mark_id=new.mark_id;
  if (new.media_type='photo' and v_count>=5) or (new.media_type in ('voice'::mark_type,'video'::mark_type) and v_count>=1) then
    raise exception 'invalid' using errcode='23514';
  end if;
  select * into v_up from media_uploads where id=new.upload_id for share;
  if not found or v_up.state<>'validated' or v_up.kind<>new.media_type
     or new.storage_path<>v_up.validated_path or new.preview_path is distinct from v_up.preview_path
     or new.mime_type<>v_up.detected_mime or new.byte_size<>v_up.validated_bytes
     or new.sha256<>v_up.sha256 or new.width is distinct from v_up.width
     or new.height is distinct from v_up.height or new.duration_ms is distinct from v_up.duration_ms then
    raise exception 'invalid' using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists mark_media_integrity on mark_media;
create trigger mark_media_integrity before insert on mark_media for each row execute function guard_mark_media_integrity();

create or replace function reject_mark_media_update()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  raise exception 'MARK_MEDIA_IMMUTABLE' using errcode='42501';
end $$;
drop trigger if exists mark_media_immutable on mark_media;
create trigger mark_media_immutable before update on mark_media
  for each row execute function reject_mark_media_update();

create or replace function mark_creation_deleted_tombstone()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  update mark_creation_requests set state='deleted',mark_id=null,result_mark_id=old.id,
    deleted_at=now() where mark_id=old.id;
  return old;
end $$;
drop trigger if exists a0_mark_creation_deleted_tombstone on marks;
create trigger a0_mark_creation_deleted_tombstone before delete on marks
  for each row execute function mark_creation_deleted_tombstone();

create or replace function create_mark(
  p_request_id uuid,p_wall_id uuid,p_type mark_type,p_text text,p_color text,p_anonymous boolean,
  p_secret boolean,p_rotation real,p_upload_ids uuid[]
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare
  v_actor uuid:=auth.uid(); v_text text:=nullif(trim(p_text),''); v_color text:=nullif(trim(p_color),'');
  v_uploads uuid[]:=coalesce(p_upload_ids,'{}'::uuid[]); v_hash text; v_req mark_creation_requests%rowtype;
  v_mark_id uuid:=gen_random_uuid(); v_status mark_status; v_expected integer; v_count integer; v_up media_uploads%rowtype;
  v_pos integer:=0; v_uid uuid; v_new_request boolean:=false;
begin
  if v_actor is null or p_request_id is null or p_wall_id is null or p_type is null
     or not public.is_active_account(v_actor) then return jsonb_build_object('status','unavailable'); end if;
  if p_type not in ('text'::mark_type,'photo'::mark_type,'voice'::mark_type,'video'::mark_type)
     or p_anonymous is null or p_secret is null then return jsonb_build_object('status','invalid'); end if;
  v_color:=case when p_type='text' and lower(v_color) in ('#ffe14d','#ffb3c1','#c6f26b','#a9d8ff') then lower(v_color)
                when v_color is null then null else '__invalid__' end;
  if v_color='__invalid__' or (v_text is not null and char_length(v_text)>500)
     or (p_type='text' and v_text is null) or (p_type<>'text' and p_secret)
     or (p_type<>'text' and v_text is not null) or cardinality(v_uploads)>5
     or cardinality(v_uploads)<>(select count(distinct x) from unnest(v_uploads) x) then
    return jsonb_build_object('status','invalid');
  end if;
  v_expected:=case when p_type='text' then 0 when p_type='photo' then cardinality(v_uploads) else 1 end;
  if (p_type='photo' and v_expected not between 1 and 5) or (p_type in ('voice','video') and cardinality(v_uploads)<>1)
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

  -- Lock uploads in a deterministic order. A FOR query naturally performs zero
  -- iterations for the normalized empty array used by text Marks; array_agg()
  -- would turn that empty set back into NULL and make FOREACH raise.
  for v_uid in select x.id from unnest(v_uploads) as x(id) order by x.id loop
    perform 1 from media_uploads where id=v_uid for update;
  end loop;
  select count(*) into v_count from media_uploads u where u.id=any(v_uploads)
    and u.uploader_id=v_actor and u.wall_id=p_wall_id and u.kind=p_type and u.state='validated'
    and u.expires_at>now() and u.consumed_mark_id is null and u.validated_path is not null;
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

-- ── Service-only read resolver and exact deletion evidence ──────────────────
create or replace function resolve_mark_media_for_signing(p_actor_id uuid,p_mark_id uuid,p_request_id uuid)
returns table("position" smallint,media_type mark_type,storage_path text,preview_path text,mime_type text,
  byte_size bigint,width integer,height integer,duration_ms integer,sha256 text)
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_mark marks%rowtype; v_wall walls%rowtype; v_owner uuid; v_author uuid;
  v_rate media_signing_rate_limits%rowtype;
  v_elapsed numeric; v_tokens numeric;
begin
  if current_user not in ('postgres','service_role') or p_actor_id is null or p_request_id is null then
    raise exception 'unavailable' using errcode='42501';
  end if;
  select * into v_mark from marks where id=p_mark_id for share;
  if not found or v_mark.secret then return; end if;
  select * into v_wall from walls where id=v_mark.wall_id for share;
  if not found then return; end if;
  v_owner:=v_wall.owner_id;
  v_author:=v_mark.author_id;
  if v_author is null then
    select ama.author_id into v_author from anonymous_mark_authors ama where ama.mark_id=v_mark.id;
  end if;
  perform public.lock_user_pair(p_actor_id,v_owner);
  if v_author is not null then perform public.lock_user_pair(p_actor_id,v_author); end if;
  -- Lock the existing authorization rows that can revoke this read. Inserts
  -- occurring after this linearization point take effect on the next sign.
  perform 1 from wall_members wm where wm.wall_id=v_wall.id and wm.user_id=p_actor_id for share;
  perform 1 from friendships f
    where (f.requester_id=v_owner and f.addressee_id=p_actor_id)
       or (f.requester_id=p_actor_id and f.addressee_id=v_owner)
    for share;
  if not public.is_active_account(p_actor_id) or not public.can_view_wall(v_mark.wall_id,p_actor_id)
     or not (v_mark.status='active' or public.is_mark_true_author(v_mark.id,p_actor_id) or v_owner=p_actor_id) then return; end if;

  insert into media_signing_rate_limits(actor_id) values(p_actor_id) on conflict do nothing;
  select * into strict v_rate from media_signing_rate_limits where actor_id=p_actor_id for update;
  v_elapsed:=greatest(0,extract(epoch from now()-v_rate.refilled_at));
  v_tokens:=least(20::numeric,v_rate.tokens+v_elapsed*2); -- 120/minute, burst 20
  if v_tokens<1 then return; end if;
  update media_signing_rate_limits set tokens=v_tokens-1,refilled_at=now() where actor_id=p_actor_id;
  return query select mm."position",mm.media_type,mm.storage_path,mm.preview_path,mm.mime_type,
    mm.byte_size,mm.width,mm.height,mm.duration_ms,mm.sha256 from mark_media mm
   join media_uploads u on u.id=mm.upload_id
   where mm.mark_id=p_mark_id and u.state='consumed' and u.cache_control_seconds<=60
     and u.validated_path=mm.storage_path
   order by mm."position" limit 5;
end $$;
revoke all on function resolve_mark_media_for_signing(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function resolve_mark_media_for_signing(uuid,uuid,uuid) to service_role;

create or replace function enqueue_mark_media_deletion()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  insert into media_object_deletions(idempotency_key,bucket_id,object_path,preview_path,reason)
  values('mark-media:'||old.id::text,'mark-media',old.storage_path,old.preview_path,'mark_deleted')
  on conflict(idempotency_key) do nothing;
  return old;
end $$;
drop trigger if exists a0_mark_media_deletion_outbox on mark_media;
create trigger a0_mark_media_deletion_outbox before delete on mark_media
  for each row execute function enqueue_mark_media_deletion();

-- FK `ON DELETE SET NULL` actions for account/Wall removal retain the workflow
-- row, but they must not defer cleanup of an unconsumed private draft until a
-- later expiry sweep. This trigger runs in that same FK-action transaction and
-- writes the exact locators to the durable outbox before either live reference
-- disappears. Consumed media remains with its Mark retention policy; its
-- `mark_media` delete trigger is the authoritative cleanup path.
create or replace function enqueue_unconsumed_media_subject_cleanup()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_fence timestamptz;
begin
  if old.consumed_mark_id is null
     and ((old.uploader_id is not null and new.uploader_id is null)
       or (old.wall_id is not null and new.wall_id is null)) then
    perform enqueue_media_upload_full_cleanup(old,'subject_deleted',true);
    -- If dispatch already linearized, its signed output destination can remain
    -- usable through the old lease and the maximum two-minute envelope lifetime.
    -- Invalidate now and reject cleanup evidence observed before that fence.
    v_fence:=case when old.state='processing' and old.lease_expires_at is not null
      then greatest(clock_timestamp(),old.lease_expires_at)+interval '2 minutes'
      else clock_timestamp() end;
    update media_object_deletions d
       set not_before=greatest(d.not_before,v_fence),updated_at=now()
      from media_upload_cleanup_requirements r
     where r.upload_id=old.id and r.deletion_id=d.id;
    new.state:='expired';
    new.session_state:='expired';
    new.error_code:='SUBJECT_DELETED';
    new.lease_expires_at:=null;
    new.attempt_id:=null;
    new.dispatch_nonce_hash:=null;
    new.completion_nonce_hash:=null;
    new.dispatch_redeemed_at:=null;
    new.completion_redeemed_at:=null;
    new.envelope_kid:=null;
    new.updated_at:=now();
  end if;
  return new;
end $$;
drop trigger if exists a0_media_upload_subject_cleanup on media_uploads;
create trigger a0_media_upload_subject_cleanup
  before update of uploader_id, wall_id on media_uploads
  for each row execute function enqueue_unconsumed_media_subject_cleanup();

create or replace function expire_media_uploads()
returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_count integer:=0; v_up media_uploads%rowtype; v_actor uuid; v_fence timestamptz;
begin
  if current_user not in ('postgres','service_role') then raise exception 'unavailable' using errcode='42501'; end if;
  -- Iterate per tombstone actor so cleanup takes the same actor → row → day
  -- lock order as begin/transition/release. A later reservation simply waits
  -- and observes this terminal state; a newly expired row waits for next run.
  for v_actor in
    select distinct uploader_tombstone_id from media_uploads
     where state in ('initiated','uploaded','processing','validated')
       and (expires_at<=now() or uploader_id is null or wall_id is null)
     order by uploader_tombstone_id
  loop
    perform lock_media_actor(v_actor);
    for v_up in
      select * from media_uploads
       where uploader_tombstone_id=v_actor
         and state in ('initiated','uploaded','processing','validated')
         and (expires_at<=now() or uploader_id is null or wall_id is null)
       order by id for update skip locked
    loop
      -- Do not release any ledger charge here. The reservation is terminal, but
      -- its private paths still exist until C2 records exact deletion/missing
      -- evidence in the durable outbox.
      perform enqueue_media_upload_full_cleanup(v_up,'upload_expired',true);
      -- A processing upload may already have redeemed a signed destination
      -- envelope. Terminalize the attempt and fence every exact cleanup row
      -- until its old lease plus the maximum two-minute envelope lifetime.
      v_fence:=case when v_up.state='processing' and v_up.lease_expires_at is not null
        then greatest(clock_timestamp(),v_up.lease_expires_at)+interval '2 minutes'
        else clock_timestamp() end;
      update media_object_deletions d
         set not_before=greatest(d.not_before,v_fence),updated_at=clock_timestamp()
        from media_upload_cleanup_requirements r
       where r.upload_id=v_up.id and r.deletion_id=d.id;
      update media_uploads set state='expired',session_state='expired',lease_expires_at=null,
        attempt_id=null,dispatch_nonce_hash=null,completion_nonce_hash=null,
        dispatch_redeemed_at=null,completion_redeemed_at=null,envelope_kid=null,
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

-- Revoke default function execution, then restore only named app contracts.
revoke all on all functions in schema public from public,anon;
grant execute on function begin_media_upload(uuid,mark_type,uuid,text,bigint),
  current_user_can_upload_mark_media_path(text),mark_media_uploaded(uuid),
  get_media_upload_status(uuid[]),create_mark(uuid,uuid,mark_type,text,text,boolean,boolean,real,uuid[])
  to authenticated;
