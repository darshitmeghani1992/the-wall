-- ════════════════════════════════════════════════════════════════════════════
-- 45_mark_lifecycle.sql · Sender edit/delete window + owner removal quota
--                        (Master Spec §32, §33; adversarial checklist §100)
--
-- Proves, as the acting end-user roles, that these are SERVER-enforced (not
-- client-trusted):
--   §32  author edits content within 10 min → allowed; after 10 min → rejected
--   §32  author deletes within 10 min → allowed; after 10 min → RLS blocks
--   §32  owner CANNOT hard-delete a received mark (no quota bypass)
--   §33  owner 'removed' requires a reason; 'normal' capped at 3 / 30 days;
--        'safety' never rate-limited (even at the cap); removed_by/at stamped
--
-- Marks are created inline with controlled created_at (as the superuser session
-- role) so the 10-minute / 30-day clocks can be exercised deterministically.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── §32 author edit window ───────────────────────────────────────────────────
BEGIN;
-- Fresh mark by A on O's wall (created_at = now → within the window).
reset role;
insert into marks (id, wall_id, author_id, type, text, created_at)
values ('45000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111','text','fresh', now());
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A (author)
do $$
begin
  update marks set text = 'edited in time' where id = '45000000-0000-0000-0000-000000000001';
  if (select text from marks where id = '45000000-0000-0000-0000-000000000001') <> 'edited in time' then
    raise exception '45 FAIL: in-window author edit did not persist';
  end if;
end $$;
\echo '45 (edit within 10 min)            : PASS  (author edits own fresh mark)'

-- Same author, a mark created 11 minutes ago → edit rejected.
reset role;
insert into marks (id, wall_id, author_id, type, text, created_at)
values ('45000000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111','text','old', now() - interval '11 minutes');
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
do $$
declare rejected boolean := false;
begin
  begin
    update marks set text = 'too late' where id = '45000000-0000-0000-0000-000000000002';
  exception when others then rejected := (SQLERRM like '%MARK_EDIT_WINDOW%');
  end;
  if not rejected then raise exception '45 FAIL: edit after 10 min was not rejected'; end if;
  if (select text from marks where id = '45000000-0000-0000-0000-000000000002') <> 'old' then
    raise exception '45 FAIL: stale-mark text changed despite closed window';
  end if;
end $$;
\echo '45 (edit after 10 min rejected)    : PASS  (MARK_EDIT_WINDOW; server time authoritative)'
ROLLBACK;

-- ── §32 delete window + owner cannot hard-delete ─────────────────────────────
BEGIN;
reset role;
insert into marks (id, wall_id, author_id, type, text, created_at) values
  ('45000000-0000-0000-0000-000000000011','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111','text','del fresh', now()),
  ('45000000-0000-0000-0000-000000000012','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111','text','del stale', now() - interval '11 minutes');

-- Author deletes own fresh mark → succeeds.
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
do $$
begin
  delete from marks where id = '45000000-0000-0000-0000-000000000011';
  if exists (select 1 from marks where id = '45000000-0000-0000-0000-000000000011') then
    raise exception '45 FAIL: in-window author delete did not remove the mark';
  end if;
end $$;
\echo '45 (delete within 10 min)          : PASS  (author deletes own fresh mark)'

-- Author deletes own STALE mark → RLS blocks (0 rows, no error).
do $$
begin
  delete from marks where id = '45000000-0000-0000-0000-000000000012';
  if not exists (select 1 from marks where id = '45000000-0000-0000-0000-000000000012') then
    raise exception '45 FAIL: author deleted a mark past the 10-minute window';
  end if;
end $$;
\echo '45 (delete after 10 min blocked)   : PASS  (RLS window; stale mark survives)'

-- Owner tries to HARD-delete a received mark → RLS blocks (no quota bypass).
reset role;
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O (wall owner, not author)
do $$
begin
  delete from marks where id = '45000000-0000-0000-0000-000000000012';
  if not exists (select 1 from marks where id = '45000000-0000-0000-0000-000000000012') then
    raise exception '45 FAIL: owner hard-deleted a mark (quota bypass)';
  end if;
end $$;
\echo '45 (owner cannot hard-delete)      : PASS  (owner removes via quota, not DELETE)'
ROLLBACK;

-- ── §33 owner removal quota (3 normal / 30 days; safety unlimited) ───────────
BEGIN;
reset role;
insert into marks (id, wall_id, author_id, type, text) values
  ('45000000-0000-0000-0000-000000000021','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','text','r1'),
  ('45000000-0000-0000-0000-000000000022','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','text','r2'),
  ('45000000-0000-0000-0000-000000000023','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','text','r3'),
  ('45000000-0000-0000-0000-000000000024','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','text','r4'),
  ('45000000-0000-0000-0000-000000000025','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','text','r5');

set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O (wall owner)

-- A removal with no reason is rejected.
do $$
declare rejected boolean := false;
begin
  begin
    update marks set status = 'removed' where id = '45000000-0000-0000-0000-000000000021';
  exception when others then rejected := (SQLERRM like '%MARK_REMOVAL_REASON%');
  end;
  if not rejected then raise exception '45 FAIL: removal without a reason was allowed'; end if;
end $$;
\echo '45 (removal needs a reason)        : PASS  (MARK_REMOVAL_REASON)'

-- Three NORMAL removals succeed and stamp who/when.
do $$
begin
  update marks set status='removed', removal_reason='normal' where id='45000000-0000-0000-0000-000000000021';
  update marks set status='removed', removal_reason='normal' where id='45000000-0000-0000-0000-000000000022';
  update marks set status='removed', removal_reason='normal' where id='45000000-0000-0000-0000-000000000023';
  if (select count(*) from marks where removed_by='44444444-4444-4444-4444-444444444444'
        and removal_reason='normal') <> 3 then
    raise exception '45 FAIL: three normal removals not all recorded';
  end if;
  if (select removed_at from marks where id='45000000-0000-0000-0000-000000000021') is null then
    raise exception '45 FAIL: removed_at not stamped';
  end if;
end $$;
\echo '45 (3 normal removals allowed)     : PASS  (stamped removed_by/at)'

-- The FOURTH normal removal is rejected (quota reached).
do $$
declare rejected boolean := false;
begin
  begin
    update marks set status='removed', removal_reason='normal' where id='45000000-0000-0000-0000-000000000024';
  exception when others then rejected := (SQLERRM like '%MARK_REMOVAL_QUOTA%');
  end;
  if not rejected then raise exception '45 FAIL: 4th normal removal was not rate-limited'; end if;
  if (select status from marks where id='45000000-0000-0000-0000-000000000024') = 'removed' then
    raise exception '45 FAIL: 4th normal removal took effect despite the quota';
  end if;
end $$;
\echo '45 (4th normal removal blocked)    : PASS  (MARK_REMOVAL_QUOTA; authenticity preserved)'

-- A SAFETY removal still succeeds at the cap (safety always wins).
do $$
begin
  update marks set status='removed', removal_reason='safety' where id='45000000-0000-0000-0000-000000000025';
  if (select status from marks where id='45000000-0000-0000-0000-000000000025') <> 'removed' then
    raise exception '45 FAIL: safety removal was blocked at the cap';
  end if;
end $$;
\echo '45 (safety removal never limited)  : PASS  (safety bypasses the quota)'
ROLLBACK;

-- ── §32 anchor immutability: an author cannot reset created_at to reopen the window ──
BEGIN;
reset role;
insert into marks (id, wall_id, author_id, type, text, created_at)
values ('45000000-0000-0000-0000-000000000031','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111','text','stale', now() - interval '2 hours');
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A (author)
do $$
declare rejected boolean := false;
begin
  begin
    update marks set created_at = now() where id = '45000000-0000-0000-0000-000000000031';
  exception when others then rejected := (SQLERRM like '%MARK_IMMUTABLE%');
  end;
  if not rejected then raise exception '45 FAIL: author reset created_at (window anchor mutable)'; end if;
  if (select created_at from marks where id = '45000000-0000-0000-0000-000000000031') > now() - interval '1 hour' then
    raise exception '45 FAIL: created_at moved despite the guard';
  end if;
end $$;
\echo '45 (created_at immutable)          : PASS  (window anchor is server-owned)'
ROLLBACK;

-- ── §33 anti-poison: a non-owner cannot plant removal-accounting columns ─────
BEGIN;
reset role;
insert into marks (id, wall_id, author_id, type, text) values
  ('45000000-0000-0000-0000-000000000041','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','text','p1'),
  ('45000000-0000-0000-0000-000000000042','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','text','p2');
-- A (author, NOT the wall owner) tries to plant the owner's accounting columns
-- WITHOUT a status change (so the owner-removal branch never runs).
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
do $$
begin
  update marks set removed_by = '44444444-4444-4444-4444-444444444444',
                   removal_reason = 'normal',
                   removed_at = now()
    where id in ('45000000-0000-0000-0000-000000000041','45000000-0000-0000-0000-000000000042');
  if (select count(*) from marks
        where removed_by = '44444444-4444-4444-4444-444444444444' and removal_reason = 'normal') <> 0 then
    raise exception '45 FAIL: non-owner planted removal-accounting columns (quota poisonable)';
  end if;
end $$;
\echo '45 (accounting columns unforgeable): PASS  (non-owner cannot poison §33 quota)'
ROLLBACK;

\echo '── 45_mark_lifecycle: ALL PASS (§32 edit/delete window + anchor immutability + §33 quota + anti-poison) ──'
