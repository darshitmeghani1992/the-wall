-- ════════════════════════════════════════════════════════════════════════════
-- 0016 · One reaction per user per Mark (Master Spec §31)
--
-- §31: "One active reaction per user per Mark. User may add / change / remove."
-- 0001 keyed `mark_reactions` on (mark_id, user_id, EMOJI), which let a single
-- user stack multiple emojis on one Mark — the "reaction de-dup debt". This
-- repoints the primary key to (mark_id, user_id) so a user has at most ONE
-- reaction per Mark; changing it is an UPDATE (upsert), removing it a DELETE.
--
-- Adds a self-only UPDATE policy (changing your reaction wasn't possible before —
-- there was only insert/delete). SELECT/DELETE policies from 0001 are unchanged.
--
-- Additive + idempotent. Does NOT modify 0001–0015 files. Build on top only.
-- ════════════════════════════════════════════════════════════════════════════

-- Collapse any pre-existing multi-emoji rows to a single row per (mark, user),
-- keeping one arbitrary row (ctid tie-break). No-op on a fresh/deduped table.
delete from mark_reactions a
  using mark_reactions b
 where a.mark_id = b.mark_id
   and a.user_id = b.user_id
   and a.ctid    > b.ctid;

-- Swap the primary key from (mark_id, user_id, emoji) → (mark_id, user_id).
alter table mark_reactions drop constraint if exists mark_reactions_pkey;
alter table mark_reactions add  constraint mark_reactions_pkey primary key (mark_id, user_id);

-- Changing your one reaction is an UPDATE — allow it for your own rows only.
drop policy if exists "reactions update self" on mark_reactions;
create policy "reactions update self" on mark_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
