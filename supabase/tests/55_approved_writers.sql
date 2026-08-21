-- ════════════════════════════════════════════════════════════════════════════
-- 55_approved_writers.sql · Approved Writers (Master Spec §15, §50 / migration 0015)
--
-- On a 'selected'-policy wall only OWNER-approved users may write. Proves:
--   • owner adds an approved writer; that writer can contribute (public wall)
--   • a non-approved user cannot; owner-only add/remove; can't add across a block
--   • **private visibility wins**: a non-friend approved writer cannot write to a
--     PRIVATE wall; becoming a friend restores write
--   • approval does NOT grant VIEW of a private wall (can_view_wall unchanged)
--   • removing approval revokes write
--
-- Uses O's PERSONAL wall (set contribution_policy='selected'); candidate writer G
-- (8888, active, not a friend of O, not blocked). Relationships created inline.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── Owner approves a writer → that writer can contribute (public wall) ────────
BEGIN;
reset role;
update walls set contribution_policy = 'selected'
  where owner_id = '44444444-4444-4444-4444-444444444444' and type = 'personal';   -- O personal, public

-- O adds G as an approved writer.
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O (owner)
insert into approved_writers (wall_id, user_id)
  select id, '88888888-8888-8888-8888-888888888888' from walls
   where owner_id = '44444444-4444-4444-4444-444444444444' and type = 'personal';

reset role;
do $$
declare o_wall uuid;
begin
  select id into o_wall from walls where owner_id = '44444444-4444-4444-4444-444444444444' and type = 'personal';
  -- Approved G can write (public + approved); non-approved B cannot.
  if not can_contribute(o_wall, '88888888-8888-8888-8888-888888888888') then
    raise exception '55 FAIL: approved writer cannot contribute to a public selected wall';
  end if;
  if can_contribute(o_wall, '22222222-2222-2222-2222-222222222222') then
    raise exception '55 FAIL: non-approved user could contribute to a selected wall';
  end if;
  -- Owner can always contribute to their own wall.
  if not can_contribute(o_wall, '44444444-4444-4444-4444-444444444444') then
    raise exception '55 FAIL: owner cannot contribute to own selected wall';
  end if;
end $$;
\echo '55 (approved writer can write)     : PASS  (public selected wall; non-approved denied)'
ROLLBACK;

-- ── Owner-only management; no add across a block; approval revocable ─────────
BEGIN;
reset role;
update walls set contribution_policy = 'selected'
  where owner_id = '44444444-4444-4444-4444-444444444444' and type = 'personal';

-- A non-owner (B) cannot add an approved writer to O's wall.
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (not owner)
do $$
declare o_wall uuid; rejected boolean := false;
begin
  select id into o_wall from walls where owner_id = '44444444-4444-4444-4444-444444444444' and type = 'personal';
  begin
    insert into approved_writers (wall_id, user_id) values (o_wall, '22222222-2222-2222-2222-222222222222');
  exception when others then rejected := true;   -- RLS with-check (owner only)
  end;
  if not rejected then raise exception '55 FAIL: non-owner added an approved writer'; end if;
end $$;

-- O cannot approve a blocked user (O blocks C, seed).
reset role;
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O
do $$
declare o_wall uuid; rejected boolean := false;
begin
  select id into o_wall from walls where owner_id = '44444444-4444-4444-4444-444444444444' and type = 'personal';
  begin
    insert into approved_writers (wall_id, user_id) values (o_wall, '33333333-3333-3333-3333-333333333333');  -- C (blocked)
  exception when others then rejected := true;
  end;
  if not rejected then raise exception '55 FAIL: owner approved a blocked user'; end if;

  -- Approve G, confirm write, then remove approval → write revoked.
  insert into approved_writers (wall_id, user_id) values (o_wall, '88888888-8888-8888-8888-888888888888');
  if not can_contribute(o_wall, '88888888-8888-8888-8888-888888888888') then
    raise exception '55 FAIL: approved writer cannot write';
  end if;
  delete from approved_writers where wall_id = o_wall and user_id = '88888888-8888-8888-8888-888888888888';
  if can_contribute(o_wall, '88888888-8888-8888-8888-888888888888') then
    raise exception '55 FAIL: removed writer can still write';
  end if;
end $$;
\echo '55 (owner-only + block + revoke)   : PASS  (only owner manages; no block; revocable)'
ROLLBACK;

-- ── Private visibility wins; approval grants no VIEW of a private wall ────────
BEGIN;
reset role;
update walls set contribution_policy = 'selected', visibility = 'private'
  where owner_id = '44444444-4444-4444-4444-444444444444' and type = 'personal';
-- O approves G (G is NOT a friend of O).
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O
insert into approved_writers (wall_id, user_id)
  select id, '88888888-8888-8888-8888-888888888888' from walls
   where owner_id = '44444444-4444-4444-4444-444444444444' and type = 'personal';
reset role;
do $$
declare o_wall uuid;
begin
  select id into o_wall from walls where owner_id = '44444444-4444-4444-4444-444444444444' and type = 'personal';
  -- Non-friend approved writer cannot write to a PRIVATE wall (private wins).
  if can_contribute(o_wall, '88888888-8888-8888-8888-888888888888') then
    raise exception '55 FAIL: non-friend approved writer wrote to a private wall';
  end if;
  -- And approval does NOT grant VIEW of the private wall.
  if can_view_wall(o_wall, '88888888-8888-8888-8888-888888888888') then
    raise exception '55 FAIL: approval granted view of a private wall';
  end if;
end $$;
-- Now make O and G friends → the approved writer can write (public OR friend).
reset role;
insert into friendships (requester_id, addressee_id, status)
  values ('44444444-4444-4444-4444-444444444444','88888888-8888-8888-8888-888888888888','accepted');
do $$
declare o_wall uuid;
begin
  select id into o_wall from walls where owner_id = '44444444-4444-4444-4444-444444444444' and type = 'personal';
  if not can_contribute(o_wall, '88888888-8888-8888-8888-888888888888') then
    raise exception '55 FAIL: approved friend cannot write to a private wall';
  end if;
end $$;
\echo '55 (private wins; friend restores) : PASS  (§50 private-visibility-wins; no view grant)'
ROLLBACK;

\echo '── 55_approved_writers: ALL PASS (selected policy, owner-managed, private-wins, revocable) ──'
