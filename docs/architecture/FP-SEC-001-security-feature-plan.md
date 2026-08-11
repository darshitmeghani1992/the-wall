# Feature Plan: SEC-001 — Security Foundation

**Author:** Architect Role · **Date:** 2026-08-11
**Governs under:** Architect Charter v2.1 / Architect Playbook v1.1 / AIOS Constitution v1.1
**Source scope:** `docs/product/PRD-SEC-001-security-foundation.md` (AC-S1…AC-S10, decisions A–E, Founder pre-approved)
**Status:** PROPOSED — HIGH-RISK (auth/authz + schema). Design-level Two-Key required: this plan + an
independent design review **before** implementation begins (Charter §19). This document does **not**
mark itself ready to implement.

---

## Complexity Estimate
- **Tier:** High-Risk / Architectural (auth/authz architecture + schema change). Playbook §7.
- **Complexity:** Complex (security-critical invariants, multiple interacting triggers/policies).
- **Rough effort:** ~2–3 focused implementation sessions (Backend), ~1 short Frontend edit, ~1 review + QA pass.
- **Files affected:** 2 new migrations (`0002`, `0003`), 1 new test-harness tree (`supabase/tests/`),
  1 optional client edit (`src/lib/marks.ts`). No change to `profiles.ts` / `upload.ts` source is required.
- **Database impact:** Additive migration (new tables, indexes, triggers; policy replacements). One
  one-time in-place data move for pre-existing anonymous marks (pre-launch → expected zero rows).
- **Dependency risk:** None (no new third-party packages; pgTAP deliberately **not** adopted — see §Test Harness).
- **Approximate AI session count:** 3–4 (Backend migrations, Backend harness, Frontend one-liner, Reviewer/QA).
- **Implementation phases:** (1) `0002` DB integrity/anonymity/moderation + harness; (2) `0003` storage
  policy migration + harness; (3) optional `marks.ts` write-path hardening. Phases 1–2 are the security core.
- **Operational risk:** High — touches auth/authz and public user-generated content. This is the whole point of SEC-001.

## Recommended Build Order
1. **Backend** implements `0002_security_foundation.sql` AND the test harness (`supabase/tests/`) together,
   so every fix lands green against AC-S1…AC-S10. Migration and its proof are one unit.
2. **Backend** implements `0003_storage_attachments.sql` + its harness test (AC storage/F6).
3. **Frontend** applies the optional one-line hardening in `src/lib/marks.ts` (`createMark`) — see §F4.
   (Not security-critical; the server trigger is the real enforcement. Can run in parallel with step 2.)
4. **Reviewer** (independent, re-executes the harness), then **QA** (behavioral, RLS-as-end-user).

Roles required: **Backend** (owns both migrations + harness — the bulk of the work) and **Frontend**
(owns only the `src/lib/marks.ts` client edit). No other implementation Role is needed this cycle.

---

## Goal
Close the six verified authorization holes (F1–F6) in `supabase/migrations/0001_init.sql` at the data-access
boundary, server-enforced, before Friends / Friend Wall / recipient picker / Shared Walls are built on top of
them. Deliver a committed, re-runnable security-test harness that proves AC-S1…AC-S10 and keeps them proven as
later features land. The invisible correctness is the feature.

## Repository Discovery (Playbook §4) — findings relied on
- Current schema/RLS: `supabase/migrations/0001_init.sql` (cited by line below). No later migration alters these policies.
- Client data-access paths: `src/lib/marks.ts` (read: `getWallMarks`/`hydrateAuthors`/`subscribeToWall`;
  write: `createMark`; owner ops: `setPinned`/`hideMark`), `src/lib/profiles.ts` (unaffected),
  `src/lib/upload.ts` (bucket `attachments`, upload paths `marks/{wallId}/…` and `avatars/{uid}/…`, public URLs).
- No existing `docs/architecture/`, ADRs, or Technical Debt Register file present — this plan seeds the first ADRs.
- **Empirically validated** the load-bearing SQL in the local `sec001_test` PG16 DB (shim → 0001 → prototypes;
  all scratch objects dropped afterward). Validated: (a) `least()/greatest()` unordered-pair unique index blocks
  reverse duplicates; (b) RLS `WITH CHECK` is evaluated **after** a `BEFORE INSERT` trigger (enables the anonymity
  design); (c) the friendship transition trigger denies requester self-accept and allows addressee accept;
  (d) several harness-shim requirements (below) that are non-obvious and would otherwise silently break tests.

---

## Threat model summary (Playbook §14)
- **Anonymous/unauth actor:** can only read public content (unchanged, acceptable). Cannot write.
- **Authenticated-but-malicious user:** the entire F1–F5 surface — self-accept, reverse-duplicate, ignored block,
  de-anonymize via REST **or realtime payload**, self-pin/self-approve, moderate walls they don't own. All closed below.
- **Inference:** de-anonymization of anonymous marks (F4) is the key inference risk; closed by never placing the
  sensitive linkage in the client-readable row (REST or realtime), not by client-side masking.

---

# Per-finding fix (Build-Ready)

Concrete SQL objects below are the specification Backend implements in `0002` (F1–F5) and `0003` (F6).
Names are normative. All new tables get `created_at timestamptz not null default now()`.

## F1 — Requester can self-accept  (0001_init.sql:327-329; G-C; AC-S1, AC-S2)
**Fix:** a `BEFORE UPDATE` transition-guard trigger on `friendships` + a tightened UPDATE policy `WITH CHECK`.
Model cancel/decline/unfriend as **DELETE** (the existing delete policy already lets either party delete),
so no ambiguous status collapse and no new enum value.

```sql
-- Trigger: only the addressee may move pending -> accepted; no transition back to pending.
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

-- Tighten the UPDATE policy with a WITH CHECK (defense in depth alongside the trigger).
drop policy if exists "friendships update party" on friendships;
create policy "friendships update party" on friendships for update to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());
```
Cancel (requester, pending) / decline (addressee, pending) / unfriend (either, accepted) all remain the existing
`"friendships delete party"` DELETE policy — no change needed there. See ADR-001.
**Validated:** requester self-accept → denied; addressee accept → `accepted`.

## F2 — Reverse-duplicate pair  (0001_init.sql:103-110; G-D; AC-S3)
**Fix:** a normalized unique index on the unordered pair. Cheaper and more robust than a BEFORE INSERT
reverse-lookup guard (atomic, race-free, one object).
```sql
create unique index if not exists friendships_pair_uniq
  on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
```
The existing PK `(requester_id, addressee_id)` stays (blocks same-direction dup); this index blocks the reverse.
See ADR-002. **Validated:** reverse insert → `unique_violation`.

## F3 — 'blocked' never enforced  (0001_init.sql:135-171; G-B; AC-S4, AC-S5)
**Fix:** model blocking as its own **directional** table (not `friendship_status='blocked'`), and enforce the
hard boundary in the helpers + friendship insert. A block in **either** direction blocks interaction and
overrides any accepted friendship.
```sql
create table if not exists blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)             -- self-block rejected cleanly (edge case)
);
alter table blocks enable row level security;
-- Only the blocker sees/manages their blocks; the blocked user cannot learn they are blocked.
create policy "blocks read own"   on blocks for select to authenticated using (blocker_id = auth.uid());
create policy "blocks insert own" on blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "blocks delete own" on blocks for delete to authenticated using (blocker_id = auth.uid());

create or replace function is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- are_friends now returns false if a block exists -> a block overrides an accepted friendship
-- for interaction AND for private-wall visibility (see F3/G-B and Open-Question resolution).
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

-- Friend request blocked if a block exists in either direction.
drop policy if exists "friendships insert requester" on friendships;
create policy "friendships insert requester" on friendships for insert to authenticated
  with check (requester_id = auth.uid() and not is_blocked(auth.uid(), addressee_id));
```
`can_view_wall` is unchanged: public walls stay world-readable (public-content resolution, ADR-007); private-wall
access is friend-gated and `are_friends` now yields false under a block, so a block removes private access between
the pair. Recipient/eligibility/notification checks in later features consume `are_friends`/`can_contribute`/
`is_blocked`, so they inherit the boundary. See ADR-003, ADR-007.

## F4 — Anonymous author_id exposed on read  (0001_init.sql:252-261; G-A; AC-S6)
**Fix (recommended, cleaner than a view/RPC):** enforce anonymity at the **write** boundary — the sensitive
linkage never enters the client-readable row, so both REST reads **and the realtime payload** are safe. The base
`marks.author_id` holds only the *public* author (NULL when anonymous); the true author of an anonymous mark is
recorded server-side in a **moderator-only** side table.
```sql
create table if not exists anonymous_mark_authors (
  mark_id   uuid primary key references marks(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,   -- null-on-delete: authorless, never stale identity
  created_at timestamptz not null default now()
);
alter table anonymous_mark_authors enable row level security;
-- No policy for anon/authenticated => zero client access. service_role (BYPASSRLS) is the protected moderation path.
revoke all on anonymous_mark_authors from anon, authenticated;

-- On insert of an anonymous mark: record the TRUE author from auth.uid() (not client input), then NULL author_id.
create or replace function marks_capture_anonymous()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.anonymous then
    insert into anonymous_mark_authors (mark_id, author_id) values (new.id, auth.uid())
      on conflict (mark_id) do update set author_id = excluded.author_id;
    new.author_id := null;                 -- base row (REST + realtime) never carries the anon author
  end if;
  return new;
end $$;

drop trigger if exists marks_capture_anon on marks;
create trigger marks_capture_anon before insert on marks
  for each row execute function marks_capture_anonymous();   -- runs before marks_set_defaults ordering not critical; see note

-- Insert policy tolerates the nulled anon author (WITH CHECK runs AFTER the BEFORE trigger — validated).
drop policy if exists "marks insert contributor" on marks;
create policy "marks insert contributor" on marks for insert to authenticated
  with check (
    can_contribute(wall_id, auth.uid())
    and (
      (not anonymous and author_id = auth.uid())
      or (anonymous and author_id is null)
    )
  );
```
`marks_set_defaults` (0001:190) must also stop deriving ownership from the now-nullable `new.author_id`: change its
owner check to `auth.uid() = w.owner_id` (trustworthy, and correct for an owner posting anonymously). Both BEFORE
INSERT triggers coexist; sequence them so ownership/status is computed from `auth.uid()` regardless of nulling
(recommend renaming to a single ordered trigger or naming `marks_capture_anon` to fire first — Backend to keep both
deterministic; the logic does not depend on order because neither reads the other's mutation).

**Client read-path change:** **none required.** `getWallMarks`/`hydrateAuthors` (`src/lib/marks.ts`) already treat
`anonymous || !author_id` as authorless, and the base row now returns `author_id = null` for anonymous marks, so no
view/RPC redirect is needed. **Optional write-path hardening** (recommended, not security-critical since the trigger
enforces it): in `createMark`, send `author_id: draft.anonymous ? null : uid` so the client never even transmits the
value on insert. That is the only client edit in scope; it is a security-necessary data-access edit, not Friends UI.

**Realtime:** the `supabase_realtime` publication still streams `marks` (0001:351) — now safe, because the anon
author is never in the row it streams. No publication change; `subscribeToWall` is unaffected. **Moderator
representation (minimal):** the `service_role` / service key path (BYPASSRLS) reads `anonymous_mark_authors` joined
to `marks`. No moderator table, claim, or console UI is built this cycle — Open-Question #3 resolved: the protected
access path *exists and is reachable* now, satisfying the G-A carve-out without shipping moderation tooling. See ADR-004.

## F5 — Author can self-set pinned/status  (0001_init.sql:266-271; G-E; AC-S7, AC-S8, AC-S9, AC-S10)
**Fix:** a `BEFORE UPDATE` column-guard trigger. It must be **SECURITY INVOKER** (default) so `current_user`
reflects the caller — a SECURITY DEFINER function would report the definer and defeat the service-role branch.
```sql
create or replace function marks_guard_moderation()
returns trigger language plpgsql as $$   -- SECURITY INVOKER (default): current_user = caller
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
```
Authors may still edit content columns (`text`, `color`, `media_url`, `payload`, `rotation`). The existing
`"marks update author or owner"` USING clause already denies an unrelated user C (AC-S9). Owner-also-author and
valid owner moderation (AC-S10) pass the `v_is_owner` branch. `setPinned`/`hideMark` in `src/lib/marks.ts` need no
change — they already run as the owner; the trigger simply rejects them when the caller is a non-owner author. See ADR-005.

## F6 — No Storage bucket/policy migration  (G-A carve-out infra; storage AC / Open-Question #2)
**Fix:** a committed migration `0003_storage_attachments.sql` that reproducibly creates the public `attachments`
bucket and `storage.objects` RLS. Read stays public (marks/avatars embed public URLs — matches `upload.ts`); writes
are authenticated and path-scoped to the two prefixes `upload.ts` actually uses.
```sql
insert into storage.buckets (id, name, public)
  values ('attachments','attachments', true)
  on conflict (id) do update set public = true;

-- Public read (bucket is public; media_url/avatar_url are world-readable public URLs).
create policy "attachments read" on storage.objects for select
  using (bucket_id = 'attachments');

-- Authenticated write, path-scoped: avatars must live under the user's own uid folder; marks under marks/.
create policy "attachments insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (
      ((storage.foldername(name))[1] = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text)
      or (storage.foldername(name))[1] = 'marks'
    )
  );

-- Users manage only their own objects (owner set by Storage to auth.uid()); upsert:false already prevents overwrite.
create policy "attachments modify own" on storage.objects for update to authenticated using (owner = auth.uid());
create policy "attachments delete own" on storage.objects for delete to authenticated using (owner = auth.uid());
```
`marks/{wallId}/…` cannot be uid-scoped at the storage layer (path carries wallId, and the object is uploaded
*before* the mark row exists); contribution authorization is enforced at the `marks` INSERT policy, and the bucket
is public-read regardless, so authenticated + `marks/` prefix is the correct minimal boundary. See ADR-006.

---

## Open-Question resolutions
1. **Block vs. public content (Founder-gate check):** **Adopt Product's recommendation** — a block stops
   *interaction* and hides *private* content between the pair, and does **not** retroactively hide already-public
   content. This is realized without changing the public-visibility model: `are_friends` returns false under a block
   (removing private-wall access and overriding accepted friendship), while `can_view_wall` still returns true for
   `visibility='public'` walls. **No Founder Gate required** — the public model is untouched (ADR-007). Escalate only
   if the Founder later wants full mutual invisibility, which would be a new G-B guarantee re-entering Product.
2. **Reproducible Storage artifact:** a committed SQL migration on `storage.buckets` + `storage.objects` policies
   (`0003`), QA-verifiable in the harness. Resolved; not a Founder gate.
3. **Ship the moderation access path vs. guarantee it:** guarantee it is *reachable now*. `service_role`
   (BYPASSRLS) + the `anonymous_mark_authors` linkage make author-identity retrieval and owner-only ops reachable
   this cycle; no console/UI is built (a Non-Goal). Carve-out is real, not deferred into a gap.

---

# Test-Harness Architecture (Backend implements; specified here)

**Approach:** dependency-light **plain psql + `DO`-block assertions**. pgTAP is **confirmed not available** in the
local PG16 (`pg_available_extensions` has no `pgtap`) and cannot be assumed installable offline — do not adopt it.

**Location & structure** (`supabase/tests/`):
```
supabase/tests/
  00_bootstrap.sql     -- the Supabase-compat SHIM (see required contents below)
  01_seed.sql          -- fixtures: users in auth.users, profiles, walls, marks, friendships, blocks
  10_friendships.sql   -- AC-S1, AC-S2, AC-S3
  20_blocking.sql      -- AC-S4, AC-S5
  30_anonymity.sql     -- AC-S6 (assert author_id null via REST path AND simulated realtime row; moderator can read side table)
  40_mark_moderation.sql -- AC-S7, AC-S8, AC-S9, AC-S10
  50_storage.sql       -- storage insert/read policy assertions + F6 reproducibility
  run_tests.sh         -- runner
```
`run_tests.sh` (each step `ON_ERROR_STOP=1`, non-zero exit on any failed assertion):
`00_bootstrap` → `supabase/migrations/0001_init.sql` → `0002_security_foundation.sql` →
`0003_storage_attachments.sql` → `01_seed` → each `NN_*.sql`. It drops/recreates `public` and the shim schemas
first so it is idempotently re-runnable. Connects as superuser `postgres` on `localhost:5432/sec001_test`
(password supplied via `PGPASSWORD` env — do not hardcode).

**Required SHIM contents (`00_bootstrap.sql`)** — each item below is load-bearing; several were discovered
empirically because their absence silently breaks tests:
- `create schema auth; create schema storage;`
- `auth.users(id uuid pk, …)`; `auth.uid()` = `nullif(current_setting('test.uid', true),'')::uuid`.
- Roles `anon`, `authenticated`, and `service_role` **with `BYPASSRLS`** (mirrors Supabase; required for the
  moderation-path assertions in F4/F5).
- **`grant usage on schema auth to authenticated, anon, service_role` and `grant execute on function auth.uid()`** —
  without this, policies calling `auth.uid()` fail with "permission denied for schema auth" and mask the real result.
- **`grant select,insert,update,delete on all tables in schema public to authenticated` (+ `select` to `anon`)** —
  Supabase grants these by default; without them every test dies on "permission denied for table" *before* RLS is
  evaluated, producing false negatives. Re-run this grant after loading each migration (new tables).
- `storage.buckets`, `storage.objects`, and `storage.foldername(name)` returning path segments **excluding the
  filename** (`(string_to_array(name,'/'))[1:cardinality(string_to_array(name,'/'))-1]`) to match Supabase semantics.
- `create publication supabase_realtime;` (so 0001's `alter publication … add table` succeeds).

**Test idiom (mandatory) — per-test transaction with SET LOCAL:** psql autocommits each statement, so the acting
identity must be set with `BEGIN; set local role <role>; set local "test.uid" = '<uuid>'; …; rollback;`. Setting
`test.uid` transaction-locally in a separate statement leaves it unset for the next statement (validated failure
mode — `auth.uid()` returns NULL and RLS silently matches zero rows, giving a false "denied"). Each test wraps its
action in a `DO` block that RAISES on the unexpected outcome (deny expected → assert an exception was thrown;
allow expected → assert it succeeded and, where relevant, that the row reached the expected state).

**Fidelity rule:** the harness maps 1:1 to AC-S1…AC-S10 and asserts as the acting end-user role (never as a
bypassing superuser except where a test explicitly exercises the `service_role` moderation path). It must **not**
be weakened to accommodate current unsafe behavior (Constitution §13; PRD Success Metrics).

---

## Migration file list
| File | Contents | Reversibility |
|---|---|---|
| `supabase/migrations/0002_security_foundation.sql` | F1 transition trigger + policy; F2 unordered-pair unique index; F3 `blocks` table + `is_blocked` + `are_friends`/`can_contribute` update + friendship-insert block guard; F4 `anonymous_mark_authors` + capture trigger + `marks_set_defaults` owner-via-`auth.uid()` + insert policy; F5 moderation guard trigger. | Additive; down-migration drops new objects and restores 0001 policy bodies. One-time backfill of pre-existing anonymous marks into `anonymous_mark_authors` then null `marks.author_id` (pre-launch → ~0 rows). |
| `supabase/migrations/0003_storage_attachments.sql` | F6 bucket + `storage.objects` RLS. | Drop policies + bucket. Independent of 0002. |

Down-migration note: `friendship_status` enum keeps the now-unused `'blocked'` value (removing an enum value is not
cleanly reversible in Postgres). Tracked as debt (below).

---

## Risk Register (Playbook §20)
| Risk | Category | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| `friendships_pair_uniq` creation fails on pre-existing reverse-dup data | Data | Low (pre-launch) | Medium | Backfill/dedupe check before index create; validated no such data expected. |
| Anon author leaks via realtime INSERT payload | Security | — | High | Closed by design: anon author never enters the base row (F4), so nothing to leak. Harness asserts it on a simulated realtime row. |
| SECURITY DEFINER on moderation trigger would break service-role branch | Security | Med if implemented wrong | High | Spec mandates SECURITY INVOKER; harness exercises service_role path (AC via moderation) to catch regressions. |
| Owner-posts-anonymously mis-statused after nulling author_id | Correctness | Low | Low | `marks_set_defaults` computes ownership from `auth.uid()`, not `author_id`. |
| Harness gives false "denied" from missing grants / GUC scoping | Test integrity | Med | High | Shim grants + per-test `BEGIN/SET LOCAL` idiom documented as mandatory (discovered empirically). |
| Storage `marks/` prefix writable by any authenticated user | Security | Low | Low | Bucket is public-read; mark attachment authorization enforced at `marks` INSERT; accepted, documented. |

## Technical Debt Register — new entries (Playbook §18)
- **DEBT-001 (Data):** `friendship_status` enum retains unused `'blocked'` value after blocking moved to the `blocks`
  table. **Cost:** minor confusion / dead value. **Repayment trigger:** next schema-consolidation migration, or before
  a public API exposes the enum.
- **DEBT-002 (Security/Architecture):** "Moderator" = `service_role` only; no first-class moderator identity/claim.
  **Cost:** cannot grant scoped moderation to a non-service actor without a redesign. **Repayment trigger:** when a
  moderation console or delegated moderators are built (explicit Non-Goal this cycle).

## Reversibility (Constitution §7)
Two-way door overall: both migrations are additive with clear down paths; the only lossy element (enum value) is
tracked as DEBT-001. Data move for anonymous marks is reversible (rejoin from `anonymous_mark_authors`).

## Build Readiness (Charter §25 / Playbook §25)
**Status: NOT READY — pending the design-level Two-Key.** The architecture is complete and internally validated,
but because this is High-Risk (auth/authz + schema) it must clear an **independent design review** before
implementation begins (Charter §19). That review is the only outstanding blocker; on clearance this becomes READY
for Backend/Frontend. This plan does not self-certify as ready to implement.

---

# ADRs

## ADR-001: Friendship transition enforced by trigger + tightened policy; cancel/decline/unfriend via DELETE
Status: Proposed · Date: 2026-08-11
**Context:** 0001's UPDATE policy (using requester OR addressee, no WITH CHECK) lets a requester self-accept (F1).
Reversibility: two-way door.
**Decision:** A `BEFORE UPDATE` trigger authorizes `pending→accepted` to the addressee only and forbids reversion to
`pending`; UPDATE policy gains a `WITH CHECK`. Cancel (requester), decline (addressee), and unfriend (either) are
DELETEs under the existing delete policy — no new status/enum.
**Consequences:** Role-correct transitions server-enforced; no ambiguous status collapse. Trigger is authoritative;
policy is defense-in-depth. **Alternatives:** WITH CHECK alone (cannot express OLD→NEW addressee-only rule); a
`declined` status (adds enum + lifecycle for no benefit over DELETE). Confidence: **Verified** (prototyped).

## ADR-002: Unordered-pair uniqueness via `least()/greatest()` unique index
Status: Proposed · Date: 2026-08-11
**Context:** PK `(requester_id,addressee_id)` permits reverse duplicate `(B,A)` (F2). Two-way door.
**Decision:** `unique index on (least(requester_id,addressee_id), greatest(...))`.
**Consequences:** Atomic, race-free single-pair guarantee; no trigger. **Alternatives:** BEFORE INSERT reverse-lookup
(race-prone, more code); CHECK `requester<addressee` (would force app to canonicalize direction and lose
requester/addressee semantics). Confidence: **Verified** (prototyped — reverse insert raises unique_violation).

## ADR-003: Blocking as a separate directional `blocks` table (not `friendship_status='blocked'`)
Status: Proposed · Date: 2026-08-11
**Context:** `'blocked'` status enforces nothing (F3) and conflates two lifecycles (friendship vs. block) in one row.
One-way-ish (data-model shape) → ADR-worthy.
**Decision:** Directional `blocks(blocker_id, blocked_id)`; `is_blocked(a,b)` is symmetric; `are_friends` and
`can_contribute` consult it; friendship-insert rejects blocked pairs. A block overrides an accepted friendship.
**Consequences:** Block is independent of friendship state, directional (who blocked whom is recorded), and privacy-
preserving (blocked user can't read the block). `'blocked'` enum value retired → DEBT-001. **Alternatives:** overload
friendship status (couples lifecycles, loses direction, can't block a non-friend). Confidence: **Believed-likely**.

## ADR-004: Anonymity enforced at write (null-at-source + moderator-only side table), not a read view/RPC
Status: Proposed · Date: 2026-08-11
**Context:** F4 leaks `author_id` for anonymous marks through the `marks` view **and** the realtime payload; masking
in `hydrateAuthors` is client-side only. G-A requires boundary enforcement with a moderation carve-out (no crypto).
Reversibility: two-way door (data move reversible).
**Decision:** A `BEFORE INSERT` trigger records the true author (from `auth.uid()`) into moderator-only
`anonymous_mark_authors` and sets `marks.author_id = null` for anonymous marks. Ordinary REST reads and realtime
therefore never carry the anon author; `service_role` reads the side table for moderation.
**Consequences:** Strongest boundary (nothing sensitive in the client-readable row) and it neutralizes the realtime
leak with **no** publication change and **no** client read-path redirect. Requires an optional one-line write
hardening in `createMark`. **Alternatives considered & rejected:** (a) `security_invoker` security-barrier VIEW +
`revoke select on marks` — cannot column-mask the realtime payload, and revoking base SELECT breaks realtime
postgres_changes delivery; more moving parts. (b) SECURITY DEFINER RPC for reads — same realtime gap, and diverges
the read path from the existing `.from('marks')` client. Confidence: **Verified** (WITH-CHECK-after-BEFORE-trigger
ordering prototyped).

## ADR-005: Mark moderation via SECURITY INVOKER BEFORE UPDATE column-guard trigger
Status: Proposed · Date: 2026-08-11
**Context:** F5 — author can self-set `pinned`/`status`. Owner-only ops must be server-enforced (G-E), preserving
valid owner moderation (AC-S10). Two-way door.
**Decision:** A `BEFORE UPDATE` trigger blocks changes to `pinned`/`status` (and `wall_id`/`author_id` reassignment)
unless the caller is the wall owner or the privileged `service_role`. It is **SECURITY INVOKER** so `current_user`
reflects the caller. RLS USING already denies non-author/non-owner (AC-S9).
**Consequences:** Authors edit only content columns; owners (incl. owner-authors) and the moderation path retain full
control. **Alternatives:** column-level GRANTs (all-or-nothing per column, can't express owner-vs-author); RLS
WITH CHECK alone (cannot compare OLD vs NEW per-column). Confidence: **Believed-likely**.

## ADR-006: Storage — public read, path-scoped authenticated write
Status: Proposed · Date: 2026-08-11
**Context:** F6 — `attachments` bucket policy not in source control. `upload.ts` uses a public bucket with paths
`avatars/{uid}/…` and `marks/{wallId}/…`; URLs are embedded public. Two-way door.
**Decision:** Committed `0003` migration: create the public bucket; public SELECT; authenticated INSERT scoped so
avatars live under the caller's uid folder and marks under `marks/`; UPDATE/DELETE restricted to the object owner.
**Consequences:** Reproducible and QA-verifiable; matches current upload/read behavior. `marks/` is not uid-scoped
(path carries wallId; object precedes the mark row) — acceptable because the bucket is public-read and contribution
is enforced at the `marks` INSERT policy. **Alternatives:** private bucket + signed URLs (larger change to
read/render paths, out of scope); uid-scoped marks path (would require changing `upload.ts` path scheme + tying
upload to a wall — unnecessary given public bucket). Confidence: **Believed-likely**.

## ADR-007: Block stops interaction + hides private content; already-public content stays public
Status: Proposed · Date: 2026-08-11
**Context:** Open Question #1 — does a block hide the blocker's public wall/marks from the blocked user? Decision B
centers on interaction. Two-way door for interaction rules; the public-visibility model itself is a one-way-ish
product commitment, which this decision deliberately does **not** change.
**Decision:** Adopt Product's recommendation. Blocking denies requests, contribution, eligibility, and private-wall
access between the pair (via `is_blocked` + `are_friends`), but does not retroactively remove read access to
`visibility='public'` walls/marks. No change to `can_view_wall`'s public branch.
**Consequences:** Hard interaction boundary without a privacy-model change or anti-circumvention edge cases
(logged-out/alt-account viewing of public content). **No Founder Gate** — the public model is untouched; if the
Founder wants full mutual invisibility, that is a new G-B guarantee that re-enters Product. Confidence:
**Believed-likely** (matches decision B wording).

---

## AI Readiness Check (Playbook §6) — all met
Zero-context executable (concrete named SQL objects, exact file paths, exact client edit, harness idiom stated);
responsibilities explicit; new-file locations specified; naming consistent with 0001; interfaces concretely typed;
tier stated; each unit fits one agent session. Handoff: **Backend** (0002/0003 + `supabase/tests/`), **Frontend**
(`src/lib/marks.ts` `createMark` optional hardening). Gate: independent design review before implementation begins.
