-- ════════════════════════════════════════════════════════════════════════════
-- 0009_walls_view_membership.sql · C2 walls-row SELECT gap close (forward-only)
--
-- 0005 rewired the can_view_wall() HELPER to member-gate PRIVATE shared walls,
-- but the base RLS SELECT policy on the `walls` table itself ("walls view",
-- 0001) was never updated: it still admitted only public / owner / private-and-
-- friends. Consequence: an ACCEPTED member of a PRIVATE SHARED wall could pass
-- can_view_wall() (used for marks/derived reads) yet get 0 rows when SELECTing
-- the walls row directly — the wall's own metadata (name, settings) was
-- unreachable to its members. This adds the membership disjunct so a member can
-- read the walls row, WITHOUT loosening any other case.
--
-- Fix: drop+recreate "walls view" with an added
--   (visibility='private' and type='shared' and is_wall_member(id, auth.uid()))
-- disjunct. public unchanged; owner unchanged; personal-private stays
-- friend-gated (the existing are_friends disjunct); a non-member of a private
-- shared wall who is neither owner nor friend still gets 0 rows (fail-closed).
-- is_wall_member (0005) is SECURITY DEFINER → bypasses wall_members RLS → no
-- policy recursion. Forward-only: 0001 is NOT edited. Idempotent
-- (drop policy if exists + create).
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "walls view" on walls;
create policy "walls view" on walls for select
  using (
    visibility = 'public'
    or owner_id = auth.uid()
    or (visibility = 'private' and are_friends(owner_id, auth.uid()))
    or (visibility = 'private' and type = 'shared' and is_wall_member(id, auth.uid()))
  );
