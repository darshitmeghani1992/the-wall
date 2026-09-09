-- ════════════════════════════════════════════════════════════════════════════
-- 95_account_lifecycle.sql · Account deactivation lifecycle (Master Spec §82, 0013)
--
-- A deactivated account is "not normally discoverable/interactable": its PERSONAL
-- Wall is not viewable and cannot be contributed to, the account cannot contribute
-- anywhere, and cannot be sent friend requests. Reactivation restores everything.
-- SHARED Walls the account owns stay accessible to members (not over-gated).
--
-- Idiom mirrors the other areas: dynamic wall ids from the seed, deactivate via the
-- self-service RPC as the acting user, per-block ROLLBACK.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- Seed helpers: G (grace, 8888…) has a public personal wall and is friends with A
-- (1111…). O (olivia, 4444…) owns the public SHARED wall W_O (aaaa…) + a personal wall.

-- ── Baseline: everyone is active; G's public personal wall is viewable ────────
BEGIN;
do $$
declare g_wall uuid;
begin
  if not is_active_account('88888888-8888-8888-8888-888888888888') then
    raise exception '95 FAIL: seeded account not active by default';
  end if;
  select id into g_wall from walls
    where owner_id = '88888888-8888-8888-8888-888888888888' and type = 'personal';
  if not can_view_wall(g_wall, '11111111-1111-1111-1111-111111111111') then
    raise exception '95 FAIL: active user public personal wall not viewable';
  end if;
end $$;
\echo '95 (active baseline)               : PASS  (default active; public wall viewable)'
ROLLBACK;

-- ── Deactivate G → personal wall hidden, no contribution, no friend request ──
BEGIN;
-- G deactivates via the self-service RPC.
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';   -- G
select deactivate_account();

reset role;
do $$
declare g_wall uuid;
begin
  if is_active_account('88888888-8888-8888-8888-888888888888') then
    raise exception '95 FAIL: deactivate_account did not flip status';
  end if;
  if (select deactivated_at from profiles where id = '88888888-8888-8888-8888-888888888888') is null then
    raise exception '95 FAIL: deactivated_at not stamped';
  end if;
  select id into g_wall from walls
    where owner_id = '88888888-8888-8888-8888-888888888888' and type = 'personal';
  -- A (G's friend) can no longer view G's personal wall.
  if can_view_wall(g_wall, '11111111-1111-1111-1111-111111111111') then
    raise exception '95 FAIL: deactivated owner personal wall still viewable';
  end if;
  -- Nobody can contribute to it.
  if can_contribute(g_wall, '11111111-1111-1111-1111-111111111111') then
    raise exception '95 FAIL: contribution to deactivated owner wall allowed';
  end if;
  -- The deactivated user cannot contribute anywhere (public 'everyone' shared wall).
  if can_contribute('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','88888888-8888-8888-8888-888888888888') then
    raise exception '95 FAIL: deactivated user could still contribute';
  end if;
end $$;
\echo '95 (deactivated: wall hidden)      : PASS  (personal wall + contribution gated both ways)'

-- A friend request TO the deactivated G is rejected by RLS (D has no relation to G).
set local role authenticated;
set local "test.uid" = '55555555-5555-5555-5555-555555555555';   -- D (requester)
do $$
declare denied boolean := false;
begin
  begin
    insert into friendships (requester_id, addressee_id, status)
    values ('55555555-5555-5555-5555-555555555555','88888888-8888-8888-8888-888888888888','pending');
  exception when others then denied := true;   -- RLS with-check (is_active_account(addressee))
  end;
  if not denied then raise exception '95 FAIL: friend request to a deactivated user succeeded'; end if;
end $$;
\echo '95 (deactivated: no friend request): PASS  (RLS rejects request to a deactivated user)'
ROLLBACK;

-- ── Reactivate restores access ───────────────────────────────────────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';   -- G
select deactivate_account();
select reactivate_account();
reset role;
do $$
declare g_wall uuid;
begin
  if not is_active_account('88888888-8888-8888-8888-888888888888') then
    raise exception '95 FAIL: reactivate_account did not restore active';
  end if;
  if (select deactivated_at from profiles where id = '88888888-8888-8888-8888-888888888888') is not null then
    raise exception '95 FAIL: deactivated_at not cleared on reactivate';
  end if;
  select id into g_wall from walls
    where owner_id = '88888888-8888-8888-8888-888888888888' and type = 'personal';
  if not can_view_wall(g_wall, '11111111-1111-1111-1111-111111111111') then
    raise exception '95 FAIL: wall not viewable again after reactivation';
  end if;
end $$;
\echo '95 (reactivated: access restored)  : PASS  (status + deactivated_at + visibility restored)'
ROLLBACK;

-- ── Shared walls are NOT over-gated by owner deactivation ────────────────────
-- Deactivating O must NOT hide the public SHARED wall W_O from others, but MUST
-- hide O's own personal wall. Proves the gate is personal-wall-only.
BEGIN;
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O
select deactivate_account();
reset role;
do $$
declare o_personal uuid;
begin
  if not can_view_wall('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111') then
    raise exception '95 FAIL: public shared wall wrongly hidden by owner deactivation';
  end if;
  select id into o_personal from walls
    where owner_id = '44444444-4444-4444-4444-444444444444' and type = 'personal';
  if can_view_wall(o_personal, '11111111-1111-1111-1111-111111111111') then
    raise exception '95 FAIL: deactivated owner personal wall still viewable';
  end if;
end $$;
\echo '95 (shared wall not over-gated)    : PASS  (owner deactivation hides personal, not shared)'
ROLLBACK;

\echo '── 95_account_lifecycle: ALL PASS (deactivate / gate / reactivate / shared-safe) ──'
