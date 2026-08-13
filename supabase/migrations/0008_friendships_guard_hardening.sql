-- ════════════════════════════════════════════════════════════════════════════
-- 0008_friendships_guard_hardening.sql · SEC-001 fail-open close (forward-only)
--
-- Hardens friendships_guard_transition() (originally 0002 F1) against a
-- status-unchanged pair reassignment. The 0002 body evaluated the unchanged-
-- status early return (`if new.status is not distinct from old.status then
-- return new`) BEFORE the pair-identity immutability check, so an UPDATE that
-- left `status` untouched while reassigning `addressee_id` (or `requester_id`)
-- slipped past the guard: an accepted friendship's other party could be swapped
-- out to manufacture a non-consensual friendship (A↔G accepted, A rewrites
-- addressee G→C ⇒ are_friends(A,C) becomes true with no request/accept by C).
--
-- Fix (mirror of the 0005 wall_members_guard_transition F-B1 reorder): move the
-- pair-identity immutability check to the TOP, ABOVE the early return, so ANY
-- requester_id/addressee_id reassignment is rejected regardless of the status
-- delta. Legitimate transitions are preserved unchanged: addressee-only
-- pending→accepted, no backward move to pending, and identity-unchanged
-- status-only / no-op accepts (which now fall through the top check and hit the
-- same early-return / accept logic as before).
--
-- Forward-only: 0002 is NOT edited. This create-or-replace supersedes the 0002
-- body; the `friendships_transition` trigger created in 0002 already calls this
-- function by name, so no trigger change is needed. SECURITY DEFINER +
-- search_path=public preserved. Idempotent (create or replace).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function friendships_guard_transition()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Pair identity is immutable — checked FIRST, ABOVE the unchanged-status early
  -- return, so a status-unchanged UPDATE that mutates requester_id/addressee_id
  -- cannot slip past it (fail-open close: else an accepted friendship's other
  -- party could be reassigned to fabricate a non-consensual friendship). ANY
  -- requester_id / addressee_id change is rejected regardless of the status delta.
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'SEC001_TRANSITION: cannot reassign a friendship pair';
  end if;
  if new.status is not distinct from old.status then return new; end if;
  if old.status = 'pending' and new.status = 'accepted' then
    if auth.uid() <> old.addressee_id then
      raise exception 'SEC001_TRANSITION: only the addressee may accept a friend request';
    end if;
  elsif new.status = 'pending' then
    raise exception 'SEC001_TRANSITION: cannot move a friendship back to pending';
  end if;
  return new;
end $$;

-- Trigger (0002 `friendships_transition`) already binds this function; re-assert
-- idempotently so the guard is wired even if applied out of the usual order.
drop trigger if exists friendships_transition on friendships;
create trigger friendships_transition before update on friendships
  for each row execute function friendships_guard_transition();
