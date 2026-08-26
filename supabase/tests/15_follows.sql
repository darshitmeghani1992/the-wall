-- ════════════════════════════════════════════════════════════════════════════
-- 15_follows.sql · Followers (Master Spec §17, §66 / migration 0014)
--
-- Following is one-way, public-Personal-Wall-only, grants NO write permission, and
-- never bypasses privacy or blocking. Proves, as the acting roles:
--   • follow a public-wall user; unfollow; no self-follow; no duplicate
--   • cannot follow a PRIVATE personal wall
--   • cannot follow across a block (either direction) or a deactivated account
--   • following does NOT grant contribution (can_contribute unchanged)
--   • blocking removes existing follow rows both ways (§51)
--
-- Seed: D (5555) blocks E (6666); all personal walls public by default; G (8888)
-- has no relationship with D or C. Per-block BEGIN … ROLLBACK.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── Follow / count / unfollow (happy path) ───────────────────────────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '55555555-5555-5555-5555-555555555555';   -- D
insert into follows (follower_id, followed_id)
  values ('55555555-5555-5555-5555-555555555555','88888888-8888-8888-8888-888888888888');   -- D → G
do $$
begin
  if (select count(*) from follows
      where follower_id = '55555555-5555-5555-5555-555555555555'
        and followed_id = '88888888-8888-8888-8888-888888888888') <> 1 then
    raise exception '15 FAIL: follow of a public-wall user did not persist';
  end if;
  -- G's follower count is world-readable.
  if (select count(*) from follows where followed_id = '88888888-8888-8888-8888-888888888888') <> 1 then
    raise exception '15 FAIL: follower count not readable';
  end if;
end $$;
-- Unfollow (self).
delete from follows
  where follower_id = '55555555-5555-5555-5555-555555555555'
    and followed_id = '88888888-8888-8888-8888-888888888888';
do $$
begin
  if (select count(*) from follows
      where follower_id = '55555555-5555-5555-5555-555555555555'
        and followed_id = '88888888-8888-8888-8888-888888888888') <> 0 then
    raise exception '15 FAIL: unfollow did not remove the row';
  end if;
end $$;
\echo '15 (follow / count / unfollow)     : PASS  (one-way follow of a public wall)'
ROLLBACK;

-- ── No self-follow; no duplicate ─────────────────────────────────────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '55555555-5555-5555-5555-555555555555';   -- D
do $$
declare rejected boolean := false;
begin
  begin
    insert into follows (follower_id, followed_id)
      values ('55555555-5555-5555-5555-555555555555','55555555-5555-5555-5555-555555555555');
  exception when others then rejected := true;   -- follows_no_self CHECK / RLS
  end;
  if not rejected then raise exception '15 FAIL: self-follow was allowed'; end if;
end $$;
insert into follows (follower_id, followed_id)
  values ('55555555-5555-5555-5555-555555555555','88888888-8888-8888-8888-888888888888');
do $$
declare rejected boolean := false;
begin
  begin
    insert into follows (follower_id, followed_id)
      values ('55555555-5555-5555-5555-555555555555','88888888-8888-8888-8888-888888888888');
  exception when unique_violation then rejected := true;   -- PK
  end;
  if not rejected then raise exception '15 FAIL: duplicate follow was allowed'; end if;
end $$;
\echo '15 (no self-follow / no duplicate) : PASS  (CHECK + PK enforced)'
ROLLBACK;

-- ── Cannot follow a PRIVATE personal wall ────────────────────────────────────
BEGIN;
reset role;
update walls set visibility = 'private'
  where owner_id = '88888888-8888-8888-8888-888888888888' and type = 'personal';
set local role authenticated;
set local "test.uid" = '55555555-5555-5555-5555-555555555555';   -- D
do $$
declare rejected boolean := false;
begin
  begin
    insert into follows (follower_id, followed_id)
      values ('55555555-5555-5555-5555-555555555555','88888888-8888-8888-8888-888888888888');
  exception when others then rejected := true;   -- RLS with-check: wall not public
  end;
  if not rejected then raise exception '15 FAIL: followed a private personal wall'; end if;
end $$;
\echo '15 (private wall not followable)   : PASS  (§17 public-wall-only)'
ROLLBACK;

-- ── Blocking prevents follow (both directions) ───────────────────────────────
BEGIN;
-- D blocked E (seed). E cannot follow D, and D cannot follow E.
set local role authenticated;
set local "test.uid" = '66666666-6666-6666-6666-666666666666';   -- E (blocked by D)
do $$
declare rejected boolean := false;
begin
  begin
    insert into follows (follower_id, followed_id)
      values ('66666666-6666-6666-6666-666666666666','55555555-5555-5555-5555-555555555555');
  exception when others then rejected := true;   -- is_blocked
  end;
  if not rejected then raise exception '15 FAIL: blocked user could follow the blocker'; end if;
end $$;
reset role;
set local role authenticated;
set local "test.uid" = '55555555-5555-5555-5555-555555555555';   -- D (blocker)
do $$
declare rejected boolean := false;
begin
  begin
    insert into follows (follower_id, followed_id)
      values ('55555555-5555-5555-5555-555555555555','66666666-6666-6666-6666-666666666666');
  exception when others then rejected := true;
  end;
  if not rejected then raise exception '15 FAIL: blocker could follow the blocked user'; end if;
end $$;
\echo '15 (block prevents follow)         : PASS  (public status never bypasses a block)'
ROLLBACK;

-- ── Cannot follow / cannot act while deactivated ─────────────────────────────
BEGIN;
-- Deactivate G → D cannot follow G.
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';   -- G
select deactivate_account();
reset role;
set local role authenticated;
set local "test.uid" = '55555555-5555-5555-5555-555555555555';   -- D
do $$
declare rejected boolean := false;
begin
  begin
    insert into follows (follower_id, followed_id)
      values ('55555555-5555-5555-5555-555555555555','88888888-8888-8888-8888-888888888888');
  exception when others then rejected := true;   -- is_active_account(followed) false
  end;
  if not rejected then raise exception '15 FAIL: followed a deactivated account'; end if;
end $$;
ROLLBACK;
BEGIN;
-- Deactivated D cannot follow anyone.
set local role authenticated;
set local "test.uid" = '55555555-5555-5555-5555-555555555555';   -- D
select deactivate_account();
do $$
declare rejected boolean := false;
begin
  begin
    insert into follows (follower_id, followed_id)
      values ('55555555-5555-5555-5555-555555555555','88888888-8888-8888-8888-888888888888');
  exception when others then rejected := true;   -- is_active_account(auth.uid()) false
  end;
  if not rejected then raise exception '15 FAIL: a deactivated user could follow'; end if;
end $$;
\echo '15 (deactivated: no follow either way): PASS  (§82 gating on follow)'
ROLLBACK;

-- ── Following does NOT grant contribution ────────────────────────────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '55555555-5555-5555-5555-555555555555';   -- D
insert into follows (follower_id, followed_id)
  values ('55555555-5555-5555-5555-555555555555','88888888-8888-8888-8888-888888888888');   -- D follows G
reset role;
do $$
declare g_wall uuid;
begin
  select id into g_wall from walls
    where owner_id = '88888888-8888-8888-8888-888888888888' and type = 'personal';
  -- G's personal wall is 'friends'-policy; D follows but is NOT a friend → no write.
  if can_contribute(g_wall, '55555555-5555-5555-5555-555555555555') then
    raise exception '15 FAIL: following granted contribution permission';
  end if;
end $$;
\echo '15 (follow grants no write)        : PASS  (following never grants contribution)'
ROLLBACK;

-- ── Blocking removes existing follows both ways (§51) ────────────────────────
BEGIN;
-- C follows G (no prior block/relationship), then C blocks G → follow torn down.
set local role authenticated;
set local "test.uid" = '33333333-3333-3333-3333-333333333333';   -- C
insert into follows (follower_id, followed_id)
  values ('33333333-3333-3333-3333-333333333333','88888888-8888-8888-8888-888888888888');
insert into blocks (blocker_id, blocked_id)
  values ('33333333-3333-3333-3333-333333333333','88888888-8888-8888-8888-888888888888');
reset role;
do $$
begin
  if (select count(*) from follows
      where follower_id = '33333333-3333-3333-3333-333333333333'
        and followed_id = '88888888-8888-8888-8888-888888888888') <> 0 then
    raise exception '15 FAIL: block did not remove the follow row';
  end if;
end $$;
\echo '15 (block removes follows)         : PASS  (§51 follow relationship removed)'
ROLLBACK;

\echo '── 15_follows: ALL PASS (one-way follow, public-only, block/active-gated, no write) ──'
