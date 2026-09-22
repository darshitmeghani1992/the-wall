-- ════════════════════════════════════════════════════════════════════════════
-- 0015 · Approved Writers (Master Spec §15, §50)
--
-- The 'selected' contribution policy ("Approved people") existed in the enum
-- (0001) but was never wired: `can_contribute` had no 'selected' branch, so such
-- walls were effectively owner-only. This adds the `approved_writers` table and
-- the branch.
--
-- Rules (§50):
--   • only the wall OWNER manages the approved list (add/remove)
--   • an approved writer may write even without friendship — BUT
--   • **private visibility wins**: on a PRIVATE wall a non-friend approved writer
--     still cannot write (approved-writer mode is practically useful on Public
--     walls unless the user is also a friend)
--   • approval does NOT grant friendship, follow, or private-Wall VIEWING
--     (can_view_wall is untouched — approval is write-only)
--   • blocking still overrides (can't add or write across a block)
--
-- Additive + idempotent. Does NOT modify 0001–0014. Build on top only.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists approved_writers (
  wall_id  uuid not null references walls(id)      on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (wall_id, user_id)
);
create index if not exists approved_writers_user_idx on approved_writers (user_id);

alter table approved_writers enable row level security;

-- Read: the wall owner (to manage) or the approved user (to know they're approved).
drop policy if exists "approved_writers read" on approved_writers;
create policy "approved_writers read" on approved_writers for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from walls w where w.id = wall_id and w.owner_id = auth.uid())
  );

-- Add: wall owner only; not the owner themselves; not across a block.
drop policy if exists "approved_writers insert owner" on approved_writers;
create policy "approved_writers insert owner" on approved_writers for insert to authenticated
  with check (
    exists (select 1 from walls w where w.id = wall_id and w.owner_id = auth.uid())
    and user_id <> auth.uid()
    and not is_blocked(auth.uid(), user_id)
  );

-- Remove: wall owner only.
drop policy if exists "approved_writers delete owner" on approved_writers;
create policy "approved_writers delete owner" on approved_writers for delete to authenticated
  using (exists (select 1 from walls w where w.id = wall_id and w.owner_id = auth.uid()));

-- ── Helper ───────────────────────────────────────────────────────────────────
create or replace function is_approved_writer(wid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from approved_writers a where a.wall_id = wid and a.user_id = uid);
$$;

-- ── Extend can_contribute with the 'selected' branch (preserves 0013 gates) ──
-- §50 "private visibility wins": the 'selected' branch additionally requires the
-- wall be public OR the writer be a friend, so a non-friend approved writer cannot
-- write to a private wall.
create or replace function can_contribute(wid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from walls w
    where w.id = wid
      and not is_blocked(w.owner_id, uid)
      and is_active_account(uid)
      and not (w.type = 'personal' and not is_active_account(w.owner_id))
      and (
        w.owner_id = uid
        or (w.contribution_policy = 'everyone')
        or (w.contribution_policy = 'friends' and are_friends(w.owner_id, uid))
        or (w.contribution_policy = 'selected' and is_approved_writer(wid, uid)
            and (w.visibility = 'public' or are_friends(w.owner_id, uid)))
        or (w.type = 'shared' and is_wall_member(wid, uid))
      )
  );
$$;
