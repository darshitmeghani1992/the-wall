-- ════════════════════════════════════════════════════════════════════════════
-- 40_mark_moderation.sql · AC-S7, AC-S8, AC-S9, AC-S10  (F5, G-E)
--
-- Fixtures (01_seed): M_active (bbbb…b1) and M_pending (bbbb…b2) both authored by
-- A on O's wall. O is the wall owner; C is an unrelated user.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── AC-S7: author self-pins their own mark → DENIED ──────────────────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A (author, not owner)
do $$
begin
  begin
    update marks set pinned = true where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  exception when others then null;  -- moderation trigger raises; expected
  end;
  if (select pinned from marks where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1') then
    raise exception 'AC-S7 FAIL: author self-pinned their own mark';
  end if;
end $$;
ROLLBACK;
\echo 'AC-S7 (author self-pin)            : PASS  (denied; mark not pinned)'

-- ── AC-S8: author self-approves their pending mark (→active) → DENIED ────────
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
do $$
begin
  begin
    update marks set status = 'active' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';
  exception when others then null;  -- moderation trigger raises; expected
  end;
  if (select status from marks where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2') = 'active' then
    raise exception 'AC-S8 FAIL: author self-approved their pending mark';
  end if;
end $$;
ROLLBACK;
\echo 'AC-S8 (author self-approve)        : PASS  (denied; mark stays pending)'

-- ── AC-S9: unrelated user C modifies A's mark → DENIED ───────────────────────
-- RLS USING (author or owner) filters C out entirely → 0 rows, no state change.
BEGIN;
set local role authenticated;
set local "test.uid" = '33333333-3333-3333-3333-333333333333';   -- C (neither author nor owner)
do $$
begin
  update marks set pinned = true where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  if (select pinned from marks where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1') then
    raise exception 'AC-S9 FAIL: unrelated user modified the mark';
  end if;
end $$;
ROLLBACK;
\echo 'AC-S9 (unrelated user modify)      : PASS  (denied; no rows affected)'

-- ── AC-S10: wall owner performs valid moderation → SUCCEEDS ──────────────────
-- Positive guard: the fixes must NOT over-restrict legitimate owner moderation.
BEGIN;
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O (wall owner)
do $$
begin
  -- pin
  update marks set pinned = true where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  if not (select pinned from marks where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1') then
    raise exception 'AC-S10 FAIL: owner could not pin';
  end if;
  -- approve (pending → active)
  update marks set status = 'active' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';
  if (select status from marks where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2') <> 'active' then
    raise exception 'AC-S10 FAIL: owner could not approve';
  end if;
  -- hide (change status)
  update marks set status = 'hidden' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  if (select status from marks where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1') <> 'hidden' then
    raise exception 'AC-S10 FAIL: owner could not hide';
  end if;
end $$;
ROLLBACK;
\echo 'AC-S10 (owner moderation)          : PASS  (pin / approve / hide all allowed)'

\echo '── 40_mark_moderation: ALL PASS (AC-S7, AC-S8, AC-S9, AC-S10) ──'
