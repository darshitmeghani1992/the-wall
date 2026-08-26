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
  -- Personal-Wall owners express themselves through Status, never ordinary Marks.
  if can_contribute(o_wall, '44444444-4444-4444-4444-444444444444') then
    raise exception '55 FAIL: owner can contribute an ordinary Mark to own Personal Wall';
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
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception '55 FAIL: owner approved a blocked user'; end if;
  if exists(select 1 from approved_writers where wall_id=o_wall
            and user_id='33333333-3333-3333-3333-333333333333') then
    raise exception '55 FAIL: blocked approval row persisted';
  end if;
end $$;

-- Approve G, then verify capability and an actual Mark as G (not as O asking
-- the protected arbitrary-actor helper about another user).
insert into approved_writers (wall_id, user_id)
  select id, '88888888-8888-8888-8888-888888888888' from walls
   where owner_id='44444444-4444-4444-4444-444444444444' and type='personal';
set local "test.uid" = '88888888-8888-8888-8888-888888888888'; -- G
do $$ declare o_wall uuid; begin
  select id into o_wall from walls where owner_id='44444444-4444-4444-4444-444444444444' and type='personal';
  if not current_user_can_contribute(o_wall) then
    raise exception '55 FAIL: approved writer capability is false';
  end if;
end $$;
insert into marks (id,wall_id,author_id,type,text)
  select '55000000-0000-0000-0000-000000000001',id,auth.uid(),'text','approved writer control'
    from walls where owner_id='44444444-4444-4444-4444-444444444444' and type='personal';

-- O removes exactly G's approval.
set local "test.uid" = '44444444-4444-4444-4444-444444444444'; -- O
do $$ declare o_wall uuid; removed_count integer; begin
  select id into o_wall from walls where owner_id='44444444-4444-4444-4444-444444444444' and type='personal';
  delete from approved_writers where wall_id=o_wall
    and user_id='88888888-8888-8888-8888-888888888888';
  get diagnostics removed_count = row_count;
  if removed_count <> 1 then raise exception '55 FAIL: owner did not remove exactly one approval'; end if;
end $$;

-- G's auth-bound capability and real write are both revoked.
set local "test.uid" = '88888888-8888-8888-8888-888888888888'; -- G
do $$ declare o_wall uuid; rejected boolean:=false; begin
  select id into o_wall from walls where owner_id='44444444-4444-4444-4444-444444444444' and type='personal';
  if current_user_can_contribute(o_wall) then
    raise exception '55 FAIL: removed writer capability remains true';
  end if;
  begin
    insert into marks (id,wall_id,author_id,type,text)
      values ('55000000-0000-0000-0000-000000000002',o_wall,auth.uid(),'text','revoked writer attack');
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception '55 FAIL: removed writer created a Mark'; end if;
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
