-- ════════════════════════════════════════════════════════════════════════════
-- 61_secret_reveal.sql · Secret one-time reveal + 1-hour expiry (FP-SEC-002 / ADR-010)
--
-- Proves the lifecycle promises 0004 did NOT cover, as the acting end-user roles:
--   • recipient's FIRST reveal returns content and records opened_at exactly once
--   • recipient's SECOND reveal fails with reason='consumed' and NO content (§27.3)
--   • an EXPIRED secret reveals reason='expired' and NO content (§27.4)
--   • a NON-recipient reveal fails reason='not_authorized' and NO content
--   • content is never returned except on the single winning ok reveal
--   • base marks.text stays NULL throughout (no re-population)
--   • expire_secret_marks() removes expired shells + purges payload
--
-- Idiom mirrors 60: inline secret creation, per-block role/uid switches, ROLLBACK.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── One-time reveal: first ok, second consumed (single transaction) ──────────
BEGIN;
-- A (author) posts a secret on O's wall; the extract trigger moves content off
-- the base row into mark_secrets with a default 1-hour expires_at, opened_at NULL.
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A (author)
insert into marks (id, wall_id, author_id, type, text, anonymous)
values ('cccccccc-cccc-cccc-cccc-ccccccccc611',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111','secret','one time only', false);

-- O (owner/recipient) reveals: first call wins.
reset role;
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O
do $$
declare r jsonb;
begin
  r := reveal_secret('cccccccc-cccc-cccc-cccc-ccccccccc611');
  if (r->>'ok') <> 'true' or (r->>'content') is distinct from 'one time only' then
    raise exception '61 FAIL: first reveal did not return content: %', r;
  end if;
end $$;
\echo '61 (first reveal → content)        : PASS  (recipient opens once)'

-- opened_at was set exactly once (checked as service_role, which retains SELECT).
reset role;
set local role service_role;
set local "test.uid" = '';
do $$
begin
  if (select opened_at from mark_secrets where mark_id = 'cccccccc-cccc-cccc-cccc-ccccccccc611') is null then
    raise exception '61 FAIL: opened_at not recorded after first reveal';
  end if;
end $$;
\echo '61 (opened_at recorded)            : PASS  (server records the open, not the client)'

-- O reveals AGAIN: must fail as consumed, with no content (§27.3 second-reveal fails).
reset role;
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O
do $$
declare r jsonb;
begin
  r := reveal_secret('cccccccc-cccc-cccc-cccc-ccccccccc611');
  if (r->>'ok') <> 'false' or (r->>'reason') <> 'consumed' or r ? 'content' then
    raise exception '61 FAIL: second reveal was not consumed/empty: %', r;
  end if;
end $$;
\echo '61 (second reveal → consumed)      : PASS  (one-time; no content on re-open)'

-- Base marks.text is still NULL after the whole reveal dance.
do $$
begin
  if (select text from marks where id = 'cccccccc-cccc-cccc-cccc-ccccccccc611') is not null then
    raise exception '61 FAIL: base marks.text became non-NULL';
  end if;
end $$;
\echo '61 (base text stays NULL)          : PASS  (reveal never re-populates the base row)'
ROLLBACK;

-- ── Expiry: a past-due secret reveals expired, and cleanup purges it ─────────
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
insert into marks (id, wall_id, author_id, type, text, anonymous)
values ('cccccccc-cccc-cccc-cccc-ccccccccc612',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111','secret','stale secret', false);

-- Backdate expiry into the past (as the superuser session role — no client role
-- can UPDATE mark_secrets; this stands in for "the clock advanced past the
-- 1-hour window").
reset role;
update mark_secrets set expires_at = now() - interval '1 minute'
  where mark_id = 'cccccccc-cccc-cccc-cccc-ccccccccc612';

-- O tries to reveal an expired secret → expired, no content.
reset role;
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O
do $$
declare r jsonb;
begin
  r := reveal_secret('cccccccc-cccc-cccc-cccc-ccccccccc612');
  if (r->>'ok') <> 'false' or (r->>'reason') <> 'expired' or r ? 'content' then
    raise exception '61 FAIL: expired secret did not report expired/empty: %', r;
  end if;
end $$;
\echo '61 (expired reveal → expired)      : PASS  (past the 1-hour window; no content)'

-- Cleanup removes the shell and purges the payload. Run as the superuser session
-- role so the post-conditions can read marks/mark_secrets directly; the function
-- itself is SECURITY DEFINER and is granted to service_role in production.
reset role;
do $$
declare n integer;
begin
  n := expire_secret_marks();
  if n < 1 then raise exception '61 FAIL: expire_secret_marks purged nothing (got %)', n; end if;
  if exists (select 1 from mark_secrets where mark_id = 'cccccccc-cccc-cccc-cccc-ccccccccc612') then
    raise exception '61 FAIL: expired payload not purged';
  end if;
  if (select status from marks where id = 'cccccccc-cccc-cccc-cccc-ccccccccc612') <> 'removed' then
    raise exception '61 FAIL: expired secret shell not removed from the wall';
  end if;
end $$;
\echo '61 (cleanup purges expired)        : PASS  (shell removed + payload purged)'
ROLLBACK;

-- ── Non-recipient reveal is denied even for a valid, unopened secret ─────────
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
insert into marks (id, wall_id, author_id, type, text, anonymous)
values ('cccccccc-cccc-cccc-cccc-ccccccccc613',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111','secret','not for you', false);

-- B is authenticated but not the wall owner → not_authorized, no content, and the
-- secret stays UNOPENED (a denied attempt must not consume it).
reset role;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (not owner)
do $$
declare r jsonb;
begin
  r := reveal_secret('cccccccc-cccc-cccc-cccc-ccccccccc613');
  if (r->>'ok') <> 'false' or (r->>'reason') <> 'not_authorized' or r ? 'content' then
    raise exception '61 FAIL: non-recipient reveal was not denied/empty: %', r;
  end if;
end $$;
reset role;
set local role service_role;
set local "test.uid" = '';
do $$
begin
  if (select opened_at from mark_secrets where mark_id = 'cccccccc-cccc-cccc-cccc-ccccccccc613') is not null then
    raise exception '61 FAIL: a denied attempt consumed the secret (opened_at set)';
  end if;
end $$;
\echo '61 (non-recipient → not_authorized): PASS  (denied; secret stays unopened)'
ROLLBACK;

\echo '── 61_secret_reveal: ALL PASS (one-time reveal + expiry + recipient-gating) ──'
