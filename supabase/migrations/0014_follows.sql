-- ════════════════════════════════════════════════════════════════════════════
-- 0014 · Followers (Master Spec §17, §66)
--
-- Following is a ONE-WAY relationship, distinct from friendship (§3.3), and only
-- relevant to PUBLIC Personal Walls (§17). A follow grants NO write permission and
-- never bypasses privacy or blocking. Rules:
--   • self-only insert/delete (you follow/unfollow as yourself)
--   • no self-follow, no duplicates (PK + CHECK)
--   • target's Personal Wall must be PUBLIC to follow (§17)
--   • cannot follow across a block (either direction), or a deactivated account,
--     and a deactivated account cannot follow (§51, §82)
--   • blocking removes any existing follow rows both ways (§51 "follow removed")
--
-- Following NEVER grants contribution: `can_contribute` is unchanged, so a follower
-- who is not a friend still cannot write to a friends-only Wall (proved in tests).
-- Follower/following COUNTS are world-readable (non-sensitive, §106).
--
-- Additive + idempotent. Does NOT modify 0001–0013. Build on top only.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint follows_no_self check (follower_id <> followed_id)
);
create index if not exists follows_followed_idx on follows (followed_id);

alter table follows enable row level security;

-- Counts are public (profiles show follower/following counts, §106).
drop policy if exists "follows view" on follows;
create policy "follows view" on follows for select using (true);

-- Follow: self only; target Personal Wall must be public; not blocked either way;
-- both accounts active. (Self-follow also blocked by the table CHECK.)
drop policy if exists "follows insert self" on follows;
create policy "follows insert self" on follows for insert to authenticated
  with check (
    follower_id = auth.uid()
    and follower_id <> followed_id
    and not is_blocked(auth.uid(), followed_id)
    and is_active_account(auth.uid())
    and is_active_account(followed_id)
    and exists (
      select 1 from walls w
      where w.owner_id = followed_id and w.type = 'personal' and w.visibility = 'public'
    )
  );

-- Unfollow: self only.
drop policy if exists "follows delete self" on follows;
create policy "follows delete self" on follows for delete to authenticated
  using (follower_id = auth.uid());

-- ── Block → remove follows both directions (§51) ─────────────────────────────
-- Blocking is otherwise enforced dynamically (is_blocked in are_friends/
-- can_contribute), but a follow ROW is state that should be torn down so counts
-- and "following" state don't survive a block. SECURITY DEFINER so it can delete
-- regardless of the blocker's row-level follow privileges.
create or replace function blocks_remove_follows()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from follows
   where (follower_id = new.blocker_id and followed_id = new.blocked_id)
      or (follower_id = new.blocked_id and followed_id = new.blocker_id);
  return new;
end $$;

drop trigger if exists blocks_remove_follows on blocks;
create trigger blocks_remove_follows after insert on blocks
  for each row execute function blocks_remove_follows();
