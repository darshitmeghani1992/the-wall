\set ON_ERROR_STOP on

-- BETA-P0: a removed Shared Wall user's identity is visible only to the owner
-- through list_removed_shared_wall_members. Members (accepted or pending),
-- removed users, unrelated people and blocked people must receive no rows.
-- Existing SECURITY DEFINER RPC and schema are unchanged. Disposable DB only.
BEGIN;
INSERT INTO public.walls(id,owner_id,type,name,visibility,open_join)
VALUES ('75000000-0000-4000-8000-000000000001',
        '44444444-4444-4444-4444-444444444444',
        'shared','Private removed-member roster','private',false);
INSERT INTO public.wall_members(wall_id,user_id,role,status) VALUES
 ('75000000-0000-4000-8000-000000000001',
  '22222222-2222-2222-2222-222222222222','member','accepted'),
 ('75000000-0000-4000-8000-000000000001',
  '77777777-7777-7777-7777-777777777777','member','pending'),
 ('75000000-0000-4000-8000-000000000001',
  '88888888-8888-8888-8888-888888888888','member','accepted');

-- Flush fixture INSERT events while O still owns the Wall and G is still
-- accepted. Otherwise deferred triggers replay the historical B/G INSERT
-- after B becomes owner and G is removed, misclassifying correct final state.
-- Restore deferral so the real owner-transfer invariant is checked below.
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

SET LOCAL ROLE authenticated;
SET LOCAL "test.uid"='44444444-4444-4444-4444-444444444444'; -- actual owner O
DO $$
DECLARE removal jsonb;
BEGIN
  removal := public.remove_shared_wall_member(
    '75000000-0000-4000-8000-000000000001',
    '88888888-8888-8888-8888-888888888888');
  IF removal->>'status' <> 'removed' THEN
    RAISE EXCEPTION '75 FAIL: owner could not create removal fixture %',removal;
  END IF;
  IF (SELECT count(*) FROM public.list_removed_shared_wall_members(
      '75000000-0000-4000-8000-000000000001')) <> 1
    OR NOT EXISTS(
      SELECT 1 FROM public.list_removed_shared_wall_members(
        '75000000-0000-4000-8000-000000000001') r
      WHERE r.user_id='88888888-8888-8888-8888-888888888888'
        AND r.removed_at IS NOT NULL
    ) THEN
    RAISE EXCEPTION '75 FAIL: true owner must see exactly the removed member';
  END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL "test.uid"='22222222-2222-2222-2222-222222222222'; -- accepted B
DO $$
BEGIN
  IF NOT public.current_user_can_view_wall(
      '75000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION '75 FAIL: accepted member cannot view wall precondition';
  END IF;
  IF EXISTS (SELECT 1 FROM public.list_removed_shared_wall_members(
      '75000000-0000-4000-8000-000000000001')) THEN
    RAISE EXCEPTION '75 FAIL: accepted member enumerated removed identities';
  END IF;
END $$;
SET LOCAL "test.uid"='77777777-7777-7777-7777-777777777777'; -- pending F
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.list_removed_shared_wall_members(
      '75000000-0000-4000-8000-000000000001')) THEN
    RAISE EXCEPTION '75 FAIL: pending invitee enumerated removed identities';
  END IF;
END $$;
SET LOCAL "test.uid"='88888888-8888-8888-8888-888888888888'; -- removed G
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.list_removed_shared_wall_members(
      '75000000-0000-4000-8000-000000000001')) THEN
    RAISE EXCEPTION '75 FAIL: removed member enumerated removed identities';
  END IF;
END $$;
SET LOCAL "test.uid"='11111111-1111-1111-1111-111111111111'; -- unrelated A
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.list_removed_shared_wall_members(
      '75000000-0000-4000-8000-000000000001')) THEN
    RAISE EXCEPTION '75 FAIL: unrelated user enumerated removed identities';
  END IF;
END $$;
SET LOCAL "test.uid"='33333333-3333-3333-3333-333333333333'; -- blocked by O
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.list_removed_shared_wall_members(
      '75000000-0000-4000-8000-000000000001')) THEN
    RAISE EXCEPTION '75 FAIL: blocked user enumerated removed identities';
  END IF;
END $$;
RESET ROLE;

-- Owner-only visibility must not depend on a stale authenticated identity.
SET LOCAL ROLE authenticated;
SET LOCAL "test.uid"='44444444-4444-4444-4444-444444444444';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.list_removed_shared_wall_members(
      '75000000-0000-4000-8000-000000000001')) <> 1 THEN
    RAISE EXCEPTION '75 FAIL: owner lost own removed-member record';
  END IF;
END $$;
RESET ROLE;

-- A successful transfer changes the identity authorized to read historical
-- removal records immediately. The former owner becomes an accepted member,
-- but membership alone must never grant access to removal history.
SET LOCAL ROLE authenticated;
SET LOCAL "test.uid"='44444444-4444-4444-4444-444444444444'; -- O, current owner
DO $roster_transfer$
BEGIN
  IF NOT public.transfer_shared_wall_ownership(
      '75000000-0000-4000-8000-000000000001',
      '22222222-2222-2222-2222-222222222222') THEN
    RAISE EXCEPTION '75 FAIL: legitimate owner transfer was denied';
  END IF;
END $roster_transfer$;
RESET ROLE;
-- Evaluate deferred owner/member constraints at the transfer boundary,
-- rather than letting an invalid final state disappear on ROLLBACK.
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

SET LOCAL ROLE authenticated;
SET LOCAL "test.uid"='22222222-2222-2222-2222-222222222222'; -- B, new owner
DO $new_roster_owner$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM public.walls w
      WHERE w.id='75000000-0000-4000-8000-000000000001'
        AND w.owner_id=auth.uid()
  ) THEN
    RAISE EXCEPTION '75 FAIL: ownership did not transfer to accepted member';
  END IF;
  IF (SELECT count(*) FROM public.list_removed_shared_wall_members(
      '75000000-0000-4000-8000-000000000001')) <> 1
     OR NOT EXISTS (
       SELECT 1 FROM public.list_removed_shared_wall_members(
         '75000000-0000-4000-8000-000000000001') r
       WHERE r.user_id='88888888-8888-8888-8888-888888888888'
         AND r.removed_at IS NOT NULL
     ) THEN
    RAISE EXCEPTION '75 FAIL: new owner cannot see existing removal history';
  END IF;
END $new_roster_owner$;
SET LOCAL "test.uid"='44444444-4444-4444-4444-444444444444'; -- O, former owner
DO $former_roster_owner$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM public.wall_members wm
      WHERE wm.wall_id='75000000-0000-4000-8000-000000000001'
        AND wm.user_id=auth.uid() AND wm.status='accepted'
  ) OR NOT public.current_user_can_view_wall(
      '75000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION '75 FAIL: former owner lost legitimate member access';
  END IF;
  IF EXISTS (
      SELECT 1 FROM public.list_removed_shared_wall_members(
        '75000000-0000-4000-8000-000000000001')
  ) THEN
    RAISE EXCEPTION '75 FAIL: former owner retained sensitive roster access';
  END IF;
END $former_roster_owner$;
RESET ROLE;
ROLLBACK;
\echo '75 (removed roster + ownership transfer privacy): PASS (disposable SQL, not hosted JWT)'
