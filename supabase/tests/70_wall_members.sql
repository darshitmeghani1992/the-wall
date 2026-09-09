-- ════════════════════════════════════════════════════════════════════════════
-- 70_wall_members.sql · Area B (FP-C2 Rev 2 / ADR-009)
--
-- Fixtures (01_seed): W_PS (dddd…) = O's PRIVATE shared wall, contribution
-- 'nobody'. Members: B accepted, F pending. G = unrelated non-blocked non-member.
-- W_O (aaaa…) = O's PUBLIC shared wall, contribution 'everyone' (control).
--
-- Proves: accepted member can view+contribute a private shared wall; a non-member
-- cannot; the owner can; a public shared wall is viewable but not writable by a non-member;
-- the invite/accept vectors hold (non-owner cannot invite; insert-as-accepted /
-- insert-as-owner escalation rejected; F3 personal-wall invite rejected; only the
-- invitee accepts; no move back to pending); and the roster SELECT does not recurse.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── Gating: accepted member (B) can view + contribute W_PS ───────────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (accepted member)
do $$
begin
  if not current_user_can_view_wall('dddddddd-dddd-dddd-dddd-dddddddddddd') then
    raise exception '70 FAIL: accepted member cannot VIEW the private shared wall';
  end if;
  if not current_user_can_contribute('dddddddd-dddd-dddd-dddd-dddddddddddd') then
    raise exception '70 FAIL: accepted member cannot CONTRIBUTE to the private shared wall';
  end if;
end $$;
ROLLBACK;
\echo '70 (member view+contribute)        : PASS  (accepted membership gates in)'

-- ── Gating: non-member (G) can NEITHER view NOR contribute W_PS ──────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';   -- G (non-member)
do $$
begin
  if current_user_can_view_wall('dddddddd-dddd-dddd-dddd-dddddddddddd') then
    raise exception '70 FAIL: non-member can VIEW the private shared wall';
  end if;
  if current_user_can_contribute('dddddddd-dddd-dddd-dddd-dddddddddddd') then
    raise exception '70 FAIL: non-member can CONTRIBUTE to the private shared wall';
  end if;
end $$;
ROLLBACK;
\echo '70 (non-member denied)             : PASS  (no membership → no view/contribute)'

-- ── Gating: owner (O) can view + contribute regardless of membership rows ────
BEGIN;
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O (owner, no member row)
do $$
begin
  if not current_user_can_view_wall('dddddddd-dddd-dddd-dddd-dddddddddddd') then
    raise exception '70 FAIL: owner cannot VIEW their own private shared wall';
  end if;
  if not current_user_can_contribute('dddddddd-dddd-dddd-dddd-dddddddddddd') then
    raise exception '70 FAIL: owner cannot CONTRIBUTE to their own private shared wall';
  end if;
end $$;
ROLLBACK;
\echo '70 (owner view+contribute)         : PASS  (ownership via walls.owner_id)'

-- ── Control: a PUBLIC shared wall stays open for an unrelated non-blocked user ─
BEGIN;
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';   -- G (unrelated to W_O)
do $$
begin
  if not current_user_can_view_wall('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') then
    raise exception '70 FAIL: public shared wall not viewable by unrelated user (regression)';
  end if;
  if current_user_can_contribute('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') then
    raise exception '70 FAIL: public Shared-Wall non-member could contribute';
  end if;
end $$;
ROLLBACK;
\echo '70 (public view/member write)      : PASS  (public view; non-member write denied)'

-- ── Invite vector: a NON-owner (B) cannot create a membership → DENIED ───────
BEGIN;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (member, not owner)
do $$
declare denied boolean := false;
begin
  begin
    insert into wall_members (wall_id, user_id, role, status)
    values ('dddddddd-dddd-dddd-dddd-dddddddddddd',
            '88888888-8888-8888-8888-888888888888','member','pending');
  exception when others then denied := true;   -- invite WITH CHECK: owner-only
  end;
  if not denied then raise exception '70 FAIL: a non-owner created a membership'; end if;
end $$;
ROLLBACK;
\echo '70 (non-owner invite)              : PASS  (only the wall owner may invite)'

-- ── Escalation: owner insert-as-accepted / insert-as-owner-role → DENIED ─────
BEGIN;
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O (owner)
do $$
declare denied1 boolean := false; denied2 boolean := false;
begin
  begin
    insert into wall_members (wall_id, user_id, role, status)
    values ('dddddddd-dddd-dddd-dddd-dddddddddddd',
            '88888888-8888-8888-8888-888888888888','member','accepted');  -- pre-accepted
  exception when others then denied1 := true;   -- WITH CHECK: status must be pending
  end;
  begin
    insert into wall_members (wall_id, user_id, role, status)
    values ('dddddddd-dddd-dddd-dddd-dddddddddddd',
            '88888888-8888-8888-8888-888888888888','owner','pending');    -- self-grant owner
  exception when others then denied2 := true;   -- WITH CHECK: role must be member
  end;
  if not denied1 then raise exception '70 FAIL: insert-as-accepted was allowed (escalation)'; end if;
  if not denied2 then raise exception '70 FAIL: insert-as-owner-role was allowed (escalation)'; end if;
end $$;
ROLLBACK;
\echo '70 (insert escalation)             : PASS  (must start pending/member)'

-- ── F3: an owner invite targeting a PERSONAL wall → DENIED ───────────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O (owner)
do $$
declare v_personal uuid; denied boolean := false;
begin
  select id into v_personal from walls
   where owner_id = '44444444-4444-4444-4444-444444444444' and type = 'personal';
  begin
    insert into wall_members (wall_id, user_id, role, status)
    values (v_personal, '88888888-8888-8888-8888-888888888888','member','pending');
  exception when others then denied := true;   -- WITH CHECK: w.type must be 'shared'
  end;
  if not denied then raise exception '70 FAIL: membership created on a PERSONAL wall (F3)'; end if;
end $$;
ROLLBACK;
\echo '70 (F3 personal-wall invite)       : PASS  (membership requires a shared wall)'

-- ── Positive: owner (O) may create a pending 'member' invite → SUCCEEDS ──────
BEGIN;
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O (owner)
do $$
begin
  insert into wall_members (wall_id, user_id, role, status)
  values ('dddddddd-dddd-dddd-dddd-dddddddddddd',
          '88888888-8888-8888-8888-888888888888','member','pending');
  if not exists (select 1 from wall_members
                 where wall_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
                   and user_id = '88888888-8888-8888-8888-888888888888'
                   and status = 'pending' and role = 'member') then
    raise exception '70 FAIL: valid owner invite did not persist';
  end if;
end $$;
ROLLBACK;
\echo '70 (owner invite allowed)          : PASS  (honest invite path unblocked)'

-- ── Accept: only the invited user (F) flips pending→accepted → SUCCEEDS ───────
BEGIN;
set local role authenticated;
set local "test.uid" = '77777777-7777-7777-7777-777777777777';   -- F (the invitee)
do $$
begin
  update wall_members set status = 'accepted'
   where wall_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
     and user_id = '77777777-7777-7777-7777-777777777777';
  if not exists (select 1 from wall_members
                 where wall_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
                   and user_id = '77777777-7777-7777-7777-777777777777'
                   and status = 'accepted') then
    raise exception '70 FAIL: invitee could not accept their own invite';
  end if;
end $$;
ROLLBACK;
\echo '70 (invitee accepts)               : PASS  (pending→accepted by the invitee)'

-- ── Accept vector: a THIRD party (G) cannot accept F''s invite → NO CHANGE ────
BEGIN;
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';   -- G (not the invitee)
do $$
begin
  -- RLS USING (user_id = auth.uid()) filters F's row out → 0 rows updated.
  update wall_members set status = 'accepted'
   where wall_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
     and user_id = '77777777-7777-7777-7777-777777777777';
  if (select status from wall_members
        where wall_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
          and user_id = '77777777-7777-7777-7777-777777777777') <> 'pending' then
    raise exception '70 FAIL: a third party accepted someone else''s invite';
  end if;
end $$;
ROLLBACK;
\echo '70 (third-party accept)            : PASS  (only the invitee''s own row is updatable)'

-- ── F-B1: accepted member self-grants 'owner' role (status unchanged) → DENIED ─
-- The immutability guard must fire even when the status delta is empty (the guard
-- reorder fix: identity/role check runs ABOVE the unchanged-status early return).
BEGIN;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (accepted member)
do $$
begin
  begin
    update wall_members set role = 'owner'                       -- status left unchanged
     where wall_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
       and user_id = '22222222-2222-2222-2222-222222222222';
  exception when others then null;   -- immutability guard raises; expected
  end;
  if (select role from wall_members
        where wall_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
          and user_id = '22222222-2222-2222-2222-222222222222') <> 'member' then
    raise exception '70 FAIL: accepted member self-escalated to owner role (F-B1)';
  end if;
end $$;
ROLLBACK;
\echo '70 (F-B1 role self-escalation)     : PASS  (role immutable even when status unchanged)'

-- ── F-B1: accepted member re-points wall_id to ANOTHER wall (status unchanged) → DENIED
-- The core fail-open bypass: without the reorder, a status-unchanged wall_id
-- change would early-return past the immutability check and self-grant membership
-- on a wall the member was never invited to.
BEGIN;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (member of W_PS, NOT W_PS2)
do $$
declare rejected boolean := false; v_message text := '';
begin
  begin
    update wall_members set wall_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'  -- W_PS2; status unchanged
     where wall_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
       and user_id = '22222222-2222-2222-2222-222222222222';
  exception when raise_exception then
    rejected := true;
    get stacked diagnostics v_message = message_text;
  end;
  if not rejected or v_message <> 'C2_MEMBER: cannot reassign or re-role a membership' then
    raise exception '70 FAIL: wall relocation did not hit the identity guard precisely: %', v_message;
  end if;
end $$;
reset role;
do $$
begin
  -- Trusted postcondition: the original accepted membership remains intact …
  if not exists (select 1 from wall_members
                 where wall_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
                   and user_id = '22222222-2222-2222-2222-222222222222'
                   and role = 'member' and status = 'accepted') then
    raise exception '70 FAIL: original membership changed during relocation attack (F-B1)';
  end if;
  -- … and no membership was fabricated on W_PS2.
  if exists (select 1 from wall_members
             where wall_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
               and user_id = '22222222-2222-2222-2222-222222222222') then
    raise exception '70 FAIL: member relocated their membership onto another wall (F-B1)';
  end if;
  -- … and B is NOT a member of W_PS2.
  if is_wall_member('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
                    '22222222-2222-2222-2222-222222222222') then
    raise exception '70 FAIL: member self-granted membership on an uninvited wall (F-B1)';
  end if;
end $$;
ROLLBACK;
\echo '70 (F-B1 wall_id self-grant)       : PASS  (wall_id immutable; no cross-wall membership)'

-- ── Transition: no move back to pending (B accepted→pending) → DENIED ─────────
BEGIN;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (accepted member)
do $$
begin
  begin
    update wall_members set status = 'pending'
     where wall_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
       and user_id = '22222222-2222-2222-2222-222222222222';
  exception when others then null;   -- transition guard raises; expected
  end;
  if (select status from wall_members
        where wall_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
          and user_id = '22222222-2222-2222-2222-222222222222') <> 'accepted' then
    raise exception '70 FAIL: a membership was moved back to pending';
  end if;
end $$;
ROLLBACK;
\echo '70 (no backward transition)        : PASS  (accepted cannot revert to pending)'

-- ── Roster SELECT does not recurse and does not leak pending invites ──────────
BEGIN;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (accepted member)
do $$
declare n integer;
begin
  select count(*) into n from wall_members
   where wall_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';   -- completes → no recursion
  if n <> 1 or not exists (
    select 1 from wall_members
     where wall_id='dddddddd-dddd-dddd-dddd-dddddddddddd'
       and user_id=auth.uid() and status='accepted'
  ) then
    raise exception '70 FAIL: accepted member roster boundary incorrect (got %)', n;
  end if;
  if exists (
    select 1 from wall_members
     where wall_id='dddddddd-dddd-dddd-dddd-dddddddddddd'
       and user_id='77777777-7777-7777-7777-777777777777'
  ) then
    raise exception '70 FAIL: pending invite leaked to accepted member';
  end if;
end $$;

set local "test.uid" = '77777777-7777-7777-7777-777777777777';   -- F (pending invitee)
do $$ declare n integer; begin
  select count(*) into n from wall_members
   where wall_id='dddddddd-dddd-dddd-dddd-dddddddddddd';
  if n <> 1 or not exists (
    select 1 from wall_members
     where wall_id='dddddddd-dddd-dddd-dddd-dddddddddddd'
       and user_id=auth.uid() and status='pending'
  ) then
    raise exception '70 FAIL: pending invitee could not read only their own invite (got %)', n;
  end if;
end $$;

set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O (owner)
do $$ declare n integer; begin
  select count(*) into n from wall_members
   where wall_id='dddddddd-dddd-dddd-dddd-dddddddddddd';
  if n <> 2 then
    raise exception '70 FAIL: owner could not read accepted + pending roster (got %)', n;
  end if;
end $$;
ROLLBACK;
\echo '70 (roster read, no recursion)     : PASS  (accepted/pending/owner visibility is scoped)'

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 0009 · walls-row SELECT policy ("walls view") membership disjunct          │
-- ╰─────────────────────────────────────────────────────────────────────────╯
-- 0005 fixed the can_view_wall() HELPER but not the base RLS SELECT policy on
-- the walls TABLE. These assertions exercise a direct `select … from walls`
-- under RLS (not the helper): an accepted member of a PRIVATE SHARED wall must
-- now see the walls row; a non-member must not; public stays open; a PRIVATE
-- PERSONAL wall stays friend-gated (member disjunct is shared-only).

-- ── 0009 (a): accepted member (B) CAN SELECT the private shared walls row ─────
BEGIN;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (accepted member of W_PS)
do $$
declare n integer;
begin
  select count(*) into n from walls where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  if n <> 1 then
    raise exception '0009 FAIL: accepted member cannot SELECT the private shared walls row (got %)', n;
  end if;
end $$;
ROLLBACK;
\echo '0009 (member SELECTs walls row)    : PASS  (private shared wall visible to its member)'

-- ── 0009 (b): non-member (G) CANNOT SELECT the private shared walls row ───────
-- G is not owner, not a friend of O, not a member → fail-closed (0 rows).
BEGIN;
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';   -- G (non-member, non-friend of O)
do $$
declare n integer;
begin
  select count(*) into n from walls where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  if n <> 0 then
    raise exception '0009 FAIL: non-member SELECTed the private shared walls row (got %)', n;
  end if;
end $$;
ROLLBACK;
\echo '0009 (non-member SELECT denied)    : PASS  (fail-closed; 0 rows for non-member)'

-- ── 0009 (c): a PUBLIC shared walls row is SELECTable by anyone (regression) ──
BEGIN;
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';   -- G (unrelated to W_O)
do $$
declare n integer;
begin
  select count(*) into n from walls where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if n <> 1 then
    raise exception '0009 FAIL: public shared walls row not SELECTable by unrelated user (got %)', n;
  end if;
end $$;
ROLLBACK;
\echo '0009 (public walls row open)       : PASS  (public unchanged by member disjunct)'

-- ── 0009 (d): a PRIVATE PERSONAL walls row stays friend-gated ─────────────────
-- A makes her (auto-created) personal wall private, then: a NON-friend (C) sees
-- 0 rows (member disjunct is shared-only, so it cannot leak a personal wall),
-- while a FRIEND (G, A↔G accepted) still sees it. Proves the personal-private
-- path is neither loosened nor broken by 0009.
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A (owner)
update walls set visibility = 'private'
 where owner_id = '11111111-1111-1111-1111-111111111111' and type = 'personal';
-- non-friend of A (C: no A↔C friendship) → must NOT see it
set local "test.uid" = '33333333-3333-3333-3333-333333333333';   -- C (non-friend of A)
do $$
declare n integer;
begin
  select count(*) into n from walls
   where owner_id = '11111111-1111-1111-1111-111111111111' and type = 'personal';
  if n <> 0 then
    raise exception '0009 FAIL: non-friend SELECTed a private PERSONAL walls row (got %)', n;
  end if;
end $$;
-- friend of A (G: A↔G accepted) → must still see it (friend-gate intact)
set local "test.uid" = '88888888-8888-8888-8888-888888888888';   -- G (friend of A)
do $$
declare n integer;
begin
  select count(*) into n from walls
   where owner_id = '11111111-1111-1111-1111-111111111111' and type = 'personal';
  if n <> 1 then
    raise exception '0009 FAIL: friend cannot SELECT a private PERSONAL walls row (got %)', n;
  end if;
end $$;
ROLLBACK;
\echo '0009 (personal-private friend-gate): PASS  (non-friend denied; friend still sees it)'

\echo '── 70_wall_members: ALL PASS (gating + invite/accept vectors + roster + 0009 walls-view) ──'
