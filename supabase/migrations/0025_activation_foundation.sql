-- ════════════════════════════════════════════════════════════════════════════
-- 0025 · Activation persistence, actor-bound bootstrap, safe Wall defaults,
--        and Personal-Wall Status.
--
-- Media migrations 0022–0024 own the immediately preceding release numbers.
-- This migration may be loaded after 0021 only in the isolated activation test
-- branch; hosted application is forbidden until 0022–0024 precede it.
-- ════════════════════════════════════════════════════════════════════════════

-- ── First-use progress without disturbing established accounts ─────────────
-- The conditional block makes a local re-run safe: only profiles that existed
-- before the column first appeared are backfilled as established accounts.
do $$
declare
  v_added_onboarding boolean := false;
begin
  if not exists (
    select 1
      from pg_catalog.pg_attribute
     where attrelid = 'public.profiles'::regclass
       and attname = 'onboarding_completed'
       and not attisdropped
  ) then
    alter table public.profiles add column onboarding_completed boolean;
    v_added_onboarding := true;
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_attribute
     where attrelid = 'public.profiles'::regclass
       and attname = 'walkthrough_completed_at'
       and not attisdropped
  ) then
    alter table public.profiles add column walkthrough_completed_at timestamptz;
  end if;

  if v_added_onboarding then
    update public.profiles
       set onboarding_completed = true,
           walkthrough_completed_at = coalesce(walkthrough_completed_at, now());
  end if;
end $$;

alter table public.profiles
  alter column onboarding_completed set default false,
  alter column onboarding_completed set not null;

-- ── Parameterless, actor-bound account bootstrap route ─────────────────────
create or replace function public.get_current_account_route()
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_onboarding_completed boolean;
  v_walkthrough_completed_at timestamptz;
begin
  if v_actor is null then
    return 'unavailable';
  end if;

  select p.account_status, p.onboarding_completed, p.walkthrough_completed_at
    into v_status, v_onboarding_completed, v_walkthrough_completed_at
    from public.profiles p
   where p.id = v_actor;

  if not found then
    return 'missing_profile';
  end if;

  if v_status = 'deactivated' then
    return 'deactivated';
  elsif v_status = 'suspended' then
    return 'suspended';
  elsif v_status <> 'active' then
    return 'unavailable';
  elsif not v_onboarding_completed then
    return 'onboarding';
  elsif v_walkthrough_completed_at is null then
    return 'walkthrough';
  else
    return 'ready';
  end if;
end $$;

revoke all on function public.get_current_account_route() from public, anon, authenticated;
grant execute on function public.get_current_account_route() to authenticated;

-- ── Safe defaults for every newly-created Personal Wall ─────────────────────
alter table public.walls alter column visibility set default 'private'::wall_visibility;
alter table public.walls alter column allow_anonymous set default false;

create or replace function public.ensure_personal_wall()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.walls (
    owner_id,
    type,
    name,
    visibility,
    contribution_policy,
    allow_anonymous
  ) values (
    new.id,
    'personal',
    new.display_name || '''s Wall',
    'private',
    'friends',
    false
  )
  on conflict do nothing;
  return new;
end $$;

revoke all on function public.ensure_personal_wall() from public, anon, authenticated;

-- ── Exactly one current Status per Personal Wall ────────────────────────────
create table if not exists public.wall_statuses (
  wall_id uuid primary key references public.walls(id) on delete cascade,
  body text not null
    check (body = btrim(body) and char_length(body) between 1 and 150),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.wall_statuses_guard_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.wall_id is distinct from old.wall_id then
    raise exception 'wall_status_identity_immutable' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists wall_statuses_guard_update on public.wall_statuses;
create trigger wall_statuses_guard_update
  before update on public.wall_statuses
  for each row execute function public.wall_statuses_guard_update();

alter table public.wall_statuses enable row level security;

drop policy if exists "wall statuses read visible personal wall" on public.wall_statuses;
create policy "wall statuses read visible personal wall"
  on public.wall_statuses for select to authenticated
  using (
    exists (
      select 1
        from public.walls w
       where w.id = wall_statuses.wall_id
         and w.type = 'personal'
         and public.current_user_can_view_wall(w.id)
    )
  );

drop policy if exists "wall statuses insert owner" on public.wall_statuses;
create policy "wall statuses insert owner"
  on public.wall_statuses for insert to authenticated
  with check (
    exists (
      select 1
        from public.walls w
       where w.id = wall_statuses.wall_id
         and w.type = 'personal'
         and w.owner_id = auth.uid()
         and public.current_user_can_view_wall(w.id)
    )
  );

drop policy if exists "wall statuses update owner" on public.wall_statuses;
create policy "wall statuses update owner"
  on public.wall_statuses for update to authenticated
  using (
    exists (
      select 1
        from public.walls w
       where w.id = wall_statuses.wall_id
         and w.type = 'personal'
         and w.owner_id = auth.uid()
         and public.current_user_can_view_wall(w.id)
    )
  )
  with check (
    exists (
      select 1
        from public.walls w
       where w.id = wall_statuses.wall_id
         and w.type = 'personal'
         and w.owner_id = auth.uid()
         and public.current_user_can_view_wall(w.id)
    )
  );

drop policy if exists "wall statuses delete owner" on public.wall_statuses;
create policy "wall statuses delete owner"
  on public.wall_statuses for delete to authenticated
  using (
    exists (
      select 1
        from public.walls w
       where w.id = wall_statuses.wall_id
         and w.type = 'personal'
         and w.owner_id = auth.uid()
         and public.current_user_can_view_wall(w.id)
    )
  );

revoke all on table public.wall_statuses from public, anon, authenticated;
grant select, insert, update, delete on table public.wall_statuses to authenticated;

revoke all on function public.wall_statuses_guard_update() from public, anon, authenticated;

-- Preserve the P0 invariant: app roles may not execute arbitrary-actor
-- authorization predicates. Protected functions and RLS continue to use only
-- actor-bound wrappers at the app boundary.
revoke all on function public.is_blocked(uuid,uuid) from public, anon, authenticated;
revoke all on function public.are_friends(uuid,uuid) from public, anon, authenticated;
revoke all on function public.is_wall_member(uuid,uuid) from public, anon, authenticated;
revoke all on function public.is_approved_writer(uuid,uuid) from public, anon, authenticated;
revoke all on function public.is_active_account(uuid) from public, anon, authenticated;
revoke all on function public.can_view_wall(uuid,uuid) from public, anon, authenticated;
revoke all on function public.can_contribute(uuid,uuid) from public, anon, authenticated;
revoke all on function public.can_view_profile(uuid,uuid) from public, anon, authenticated;
revoke all on function public.is_mark_true_author(uuid,uuid) from public, anon, authenticated;
revoke all on function public.can_react_to_mark(uuid,uuid) from public, anon, authenticated;
