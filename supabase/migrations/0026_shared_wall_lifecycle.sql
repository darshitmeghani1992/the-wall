-- ============================================================================
-- 0026 · Shared-Wall lifecycle (FP-SHARED-001)
--
-- Makes membership lifecycle writes RPC-only, adds durable removal tombstones,
-- enforces the single-owner invariant at transaction end, and serializes every
-- lifecycle operation on the Shared-Wall row before pair/membership state.
-- This is a forward-only cutover: clients must migrate before this ships.
-- ============================================================================

-- ── Schema and legacy reconciliation ────────────────────────────────────────
alter table public.walls
  add column if not exists open_join boolean not null default false;

do $$ begin
  alter table public.walls add constraint walls_open_join_ck
    check (not open_join or (type = 'shared' and visibility = 'public'));
exception when duplicate_object then null; end $$;

create table if not exists public.shared_wall_member_removals (
  wall_id uuid not null references public.walls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  removed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (wall_id, user_id)
);
create index if not exists shared_wall_member_removals_user_idx
  on public.shared_wall_member_removals(user_id, wall_id);
alter table public.shared_wall_member_removals enable row level security;
revoke all on table public.shared_wall_member_removals
  from public, anon, authenticated, service_role;

-- walls.owner_id is the only ownership source. Remove legacy duplicate owner
-- rows/tombstones before installing the deferred invariant.
delete from public.wall_members wm
 using public.walls w
 where w.id = wm.wall_id and w.owner_id = wm.user_id;
delete from public.shared_wall_member_removals r
 using public.walls w
 where w.id = r.wall_id and w.owner_id = r.user_id;
-- Accepted membership is stronger evidence than a stale historical removal.
-- Pending reinvites deliberately retain the tombstone until acceptance.
delete from public.shared_wall_member_removals r
 using public.wall_members wm
 where wm.wall_id = r.wall_id and wm.user_id = r.user_id
   and wm.status = 'accepted';

-- `owner` was a legacy enum value but never a valid membership role. Keep the
-- enum for forward-only compatibility while making the table canonical.
-- Drop only the two pre-0026 mutation triggers around this one reconciliation
-- statement. Both correctly reject runtime role changes, while the pair guard
-- also rejects blocked/inactive legacy rows; neither must reinterpret a trusted
-- migration repair as an app mutation. The migration is transactional, and the
-- exact protections are rebuilt immediately before any app-facing grants/RPCs.
drop trigger if exists aa_wall_members_pair_guard on public.wall_members;
drop trigger if exists wall_members_transition on public.wall_members;
update public.wall_members set role = 'member' where role <> 'member';
create trigger aa_wall_members_pair_guard
  before insert or update on public.wall_members
  for each row execute function public.guard_wall_member_pair_write();
create trigger wall_members_transition
  before update on public.wall_members
  for each row execute function public.wall_members_guard_transition();
do $$ begin
  alter table public.wall_members add constraint wall_members_role_member_ck
    check (role = 'member');
exception when duplicate_object then null; end $$;

-- Deferred checks are required by ownership transfer: the new owner is updated
-- first and their old membership is removed later in the same transaction.
create or replace function public.enforce_shared_wall_member_invariant()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_type public.wall_type;
  v_owner uuid;
begin
  select w.type, w.owner_id into v_type, v_owner
    from public.walls w where w.id = new.wall_id;
  if not found or v_type <> 'shared' or v_owner = new.user_id then
    raise exception 'SHARED_WALL_MEMBER_INVARIANT' using errcode = '23514';
  end if;
  if new.status = 'accepted' and exists (
    select 1 from public.shared_wall_member_removals r
     where r.wall_id = new.wall_id and r.user_id = new.user_id
  ) then
    raise exception 'SHARED_WALL_ACCEPTED_REMOVAL_COLLISION' using errcode = '23514';
  end if;
  return null;
end $$;

create or replace function public.enforce_shared_wall_removal_invariant()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_type public.wall_type;
  v_owner uuid;
begin
  select w.type, w.owner_id into v_type, v_owner
    from public.walls w where w.id = new.wall_id;
  if not found or v_type <> 'shared' or v_owner = new.user_id then
    raise exception 'SHARED_WALL_REMOVAL_INVARIANT' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.wall_members wm
     where wm.wall_id = new.wall_id and wm.user_id = new.user_id
       and wm.status = 'accepted'
  ) then
    raise exception 'SHARED_WALL_ACCEPTED_REMOVAL_COLLISION' using errcode = '23514';
  end if;
  return null;
end $$;

create or replace function public.enforce_shared_wall_owner_invariant()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.type = 'shared' and (
    exists (select 1 from public.wall_members wm
             where wm.wall_id = new.id and wm.user_id = new.owner_id)
    or exists (select 1 from public.shared_wall_member_removals r
                where r.wall_id = new.id and r.user_id = new.owner_id)
  ) then
    raise exception 'SHARED_WALL_OWNER_INVARIANT' using errcode = '23514';
  end if;
  return null;
end $$;

drop trigger if exists shared_wall_member_invariant on public.wall_members;
create constraint trigger shared_wall_member_invariant
  after insert or update on public.wall_members
  deferrable initially deferred
  for each row execute function public.enforce_shared_wall_member_invariant();

drop trigger if exists shared_wall_removal_invariant on public.shared_wall_member_removals;
create constraint trigger shared_wall_removal_invariant
  after insert or update on public.shared_wall_member_removals
  deferrable initially deferred
  for each row execute function public.enforce_shared_wall_removal_invariant();

drop trigger if exists shared_wall_owner_invariant on public.walls;
create constraint trigger shared_wall_owner_invariant
  after update on public.walls
  deferrable initially deferred
  for each row execute function public.enforce_shared_wall_owner_invariant();

revoke all on function public.enforce_shared_wall_member_invariant()
  from public, anon, authenticated;
revoke all on function public.enforce_shared_wall_removal_invariant()
  from public, anon, authenticated;
revoke all on function public.enforce_shared_wall_owner_invariant()
  from public, anon, authenticated;

-- ── Direct-write cutover ────────────────────────────────────────────────────
-- RLS policies execute with the app role's function privileges. Keep the
-- arbitrary-actor helper private and expose only this zero-argument self check.
create or replace function public.current_user_is_active_account()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and public.is_active_account(auth.uid());
$$;
revoke all on function public.current_user_is_active_account()
  from public,anon,authenticated;
grant execute on function public.current_user_is_active_account() to authenticated;

create or replace function public.guard_shared_wall_create()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_actor uuid := auth.uid();
begin
  -- Privileged migrations and the protected Personal-Wall profile trigger keep
  -- their established paths. An app-originated Shared-Wall create locks its
  -- actor profile so deactivation cannot race the RLS active-account check.
  if v_actor is not null and new.type = 'shared' then
    perform 1 from public.profiles p where p.id=v_actor for update;
    if new.owner_id<>v_actor or not public.is_active_account(v_actor) then
      raise exception 'unavailable' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists aa_shared_wall_create_guard on public.walls;
create trigger aa_shared_wall_create_guard before insert on public.walls
  for each row execute function public.guard_shared_wall_create();
revoke all on function public.guard_shared_wall_create()
  from public,anon,authenticated;

drop policy if exists "walls insert self" on public.walls;
drop policy if exists "walls insert shared owner" on public.walls;
create policy "walls insert shared owner"
  on public.walls for insert to authenticated
  with check (
    owner_id = auth.uid()
    and type = 'shared'
    and public.current_user_is_active_account()
  );

drop policy if exists "walls update owner" on public.walls;
drop policy if exists "walls update personal owner" on public.walls;
create policy "walls update personal owner"
  on public.walls for update to authenticated
  using (
    type = 'personal'
    and owner_id = auth.uid()
    and public.current_user_is_active_account()
  )
  with check (
    type = 'personal'
    and owner_id = auth.uid()
    and public.current_user_is_active_account()
  );

drop policy if exists "walls delete owner" on public.walls;
drop policy if exists "walls delete personal owner" on public.walls;
create policy "walls delete personal owner"
  on public.walls for delete to authenticated
  using (
    type = 'personal'
    and owner_id = auth.uid()
    and public.current_user_is_active_account()
  );

-- Membership state has one server-side mutation surface after this point.
revoke insert, update, delete on table public.wall_members from authenticated;
revoke delete on table public.walls from authenticated;

-- ── Alert vocabulary ────────────────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_kind_ck;
alter table public.notifications add constraint notifications_kind_ck check (
  kind in (
    'mark_left','shared_wall_mark','reaction','friend_request','friend_accepted',
    'shared_wall_invite','comment','shared_wall_invite_accepted',
    'shared_wall_ownership_transferred'
  )
);

-- ── Shared helpers (not app-callable) ───────────────────────────────────────
create or replace function public.lock_shared_wall_member_rows(
  p_wall_id uuid,
  p_user_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform wm.user_id
    from public.wall_members wm
   where wm.wall_id = p_wall_id
     and wm.user_id = any(coalesce(p_user_ids, '{}'::uuid[]))
   order by wm.user_id
   for update;
end $$;
revoke all on function public.lock_shared_wall_member_rows(uuid,uuid[])
  from public, anon, authenticated;

-- ── Join ────────────────────────────────────────────────────────────────────
create or replace function public.join_shared_wall(p_wall_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_wall public.walls%rowtype;
  v_status public.wall_member_status;
begin
  if v_actor is null or p_wall_id is null then
    return jsonb_build_object('status','unavailable');
  end if;

  select * into v_wall from public.walls w
   where w.id = p_wall_id and w.type = 'shared' for update;
  if not found or v_wall.owner_id = v_actor then
    return jsonb_build_object('status','unavailable');
  end if;

  perform p.id from public.profiles p
   where p.id in (v_actor, v_wall.owner_id) order by p.id for update;
  if not public.is_active_account(v_actor)
     or not public.is_active_account(v_wall.owner_id) then
    return jsonb_build_object('status','unavailable');
  end if;
  perform public.lock_user_pair(v_actor, v_wall.owner_id);
  perform public.lock_shared_wall_member_rows(p_wall_id, array[v_actor]);

  select wm.status into v_status from public.wall_members wm
   where wm.wall_id = p_wall_id and wm.user_id = v_actor;
  if public.is_blocked(v_actor, v_wall.owner_id) then
    return jsonb_build_object('status','unavailable');
  end if;
  if v_status = 'accepted' then
    return jsonb_build_object('status','already_member','wall_id',p_wall_id);
  end if;
  if v_status is not null
     or v_wall.visibility <> 'public'
     or not v_wall.open_join
     or exists (select 1 from public.shared_wall_member_removals r
                 where r.wall_id = p_wall_id and r.user_id = v_actor) then
    return jsonb_build_object('status','unavailable');
  end if;

  insert into public.wall_members(wall_id,user_id,role,status)
    values(p_wall_id,v_actor,'member','accepted');
  return jsonb_build_object('status','joined','wall_id',p_wall_id);
end $$;

-- ── Invite and response ─────────────────────────────────────────────────────
create or replace function public.invite_shared_wall_member(
  p_wall_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_wall public.walls%rowtype;
  v_status public.wall_member_status;
begin
  if v_actor is null or p_target_user_id is null or v_actor = p_target_user_id then
    return jsonb_build_object('status','unavailable');
  end if;
  select * into v_wall from public.walls w
   where w.id = p_wall_id and w.type = 'shared' for update;
  if not found or v_wall.owner_id <> v_actor then
    return jsonb_build_object('status','unavailable');
  end if;
  perform p.id from public.profiles p
   where p.id in (v_actor,p_target_user_id) order by p.id for update;
  if not public.is_active_account(v_actor)
     or not public.is_active_account(p_target_user_id) then
    return jsonb_build_object('status','unavailable');
  end if;
  perform public.lock_user_pair(v_actor,p_target_user_id);
  perform public.lock_shared_wall_member_rows(p_wall_id,array[p_target_user_id]);
  if public.is_blocked(v_actor,p_target_user_id) then
    return jsonb_build_object('status','unavailable');
  end if;
  select wm.status into v_status from public.wall_members wm
   where wm.wall_id=p_wall_id and wm.user_id=p_target_user_id;
  if v_status='accepted' then
    return jsonb_build_object('status','already_member','wall_id',p_wall_id);
  elsif v_status='pending' then
    return jsonb_build_object('status','already_invited','wall_id',p_wall_id);
  end if;
  insert into public.wall_members(wall_id,user_id,role,status)
    values(p_wall_id,p_target_user_id,'member','pending');
  return jsonb_build_object('status','invited','wall_id',p_wall_id);
end $$;

create or replace function public.respond_shared_wall_invite(
  p_wall_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_wall public.walls%rowtype;
  v_status public.wall_member_status;
begin
  if v_actor is null or p_wall_id is null or p_accept is null then
    return jsonb_build_object('status','unavailable');
  end if;
  select * into v_wall from public.walls w
   where w.id=p_wall_id and w.type='shared' for update;
  if not found or v_wall.owner_id=v_actor then
    return jsonb_build_object('status','unavailable');
  end if;
  perform p.id from public.profiles p
   where p.id in (v_actor,v_wall.owner_id) order by p.id for update;
  if not public.is_active_account(v_actor)
     or not public.is_active_account(v_wall.owner_id) then
    return jsonb_build_object('status','unavailable');
  end if;
  perform public.lock_user_pair(v_actor,v_wall.owner_id);
  perform public.lock_shared_wall_member_rows(p_wall_id,array[v_actor]);
  if public.is_blocked(v_actor,v_wall.owner_id) then
    return jsonb_build_object('status','unavailable');
  end if;
  select wm.status into v_status from public.wall_members wm
   where wm.wall_id=p_wall_id and wm.user_id=v_actor;
  if v_status <> 'pending' or v_status is null then
    return jsonb_build_object('status','unavailable');
  end if;
  if p_accept then
    update public.wall_members set status='accepted'
     where wall_id=p_wall_id and user_id=v_actor;
    delete from public.shared_wall_member_removals
     where wall_id=p_wall_id and user_id=v_actor;
    perform public.write_notification(
      v_wall.owner_id,v_actor,v_actor,'shared_wall_invite_accepted',null,p_wall_id
    );
    return jsonb_build_object('status','accepted','wall_id',p_wall_id);
  end if;
  delete from public.wall_members where wall_id=p_wall_id and user_id=v_actor;
  return jsonb_build_object('status','declined','wall_id',p_wall_id);
end $$;

-- ── Removal and leave ───────────────────────────────────────────────────────
create or replace function public.remove_shared_wall_member(
  p_wall_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_wall public.walls%rowtype;
  v_status public.wall_member_status;
begin
  if v_actor is null or p_target_user_id is null or v_actor=p_target_user_id then
    return jsonb_build_object('status','unavailable');
  end if;
  select * into v_wall from public.walls w
   where w.id=p_wall_id and w.type='shared' for update;
  if not found or v_wall.owner_id<>v_actor then
    return jsonb_build_object('status','unavailable');
  end if;
  perform p.id from public.profiles p
   where p.id in (v_actor,p_target_user_id) order by p.id for update;
  if not public.is_active_account(v_actor)
     or not public.is_active_account(v_wall.owner_id) then
    return jsonb_build_object('status','unavailable');
  end if;
  perform public.lock_user_pair(v_actor,p_target_user_id);
  perform public.lock_shared_wall_member_rows(p_wall_id,array[p_target_user_id]);
  if public.is_blocked(v_actor,p_target_user_id) then
    return jsonb_build_object('status','unavailable');
  end if;
  select wm.status into v_status from public.wall_members wm
   where wm.wall_id=p_wall_id and wm.user_id=p_target_user_id;
  if v_status='accepted' then
    insert into public.shared_wall_member_removals(
      wall_id,user_id,removed_by,created_at,updated_at
    ) values(p_wall_id,p_target_user_id,v_actor,now(),now())
    on conflict(wall_id,user_id) do update
      set removed_by=excluded.removed_by,updated_at=now();
    delete from public.wall_members
     where wall_id=p_wall_id and user_id=p_target_user_id;
    return jsonb_build_object('status','removed','wall_id',p_wall_id);
  elsif v_status='pending' then
    delete from public.wall_members
     where wall_id=p_wall_id and user_id=p_target_user_id;
    return jsonb_build_object('status','revoked','wall_id',p_wall_id);
  end if;
  return jsonb_build_object('status','unavailable');
end $$;

create or replace function public.leave_shared_wall(p_wall_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_wall public.walls%rowtype;
  v_status public.wall_member_status;
begin
  if v_actor is null or p_wall_id is null then
    return jsonb_build_object('status','unavailable');
  end if;
  select * into v_wall from public.walls w
   where w.id=p_wall_id and w.type='shared' for update;
  if not found then return jsonb_build_object('status','unavailable'); end if;
  perform p.id from public.profiles p
   where p.id in (v_actor,v_wall.owner_id) order by p.id for update;
  if not public.is_active_account(v_actor)
     or not public.is_active_account(v_wall.owner_id) then
    return jsonb_build_object('status','unavailable');
  end if;
  if v_wall.owner_id=v_actor then
    return jsonb_build_object('status','owner_action_required','wall_id',p_wall_id);
  end if;
  perform public.lock_user_pair(v_actor,v_wall.owner_id);
  perform public.lock_shared_wall_member_rows(p_wall_id,array[v_actor]);
  if public.is_blocked(v_actor,v_wall.owner_id) then
    return jsonb_build_object('status','unavailable');
  end if;
  select wm.status into v_status from public.wall_members wm
   where wm.wall_id=p_wall_id and wm.user_id=v_actor;
  if v_status<>'accepted' or v_status is null then
    return jsonb_build_object('status','unavailable');
  end if;
  delete from public.wall_members where wall_id=p_wall_id and user_id=v_actor;
  return jsonb_build_object('status','left','wall_id',p_wall_id);
end $$;

-- ── Settings, deletion, and ownership ───────────────────────────────────────
create or replace function public.update_shared_wall_settings(
  p_wall_id uuid,
  p_name text,
  p_visibility text,
  p_open_join boolean,
  p_allow_anonymous boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_wall public.walls%rowtype;
  v_name text := btrim(p_name);
begin
  if v_actor is null or p_wall_id is null then
    return jsonb_build_object('status','unavailable');
  end if;
  if p_name is null or p_visibility is null or p_open_join is null
     or p_allow_anonymous is null or v_name is null
     or char_length(v_name) not between 1 and 60
     or p_visibility not in ('public','private')
     or (p_visibility='private' and p_open_join) then
    return jsonb_build_object('status','invalid_input');
  end if;
  select * into v_wall from public.walls w
   where w.id=p_wall_id and w.type='shared' for update;
  if not found or v_wall.owner_id<>v_actor then
    return jsonb_build_object('status','unavailable');
  end if;
  perform 1 from public.profiles p where p.id=v_actor for update;
  if not public.is_active_account(v_actor) then
    return jsonb_build_object('status','unavailable');
  end if;
  update public.walls
     set name=v_name,
         visibility=p_visibility::public.wall_visibility,
         open_join=p_open_join,
         allow_anonymous=p_allow_anonymous
   where id=p_wall_id;
  return jsonb_build_object(
    'status','updated','wall_id',p_wall_id,'name',v_name,
    'visibility',p_visibility,'open_join',p_open_join,
    'allow_anonymous',p_allow_anonymous
  );
end $$;

create or replace function public.delete_shared_wall(
  p_wall_id uuid,
  p_expected_name text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_wall public.walls%rowtype;
begin
  if v_actor is null or p_wall_id is null then
    return jsonb_build_object('status','unavailable');
  end if;
  select * into v_wall from public.walls w
   where w.id=p_wall_id and w.type='shared' for update;
  if not found or v_wall.owner_id<>v_actor then
    return jsonb_build_object('status','unavailable');
  end if;
  perform 1 from public.profiles p where p.id=v_actor for update;
  if not public.is_active_account(v_actor) then
    return jsonb_build_object('status','unavailable');
  end if;
  if p_expected_name is distinct from v_wall.name then
    return jsonb_build_object('status','confirmation_mismatch','wall_id',p_wall_id);
  end if;
  delete from public.walls where id=p_wall_id;
  return jsonb_build_object('status','deleted','wall_id',p_wall_id);
end $$;

create or replace function public.transfer_shared_wall_ownership(
  p_wall_id uuid,
  p_target_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_wall public.walls%rowtype;
  v_status public.wall_member_status;
begin
  if v_actor is null or p_target_user_id is null or v_actor=p_target_user_id then
    return false;
  end if;
  select * into v_wall from public.walls w
   where w.id=p_wall_id and w.type='shared' for update;
  if not found or v_wall.owner_id<>v_actor then return false; end if;
  perform p.id from public.profiles p
   where p.id in (v_actor,p_target_user_id) order by p.id for update;
  if not public.is_active_account(v_actor)
     or not public.is_active_account(p_target_user_id) then return false; end if;
  perform public.lock_user_pair(v_actor,p_target_user_id);
  perform public.lock_shared_wall_member_rows(
    p_wall_id,array[v_actor,p_target_user_id]
  );
  select wm.status into v_status from public.wall_members wm
   where wm.wall_id=p_wall_id and wm.user_id=p_target_user_id;
  if public.is_blocked(v_actor,p_target_user_id)
     or v_status<>'accepted' or v_status is null
     or exists(select 1 from public.shared_wall_member_removals r
                where r.wall_id=p_wall_id and r.user_id=p_target_user_id) then
    return false;
  end if;

  insert into public.wall_ownership_transfer_authorizations(
    transaction_id,wall_id,old_owner_id,new_owner_id
  ) values(txid_current(),p_wall_id,v_actor,p_target_user_id)
  on conflict(transaction_id,wall_id) do update
    set old_owner_id=excluded.old_owner_id,new_owner_id=excluded.new_owner_id;

  -- The order is intentional. Deferred invariant triggers validate the final
  -- state, while the authorization row makes only this exact owner change legal.
  update public.walls set owner_id=p_target_user_id where id=p_wall_id;
  delete from public.wall_members
   where wall_id=p_wall_id and user_id=p_target_user_id;
  insert into public.wall_members(wall_id,user_id,role,status)
    values(p_wall_id,v_actor,'member','accepted')
    on conflict(wall_id,user_id) do update set role='member',status='accepted';
  delete from public.wall_ownership_transfer_authorizations
   where transaction_id=txid_current() and wall_id=p_wall_id;

  perform public.write_notification(
    p_target_user_id,v_actor,v_actor,'shared_wall_ownership_transferred',null,p_wall_id
  );
  return true;
end $$;

-- ── Owner removal list and private invite preview ───────────────────────────
create or replace function public.list_removed_shared_wall_members(p_wall_id uuid)
returns table(user_id uuid, removed_at timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.is_active_account(v_actor)
     or not exists(select 1 from public.walls w
                    where w.id=p_wall_id and w.type='shared'
                      and w.owner_id=v_actor) then
    return;
  end if;
  return query
    select r.user_id,r.updated_at
      from public.shared_wall_member_removals r
     where r.wall_id=p_wall_id
     order by r.updated_at desc,r.user_id;
end $$;

create or replace function public.get_my_pending_shared_wall_invite(p_wall_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null or not public.is_active_account(v_actor) then
    return jsonb_build_object('status','unavailable');
  end if;
  select jsonb_build_object(
           'status','available',
           'wall_id',w.id,
           'wall_name',w.name,
           'visibility',w.visibility,
           'owner_display_name',p.display_name
         ) into v_result
    from public.wall_members wm
    join public.walls w on w.id=wm.wall_id and w.type='shared'
    join public.profiles p on p.id=w.owner_id and p.account_status='active'
   where wm.wall_id=p_wall_id and wm.user_id=v_actor and wm.status='pending'
     and not public.is_blocked(v_actor,w.owner_id);
  return coalesce(v_result,jsonb_build_object('status','unavailable'));
end $$;

-- ── Capability extension ────────────────────────────────────────────────────
create or replace function public.get_wall_capabilities(p_wall_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_wall public.walls%rowtype;
  v_has_membership boolean;
  v_membership_status public.wall_member_status;
  v_has_tombstone boolean;
  v_join_state text;
begin
  if v_uid is null or not public.is_active_account(v_uid)
     or not public.can_view_wall(p_wall_id,v_uid) then
    return jsonb_build_object('status','unavailable');
  end if;
  select * into v_wall from public.walls w where w.id=p_wall_id;
  if not found then return jsonb_build_object('status','unavailable'); end if;
  select wm.status into v_membership_status
    from public.wall_members wm
   where wm.wall_id=p_wall_id and wm.user_id=v_uid;
  v_has_membership := v_membership_status is not null;
  select exists(select 1 from public.shared_wall_member_removals r
                 where r.wall_id=p_wall_id and r.user_id=v_uid)
    into v_has_tombstone;

  v_join_state := case
    when v_wall.type='personal' then null
    when v_wall.owner_id=v_uid then 'owner'
    when v_membership_status='accepted' then 'member'
    when v_membership_status='pending' then 'invited'
    when not v_has_membership and v_has_tombstone then 'owner_approval_required'
    when not v_has_membership and not v_has_tombstone
      and v_wall.visibility='public' and v_wall.open_join
      and public.is_active_account(v_uid)
      and public.is_active_account(v_wall.owner_id)
      and not public.is_blocked(v_wall.owner_id,v_uid) then 'joinable'
    else 'invite_required'
  end;
  return jsonb_build_object(
    'status','available','wall_type',v_wall.type,
    'is_owner',v_wall.owner_id=v_uid,'can_view',true,
    'can_contribute',public.can_contribute(p_wall_id,v_uid),
    'join_state',v_join_state,
    'can_join',coalesce(v_join_state='joinable',false)
  );
end $$;

-- ── Grants: only actor-bound public contracts cross the app boundary ────────
revoke all on function public.join_shared_wall(uuid) from public,anon,authenticated;
revoke all on function public.invite_shared_wall_member(uuid,uuid) from public,anon,authenticated;
revoke all on function public.respond_shared_wall_invite(uuid,boolean) from public,anon,authenticated;
revoke all on function public.remove_shared_wall_member(uuid,uuid) from public,anon,authenticated;
revoke all on function public.leave_shared_wall(uuid) from public,anon,authenticated;
revoke all on function public.update_shared_wall_settings(uuid,text,text,boolean,boolean) from public,anon,authenticated;
revoke all on function public.delete_shared_wall(uuid,text) from public,anon,authenticated;
revoke all on function public.transfer_shared_wall_ownership(uuid,uuid) from public,anon,authenticated;
revoke all on function public.list_removed_shared_wall_members(uuid) from public,anon,authenticated;
revoke all on function public.get_my_pending_shared_wall_invite(uuid) from public,anon,authenticated;
revoke all on function public.get_wall_capabilities(uuid) from public,anon,authenticated;

grant execute on function public.join_shared_wall(uuid) to authenticated;
grant execute on function public.invite_shared_wall_member(uuid,uuid) to authenticated;
grant execute on function public.respond_shared_wall_invite(uuid,boolean) to authenticated;
grant execute on function public.remove_shared_wall_member(uuid,uuid) to authenticated;
grant execute on function public.leave_shared_wall(uuid) to authenticated;
grant execute on function public.update_shared_wall_settings(uuid,text,text,boolean,boolean) to authenticated;
grant execute on function public.delete_shared_wall(uuid,text) to authenticated;
grant execute on function public.transfer_shared_wall_ownership(uuid,uuid) to authenticated;
grant execute on function public.list_removed_shared_wall_members(uuid) to authenticated;
grant execute on function public.get_my_pending_shared_wall_invite(uuid) to authenticated;
grant execute on function public.get_wall_capabilities(uuid) to authenticated;

-- Preserve the P0 oracle boundary after every new SECURITY DEFINER contract.
revoke all on function public.is_blocked(uuid,uuid) from public,anon,authenticated;
revoke all on function public.is_active_account(uuid) from public,anon,authenticated;
revoke all on function public.is_wall_member(uuid,uuid) from public,anon,authenticated;
revoke all on function public.can_view_wall(uuid,uuid) from public,anon,authenticated;
revoke all on function public.can_contribute(uuid,uuid) from public,anon,authenticated;
