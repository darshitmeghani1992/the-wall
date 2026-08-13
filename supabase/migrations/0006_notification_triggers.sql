-- ════════════════════════════════════════════════════════════════════════════
-- 0006 · MVP Batch C — Area C: Notification Triggers (FP-C2 Rev 2 / ADR-010)
--
-- Populates the existing `notifications` table (0001; deliberately NO client
-- insert policy) via SECURITY DEFINER AFTER triggers, for the six Batch-C events.
-- Each trigger runs as the table owner so it can insert on the recipient's behalf
-- despite the missing client insert policy (that gap is intentional and bypassed
-- only by these audited paths). Structurally leak-proof:
--   • notifications has NO content column → secret content cannot leak
--   • actor_id is NULL for anonymous marks → the mark trigger cannot de-anonymize
--   • the reaction trigger resolves the TRUE author of an anonymous mark from
--     anonymous_mark_authors (moderator side table) and notifies THAT author about
--     their own mark — revealing nothing hidden, and never exposing the author to
--     anyone else.
-- Self-events are skipped via auth.uid() (correct even when the base row's
-- author_id is NULL because an owner posted anonymously on their own wall).
--
-- DEPENDS ON 0005 (wall_members must exist for the invite trigger; the mark
-- trigger classifies personal vs shared by walls.type). References
-- anonymous_mark_authors (0002). Additive and idempotent. Build on top only.
-- ════════════════════════════════════════════════════════════════════════════

-- ── kind vocabulary (canonical, reconciled with C1; ADR-010) ─────────────────
-- Enforced by an additive CHECK (only triggers write, so this is safe; an enum
-- type change was rejected as more invasive). `comment` is reserved for forward
-- compat (no trigger this cycle). Idempotent via a duplicate_object guard.
do $$ begin
  alter table notifications
    add constraint notifications_kind_ck
    check (kind in ('mark_left','shared_wall_mark','reaction','friend_request',
                    'friend_accepted','shared_wall_invite','comment'));
exception when duplicate_object then null; end $$;

-- ── Mark left (marks AFTER INSERT) ───────────────────────────────────────────
-- Recipient: the wall owner. kind: mark_left (personal) / shared_wall_mark
-- (shared), by walls.type. Skip self (auth.uid() = owner). actor_id: the true
-- author (auth.uid()), or NULL for an anonymous mark (no de-anon).
create or replace function notify_mark_left() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_type wall_type; v_actor uuid;
begin
  select owner_id, type into v_owner, v_type from walls where id = new.wall_id;
  if v_owner is null then return new; end if;
  if auth.uid() = v_owner then return new; end if;         -- skip self
  v_actor := case when new.anonymous then null else auth.uid() end;
  insert into notifications (user_id, actor_id, kind, mark_id, wall_id)
  values (v_owner, v_actor,
          case when v_type = 'shared' then 'shared_wall_mark' else 'mark_left' end,
          new.id, new.wall_id);
  return new;
end $$;

drop trigger if exists marks_notify on marks;
create trigger marks_notify after insert on marks
  for each row execute function notify_mark_left();

-- ── Reaction (mark_reactions AFTER INSERT) ───────────────────────────────────
-- Recipient: the TRUE mark author (from anonymous_mark_authors for anon marks,
-- else marks.author_id). actor_id: the reactor. Skip if author unknown or author
-- reacted to their own mark. Notifies the author about their own mark only → no
-- de-anon, no leak.
create or replace function notify_reaction() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_anon boolean; v_wall uuid;
begin
  select author_id, anonymous, wall_id into v_author, v_anon, v_wall
    from marks where id = new.mark_id;
  if v_anon then
    select author_id into v_author from anonymous_mark_authors where mark_id = new.mark_id;
  end if;
  if v_author is null then return new; end if;             -- unknown author → skip
  if v_author = new.user_id then return new; end if;       -- self-reaction → skip
  insert into notifications (user_id, actor_id, kind, mark_id, wall_id)
  values (v_author, new.user_id, 'reaction', new.mark_id, v_wall);
  return new;
end $$;

drop trigger if exists mark_reactions_notify on mark_reactions;
create trigger mark_reactions_notify after insert on mark_reactions
  for each row execute function notify_reaction();

-- ── Friend request (friendships AFTER INSERT) ────────────────────────────────
-- Recipient: the addressee. actor_id: the requester. (Pair guaranteed distinct by
-- the 0001 CHECK.)
create or replace function notify_friend_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, actor_id, kind)
  values (new.addressee_id, new.requester_id, 'friend_request');
  return new;
end $$;

drop trigger if exists friendships_notify_insert on friendships;
create trigger friendships_notify_insert after insert on friendships
  for each row execute function notify_friend_request();

-- ── Friend accepted (friendships AFTER UPDATE) ───────────────────────────────
-- Recipient: the original requester. actor_id: the addressee (who accepted).
-- Only on the pending→accepted transition.
create or replace function notify_friend_accepted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    insert into notifications (user_id, actor_id, kind)
    values (new.requester_id, new.addressee_id, 'friend_accepted');
  end if;
  return new;
end $$;

drop trigger if exists friendships_notify_update on friendships;
create trigger friendships_notify_update after update on friendships
  for each row execute function notify_friend_accepted();

-- ── Shared-wall invite (wall_members AFTER INSERT) ───────────────────────────
-- Recipient: the invitee. actor_id: the owner who invited (auth.uid()). Only for
-- a pending invite row.
create or replace function notify_wall_invite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then
    insert into notifications (user_id, actor_id, kind, wall_id)
    values (new.user_id, auth.uid(), 'shared_wall_invite', new.wall_id);
  end if;
  return new;
end $$;

drop trigger if exists wall_members_notify on wall_members;
create trigger wall_members_notify after insert on wall_members
  for each row execute function notify_wall_invite();
