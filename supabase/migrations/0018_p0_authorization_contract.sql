-- ════════════════════════════════════════════════════════════════════════
-- 0018 · P0 canonical authorization contract (Package A1)
--
-- This is the compatibility phase before private Mark media (0020/0021): app
-- clients may create canonical TEXT Marks only. Legacy public Mark uploads and
-- media-bearing Mark inserts fail closed immediately. The migration also makes
-- blocking bilateral, serializes pair mutations, centralizes Alert creation,
-- hardens reactions, and makes Wall/Mark identity immutable to app callers.
-- ════════════════════════════════════════════════════════════════════════

-- ── Pair serialization ─────────────────────────────────────────────────────────────────────
create or replace function lock_user_pair(a uuid, b uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_key bigint;
begin
  if a is null or b is null or a = b then return; end if;
  v_key := pg_catalog.hashtextextended(
    case when a::text < b::text then a::text || ':' || b::text
         else b::text || ':' || a::text end, 0);
  perform pg_catalog.pg_advisory_xact_lock(v_key);
end $$;
revoke all on function lock_user_pair(uuid, uuid) from public, anon, authenticated;

-- All pair-changing app writes acquire the same transaction lock before their
-- policy/transition checks. BEFORE-row triggers run before INSERT WITH CHECK.
create or replace function guard_block_pair_write()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'DELETE' then
    perform public.lock_user_pair(old.blocker_id, old.blocked_id);
    return old;
  end if;
  perform public.lock_user_pair(new.blocker_id, new.blocked_id);
  return new;
end $$;
drop trigger if exists aa_blocks_pair_lock on blocks;
create trigger aa_blocks_pair_lock before insert or delete on blocks
  for each row execute function guard_block_pair_write();

create or replace function guard_friendship_pair_write()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform public.lock_user_pair(new.requester_id, new.addressee_id);
  if public.is_blocked(new.requester_id, new.addressee_id) then
    raise exception 'unavailable' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists aa_friendships_pair_guard on friendships;
create trigger aa_friendships_pair_guard before insert or update on friendships
  for each row execute function guard_friendship_pair_write();

create or replace function guard_follow_pair_write()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform public.lock_user_pair(new.follower_id, new.followed_id);
  if public.is_blocked(new.follower_id, new.followed_id) then
    raise exception 'unavailable' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists aa_follows_pair_guard on follows;
create trigger aa_follows_pair_guard before insert on follows
  for each row execute function guard_follow_pair_write();

create or replace function guard_approved_writer_pair_write()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_owner uuid;
begin
  select w.owner_id into v_owner from public.walls w where w.id = new.wall_id;
  perform public.lock_user_pair(v_owner, new.user_id);
  if v_owner is null or public.is_blocked(v_owner, new.user_id) then
    raise exception 'unavailable' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists aa_approved_writers_pair_guard on approved_writers;
create trigger aa_approved_writers_pair_guard before insert on approved_writers
  for each row execute function guard_approved_writer_pair_write();

create or replace function guard_wall_member_pair_write()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_owner uuid;
begin
  select w.owner_id into v_owner from public.walls w where w.id = new.wall_id;
  perform public.lock_user_pair(v_owner, new.user_id);
  if v_owner is null or public.is_blocked(v_owner, new.user_id) then
    raise exception 'unavailable' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists aa_wall_members_pair_guard on wall_members;
create trigger aa_wall_members_pair_guard before insert or update on wall_members
  for each row execute function guard_wall_member_pair_write();

-- ── Canonical visibility/contribution ───────────────────────────────────────────────
create or replace function can_view_wall(wid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select uid is not null and public.is_active_account(uid) and exists (
    select 1 from public.walls w
    where w.id = wid
      and (
        (w.type = 'personal'
         and public.is_active_account(w.owner_id)
         and not public.is_blocked(w.owner_id, uid)
         and (w.owner_id = uid or w.visibility = 'public'
              or (w.visibility = 'private' and public.are_friends(w.owner_id, uid))))
        or
        (w.type = 'shared'
         and (w.owner_id = uid
              or public.is_wall_member(w.id, uid)
              or (w.visibility = 'public' and not public.is_blocked(w.owner_id, uid))))
      )
  );
$$;
revoke all on function can_view_wall(uuid, uuid) from public, anon;
grant execute on function can_view_wall(uuid, uuid) to authenticated;

create or replace function can_contribute(wid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select uid is not null and public.is_active_account(uid) and exists (
    select 1 from public.walls w
    where w.id = wid and (
      (w.type = 'personal'
       and w.owner_id <> uid
       and public.can_view_wall(w.id, uid)
       and not public.is_blocked(w.owner_id, uid)
       and (
         w.contribution_policy = 'everyone'
         or (w.contribution_policy = 'friends' and public.are_friends(w.owner_id, uid))
         or (w.contribution_policy = 'selected' and public.is_approved_writer(w.id, uid))
       ))
      or
      (w.type = 'shared'
       and (w.owner_id = uid or public.is_wall_member(w.id, uid)))
    )
  );
$$;
revoke all on function can_contribute(uuid, uuid) from public, anon;
grant execute on function can_contribute(uuid, uuid) to authenticated;

create or replace function can_view_profile(profile_uid uuid, viewer_uid uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select profile_uid is not null and viewer_uid is not null
     and public.is_active_account(viewer_uid)
     and (profile_uid = viewer_uid
          or (public.is_active_account(profile_uid)
              and not public.is_blocked(profile_uid, viewer_uid)));
$$;
revoke all on function can_view_profile(uuid, uuid) from public, anon;
grant execute on function can_view_profile(uuid, uuid) to authenticated;

drop policy if exists "profiles read" on profiles;
drop policy if exists "profiles read available" on profiles;
create policy "profiles read available" on profiles for select to authenticated
  using (public.can_view_profile(id, auth.uid()));
drop policy if exists "walls view" on walls;
drop policy if exists "walls view canonical" on walls;
create policy "walls view canonical" on walls for select to authenticated
  using (public.can_view_wall(id, auth.uid()));

-- Boolean-only true-author resolver. It never returns the hidden identity.
create or replace function is_mark_true_author(mid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select uid is not null and exists (
    select 1 from public.marks m
    left join public.anonymous_mark_authors ama on ama.mark_id = m.id
    where m.id = mid
      and (m.author_id = uid or (m.anonymous and ama.author_id = uid))
  );
$$;
revoke all on function is_mark_true_author(uuid, uuid) from public, anon;
grant execute on function is_mark_true_author(uuid, uuid) to authenticated;

-- Canonical Mark rows only. Historical rows remain available to protected
-- moderation through BYPASSRLS, but never to app clients or Realtime consumers.
drop policy if exists "marks view" on marks;
drop policy if exists "marks view canonical" on marks;
create policy "marks view canonical" on marks for select to authenticated
  using (
    type in ('text'::mark_type, 'photo'::mark_type, 'voice'::mark_type, 'video'::mark_type)
    and public.can_view_wall(wall_id, auth.uid())
    and (status = 'active' or public.is_mark_true_author(id, auth.uid())
         or exists (select 1 from public.walls w where w.id = wall_id and w.owner_id = auth.uid()))
  );

-- Roster: accepted members see non-blocked accepted co-members. Owners retain
-- the membership row needed for management, while the profile policy hides a
-- blocked member's identity and link (the UI renders a neutral row).
drop policy if exists "wall_members read" on wall_members;
drop policy if exists "wall_members read safe" on wall_members;
create policy "wall_members read safe" on wall_members for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.walls w where w.id = wall_id and w.owner_id = auth.uid())
    or (status = 'accepted' and public.is_wall_member(wall_id, auth.uid())
        and not public.is_blocked(user_id, auth.uid()))
  );

-- ── Reaction authorization and integrity ────────────────────────────────────────────────
do $$ begin
  alter table mark_reactions add constraint mark_reactions_emoji_ck
    check (emoji in ('❤️','😂','🥹','🔥','👏'));
exception when duplicate_object then null; end $$;

create or replace function can_react_to_mark(mid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select uid is not null and public.is_active_account(uid) and exists (
    select 1 from public.marks m
    left join public.anonymous_mark_authors ama on ama.mark_id = m.id
    where m.id = mid
      and m.status = 'active'
      and m.type in ('text'::mark_type, 'photo'::mark_type, 'voice'::mark_type, 'video'::mark_type)
      and public.can_view_wall(m.wall_id, uid)
      and coalesce(m.author_id, ama.author_id) is not null
      and public.is_active_account(coalesce(m.author_id, ama.author_id))
      and not public.is_blocked(uid, coalesce(m.author_id, ama.author_id))
  );
$$;
revoke all on function can_react_to_mark(uuid, uuid) from public, anon;
grant execute on function can_react_to_mark(uuid, uuid) to authenticated;

create or replace function guard_reaction_pair_write()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_author uuid;
begin
  select coalesce(m.author_id, ama.author_id) into v_author
    from public.marks m
    left join public.anonymous_mark_authors ama on ama.mark_id = m.id
   where m.id = new.mark_id;
  perform public.lock_user_pair(new.user_id, v_author);
  if v_author is null or not public.can_react_to_mark(new.mark_id, new.user_id) then
    raise exception 'unavailable' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists aa_reactions_pair_guard on mark_reactions;
create trigger aa_reactions_pair_guard before insert or update on mark_reactions
  for each row execute function guard_reaction_pair_write();

create or replace function guard_reaction_identity()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if new.mark_id is distinct from old.mark_id or new.user_id is distinct from old.user_id then
    raise exception 'REACTION_IMMUTABLE: mark_id and user_id cannot change';
  end if;
  return new;
end $$;
drop trigger if exists ab_reactions_identity_guard on mark_reactions;
create trigger ab_reactions_identity_guard before update on mark_reactions
  for each row execute function guard_reaction_identity();

drop policy if exists "reactions view" on mark_reactions;
drop policy if exists "reactions view accessible mark" on mark_reactions;
create policy "reactions view accessible mark" on mark_reactions for select to authenticated
  using (exists (select 1 from public.marks m where m.id = mark_id
                 and m.status = 'active' and public.can_view_wall(m.wall_id, auth.uid())));
drop policy if exists "reactions write self" on mark_reactions;
drop policy if exists "reactions insert accessible" on mark_reactions;
create policy "reactions insert accessible" on mark_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.can_react_to_mark(mark_id, auth.uid()));
drop policy if exists "reactions update self" on mark_reactions;
drop policy if exists "reactions update accessible" on mark_reactions;
create policy "reactions update accessible" on mark_reactions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_react_to_mark(mark_id, auth.uid()));
-- Existing self-delete policy deliberately remains: a user may remove their own
-- reaction after losing Mark access.

-- ── Wall/Mark identity and compatibility-phase creation guard ────────────────────
create or replace function walls_guard_identity()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if new.id is distinct from old.id or new.type is distinct from old.type then
    raise exception 'WALL_IDENTITY_IMMUTABLE';
  end if;
  if new.owner_id is distinct from old.owner_id and current_user <> 'postgres' then
    raise exception 'WALL_OWNER_RPC_ONLY';
  end if;
  return new;
end $$;
drop trigger if exists walls_identity_guard on walls;
create trigger walls_identity_guard before update on walls
  for each row execute function walls_guard_identity();

create or replace function transfer_shared_wall_ownership(p_wall_id uuid, p_target_user_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_actor uuid := auth.uid(); v_owner uuid;
begin
  if v_actor is null or p_target_user_id is null or v_actor = p_target_user_id
     or not public.is_active_account(v_actor) or not public.is_active_account(p_target_user_id) then
    return false;
  end if;
  select w.owner_id into v_owner from public.walls w
   where w.id = p_wall_id and w.type = 'shared' for update;
  if v_owner is distinct from v_actor then return false; end if;
  perform public.lock_user_pair(v_actor, p_target_user_id);
  if public.is_blocked(v_actor, p_target_user_id)
     or not public.is_wall_member(p_wall_id, p_target_user_id) then return false; end if;

  delete from public.wall_members
   where wall_id = p_wall_id and user_id = p_target_user_id;
  insert into public.wall_members (wall_id, user_id, role, status)
    values (p_wall_id, v_actor, 'member', 'accepted')
    on conflict (wall_id, user_id) do update set role = 'member', status = 'accepted';
  update public.walls set owner_id = p_target_user_id where id = p_wall_id;
  return true;
end $$;
revoke all on function transfer_shared_wall_ownership(uuid, uuid) from public, anon;
grant execute on function transfer_shared_wall_ownership(uuid, uuid) to authenticated;

create or replace function marks_compat_insert_guard()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if current_user not in ('postgres','service_role') then
    if new.type <> 'text'::mark_type or new.media_url is not null or new.payload is not null then
      raise exception 'MARK_MEDIA_UNAVAILABLE' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create or replace function guard_mark_contribution_pair()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_actor uuid := auth.uid(); v_owner uuid; v_type wall_type;
begin
  if v_actor is null then return new; end if;
  select w.owner_id, w.type into v_owner, v_type from public.walls w where w.id = new.wall_id;
  if v_owner is null then raise exception 'unavailable' using errcode='42501'; end if;
  -- Shared co-members keep group contribution even if the owner is one side of a
  -- block; Personal contribution is a direct pair action and is serialized.
  if v_type = 'personal' then perform public.lock_user_pair(v_actor, v_owner); end if;
  if not public.can_contribute(new.wall_id, v_actor) then
    raise exception 'unavailable' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists a0_marks_pair_guard on marks;
create trigger a0_marks_pair_guard before insert on marks
  for each row execute function guard_mark_contribution_pair();
drop trigger if exists aa_marks_compat_insert_guard on marks;
create trigger aa_marks_compat_insert_guard before insert on marks
  for each row execute function marks_compat_insert_guard();

-- Compatibility writer: text only, server-authorized; all media shapes fail.
drop policy if exists "marks insert contributor" on marks;
drop policy if exists "marks insert text compatibility" on marks;
create policy "marks insert text compatibility" on marks for insert to authenticated
  with check (
    type = 'text'::mark_type and media_url is null and payload is null
    and public.can_contribute(wall_id, auth.uid())
    and ((not anonymous and author_id = auth.uid()) or (anonymous and author_id is null))
  );

-- Update uses the protected true-author predicate for Anonymous Marks too.
drop policy if exists "marks update author or owner" on marks;
drop policy if exists "marks update author or owner canonical" on marks;
create policy "marks update author or owner canonical" on marks for update to authenticated
  using (public.is_mark_true_author(id, auth.uid())
         or exists (select 1 from public.walls w where w.id = wall_id and w.owner_id = auth.uid()))
  with check (public.is_mark_true_author(id, auth.uid())
              or exists (select 1 from public.walls w where w.id = wall_id and w.owner_id = auth.uid()));

-- Replace 0012's guard: no runtime client/service identity/type reassignment;
-- authors retain the approved text edit window; owners retain lifecycle controls.
create or replace function marks_guard_moderation()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  v_is_owner boolean;
  v_privileged boolean := current_user = 'postgres';
  v_is_author boolean;
  v_content_changed boolean;
  v_owner_removing boolean;
  v_normal_count integer;
begin
  v_is_owner := exists (select 1 from public.walls w where w.id = old.wall_id and w.owner_id = auth.uid());
  v_is_author := public.current_user_is_mark_author(old.id);
  v_owner_removing := new.status = 'removed' and old.status is distinct from 'removed'
                      and v_is_owner and not v_privileged;

  if new.id is distinct from old.id or new.wall_id is distinct from old.wall_id
     or new.author_id is distinct from old.author_id or new.type is distinct from old.type
     or new.anonymous is distinct from old.anonymous or new.secret is distinct from old.secret then
    raise exception 'MARK_IDENTITY_IMMUTABLE';
  end if;
  if not v_privileged and new.created_at is distinct from old.created_at then
    raise exception 'MARK_IMMUTABLE: created_at cannot be changed';
  end if;
  if not v_privileged and not v_owner_removing then
    new.removed_by := old.removed_by;
    new.removed_at := old.removed_at;
    new.removal_reason := old.removal_reason;
  end if;
  if (new.pinned is distinct from old.pinned) or (new.status is distinct from old.status) then
    if not (v_is_owner or v_privileged) then
      raise exception 'SEC001_MODERATION: only the wall owner may pin/approve/change status';
    end if;
  end if;

  v_content_changed := new.text is distinct from old.text
                    or new.color is distinct from old.color
                    or new.media_url is distinct from old.media_url
                    or new.payload is distinct from old.payload;
  if v_content_changed and not v_privileged then
    if not v_is_author then
      raise exception 'MARK_CONTENT_AUTHOR_ONLY: only the author may edit a mark''s content';
    elsif now() >= old.created_at + interval '10 minutes' then
      raise exception 'MARK_EDIT_WINDOW: the 10-minute edit window has closed';
    elsif new.media_url is not null or new.payload is not null then
      raise exception 'MARK_MEDIA_UNAVAILABLE' using errcode = '42501';
    end if;
  end if;

  if new.status = 'removed' and old.status is distinct from 'removed'
     and v_is_owner and not v_privileged then
    if new.removal_reason is null then raise exception 'MARK_REMOVAL_REASON: a removal reason is required'; end if;
    new.removed_by := auth.uid(); new.removed_at := now();
    if new.removal_reason = 'normal' then
      select count(*) into v_normal_count from public.marks
       where removed_by = auth.uid() and removal_reason = 'normal'
         and removed_at > now() - interval '30 days';
      if v_normal_count >= 3 then
        raise exception 'MARK_REMOVAL_QUOTA: normal removal limit (3 per 30 days) reached';
      end if;
    end if;
  end if;
  return new;
end $$;

-- Public attachments remain for avatars and legacy reads, but new Mark object
-- creation/modification is denied until the private-media package ships.
drop policy if exists "attachments insert" on storage.objects;
drop policy if exists "attachments insert avatars only" on storage.objects;
create policy "attachments insert avatars only" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments'
              and (storage.foldername(name))[1] = 'avatars'
              and (storage.foldername(name))[2] = auth.uid()::text);
drop policy if exists "attachments modify own" on storage.objects;
drop policy if exists "attachments modify own nonmark" on storage.objects;
create policy "attachments modify own nonmark" on storage.objects for update to authenticated
  using (owner = auth.uid() and coalesce((storage.foldername(name))[1], '') <> 'marks')
  with check (owner = auth.uid() and coalesce((storage.foldername(name))[1], '') <> 'marks');
drop policy if exists "attachments delete own" on storage.objects;
drop policy if exists "attachments delete own nonmark" on storage.objects;
create policy "attachments delete own nonmark" on storage.objects for delete to authenticated
  using (owner = auth.uid() and coalesce((storage.foldername(name))[1], '') <> 'marks');

-- ── Anonymous Alert provenance + one protected Alert writer ─────────────────────────────
create table if not exists notification_origins (
  notification_id uuid primary key references notifications(id) on delete cascade,
  true_actor_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table notification_origins enable row level security;
revoke all on notification_origins from public, anon, authenticated;
grant select on notification_origins to service_role;

create or replace function write_notification(
  p_recipient_id uuid,
  p_public_actor_id uuid,
  p_true_actor_id uuid,
  p_kind text,
  p_mark_id uuid default null,
  p_wall_id uuid default null
)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_notification_id uuid;
begin
  if p_recipient_id is null or p_true_actor_id is null or p_recipient_id = p_true_actor_id
     or not public.is_active_account(p_recipient_id)
     or not public.is_active_account(p_true_actor_id) then return null; end if;
  perform public.lock_user_pair(p_recipient_id, p_true_actor_id);
  if public.is_blocked(p_recipient_id, p_true_actor_id) then return null; end if;

  insert into public.notifications (user_id, actor_id, kind, mark_id, wall_id)
    values (p_recipient_id, p_public_actor_id, p_kind, p_mark_id, p_wall_id)
    returning id into v_notification_id;
  if p_public_actor_id is null then
    insert into public.notification_origins (notification_id, true_actor_id)
      values (v_notification_id, p_true_actor_id);
  end if;
  return v_notification_id;
end $$;
revoke all on function write_notification(uuid, uuid, uuid, text, uuid, uuid)
  from public, anon, authenticated;

create or replace function notify_mark_left()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_owner uuid; v_type wall_type; v_true_actor uuid; v_public_actor uuid;
begin
  select w.owner_id, w.type into v_owner, v_type from public.walls w where w.id = new.wall_id;
  if new.anonymous then
    select ama.author_id into v_true_actor from public.anonymous_mark_authors ama where ama.mark_id = new.id;
    v_public_actor := null;
  else
    v_true_actor := new.author_id;
    v_public_actor := new.author_id;
  end if;
  perform public.write_notification(v_owner, v_public_actor, v_true_actor,
    case when v_type = 'shared' then 'shared_wall_mark' else 'mark_left' end,
    new.id, new.wall_id);
  return new;
end $$;
drop trigger if exists marks_notify on marks;
drop trigger if exists zz_marks_notify on marks;
-- Runs after marks_record_anon alphabetically, so Anonymous provenance is already
-- durably present in the same transaction before Alert creation.
create trigger zz_marks_notify after insert on marks
  for each row execute function notify_mark_left();

create or replace function notify_reaction()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_author uuid; v_wall uuid;
begin
  select coalesce(m.author_id, ama.author_id), m.wall_id into v_author, v_wall
    from public.marks m
    left join public.anonymous_mark_authors ama on ama.mark_id = m.id
   where m.id = new.mark_id;
  perform public.write_notification(v_author, new.user_id, new.user_id,
                                    'reaction', new.mark_id, v_wall);
  return new;
end $$;

create or replace function notify_friend_request()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform public.write_notification(new.addressee_id, new.requester_id, new.requester_id,
                                    'friend_request', null, null);
  return new;
end $$;

create or replace function notify_friend_accepted()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    perform public.write_notification(new.requester_id, new.addressee_id, new.addressee_id,
                                      'friend_accepted', null, null);
  end if;
  return new;
end $$;

create or replace function notify_wall_invite()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_owner uuid;
begin
  if new.status = 'pending' then
    select w.owner_id into v_owner from public.walls w where w.id = new.wall_id;
    perform public.write_notification(new.user_id, v_owner, v_owner,
                                      'shared_wall_invite', null, new.wall_id);
  end if;
  return new;
end $$;

-- ── Atomic block cleanup ──────────────────────────────────────────────────────────
drop trigger if exists blocks_remove_follows on blocks;
drop function if exists blocks_remove_follows();

create or replace function blocks_cleanup_pair()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  -- aa_blocks_pair_lock already owns this lock; reacquisition is safe and makes
  -- the cleanup function correct if trigger ordering changes later.
  perform public.lock_user_pair(new.blocker_id, new.blocked_id);

  delete from public.friendships f
   where (f.requester_id = new.blocker_id and f.addressee_id = new.blocked_id)
      or (f.requester_id = new.blocked_id and f.addressee_id = new.blocker_id);
  delete from public.follows f
   where (f.follower_id = new.blocker_id and f.followed_id = new.blocked_id)
      or (f.follower_id = new.blocked_id and f.followed_id = new.blocker_id);
  delete from public.approved_writers aw using public.walls w
   where aw.wall_id = w.id and w.type = 'personal'
     and ((w.owner_id = new.blocker_id and aw.user_id = new.blocked_id)
       or (w.owner_id = new.blocked_id and aw.user_id = new.blocker_id));
  delete from public.wall_members wm using public.walls w
   where wm.wall_id = w.id and wm.status = 'pending'
     and ((w.owner_id = new.blocker_id and wm.user_id = new.blocked_id)
       or (w.owner_id = new.blocked_id and wm.user_id = new.blocker_id));

  delete from public.mark_reactions mr using public.marks m
   left join public.anonymous_mark_authors ama on ama.mark_id = m.id
   where mr.mark_id = m.id
     and ((mr.user_id = new.blocker_id and coalesce(m.author_id, ama.author_id) = new.blocked_id)
       or (mr.user_id = new.blocked_id and coalesce(m.author_id, ama.author_id) = new.blocker_id));

  delete from public.notifications n
   where (n.user_id = new.blocker_id and n.actor_id = new.blocked_id)
      or (n.user_id = new.blocked_id and n.actor_id = new.blocker_id)
      or exists (
        select 1 from public.notification_origins no
         where no.notification_id = n.id
           and ((n.user_id = new.blocker_id and no.true_actor_id = new.blocked_id)
             or (n.user_id = new.blocked_id and no.true_actor_id = new.blocker_id))
      );
  return new;
end $$;
drop trigger if exists zz_blocks_cleanup_pair on blocks;
create trigger zz_blocks_cleanup_pair after insert on blocks
  for each row execute function blocks_cleanup_pair();

-- ── Non-enumerating capability contract ──────────────────────────────────────────
create or replace function get_wall_capabilities(p_wall_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_uid uuid := auth.uid(); v_wall public.walls%rowtype;
begin
  if v_uid is null or not public.is_active_account(v_uid)
     or not public.can_view_wall(p_wall_id, v_uid) then
    return jsonb_build_object('status', 'unavailable');
  end if;
  select * into v_wall from public.walls where id = p_wall_id;
  if not found then return jsonb_build_object('status', 'unavailable'); end if;
  return jsonb_build_object(
    'status', 'available',
    'wall_type', v_wall.type,
    'is_owner', v_wall.owner_id = v_uid,
    'can_view', true,
    'can_contribute', public.can_contribute(p_wall_id, v_uid)
  );
end $$;
revoke all on function get_wall_capabilities(uuid) from public, anon;
grant execute on function get_wall_capabilities(uuid) to authenticated;

-- ── Reviewer hardening: close arbitrary-actor privacy oracles ─────────────────
-- Internal predicates retain their historical signatures for migration and
-- protected-function compatibility, but app roles cannot execute them. Every
-- app-callable helper below derives the actor exclusively from auth.uid().
create or replace function current_user_can_view_wall(p_wall_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select public.can_view_wall(p_wall_id, auth.uid());
$$;
create or replace function current_user_can_contribute(p_wall_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select public.can_contribute(p_wall_id, auth.uid());
$$;
create or replace function current_user_can_view_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select public.can_view_profile(p_profile_id, auth.uid());
$$;
create or replace function current_user_is_mark_author(p_mark_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select public.is_mark_true_author(p_mark_id, auth.uid());
$$;
create or replace function current_user_can_react(p_mark_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select public.can_react_to_mark(p_mark_id, auth.uid());
$$;
create or replace function current_user_can_see_wall_member(p_wall_id uuid, p_member_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select auth.uid() is not null
    and exists (select 1 from public.wall_members target
                where target.wall_id=p_wall_id and target.user_id=p_member_id)
    and (
    p_member_id = auth.uid()
    or exists (select 1 from public.walls w where w.id=p_wall_id and w.owner_id=auth.uid())
    or (public.is_wall_member(p_wall_id, auth.uid())
        and public.is_wall_member(p_wall_id, p_member_id)
        and not public.is_blocked(auth.uid(), p_member_id))
  );
$$;
create or replace function current_user_is_admin()
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select public.is_admin(auth.uid());
$$;

revoke all on function current_user_can_view_wall(uuid) from public, anon;
revoke all on function current_user_can_contribute(uuid) from public, anon;
revoke all on function current_user_can_view_profile(uuid) from public, anon;
revoke all on function current_user_is_mark_author(uuid) from public, anon;
revoke all on function current_user_can_react(uuid) from public, anon;
revoke all on function current_user_can_see_wall_member(uuid,uuid) from public, anon;
revoke all on function current_user_is_admin() from public, anon;
grant execute on function current_user_can_view_wall(uuid) to authenticated;
grant execute on function current_user_can_contribute(uuid) to authenticated;
grant execute on function current_user_can_view_profile(uuid) to authenticated;
grant execute on function current_user_is_mark_author(uuid) to authenticated;
grant execute on function current_user_can_react(uuid) to authenticated;
grant execute on function current_user_can_see_wall_member(uuid,uuid) to authenticated;
grant execute on function current_user_is_admin() to authenticated;

-- Revoke every arbitrary-actor/internal predicate from app roles. Protected
-- triggers/RPCs are SECURITY DEFINER and continue to use them as the owner.
revoke all on function is_blocked(uuid,uuid) from public, anon, authenticated;
revoke all on function are_friends(uuid,uuid) from public, anon, authenticated;
revoke all on function is_wall_member(uuid,uuid) from public, anon, authenticated;
revoke all on function is_approved_writer(uuid,uuid) from public, anon, authenticated;
revoke all on function is_active_account(uuid) from public, anon, authenticated;
revoke all on function is_admin(uuid) from public, anon, authenticated;
revoke all on function can_view_wall(uuid,uuid) from public, anon, authenticated;
revoke all on function can_contribute(uuid,uuid) from public, anon, authenticated;
revoke all on function can_view_profile(uuid,uuid) from public, anon, authenticated;
revoke all on function is_mark_true_author(uuid,uuid) from public, anon, authenticated;
revoke all on function can_react_to_mark(uuid,uuid) from public, anon, authenticated;

-- Final RLS policies call only auth-bound helpers or use non-sensitive row-local
-- predicates. This prevents an app caller substituting a third party as actor.
drop policy if exists "profiles read available" on profiles;
create policy "profiles read available" on profiles for select to authenticated
  using (public.current_user_can_view_profile(id));
drop policy if exists "walls view canonical" on walls;
create policy "walls view canonical" on walls for select to authenticated
  using (public.current_user_can_view_wall(id));
drop policy if exists "marks view canonical" on marks;
create policy "marks view canonical" on marks for select to authenticated
  using (
    type in ('text'::mark_type,'photo'::mark_type,'voice'::mark_type,'video'::mark_type)
    and public.current_user_can_view_wall(wall_id)
    and (status='active' or public.current_user_is_mark_author(id)
         or exists(select 1 from public.walls w where w.id=wall_id and w.owner_id=auth.uid()))
  );
drop policy if exists "wall_members read safe" on wall_members;
create policy "wall_members read safe" on wall_members for select to authenticated
  using (public.current_user_can_see_wall_member(wall_id,user_id));

drop policy if exists "reactions view accessible mark" on mark_reactions;
create policy "reactions view accessible mark" on mark_reactions for select to authenticated
  using (exists(select 1 from public.marks m where m.id=mark_id and m.status='active'
                and public.current_user_can_view_wall(m.wall_id)));
drop policy if exists "reactions insert accessible" on mark_reactions;
create policy "reactions insert accessible" on mark_reactions for insert to authenticated
  with check (user_id=auth.uid() and public.current_user_can_react(mark_id));
drop policy if exists "reactions update accessible" on mark_reactions;
create policy "reactions update accessible" on mark_reactions for update to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid() and public.current_user_can_react(mark_id));

drop policy if exists "marks insert text compatibility" on marks;
create policy "marks insert text compatibility" on marks for insert to authenticated
  with check (
    type='text'::mark_type and media_url is null and payload is null
    and public.current_user_can_contribute(wall_id)
    and ((not anonymous and author_id=auth.uid()) or (anonymous and author_id is null))
  );
drop policy if exists "marks update author or owner canonical" on marks;
create policy "marks update author or owner canonical" on marks for update to authenticated
  using (public.current_user_is_mark_author(id)
         or exists(select 1 from public.walls w where w.id=wall_id and w.owner_id=auth.uid()))
  with check (public.current_user_is_mark_author(id)
              or exists(select 1 from public.walls w where w.id=wall_id and w.owner_id=auth.uid()));
drop policy if exists "marks delete author within window" on marks;
create policy "marks delete true author within window" on marks for delete to authenticated
  using (public.current_user_is_mark_author(id) and now() < created_at + interval '10 minutes');

-- Pair guards, not app-callable arbitrary predicates, enforce block/active state
-- for direct relationship writes. RLS still pins row identity to auth.uid().
create or replace function guard_friendship_pair_write()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform public.lock_user_pair(new.requester_id,new.addressee_id);
  if public.is_blocked(new.requester_id,new.addressee_id)
     or not public.is_active_account(new.requester_id)
     or not public.is_active_account(new.addressee_id) then
    raise exception 'unavailable' using errcode='42501';
  end if;
  return new;
end $$;
drop policy if exists "friendships insert requester" on friendships;
create policy "friendships insert requester" on friendships for insert to authenticated
  with check (requester_id=auth.uid() and status='pending');

create or replace function guard_follow_pair_write()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform public.lock_user_pair(new.follower_id,new.followed_id);
  if public.is_blocked(new.follower_id,new.followed_id)
     or not public.is_active_account(new.follower_id)
     or not public.is_active_account(new.followed_id) then
    raise exception 'unavailable' using errcode='42501';
  end if;
  return new;
end $$;
drop policy if exists "follows insert self" on follows;
create policy "follows insert self" on follows for insert to authenticated
  with check (follower_id=auth.uid() and follower_id<>followed_id
              and exists(select 1 from public.walls w where w.owner_id=followed_id
                         and w.type='personal' and w.visibility='public'));

create or replace function guard_approved_writer_pair_write()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_owner uuid;
begin
  select w.owner_id into v_owner from public.walls w where w.id=new.wall_id and w.type='personal';
  perform public.lock_user_pair(v_owner,new.user_id);
  if v_owner is null or public.is_blocked(v_owner,new.user_id)
     or not public.is_active_account(v_owner) or not public.is_active_account(new.user_id) then
    raise exception 'unavailable' using errcode='42501';
  end if;
  return new;
end $$;
drop policy if exists "approved_writers insert owner" on approved_writers;
create policy "approved_writers insert owner" on approved_writers for insert to authenticated
  with check (user_id<>auth.uid() and exists(select 1 from public.walls w
              where w.id=wall_id and w.owner_id=auth.uid() and w.type='personal'));

create or replace function guard_wall_member_pair_write()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_owner uuid;
begin
  select w.owner_id into v_owner from public.walls w where w.id=new.wall_id and w.type='shared';
  perform public.lock_user_pair(v_owner,new.user_id);
  if v_owner is null or public.is_blocked(v_owner,new.user_id)
     or not public.is_active_account(v_owner) or not public.is_active_account(new.user_id) then
    raise exception 'unavailable' using errcode='42501';
  end if;
  return new;
end $$;

drop policy if exists "reports read own or admin" on reports;
create policy "reports read own or admin" on reports for select to authenticated
  using (reporter_id=auth.uid() or public.current_user_is_admin());
drop policy if exists "moderation_actions read admin" on moderation_actions;
create policy "moderation_actions read admin" on moderation_actions for select to authenticated
  using (public.current_user_is_admin());

-- ── Narrow ownership-transfer authorization ────────────────────────────────
create table if not exists wall_ownership_transfer_authorizations (
  transaction_id bigint not null,
  wall_id uuid not null references walls(id) on delete cascade,
  old_owner_id uuid not null references auth.users(id),
  new_owner_id uuid not null references auth.users(id),
  primary key(transaction_id,wall_id)
);
alter table wall_ownership_transfer_authorizations enable row level security;
revoke all on wall_ownership_transfer_authorizations from public,anon,authenticated,service_role;

create or replace function walls_guard_identity()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if new.id is distinct from old.id or new.type is distinct from old.type then
    raise exception 'WALL_IDENTITY_IMMUTABLE';
  end if;
  if new.owner_id is distinct from old.owner_id and not exists(
    select 1 from public.wall_ownership_transfer_authorizations a
     where a.transaction_id=txid_current() and a.wall_id=old.id
       and a.old_owner_id=old.owner_id and a.new_owner_id=new.owner_id
  ) then raise exception 'WALL_OWNER_RPC_ONLY'; end if;
  return new;
end $$;

create or replace function transfer_shared_wall_ownership(p_wall_id uuid,p_target_user_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_actor uuid:=auth.uid(); v_owner uuid;
begin
  if v_actor is null or p_target_user_id is null or v_actor=p_target_user_id
     or not public.is_active_account(v_actor) or not public.is_active_account(p_target_user_id) then return false; end if;
  select w.owner_id into v_owner from public.walls w
   where w.id=p_wall_id and w.type='shared' for update;
  if v_owner is distinct from v_actor then return false; end if;
  perform public.lock_user_pair(v_actor,p_target_user_id);
  if public.is_blocked(v_actor,p_target_user_id)
     or not public.is_wall_member(p_wall_id,p_target_user_id) then return false; end if;

  insert into public.wall_ownership_transfer_authorizations
    (transaction_id,wall_id,old_owner_id,new_owner_id)
    values(txid_current(),p_wall_id,v_actor,p_target_user_id);
  delete from public.wall_members where wall_id=p_wall_id and user_id=p_target_user_id;
  insert into public.wall_members(wall_id,user_id,role,status)
    values(p_wall_id,v_actor,'member','accepted')
    on conflict(wall_id,user_id) do update set role='member',status='accepted';
  update public.walls set owner_id=p_target_user_id where id=p_wall_id;
  delete from public.wall_ownership_transfer_authorizations
   where transaction_id=txid_current() and wall_id=p_wall_id;
  return true;
end $$;
