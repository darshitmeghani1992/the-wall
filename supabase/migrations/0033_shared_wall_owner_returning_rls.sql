-- 0033 · Shared-Wall owner INSERT ... RETURNING RLS fix (FP-C2 / FP-SHARED-001).
--
-- Hosted staging PG17 reproduced a user-facing failure: `INSERT INTO walls ...
-- RETURNING *` by an authenticated active owner fails 42501 even though a
-- non-RETURNING INSERT succeeds. The SELECT RLS helper queries walls to locate
-- a row; during RETURNING, the newly inserted row cannot be seen by that helper
-- from the current statement snapshot. The client createSharedWall() relies on
-- `.insert(...).select('*').single()`, so all Shared-Wall creation was blocked.
--
-- Preserve exactly the existing canonical RLS helper for other actors. Add
-- one strictly narrower row-local predicate: current ACTIVE owner of this row
-- can see it, including during INSERT RETURNING. This does not let unauthenticated,
-- deactivated, unrelated, or blocked non-owner users access a Wall.
--
-- Idempotent, reversible by reinstating prior `current_user_can_view_wall(id)`
-- predicate. No data mutation; tested against isolated hosted staging with a
-- three-actor private Shared-Wall transaction and complete ROLLBACK.

drop policy if exists "walls view canonical" on public.walls;
create policy "walls view canonical" on public.walls for select to authenticated
  using (
    (owner_id = (select auth.uid()) and public.current_user_is_active_account())
    or public.current_user_can_view_wall(id)
  );
