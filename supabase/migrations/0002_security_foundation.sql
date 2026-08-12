-- ════════════════════════════════════════════════════════════════════════════
-- 0002 · SEC-001 Security Foundation (F1–F5)
--
-- Closes the F1–F5 authorization holes in 0001_init.sql at the data-access
-- boundary, server-enforced. Implements FP-SEC-001 (Rev 2) exactly:
--   F1  friendship transition guard + UPDATE WITH CHECK + INSERT status='pending'
--   F2  normalized unordered-pair unique index
--   F3  directional `blocks` table + is_blocked() wired into are_friends /
--       can_contribute / friendship-insert
--   F4  write-boundary anonymity: two triggers (BEFORE INSERT null, AFTER INSERT
--       record) + moderator-only `anonymous_mark_authors` side table
--   F5  SECURITY INVOKER mark-moderation column-guard trigger
--
-- Additive and idempotent (drop-if-exists / if-not-exists / do-blocks), in the
-- style of 0001. Does NOT modify 0001; replaces named functions/policies where
-- 0001 defined a weaker version. Build on top only.
-- ════════════════════════════════════════════════════════════════════════════

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ F2 — Reverse-duplicate pair (G-D; AC-S3)                                  │
-- ╰─────────────────────────────────────────────────────────────────────────╯
-- Normalized unique index on the unordered pair. The existing PK
-- (requester_id, addressee_id) already blocks same-direction dups; this blocks
-- the reverse (B,A) duplicate for the same logical pair. Atomic, race-free.
create unique index if not exists friendships_pair_uniq
  on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ F3 — Directional blocking (G-B; AC-S4, AC-S5)                             │
-- ╰─────────────────────────────────────────────────────────────────────────╯
create table if not exists blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)             -- self-block rejected cleanly
);
alter table blocks enable row level security;

-- Only the blocker sees/manages their blocks; the blocked user cannot learn they
-- are blocked.
drop policy if exists "blocks read own" on blocks;
create policy "blocks read own"   on blocks for select to authenticated using (blocker_id = auth.uid());
drop policy if exists "blocks insert own" on blocks;
create policy "blocks insert own" on blocks for insert to authenticated with check (blocker_id = auth.uid());
drop policy if exists "blocks delete own" on blocks;
create policy "blocks delete own" on blocks for delete to authenticated using (blocker_id = auth.uid());

-- Explicit client grants for the new table (Supabase grants base DML by default;
-- this makes the intent reproducible from source).
grant select, insert, delete on blocks to authenticated;

-- Symmetric block predicate: a block in EITHER direction blocks interaction.
create or replace function is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- are_friends now returns false if a block exists → a block overrides an accepted
-- friendship for interaction AND for private-wall visibility (F3/G-B, ADR-007).
create or replace function are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a))
  ) and not is_blocked(a, b);
$$;

-- Contribution denied for a blocked pair (owner path unaffected).
create or replace function can_contribute(wid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from walls w
    where w.id = wid
      and not is_blocked(w.owner_id, uid)
      and (
        w.owner_id = uid
        or (w.contribution_policy = 'everyone')
        or (w.contribution_policy = 'friends' and are_friends(w.owner_id, uid))
      )
  );
$$;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ F1 — Requester self-accept, via UPDATE and via INSERT (G-C; AC-S1, AC-S2)│
-- ╰─────────────────────────────────────────────────────────────────────────╯
-- Trigger: only the addressee may move pending -> accepted; no transition back
-- to pending; the pair identity is immutable.
create or replace function friendships_guard_transition()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if old.status = 'pending' and new.status = 'accepted' then
    if auth.uid() <> old.addressee_id then
      raise exception 'SEC001_TRANSITION: only the addressee may accept a friend request';
    end if;
  elsif new.status = 'pending' then
    raise exception 'SEC001_TRANSITION: cannot move a friendship back to pending';
  end if;
  -- identity of the pair is immutable
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'SEC001_TRANSITION: cannot reassign a friendship pair';
  end if;
  return new;
end $$;

drop trigger if exists friendships_transition on friendships;
create trigger friendships_transition before update on friendships
  for each row execute function friendships_guard_transition();

-- Tighten the UPDATE policy with a WITH CHECK (defense in depth alongside trigger).
drop policy if exists "friendships update party" on friendships;
create policy "friendships update party" on friendships for update to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());

-- Friend request: requester only, must START 'pending' (closes the
-- INSERT-as-accepted vector, F1/G-C), and blocked if a block exists either way.
drop policy if exists "friendships insert requester" on friendships;
create policy "friendships insert requester" on friendships for insert to authenticated
  with check (
    requester_id = auth.uid()
    and status = 'pending'
    and not is_blocked(auth.uid(), addressee_id)
  );

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ F4 — Anonymous author_id exposed on read (G-A; AC-S6)                     │
-- ╰─────────────────────────────────────────────────────────────────────────╯
-- Moderator-only side table: the true author of an anonymous mark lives here,
-- never in the client-readable `marks` row (REST or realtime).
create table if not exists anonymous_mark_authors (
  mark_id    uuid primary key references marks(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,  -- authorless, never stale identity
  created_at timestamptz not null default now()
);
alter table anonymous_mark_authors enable row level security;

-- Zero client access. service_role is the protected moderation path — BYPASSRLS
-- bypasses RLS policies but NOT table-privilege GRANTs, so service_role needs an
-- EXPLICIT grant to read the side table (else permission denied).
revoke all on anonymous_mark_authors from anon, authenticated;
grant select on anonymous_mark_authors to service_role;

-- BEFORE INSERT: null the anon author on the base row. MUST stay BEFORE so the
-- base row AND the realtime INSERT payload both carry author_id = NULL.
create or replace function marks_null_anonymous_author()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.anonymous then new.author_id := null; end if;
  return new;
end $$;
drop trigger if exists marks_null_anon on marks;
create trigger marks_null_anon before insert on marks
  for each row execute function marks_null_anonymous_author();

-- AFTER INSERT: parent marks row now exists (FK satisfied), record the true
-- author from auth.uid() into the moderator-only side table.
create or replace function marks_record_anonymous_author()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.anonymous then
    insert into anonymous_mark_authors (mark_id, author_id) values (new.id, auth.uid())
      on conflict (mark_id) do update set author_id = excluded.author_id;
  end if;
  return new;
end $$;
drop trigger if exists marks_record_anon on marks;
create trigger marks_record_anon after insert on marks
  for each row execute function marks_record_anonymous_author();

-- marks_set_defaults must stop deriving ownership from the now-nullable
-- author_id: compute the owner branch from auth.uid() (trustworthy, and correct
-- for an owner posting anonymously). Body otherwise identical to 0001.
create or replace function marks_set_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
declare w walls%rowtype;
begin
  select * into w from walls where id = new.wall_id;
  if new.anonymous and not w.allow_anonymous then
    raise exception 'This wall does not allow anonymous marks';
  end if;
  -- Owner's own marks are always active; others go to a queue when approval is on.
  if auth.uid() = w.owner_id then
    new.status := 'active';
  elsif w.require_approval then
    new.status := 'pending';
  else
    new.status := coalesce(new.status, 'active');
  end if;
  return new;
end $$;
-- (0001's marks_defaults trigger already points at this function name.)

-- Insert policy tolerates the nulled anon author (WITH CHECK runs AFTER the
-- BEFORE trigger). Non-anon marks must carry the caller as author; anon marks
-- must carry NULL (the trigger guarantees it).
drop policy if exists "marks insert contributor" on marks;
create policy "marks insert contributor" on marks for insert to authenticated
  with check (
    can_contribute(wall_id, auth.uid())
    and (
      (not anonymous and author_id = auth.uid())
      or (anonymous and author_id is null)
    )
  );

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ F5 — Author self-set pinned/status (G-E; AC-S7…AC-S10)                    │
-- ╰─────────────────────────────────────────────────────────────────────────╯
-- SECURITY INVOKER (default) so current_user reflects the caller — a SECURITY
-- DEFINER function would report the definer and defeat the service-role branch.
create or replace function marks_guard_moderation()
returns trigger language plpgsql as $$   -- SECURITY INVOKER (default)
declare v_is_owner boolean; v_privileged boolean;
begin
  v_privileged := current_user in ('service_role','postgres');   -- protected moderation path
  v_is_owner   := exists (select 1 from walls w where w.id = new.wall_id and w.owner_id = auth.uid());
  -- moderation columns
  if (new.pinned is distinct from old.pinned) or (new.status is distinct from old.status) then
    if not (v_is_owner or v_privileged) then
      raise exception 'SEC001_MODERATION: only the wall owner may pin/approve/change status';
    end if;
  end if;
  -- author may never move the mark or reassign authorship
  if (new.wall_id <> old.wall_id) or (new.author_id is distinct from old.author_id) then
    if not (v_is_owner or v_privileged) then
      raise exception 'SEC001_MODERATION: cannot reassign a mark';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists marks_moderation on marks;
create trigger marks_moderation before update on marks
  for each row execute function marks_guard_moderation();
