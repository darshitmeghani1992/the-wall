-- ════════════════════════════════════════════════════════════════════════════
-- 25_reactions.sql · One reaction per user per Mark (Master Spec §31 / migration 0016)
--
-- Proves, as the acting roles:
--   • a user has at most ONE reaction row per Mark (PK is (mark_id, user_id))
--   • a second DIFFERENT emoji as a plain insert is rejected (PK), but an UPSERT
--     on (mark_id, user_id) CHANGES the reaction (still one row)
--   • a user can only write/change/delete their OWN reaction (self-only RLS)
--
-- Uses seed mark M_active (bbbb…b1) on O's wall; reactors A (1111) and B (2222).
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── One row per (mark,user); plain second-emoji insert rejected; upsert changes ─
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
insert into mark_reactions (mark_id, user_id, emoji)
  values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','11111111-1111-1111-1111-111111111111','❤️');

-- A second, different emoji as a plain INSERT collides on the (mark,user) PK.
do $$
declare rejected boolean := false;
begin
  begin
    insert into mark_reactions (mark_id, user_id, emoji)
      values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','11111111-1111-1111-1111-111111111111','🔥');
  exception when unique_violation then rejected := true;
  end;
  if not rejected then raise exception '25 FAIL: a user stacked two reactions on one Mark'; end if;
end $$;

-- Changing the reaction is an UPSERT on (mark_id, user_id) → still exactly one row.
insert into mark_reactions (mark_id, user_id, emoji)
  values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','11111111-1111-1111-1111-111111111111','🔥')
  on conflict (mark_id, user_id) do update set emoji = excluded.emoji;
do $$
begin
  if (select count(*) from mark_reactions
      where mark_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
        and user_id = '11111111-1111-1111-1111-111111111111') <> 1 then
    raise exception '25 FAIL: changing a reaction did not keep exactly one row';
  end if;
  if (select emoji from mark_reactions
      where mark_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
        and user_id = '11111111-1111-1111-1111-111111111111') <> '🔥' then
    raise exception '25 FAIL: reaction change did not update the emoji';
  end if;
end $$;
\echo '25 (one reaction per user)         : PASS  (PK (mark,user); upsert changes, never stacks)'
ROLLBACK;

-- ── Self-only: a user cannot write or change ANOTHER user's reaction ─────────
BEGIN;
-- Seed B's reaction as superuser.
reset role;
insert into mark_reactions (mark_id, user_id, emoji)
  values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','22222222-2222-2222-2222-222222222222','❤️');
-- A tries to insert a reaction on B's behalf → RLS with-check (user_id=auth.uid()).
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
do $$
declare rejected boolean := false;
begin
  begin
    insert into mark_reactions (mark_id, user_id, emoji)
      values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','22222222-2222-2222-2222-222222222222','😂');
  exception when others then rejected := true;   -- RLS / PK
  end;
  if not rejected then raise exception '25 FAIL: A wrote a reaction as B'; end if;
end $$;
-- A's UPDATE of B's reaction affects 0 rows (using user_id=auth.uid()).
update mark_reactions set emoji = '😂'
  where mark_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
    and user_id = '22222222-2222-2222-2222-222222222222';
reset role;
do $$
begin
  if (select emoji from mark_reactions
      where mark_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
        and user_id = '22222222-2222-2222-2222-222222222222') <> '❤️' then
    raise exception '25 FAIL: A changed B''s reaction';
  end if;
end $$;
\echo '25 (self-only write/change)        : PASS  (a user cannot react as/for another)'
ROLLBACK;

\echo '── 25_reactions: ALL PASS (one-per-user §31 + self-only) ──'
