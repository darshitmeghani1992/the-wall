-- ════════════════════════════════════════════════════════════════════════════
-- 60_secret_marks.sql · Area A (FP-C2 Rev 2 / ADR-008, R-A2/F1)
--
-- Secret = content hidden from all but the wall owner (+ service_role) and never
-- streamed via realtime. Proves, as the acting roles:
--   • author sends `text` on a type='secret' mark → base marks.text is NULL
--   • a non-owner is denied by the reveal RPC (0010 revoked direct client SELECT)
--   • the wall owner reveals the content (RPC); service_role reads it directly
--   • mark_secrets is ABSENT from supabase_realtime; marks is present
--   • an anonymous+secret mark hides BOTH author and content on the base row
--     while the owner reads content WITHOUT learning the author
--   • F1 lifecycle: an author UPDATE and an owner UPDATE of a secret's text are
--     BOTH rejected (check_violation) and the base text stays NULL; a non-secret
--     mark's text UPDATE still succeeds (the CHECK does not over-restrict)
--
-- Idiom: per-block BEGIN; set local role/uid; …; ROLLBACK. Secret marks are
-- created inline (as 30_anonymity does), not seeded.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── Core isolation + F1 lifecycle (one transaction, role switches) ───────────
BEGIN;
-- A posts a plain secret on O's public shared wall (W_O; contribution 'everyone'),
-- explicitly sending the content in `text` to prove the SERVER moves it.
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A (author)
insert into marks (id, wall_id, author_id, type, text, anonymous)
values ('cccccccc-cccc-cccc-cccc-cccccccccc60',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111','secret','super secret', false);

-- Base row: text moved off at the write boundary.
do $$
begin
  if (select text from marks where id = 'cccccccc-cccc-cccc-cccc-cccccccccc60') is not null then
    raise exception '60 FAIL: secret base row text was not nulled';
  end if;
end $$;
\echo '60 (base marks.text NULL)          : PASS  (content moved off base row)'

-- Non-owner authenticated reader (B): the reveal RPC denies (0010 revoked the
-- direct client SELECT, so the ONLY read path is reveal_secret, which is
-- recipient-gated → not_authorized, never content).
reset role;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (not the owner)
do $$
declare r jsonb;
begin
  r := reveal_secret('cccccccc-cccc-cccc-cccc-cccccccccc60');
  if (r->>'reason') <> 'not_authorized' or r ? 'content' then
    raise exception '60 FAIL: non-owner reveal_secret leaked content or was authorized: %', r;
  end if;
end $$;
\echo '60 (non-owner denied)              : PASS  (reveal_secret gates non-owner; no content)'

-- Wall owner (O): reveals the content via the one-time RPC.
reset role;
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O (wall owner)
do $$
declare r jsonb;
begin
  r := reveal_secret('cccccccc-cccc-cccc-cccc-cccccccccc60');
  if (r->>'ok') <> 'true' or (r->>'content') is distinct from 'super secret' then
    raise exception '60 FAIL: wall owner could not reveal the secret content: %', r;
  end if;
end $$;
\echo '60 (owner reveals content)         : PASS  (recipient reveals the secret)'

-- service_role (moderation path): reads the content via explicit grant.
reset role;
set local role service_role;
set local "test.uid" = '';
do $$
begin
  if (select content from mark_secrets where mark_id = 'cccccccc-cccc-cccc-cccc-cccccccccc60')
     is distinct from 'super secret' then
    raise exception '60 FAIL: moderation path could not read the secret content';
  end if;
end $$;
\echo '60 (service_role reads content)    : PASS  (moderation via explicit grant)'

-- Realtime publication: mark_secrets absent, marks present.
reset role;
do $$
begin
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public'
               and tablename = 'mark_secrets') then
    raise exception '60 FAIL: mark_secrets is in the supabase_realtime publication';
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public'
                   and tablename = 'marks') then
    raise exception '60 FAIL: marks is missing from the supabase_realtime publication';
  end if;
end $$;
\echo '60 (publication guard)             : PASS  (mark_secrets NOT published; marks is)'

-- F1 lifecycle (author): author cannot re-populate the secret's base text.
reset role;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A (author)
do $$
declare rejected boolean := false;
begin
  begin
    update marks set text = 'leak' where id = 'cccccccc-cccc-cccc-cccc-cccccccccc60';
  exception when check_violation then rejected := true;   -- marks_secret_text_null
  end;
  if not rejected then raise exception '60 FAIL: author UPDATE of secret text was not rejected'; end if;
  if (select text from marks where id = 'cccccccc-cccc-cccc-cccc-cccccccccc60') is not null then
    raise exception '60 FAIL: secret base text non-NULL after author UPDATE attempt';
  end if;
end $$;
\echo '60 (F1 author UPDATE rejected)     : PASS  (check_violation; base text stays NULL)'

-- F1 lifecycle (owner): the wall owner cannot re-populate the secret's base text.
reset role;
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O (wall owner)
do $$
declare rejected boolean := false;
begin
  begin
    update marks set text = 'leak' where id = 'cccccccc-cccc-cccc-cccc-cccccccccc60';
  exception when check_violation then rejected := true;   -- marks_secret_text_null
  end;
  if not rejected then raise exception '60 FAIL: owner UPDATE of secret text was not rejected'; end if;
  if (select text from marks where id = 'cccccccc-cccc-cccc-cccc-cccccccccc60') is not null then
    raise exception '60 FAIL: secret base text non-NULL after owner UPDATE attempt';
  end if;
end $$;
\echo '60 (F1 owner UPDATE rejected)      : PASS  (check_violation; base text stays NULL)'
ROLLBACK;

-- ── F1 positive: a NON-secret mark''s text UPDATE still succeeds ──────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A (author of M_active, a sticky)
do $$
begin
  update marks set text = 'edited active' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  if (select text from marks where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1') <> 'edited active' then
    raise exception '60 FAIL: non-secret text edit did not persist (CHECK over-restricts)';
  end if;
end $$;
ROLLBACK;
\echo '60 (F1 non-secret edit allowed)    : PASS  (CHECK does not over-restrict)'

-- ── Anonymous + secret: base row hides BOTH author and content ───────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
insert into marks (id, wall_id, author_id, type, text, anonymous)
values ('cccccccc-cccc-cccc-cccc-cccccccccc61',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111','secret','anon super secret', true);
do $$
begin
  if (select author_id from marks where id = 'cccccccc-cccc-cccc-cccc-cccccccccc61') is not null then
    raise exception '60 FAIL: anon+secret base row leaks author_id';
  end if;
  if (select text from marks where id = 'cccccccc-cccc-cccc-cccc-cccccccccc61') is not null then
    raise exception '60 FAIL: anon+secret base row leaks text';
  end if;
end $$;
-- Owner reveals content WITHOUT learning the author (mark_secrets has no author col).
reset role;
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O (owner)
do $$
declare r jsonb;
begin
  r := reveal_secret('cccccccc-cccc-cccc-cccc-cccccccccc61');
  if (r->>'ok') <> 'true' or (r->>'content') is distinct from 'anon super secret' then
    raise exception '60 FAIL: owner could not reveal anon+secret content: %', r;
  end if;
end $$;
ROLLBACK;
\echo '60 (anon+secret: author+content hidden): PASS  (owner reads content, not author)'

\echo '── 60_secret_marks: ALL PASS (isolation + F1 lifecycle + anon+secret) ──'
