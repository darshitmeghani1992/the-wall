-- ════════════════════════════════════════════════════════════════════════════
-- 0013 · Account deactivation / deletion lifecycle (Master Spec §82)
--
-- A user may deactivate their account (30-day recoverable window). While
-- deactivated, the account is "not normally discoverable/interactable" (§82):
--   • their PERSONAL Wall is not viewable by anyone,
--   • no one may contribute to it,
--   • a deactivated user may not contribute anywhere,
--   • they cannot be sent friend requests,
--   • they are excluded from people search (client query).
-- Reactivating (sign back in within the window) restores everything.
--
-- Blast-radius is kept minimal by gating the two SECURITY DEFINER chokepoints that
-- already centralise visibility/contribution (can_view_wall / can_contribute) plus
-- the friendships-insert policy — rather than hiding the profile ROW (which would
-- break author display on existing Marks). SHARED Walls a deactivated user happens
-- to own are deliberately NOT gated on owner-active (their members must keep
-- access); Shared-Wall ownership is handled at FINAL deletion, not at deactivation.
--
-- Final 30-day purge (hard delete + Shared-Wall ownership transfer/delete, §43/§82)
-- needs a scheduler and is a hosted/pg_cron deploy task — see docs/BUILD_STATUS.md.
--
-- Additive + idempotent. Does NOT modify 0001–0012. Build on top only.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Lifecycle columns on profiles ────────────────────────────────────────────
alter table profiles add column if not exists account_status text not null default 'active';
do $$ begin
  alter table profiles add constraint profiles_account_status_chk
    check (account_status in ('active','deactivated'));
exception when duplicate_object then null; end $$;
alter table profiles add column if not exists deactivated_at timestamptz;

-- ── Helper: is this account active? ──────────────────────────────────────────
-- SECURITY DEFINER + stable, mirroring are_friends/is_blocked. A missing profile
-- row resolves to NOT active (fail-closed). Used inside the gated chokepoints.
create or replace function is_active_account(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = uid and p.account_status = 'active');
$$;

-- ── Re-gate can_view_wall (preserves 0005 logic; adds personal-deactivated guard) ─
-- A PERSONAL Wall owned by a deactivated account is viewable by no one. Public and
-- private personal walls of ACTIVE owners, and all SHARED walls, are unchanged.
create or replace function can_view_wall(wid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from walls w
    where w.id = wid
      and not (w.type = 'personal' and not is_active_account(w.owner_id))
      and (
        w.visibility = 'public'
        or w.owner_id = uid
        or (w.type = 'personal' and w.visibility = 'private' and are_friends(w.owner_id, uid))
        or (w.type = 'shared'   and is_wall_member(wid, uid))
      )
  );
$$;

-- ── Re-gate can_contribute (preserves 0005 logic; adds active-account guards) ──
-- A deactivated user may not contribute anywhere; and no one may contribute to a
-- deactivated user's PERSONAL Wall. Shared-wall contribution by members is
-- unaffected by the shared wall's owner being deactivated.
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
        or (w.type = 'shared' and is_wall_member(wid, uid))
      )
  );
$$;

-- ── Friend requests: not to/from a deactivated account ───────────────────────
drop policy if exists "friendships insert requester" on friendships;
create policy "friendships insert requester" on friendships for insert to authenticated
  with check (
    requester_id = auth.uid()
    and status = 'pending'
    and not is_blocked(auth.uid(), addressee_id)
    and is_active_account(auth.uid())
    and is_active_account(addressee_id)
  );

-- ── Self-service deactivate / reactivate ─────────────────────────────────────
-- SECURITY DEFINER, self-only via auth.uid(); stamps deactivated_at so a purge job
-- can compute the 30-day window. (The `profiles update self` policy already lets a
-- user set their own status, but these give a clean API and correct stamping.)
create or replace function deactivate_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  update profiles set account_status = 'deactivated', deactivated_at = now()
    where id = auth.uid();
end $$;

create or replace function reactivate_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  update profiles set account_status = 'active', deactivated_at = null
    where id = auth.uid();
end $$;

revoke all on function deactivate_account() from public;
revoke all on function reactivate_account() from public;
grant execute on function deactivate_account() to authenticated;
grant execute on function reactivate_account() to authenticated;
