-- ════════════════════════════════════════════════════════════════════════════
-- 0001 · "The Wall" (Social Wall) — schema, RLS, triggers, realtime.
--
-- Initial schema for The Wall's Supabase project: the Wall/Mark domain, row-level
-- security, triggers, and realtime. Safe to re-run (idempotent).
-- ════════════════════════════════════════════════════════════════════════════

-- ── Enums ───────────────────────────────────────────────────────────────────
do $$ begin
  create type wall_type as enum ('personal','shared');
exception when duplicate_object then null; end $$;

do $$ begin
  create type wall_visibility as enum ('public','private','invite_only');
exception when duplicate_object then null; end $$;

do $$ begin
  create type contribution_policy as enum ('everyone','friends','selected','nobody');
exception when duplicate_object then null; end $$;

do $$ begin
  create type mark_type as enum
    ('sticky','roast','secret','memory','photo','award','poll','doodle','prediction');
exception when duplicate_object then null; end $$;

do $$ begin
  create type mark_status as enum ('active','pending','hidden','removed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type friendship_status as enum ('pending','accepted','blocked');
exception when duplicate_object then null; end $$;

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  handle       text unique not null,
  display_name text not null,
  avatar_url   text,
  bio          text,
  interests    text[] default '{}',
  created_at   timestamptz not null default now()
);

create table if not exists walls (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  type                wall_type not null default 'personal',
  name                text not null,
  visibility          wall_visibility not null default 'public',
  contribution_policy contribution_policy not null default 'friends',
  allow_anonymous     boolean not null default true,
  require_approval    boolean not null default false,
  created_at          timestamptz not null default now()
);
-- Exactly one personal wall per user.
create unique index if not exists walls_one_personal_per_owner
  on walls (owner_id) where type = 'personal';

create table if not exists marks (
  id         uuid primary key default gen_random_uuid(),
  wall_id    uuid not null references walls(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  type       mark_type not null,
  text       text,
  color      text,
  anonymous  boolean not null default false,
  media_url  text,
  payload    jsonb,
  rotation   real not null default 0,
  pinned     boolean not null default false,
  status     mark_status not null default 'active',
  created_at timestamptz not null default now()
);
create index if not exists marks_wall_created_idx on marks (wall_id, created_at desc);
create index if not exists marks_author_idx on marks (author_id);

create table if not exists mark_reactions (
  mark_id uuid not null references marks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji   text not null,
  primary key (mark_id, user_id, emoji)
);

create table if not exists comments (
  id         uuid primary key default gen_random_uuid(),
  mark_id    uuid not null references marks(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_mark_idx on comments (mark_id, created_at);

-- Poll votes for poll-type marks (one vote per user per mark).
create table if not exists poll_votes (
  mark_id      uuid not null references marks(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  option_index integer not null,
  primary key (mark_id, user_id)
);

-- Friendship as an undirected relationship stored once (requester → addressee).
create table if not exists friendships (
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status       friendship_status not null default 'pending',
  created_at   timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index if not exists friendships_addressee_idx on friendships (addressee_id, status);

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade, -- recipient
  actor_id   uuid references auth.users(id) on delete set null,
  kind       text not null,
  mark_id    uuid references marks(id) on delete cascade,
  wall_id    uuid references walls(id) on delete cascade,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  mark_id     uuid references marks(id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now()
);

-- ── Helpers ─────────────────────────────────────────────────────────────────
-- Accepted friendship in either direction.
create or replace function are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a))
  );
$$;

-- Can `uid` VIEW `wid`? Public walls are open; private walls need owner/friend.
create or replace function can_view_wall(wid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from walls w
    where w.id = wid
      and (
        w.visibility = 'public'
        or w.owner_id = uid
        or (w.visibility = 'private' and are_friends(w.owner_id, uid))
      )
  );
$$;

-- Can `uid` CONTRIBUTE a mark to `wid`? Honors contribution_policy.
create or replace function can_contribute(wid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from walls w
    where w.id = wid
      and (
        w.owner_id = uid
        or (w.contribution_policy = 'everyone')
        or (w.contribution_policy = 'friends' and are_friends(w.owner_id, uid))
      )
  );
$$;

-- ── Triggers ────────────────────────────────────────────────────────────────
-- Every profile automatically gets one Personal Wall named after the user.
create or replace function ensure_personal_wall()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into walls (owner_id, type, name, visibility, contribution_policy)
  values (new.id, 'personal', new.display_name || '''s Wall', 'public', 'friends')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists profiles_personal_wall on profiles;
create trigger profiles_personal_wall
  after insert on profiles
  for each row execute function ensure_personal_wall();

-- Derive a mark's initial status + guard anonymous against the wall's setting.
create or replace function marks_set_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
declare w walls%rowtype;
begin
  select * into w from walls where id = new.wall_id;
  if new.anonymous and not w.allow_anonymous then
    raise exception 'This wall does not allow anonymous marks';
  end if;
  -- Owner's own marks are always active; others go to a queue when approval is on.
  if new.author_id = w.owner_id then
    new.status := 'active';
  elsif w.require_approval then
    new.status := 'pending';
  else
    new.status := coalesce(new.status, 'active');
  end if;
  return new;
end $$;

drop trigger if exists marks_defaults on marks;
create trigger marks_defaults
  before insert on marks
  for each row execute function marks_set_defaults();

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table profiles       enable row level security;
alter table walls          enable row level security;
alter table marks          enable row level security;
alter table mark_reactions enable row level security;
alter table comments       enable row level security;
alter table poll_votes     enable row level security;
alter table friendships    enable row level security;
alter table notifications  enable row level security;
alter table reports        enable row level security;

-- profiles: world-readable; user writes only their own row.
drop policy if exists "profiles read" on profiles;
create policy "profiles read" on profiles for select using (true);
drop policy if exists "profiles insert self" on profiles;
create policy "profiles insert self" on profiles for insert to authenticated
  with check (id = auth.uid());
drop policy if exists "profiles update self" on profiles;
create policy "profiles update self" on profiles for update to authenticated
  using (id = auth.uid());

-- walls: viewable per visibility; only the owner writes.
drop policy if exists "walls view" on walls;
create policy "walls view" on walls for select
  using (visibility = 'public' or owner_id = auth.uid()
         or (visibility = 'private' and are_friends(owner_id, auth.uid())));
drop policy if exists "walls insert self" on walls;
create policy "walls insert self" on walls for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists "walls update owner" on walls;
create policy "walls update owner" on walls for update to authenticated
  using (owner_id = auth.uid());
drop policy if exists "walls delete owner" on walls;
create policy "walls delete owner" on walls for delete to authenticated
  using (owner_id = auth.uid());

-- marks: viewable if the viewer can see the wall AND (active | is author | is
-- wall owner — so authors see their pending marks and owners see the queue).
drop policy if exists "marks view" on marks;
create policy "marks view" on marks for select
  using (
    can_view_wall(wall_id, auth.uid())
    and (
      status = 'active'
      or author_id = auth.uid()
      or exists (select 1 from walls w where w.id = wall_id and w.owner_id = auth.uid())
    )
  );
drop policy if exists "marks insert contributor" on marks;
create policy "marks insert contributor" on marks for insert to authenticated
  with check (author_id = auth.uid() and can_contribute(wall_id, auth.uid()));
-- authors edit their own; wall owners moderate (pin/approve/hide).
drop policy if exists "marks update author or owner" on marks;
create policy "marks update author or owner" on marks for update to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from walls w where w.id = wall_id and w.owner_id = auth.uid())
  );
drop policy if exists "marks delete author or owner" on marks;
create policy "marks delete author or owner" on marks for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from walls w where w.id = wall_id and w.owner_id = auth.uid())
  );

-- mark_reactions: readable with the mark; users react only as themselves.
drop policy if exists "reactions view" on mark_reactions;
create policy "reactions view" on mark_reactions for select
  using (exists (select 1 from marks m where m.id = mark_id and can_view_wall(m.wall_id, auth.uid())));
drop policy if exists "reactions write self" on mark_reactions;
create policy "reactions write self" on mark_reactions for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "reactions delete self" on mark_reactions;
create policy "reactions delete self" on mark_reactions for delete to authenticated
  using (user_id = auth.uid());

-- comments: readable with the mark; author writes own; author or wall owner deletes.
drop policy if exists "comments view" on comments;
create policy "comments view" on comments for select
  using (exists (select 1 from marks m where m.id = mark_id and can_view_wall(m.wall_id, auth.uid())));
drop policy if exists "comments insert self" on comments;
create policy "comments insert self" on comments for insert to authenticated
  with check (author_id = auth.uid()
    and exists (select 1 from marks m where m.id = mark_id and can_view_wall(m.wall_id, auth.uid())));
drop policy if exists "comments delete author or owner" on comments;
create policy "comments delete author or owner" on comments for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from marks m join walls w on w.id = m.wall_id
      where m.id = mark_id and w.owner_id = auth.uid()
    )
  );

-- poll_votes: readable with the mark; one vote row per user, written as self.
drop policy if exists "votes view" on poll_votes;
create policy "votes view" on poll_votes for select
  using (exists (select 1 from marks m where m.id = mark_id and can_view_wall(m.wall_id, auth.uid())));
drop policy if exists "votes write self" on poll_votes;
create policy "votes write self" on poll_votes for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "votes update self" on poll_votes;
create policy "votes update self" on poll_votes for update to authenticated
  using (user_id = auth.uid());

-- friendships: either party can read; requester creates; either party updates
-- (accept / block); either party can delete (unfriend / cancel).
drop policy if exists "friendships view" on friendships;
create policy "friendships view" on friendships for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists "friendships insert requester" on friendships;
create policy "friendships insert requester" on friendships for insert to authenticated
  with check (requester_id = auth.uid());
drop policy if exists "friendships update party" on friendships;
create policy "friendships update party" on friendships for update to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists "friendships delete party" on friendships;
create policy "friendships delete party" on friendships for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- notifications: recipient reads / marks-read own; inserts happen via triggers
-- or the service role, so no client insert policy is granted.
drop policy if exists "notifications view own" on notifications;
create policy "notifications view own" on notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "notifications update own" on notifications;
create policy "notifications update own" on notifications for update to authenticated
  using (user_id = auth.uid());

-- reports: a user files reports as themselves; reads are service-role only.
drop policy if exists "reports insert self" on reports;
create policy "reports insert self" on reports for insert to authenticated
  with check (reporter_id = auth.uid());

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$
begin
  begin alter publication supabase_realtime add table marks; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table mark_reactions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table comments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table notifications; exception when duplicate_object then null; end;
end $$;
