-- ════════════════════════════════════════════════════════════════════════════
-- 0010 · Secret Marks — one-time atomic reveal + 1-hour expiry (FP-SEC-002 / ADR-010)
--
-- 0004/ADR-008 moved secret CONTENT off the base row into the RLS-gated side
-- table `mark_secrets` (never on `marks`, never published to realtime, owner-read).
-- That delivers content ISOLATION but not the two remaining Master Spec promises:
--   • §27.3 one-time reveal — the server atomically records the opened state and a
--     SECOND reveal must fail; do NOT rely on a client-only flag.
--   • §27.4 / §68 one-hour lifetime — a secret expires 1h after creation; after
--     expiry the payload is unavailable and the shell is cleaned up.
--
-- This migration adds `expires_at` + `opened_at`, makes reveal a gated atomic RPC
-- (`reveal_secret`), REVOKES the direct client SELECT on `mark_secrets` (a retained
-- direct read would defeat one-time reveal), and provides an `expire_secret_marks()`
-- cleanup function for a scheduled job.
--
-- Additive + idempotent (add-column-if-not-exists / create-or-replace / drop-if-
-- exists). Does NOT modify 0001–0009. Build on top only.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Lifecycle columns on the side table ──────────────────────────────────────
-- expires_at: default now()+1h at insert (the extract-secret trigger inserts with
-- no explicit value, so every secret gets a 1-hour window). opened_at: NULL until
-- the one-time reveal consumes it; non-NULL forever after (records WHEN, for audit).
alter table mark_secrets add column if not exists expires_at timestamptz not null default now() + interval '1 hour';
alter table mark_secrets add column if not exists opened_at  timestamptz;

-- ── Reads become RPC-only for end users ──────────────────────────────────────
-- One-time reveal is only real if the content cannot be re-read out of band. So
-- the client loses ALL direct privilege on the side table; the only read path is
-- the consuming SECURITY DEFINER RPC below. The 0004 owner SELECT policy is now
-- moot (no SELECT grant) — drop it for clarity. service_role keeps its EXPLICIT
-- grant (0004) for the moderation read path; BYPASSRLS is not a table grant.
drop policy if exists "mark_secrets read owner" on mark_secrets;
revoke select on mark_secrets from authenticated;
-- (service_role SELECT grant from 0004 is intentionally retained.)

-- ── Atomic one-time reveal ───────────────────────────────────────────────────
-- Returns jsonb so the client can show distinct §111 states without ever
-- receiving content it isn't entitled to:
--   { ok:true,  reason:'ok',            content:<text> }   -- the single winning reveal
--   { ok:false, reason:'not_authorized' }                  -- caller is not the recipient
--   { ok:false, reason:'consumed' }                        -- already opened once
--   { ok:false, reason:'expired' }                         -- past the 1-hour window
--   { ok:false, reason:'missing' }                         -- no such secret row
--
-- SECURITY DEFINER because the caller has NO table privilege on mark_secrets; the
-- function runs as the table owner. It authorizes the caller as the wall owner
-- (recipient) FIRST — via auth.uid(), which is request/session scoped and
-- unaffected by DEFINER — then performs the consume. `set search_path = public`
-- pins name resolution (defense against search_path games on a DEFINER function).
create or replace function reveal_secret(p_mark_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content text;
  v_opened  timestamptz;
  v_found   boolean;
begin
  -- 1. Authorize: only the wall owner (the recipient) may reveal. Return before
  --    touching the row so a non-recipient learns nothing about its state.
  if not exists (
    select 1 from marks m join walls w on w.id = m.wall_id
    where m.id = p_mark_id and w.owner_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorized');
  end if;

  -- 2. Atomic consume: exactly one caller can flip opened_at while the secret is
  --    unopened AND unexpired. The row lock serializes concurrent callers, so two
  --    simultaneous reveals can never both return content (§68 race requirement).
  update mark_secrets
     set opened_at = now()
   where mark_id = p_mark_id
     and opened_at is null
     and now() < expires_at
  returning content into v_content;

  if found then
    return jsonb_build_object('ok', true, 'reason', 'ok', 'content', v_content);
  end if;

  -- 3. Classify the failure WITHOUT leaking content. (No row → missing; already
  --    opened → consumed; otherwise → expired.)
  select opened_at, true into v_opened, v_found
    from mark_secrets where mark_id = p_mark_id;
  if not v_found then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  elsif v_opened is not null then
    return jsonb_build_object('ok', false, 'reason', 'consumed');
  else
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
end $$;

revoke all on function reveal_secret(uuid) from public;
grant execute on function reveal_secret(uuid) to authenticated;

-- ── Expiry cleanup (for a scheduled job) ─────────────────────────────────────
-- Removes expired secret SHELLS from walls (status→removed; getWallMarks filters
-- to status='active', so they disappear — §27.4) and PURGES their payload. Returns
-- the count purged. SECURITY DEFINER so a scheduler role can run it; granted to
-- service_role only (never to end users). Deploy: schedule via pg_cron on hosted.
create or replace function expire_secret_marks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purged integer;
begin
  update marks
     set status = 'removed'
   where type = 'secret'
     and status = 'active'
     and id in (select mark_id from mark_secrets where now() >= expires_at);

  with del as (
    delete from mark_secrets where now() >= expires_at returning 1
  )
  select count(*) into v_purged from del;

  return v_purged;
end $$;

revoke all on function expire_secret_marks() from public;
grant execute on function expire_secret_marks() to service_role;
