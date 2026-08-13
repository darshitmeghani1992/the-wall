-- ════════════════════════════════════════════════════════════════════════════
-- 0005 · MVP Batch C — Area B: Shared-Wall Member Model (FP-C2 Rev 2 / ADR-009)
--
-- Adds the missing membership model so PRIVATE shared walls are gated by accepted
-- membership. Introduces `wall_members(wall_id,user_id,role,status)` (MVP roles
-- owner/member, status pending→accepted) and `is_wall_member()`, then rewires the
-- two authorization helpers additively:
--   • can_view_wall : public unchanged; PERSONAL-private stays friend-gated;
--                     SHARED becomes member-gated.
--   • can_contribute: keeps 0002's block check + owner/everyone/friends; ADDS a
--                     shared-member contribution disjunct.
-- Invites mirror SEC-001's friendship-invite pattern (owner-only INSERT pinned to
-- pending/member; invited-user-only accept guarded by a transition trigger;
-- owner-or-self DELETE). `is_wall_member` is SECURITY DEFINER so referencing it
-- inside wall_members' own SELECT policy does NOT recurse (same as are_friends).
--
-- Additive and idempotent. Does NOT modify 0001/0002/0003. Build on top only.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Enums (MVP: no admin hierarchy) ──────────────────────────────────────────
do $$ begin
  create type wall_member_role as enum ('owner','member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type wall_member_status as enum ('pending','accepted');
exception when duplicate_object then null; end $$;

-- ── Table ────────────────────────────────────────────────────────────────────
-- Ownership stays sourced from walls.owner_id (no owner membership row required);
-- is_wall_member checks ACCEPTED membership only.
create table if not exists wall_members (
  wall_id    uuid not null references walls(id)      on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       wall_member_role   not null default 'member',
  status     wall_member_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (wall_id, user_id)
);
create index if not exists wall_members_user_idx on wall_members (user_id, status);
alter table wall_members enable row level security;

-- Accepted-membership predicate. SECURITY DEFINER → bypasses RLS on wall_members,
-- so it is safe to reference inside wall_members' own SELECT policy (no recursion).
create or replace function is_wall_member(wid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from wall_members wm
                 where wm.wall_id = wid and wm.user_id = uid and wm.status = 'accepted');
$$;

-- ── RLS (mirrors the SEC-001 friendship-invite pattern) ──────────────────────
-- Roster read: your own rows, the wall owner sees all, members see co-members.
drop policy if exists "wall_members read" on wall_members;
create policy "wall_members read" on wall_members for select to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from walls w where w.id = wall_id and w.owner_id = auth.uid())
         or is_wall_member(wall_id, auth.uid()));           -- SECURITY DEFINER → no recursion

-- Invite: ONLY the wall owner may create a membership, it MUST start pending as
-- 'member' (closes the insert-as-accepted / insert-as-owner escalation vector —
-- same lesson as 0002 F1), AND the target wall MUST be SHARED (F3 tidy: no inert
-- membership rows on personal walls, which is_wall_member never consults).
drop policy if exists "wall_members invite owner" on wall_members;
create policy "wall_members invite owner" on wall_members for insert to authenticated
  with check (exists (select 1 from walls w
                      where w.id = wall_id and w.owner_id = auth.uid() and w.type = 'shared')
              and status = 'pending' and role = 'member');

-- Accept: only the invited user may touch their own row (transition trigger
-- enforces pending→accepted only).
drop policy if exists "wall_members accept self" on wall_members;
create policy "wall_members accept self" on wall_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Remove/leave: the member themselves, or the wall owner.
drop policy if exists "wall_members remove" on wall_members;
create policy "wall_members remove" on wall_members for delete to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from walls w where w.id = wall_id and w.owner_id = auth.uid()));

-- Explicit client grants (Supabase grants base DML by default; explicit for
-- reproducibility from source — same as 0002's blocks grants).
grant select, insert, update, delete on wall_members to authenticated;

-- ── Transition guard (mirror friendships_guard_transition, 0002) ─────────────
-- Only pending→accepted, no backward move, identity/role immutable, and only the
-- invited user may accept.
create or replace function wall_members_guard_transition() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Identity/role are immutable — checked FIRST, ABOVE the unchanged-status early
  -- return, so a status-unchanged UPDATE that mutates wall_id/user_id/role cannot
  -- slip past it (fail-open bypass fix, review F-B1: an accepted member could else
  -- `update … set wall_id=<other private shared wall>` with status unchanged and
  -- self-grant membership on a wall they were never invited to). ANY wall_id /
  -- user_id / role change is rejected regardless of the status delta.
  if new.wall_id <> old.wall_id or new.user_id <> old.user_id or new.role <> old.role then
    raise exception 'C2_MEMBER: cannot reassign or re-role a membership';
  end if;
  if new.status is not distinct from old.status then return new; end if;
  if old.status = 'pending' and new.status = 'accepted' then
    if auth.uid() <> old.user_id then
      raise exception 'C2_MEMBER: only the invited user may accept a wall invite'; end if;
  elsif new.status = 'pending' then
    raise exception 'C2_MEMBER: cannot move a membership back to pending';
  end if;
  return new;
end $$;

drop trigger if exists wall_members_transition on wall_members;
create trigger wall_members_transition before update on wall_members
  for each row execute function wall_members_guard_transition();

-- ── Wiring into the two authorization helpers (create-or-replace, additive) ──
-- can_view_wall: public unchanged; PERSONAL-private stays friend-gated (ADR-009
-- refinement: 0001/0002 gated ALL private walls by friendship); SHARED becomes
-- member-gated. Prior body is recoverable from 0001 (reversibility, Constitution §7).
create or replace function can_view_wall(wid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from walls w
    where w.id = wid
      and (
        w.visibility = 'public'
        or w.owner_id = uid
        or (w.type = 'personal' and w.visibility = 'private' and are_friends(w.owner_id, uid))
        or (w.type = 'shared'   and is_wall_member(wid, uid))
      )
  );
$$;

-- can_contribute: keep 0002's block check + owner/everyone/friends; ADD shared-
-- member contribution. Prior body recoverable from 0002.
create or replace function can_contribute(wid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from walls w
    where w.id = wid
      and not is_blocked(w.owner_id, uid)
      and (
        w.owner_id = uid
        or (w.contribution_policy = 'everyone')
        or (w.contribution_policy = 'friends' and are_friends(w.owner_id, uid))
        or (w.type = 'shared' and is_wall_member(wid, uid))
      )
  );
$$;
