-- ════════════════════════════════════════════════════════════════════════════
-- 0012 · Mark lifecycle enforcement — sender edit/delete window + owner removal
--        quota (Master Spec §32, §33; adversarial checklist §100)
--
-- Two server-authoritative rules the prototype never enforced (both are
-- API-abuse vectors, so they live in the trigger/RLS, not the client):
--
--   §32 Sender edit/delete window — the AUTHOR may edit a Mark's content or
--       delete it only within 10 MINUTES of creation. Server time (now()) is
--       authoritative; the client clock is never trusted. Moderation/reporting
--       by the owner is unaffected.
--
--   §33 Owner normal-removal quota — the wall OWNER removes received Marks by
--       moving them to status='removed'. To preserve authenticity, 'normal'
--       removals are capped at 3 per rolling 30 days; 'safety' and 'moderation'
--       removals are NEVER rate-limited (safety always wins). Every removal
--       stamps who/when for accountability.
--
-- Also closes a quota bypass: the 0001 DELETE policy let a wall owner HARD-delete
-- any Mark on their wall, sidestepping the soft-remove quota. Owners now remove
-- via status='removed' (quota-enforced); the DELETE path is author-only within
-- the edit window. (Wall/account deletion still cascades via the FK, unaffected.)
--
-- Additive + idempotent. Does NOT modify 0001–0011. Build on top only.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Removal accounting columns ───────────────────────────────────────────────
alter table marks add column if not exists removed_by     uuid references auth.users(id) on delete set null;
alter table marks add column if not exists removed_at      timestamptz;
alter table marks add column if not exists removal_reason  text;
do $$ begin
  alter table marks add constraint marks_removal_reason_chk
    check (removal_reason is null or removal_reason in ('normal','safety','moderation'));
exception when duplicate_object then null; end $$;

-- Index the quota lookup (owner's normal removals within the rolling window).
create index if not exists marks_removed_by_at_idx on marks (removed_by, removed_at)
  where removal_reason = 'normal';

-- ── Enhanced moderation guard: keeps the SEC-001 F5 checks, adds §32 + §33 ────
-- SECURITY INVOKER (default) so current_user reflects the caller and auth.uid()
-- is the real user — a DEFINER function would defeat the service_role branch.
create or replace function marks_guard_moderation()
returns trigger language plpgsql as $$
declare
  v_is_owner        boolean;
  v_privileged      boolean;
  v_is_author       boolean;
  v_content_changed boolean;
  v_normal_count    integer;
begin
  v_privileged := current_user in ('service_role','postgres');   -- protected moderation path
  v_is_owner   := exists (select 1 from walls w where w.id = new.wall_id and w.owner_id = auth.uid());
  v_is_author  := old.author_id is not null and old.author_id = auth.uid();

  -- [SEC-001 F5] moderation columns (pinned/status): owner or privileged only.
  if (new.pinned is distinct from old.pinned) or (new.status is distinct from old.status) then
    if not (v_is_owner or v_privileged) then
      raise exception 'SEC001_MODERATION: only the wall owner may pin/approve/change status';
    end if;
  end if;

  -- [SEC-001 F5] an author may never move the mark or reassign authorship.
  if (new.wall_id <> old.wall_id) or (new.author_id is distinct from old.author_id) then
    if not (v_is_owner or v_privileged) then
      raise exception 'SEC001_MODERATION: cannot reassign a mark';
    end if;
  end if;

  -- [§32] sender edit window — an author editing CONTENT (not the owner/privileged
  -- moderation path) may only do so within 10 minutes of creation.
  v_content_changed := (new.text is distinct from old.text)
                    or (new.color is distinct from old.color)
                    or (new.media_url is distinct from old.media_url)
                    or (new.payload is distinct from old.payload);
  if v_content_changed and v_is_author and not (v_is_owner or v_privileged) then
    if now() >= old.created_at + interval '10 minutes' then
      raise exception 'MARK_EDIT_WINDOW: the 10-minute edit window has closed';
    end if;
  end if;

  -- [§33] owner removal quota — when a mark first moves to 'removed':
  if new.status = 'removed' and old.status is distinct from 'removed' then
    if v_is_owner and not v_privileged then
      if new.removal_reason is null then
        raise exception 'MARK_REMOVAL_REASON: a removal reason is required';
      end if;
      -- stamp accountability server-side (ignore any client-supplied values).
      new.removed_by := auth.uid();
      new.removed_at := now();
      if new.removal_reason = 'normal' then
        select count(*) into v_normal_count from marks
          where removed_by = auth.uid()
            and removal_reason = 'normal'
            and removed_at > now() - interval '30 days';
        if v_normal_count >= 3 then
          raise exception 'MARK_REMOVAL_QUOTA: normal removal limit (3 per 30 days) reached — use a safety removal for abuse';
        end if;
      end if;
    end if;
  end if;

  return new;
end $$;
-- (trigger binding `marks_moderation` from 0002 is unchanged; body swapped above.)

-- ── §32 delete window + close the owner hard-delete quota bypass ──────────────
-- Author may DELETE only within the 10-minute window. The owner NO LONGER has a
-- hard-delete path (they soft-remove via status='removed', which the quota
-- governs). Cascade deletes from wall/account removal are unaffected (FK, not RLS).
drop policy if exists "marks delete author or owner" on marks;
create policy "marks delete author within window" on marks for delete to authenticated
  using (
    author_id = auth.uid()
    and now() < created_at + interval '10 minutes'
  );
