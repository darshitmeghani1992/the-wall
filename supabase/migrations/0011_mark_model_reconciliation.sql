-- ════════════════════════════════════════════════════════════════════════════
-- 0011 · Mark model reconciliation — Secret is an orthogonal MODE, not a type
--        (Master Spec §21 single integrated composer, §27 "any supported Mark
--         may be Secret", §4 excludes games/doodles)
--
-- The prototype encoded Secret as a mark TYPE alongside game/doodle types
-- (0001: mark_type enum sticky/roast/secret/memory/photo/award/poll/doodle/
-- prediction). The Master Spec says the canonical Mark content types are
-- text/photo/voice/video, and Secret (like Anonymous) is a MODE that can apply
-- to ANY of them. This migration:
--   • adds the canonical content-type enum values text/voice/video ('photo'
--     already exists; legacy values stay in the enum — Postgres can't drop enum
--     values — but the app stops using them),
--   • adds `marks.secret boolean` as the orthogonal mode flag,
--   • repoints the three places that keyed off `type = 'secret'` to `secret`:
--     the extract-secret write boundary (0004), the F1 lifecycle CHECK (0004),
--     and the expiry cleanup (0010).
--
-- The `secret` flag is safe to carry on the realtime-published `marks` row: it
-- only signals "this is a Secret" (viewers already see a locked shell) — the
-- CONTENT still lives solely in the RLS-gated `mark_secrets` side table and the
-- base `marks.text` stays NULL for secrets (unchanged from 0004/0010).
--
-- Additive + idempotent. Does NOT modify 0001–0010. Build on top only.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Canonical content-type enum values (photo already present in 0001) ───────
-- ADD VALUE IF NOT EXISTS is idempotent; PG15 allows it inside a transaction as
-- long as the new value isn't USED in the same transaction (we don't).
alter type mark_type add value if not exists 'text';
alter type mark_type add value if not exists 'voice';
alter type mark_type add value if not exists 'video';

-- ── Secret as an orthogonal boolean mode ─────────────────────────────────────
alter table marks add column if not exists secret boolean not null default false;

-- ── Repoint the write boundary: extract on secret=true, not type='secret' ────
-- (Identical body to 0004 except the guard; still SECURITY DEFINER so it can
-- write the client-revoked side table, still nulls the base text so REST + the
-- realtime INSERT payload carry no secret content.)
create or replace function marks_extract_secret()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.secret and new.text is not null then
    insert into mark_secrets (mark_id, content) values (new.id, new.text)
      on conflict (mark_id) do update set content = excluded.content;  -- deferred FK OK at commit
    new.text := null;   -- base row + realtime INSERT payload carry NO secret content
  end if;
  return new;
end $$;
-- (trigger binding from 0004 is unchanged; create-or-replace swaps the body.)

-- ── Repoint the F1 lifecycle CHECK from type to the secret flag ──────────────
-- Keeps secret content off the base row across the whole row lifecycle: any later
-- `update marks set text=…` on a secret (author OR owner) is rejected. Swap the
-- 0004 constraint (keyed on type) for one keyed on the new flag.
alter table marks drop constraint if exists marks_secret_text_null;
do $$ begin
  alter table marks add constraint marks_secret_text_null
    check (secret = false or text is null);
exception when duplicate_object then null; end $$;

-- ── Repoint the expiry cleanup from type='secret' to secret=true ─────────────
create or replace function expire_secret_marks()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_purged integer;
begin
  update marks
     set status = 'removed'
   where secret
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
