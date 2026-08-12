# Feature Plan: MVP Batch C — PR C2 (Security / Schema Foundation)

**Author:** Architect Role · **Date:** 2026-08-12
**Governs under:** Architect Charter v2.1 / Architect Playbook v1.1 / AIOS Constitution v1.1
**Source scope:** MVP Batch C. C2 is the HIGH-RISK schema/RLS/trigger foundation that the NORMAL PR C1
(`src/lib/{reactions,notifications,walls,marks}.ts` on `claude/mvp-batch-c-normal`) already depends on and
consumes as a forward contract.
**Builds on:** `0001_init.sql`, `0002_security_foundation.sql` (SEC-001 / FP-SEC-001 Rev 2), `0003_storage_attachments.sql`.
**Status:** PROPOSED — **HIGH-RISK / Two-Key (schema + auth/authz + security architecture)**. Design-level Two-Key
required: this plan **plus an independent design review before implementation begins** (Charter §19, Constitution §16).
**This document does NOT mark itself ready to implement.** No production Supabase deploy is authorized by this plan.

---

## Complexity Estimate
- **Tier:** High-Risk / Architectural (schema change + authorization architecture + security). Playbook §7.
- **Complexity:** Complex (four interacting additive migrations; secret-content isolation and an anonymity-analogous
  side table; membership rewired into two authorization helpers used by nearly every read/write policy).
- **Rough effort:** ~3–4 focused Backend sessions (migrations + harness), ~1 short Frontend session (secret read path
  in C1), ~1 Reviewer + 1 QA pass.
- **Files affected:** 4 new migrations (`0004`–`0007`), 4 new test files + seed/runner edits under `supabase/tests/`,
  1 new Frontend read function (`src/lib/marks.ts` or a new `src/lib/secrets.ts`). No change to C1's write paths.
- **Database impact:** Additive migration only — new tables (`mark_secrets`, `wall_members`), new nullable columns on
  `profiles`, new enums, new triggers/functions, one additive `marks` table CHECK + one additive `notifications.kind`
  CHECK, `create-or-replace` of two existing helpers (`can_view_wall`, `can_contribute`). No destructive DDL, no data
  backfill (pre-launch → expected zero rows).
- **Dependency risk:** None (no new third-party packages; psql harness reused, pgTAP still not adopted).
- **Approximate AI session count:** 4–6.
- **Implementation phases:** (1) `0004` secret marks + harness; (2) `0005` wall members + harness; (3) `0006`
  notification triggers + harness (depends on `0005`); (4) `0007` profile links + harness; (5) Frontend secret read
  path; (6) Reviewer, then QA.
- **Operational risk:** High — touches authorization (`can_view_wall`/`can_contribute`), public user-generated content,
  and a new confidentiality guarantee (secret content). This is the point of C2.

## Recommended Build Order
1. **Backend** — `0004_secret_marks.sql` + `supabase/tests/60_secret_marks.sql`. Independent of B/C/D; can go first.
2. **Backend** — `0005_wall_members.sql` + `supabase/tests/70_wall_members.sql`. Rewires `can_view_wall`/`can_contribute`.
3. **Backend** — `0006_notification_triggers.sql` + `supabase/tests/80_notifications.sql`. **Depends on `0005`** (the
   `shared_wall_invite` trigger targets `wall_members`; the mark trigger classifies personal vs shared by `walls.type`).
4. **Backend** — `0007_profile_social_links.sql` + `supabase/tests/90_profile_links.sql`. Independent; can parallel 1–3.
5. **Frontend** — secret read path in C1 (see §A, "Client read path"). Depends on `0004` shipping. Not security-critical
   (the server is the boundary); can run in parallel with 2–4.
6. **Reviewer** (re-executes the full harness, `run_tests.sh`), then **QA** (behavioral, RLS-as-end-user).

**Roles required:** **Backend** (owns all four migrations + all harness files — the bulk) and **Frontend** (owns only
the new secret read function that renders owner-visible secret content). No other implementation Role this cycle.

---

## Goal
Turn four client-side or absent guarantees into server-enforced ones, additively, before more of Batch C is built on
them: (A) make Secret Marks *actually* secret at the data boundary — content unreadable by anyone but the wall
owner/recipient and moderation, and un-leakable via realtime; (B) introduce the missing `wall_members` model so private
shared walls are member-gated; (C) populate the existing `notifications` table via triggers, since it has no client
insert policy and is legitimately empty today; (D) add the profile social-link columns. C1 already treats all four as
forward contracts and degrades honestly until C2 lands.

## Repository Discovery (Playbook §4) — findings relied on
- Schema/RLS baseline: `0001_init.sql` (walls/marks/reactions/comments/friendships/notifications/reports; `can_view_wall`
  0001:146-157, `can_contribute` 0001:160-171). `0002_security_foundation.sql` adds blocking, the anonymity side-table
  pattern (`anonymous_mark_authors`, two-trigger null-at-source), friendship transition guards, and the
  moderation column-guard. `0003` = storage. No later migration alters these.
- C1 consumers (branch `claude/mvp-batch-c-normal`): `marks.ts` (`createMark` sends `text` for every type incl. secret;
  `subscribeToWall` streams `marks` INSERTs), `reactions.ts` (writes `mark_reactions`; explicitly notes reaction→author
  notification is a "C2 dependency" it does not fake), `notifications.ts` (`notificationMessage`/`notificationRoute`
  resolvers keyed on a `kind` vocabulary, degrade gracefully on unknown kinds), `walls.ts` (creates PUBLIC shared walls
  only; documents `wall_members`, private shared walls, and invites-as-membership as C2).
- Test harness: `supabase/tests/` psql pattern — a Supabase-compat shim (`00_bootstrap.sql`: `auth.uid()` reads the
  `test.uid` GUC, roles `anon/authenticated/service_role`, realtime publication, storage shim), deterministic
  `01_seed.sql`, per-area files with `SET LOCAL ROLE` + `SET LOCAL "test.uid"` and `DO`-block assertions, run by
  `run_tests.sh` (drop/recreate DB → shim → migrations → seed → each area; nonzero on first failed assertion). **Reused
  as-is; extended, never weakened.**
- ADRs to date: ADR-001…ADR-007 live inline in `FP-SEC-001-security-feature-plan.md`. C2 continues at **ADR-008**.
- No `docs/TECHNICAL_DEBT_REGISTER.md` exists yet; C2 seeds its first entries (see §Technical Debt).

## Empirical validation (Playbook §4, Constitution §12 — **Verified**)
Prototyped the three riskiest designs in a throwaway local PG16 DB (`c2_scratch`) loaded shim → 0001 → 0002 → 0003 →
seed, then dropped the scratch DB (the shared `sec001_test` DB was **not** touched). All passed:
- **A (secret isolation):** author sends `text`; BEFORE-INSERT trigger moves it to `mark_secrets` and nulls the base
  row → base `marks.text` NULL; non-owner SELECT on `mark_secrets` returns **0 rows** (RLS); wall owner reads content;
  `service_role` reads content; `mark_secrets` is **absent** from `supabase_realtime` while `marks` remains present.
- **B (membership):** accepted member can view+contribute a private shared wall; non-member cannot; owner can; a public
  shared wall is unaffected for an unrelated (non-blocked) user; the `wall_members` SELECT policy referencing
  `is_wall_member` (SECURITY DEFINER) does **not** recurse.
- **C (notification trigger):** a SECURITY DEFINER `AFTER INSERT` trigger on `mark_reactions` inserts a notification
  **despite `notifications` having no client insert policy**; a reaction on an **anonymous** mark notifies the **true**
  author (read from `anonymous_mark_authors` by the definer) with **no** de-anonymization of the base row; a
  self-reaction produces **no** notification.

---

## Area A — TRUE Secret Marks  *(the hard one; anonymity-analogous)*
**One-liner:** Secret = *content* hidden from all but the wall owner/recipient (+ `service_role`); enforced by moving
the content into an RLS-gated `mark_secrets` side table at write time and leaving the base `marks` row (and its
realtime payload) content-free.

### The leak being closed
Today `marks.text` is world-readable via RLS *and* streamed through the `supabase_realtime` publication
(0001:351). A "secret" Mark is only client-blurred → the content is fully retrievable by any viewer over REST **and**
over realtime. This is a real confidentiality leak, structurally identical to the F4 anonymity leak SEC-001 closed —
so C2 mirrors the SEC-001 side-table pattern, adapted for *content* rather than *authorship*.

### DB objects (migration `0004_secret_marks.sql`)
```
-- side table: content lives ONLY here; NEVER on marks; NEVER in the realtime publication.
create table if not exists mark_secrets (
  mark_id uuid primary key
    references marks(id) on delete cascade deferrable initially deferred,  -- see ADR-008
  content    text not null,
  created_at timestamptz not null default now()
);
alter table mark_secrets enable row level security;

-- READ = wall owner (the recipient) only, via a join to walls. Deliberately NO author_id
-- column and NO author read-back → an anonymous+secret mark cannot be de-anonymized by the
-- owner reading the content (identity stays in anonymous_mark_authors, service_role only).
create policy "mark_secrets read owner" on mark_secrets for select to authenticated
  using (exists (select 1 from marks m join walls w on w.id = m.wall_id
                 where m.id = mark_secrets.mark_id and w.owner_id = auth.uid()));

-- moderation path: explicit grant (BYPASSRLS is not a table GRANT — same lesson as 0002 F4).
grant select on mark_secrets to service_role;

-- write-boundary move: single BEFORE INSERT trigger (see ADR-008 for why single, not two).
create or replace function marks_extract_secret()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'secret' and new.text is not null then
    insert into mark_secrets (mark_id, content) values (new.id, new.text)
      on conflict (mark_id) do update set content = excluded.content;   -- deferred FK satisfied at commit
    new.text := null;   -- base row + realtime INSERT payload carry NO secret content
  end if;
  return new;
end $$;
create trigger marks_extract_secret before insert on marks
  for each row execute function marks_extract_secret();

-- LIFECYCLE guard (see ADR-008 / R-A2): a plain table CHECK keeps secret content off the
-- base row across the WHOLE row lifecycle, not just at INSERT. Evaluated AFTER BEFORE triggers,
-- so the trigger-nulled INSERT passes; a later `update marks set text=… where <secret>` by the
-- author OR the wall owner is rejected (check_violation) — closing the "authorized party can
-- re-populate and broadcast the secret via realtime" path, and preventing a stale duplicate
-- vs mark_secrets. Non-secret marks are unaffected.
alter table marks add constraint marks_secret_text_null
  check (type <> 'secret' or text is null);
```
- **NOT** added to `supabase_realtime`. (Assertion in the harness guards this.)
- Compatible with anonymity: for an anonymous **and** secret mark, `marks_null_anon` (0002) nulls `author_id` and
  `marks_extract_secret` moves `text` — independent BEFORE-INSERT triggers, no interaction. Identity → service-role-only
  side table; content → owner-readable side table; base row carries neither.
- `marks_set_defaults`/`marks_null_anon` ordering is unaffected (this trigger only touches `text`).

### How the composer writes it (enforcement, not client trust)
C1's `createMark` **already** sends the secret in `marks.text` with `type='secret'` — **no C1 write change**. The
server, not the client, guarantees the content never persists on `marks`: the BEFORE-INSERT trigger moves it. Even a
malicious client that inserts a secret with content in `text` has that content moved off the base row before commit.
The `marks_secret_text_null` CHECK (above) extends that guarantee across the row's whole lifecycle: it is evaluated
after the BEFORE trigger (so the trigger-nulled INSERT passes) and rejects any later UPDATE — by the author OR the wall
owner — that would write `text` back onto a secret row. Note this makes the base `marks.text` **write-once-empty** for
secrets; editing a secret's content is therefore an operation on `mark_secrets` (owner/author flow), not a future
`update marks set text` — see R-A2 and Future Extensions.

### Client read path (Frontend, hands off from this plan)
New read function (C1 follow-up, e.g. `getSecretContents(markIds): Record<markId, string>`): selects `mark_secrets` for
the given ids; RLS returns rows **only** for marks on walls the caller owns. Rendering rule for `type='secret'`:
if a content row came back → show it (owner/recipient); else show C1's existing `🔒 Only you can open this`. Because the
base `marks.text` is NULL for secrets, every non-owner path (REST list, realtime stream) already shows the lock with no
extra work — the read function is purely additive for the owner.

**Recipient semantics (MVP):** the sole non-moderation reader is the **wall owner**. There is no per-mark `recipient_id`
and no author read-back. Directed secrets (secret to a specific chosen user) and author re-reading are **deferred**
(Future Extensions) — both are additive later (a `recipient_id` column + an extra RLS disjunct).

---

## Area B — Shared-Wall Member Model
**One-liner:** Add `wall_members(wall_id,user_id,role,status)` (MVP roles owner/member, status pending→accepted) and
teach `can_view_wall`/`can_contribute` that a shared wall is gated by accepted membership — leaving personal walls and
public walls exactly as they are.

### DB objects (migration `0005_wall_members.sql`)
```
create type wall_member_role   as enum ('owner','member');       -- no admin hierarchy (MVP)
create type wall_member_status as enum ('pending','accepted');

create table if not exists wall_members (
  wall_id    uuid not null references walls(id)      on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       wall_member_role   not null default 'member',
  status     wall_member_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (wall_id, user_id)
);
create index if not exists wall_members_user_idx on wall_members (user_id, status);
alter table wall_members enable row level security;

create or replace function is_wall_member(wid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from wall_members wm
                 where wm.wall_id = wid and wm.user_id = uid and wm.status = 'accepted');
$$;
```
Ownership stays sourced from `walls.owner_id` (no owner membership row required); `is_wall_member` checks **accepted**
membership only.

### RLS (mirrors the SEC-001 friendship-invite pattern)
```
-- roster read: your own rows, the wall owner sees all, members see co-members.
create policy "wall_members read" on wall_members for select to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from walls w where w.id = wall_id and w.owner_id = auth.uid())
         or is_wall_member(wall_id, auth.uid()));            -- SECURITY DEFINER → no RLS recursion (validated)

-- invite: ONLY the wall owner may create a membership, and it MUST start pending as 'member'
-- (closes the "insert-as-accepted" / "insert-as-owner" vector — same lesson as 0002 F1).
-- F3 tidy: require the target wall to be SHARED, so no inert membership rows can be created on
-- personal walls (harmless today — is_wall_member is only consulted for type='shared' — but this
-- keeps the table free of dead data).
create policy "wall_members invite owner" on wall_members for insert to authenticated
  with check (exists (select 1 from walls w
                      where w.id = wall_id and w.owner_id = auth.uid() and w.type = 'shared')
              and status = 'pending' and role = 'member');

-- accept: only the invited user flips their own pending→accepted (guard trigger enforces the transition).
create policy "wall_members accept self" on wall_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- remove/leave: the member themselves, or the wall owner.
create policy "wall_members remove" on wall_members for delete to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from walls w where w.id = wall_id and w.owner_id = auth.uid()));

grant select, insert, update, delete on wall_members to authenticated;

-- transition guard (mirror friendships_guard_transition, 0002): only pending→accepted, no backward,
-- identity/role immutable, only the invited user may accept.
create or replace function wall_members_guard_transition() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if old.status = 'pending' and new.status = 'accepted' then
    if auth.uid() <> old.user_id then
      raise exception 'C2_MEMBER: only the invited user may accept a wall invite'; end if;
  elsif new.status = 'pending' then
    raise exception 'C2_MEMBER: cannot move a membership back to pending';
  end if;
  if new.wall_id <> old.wall_id or new.user_id <> old.user_id or new.role <> old.role then
    raise exception 'C2_MEMBER: cannot reassign or re-role a membership';
  end if;
  return new;
end $$;
create trigger wall_members_transition before update on wall_members
  for each row execute function wall_members_guard_transition();
```

### Wiring into the two authorization helpers (create-or-replace, additive disjuncts)
```
-- can_view_wall: public unchanged; PERSONAL-private stays friend-gated; SHARED becomes member-gated.
... where w.id = wid and (
      w.visibility = 'public'
   or w.owner_id = uid
   or (w.type = 'personal' and w.visibility = 'private' and are_friends(w.owner_id, uid))
   or (w.type = 'shared'   and is_wall_member(wid, uid))
)

-- can_contribute: keep 0002's block check + owner/everyone/friends; ADD shared-member contribution.
... where w.id = wid and not is_blocked(w.owner_id, uid) and (
      w.owner_id = uid
   or (w.contribution_policy = 'everyone')
   or (w.contribution_policy = 'friends' and are_friends(w.owner_id, uid))
   or (w.type = 'shared' and is_wall_member(wid, uid))
)
```
**Deliberate refinement (ADR-009):** in 0001/0002 a private wall used `are_friends` regardless of type. C2 splits this:
private **personal** walls remain friend-gated; private/`invite_only` **shared** walls become **member**-gated. No
private shared walls exist operationally today (C1 creates public shared walls only), so this is additive in practice,
but it is a semantic change and is called out in the Risk register and ADR-009. Public shared walls (`everyone`) are
untouched — validated.

---

## Area C — Notification Triggers
**One-liner:** SECURITY DEFINER `AFTER` triggers populate the existing `notifications` table (which has no client insert
policy) for the six Batch-C events, writing a fixed `kind` vocabulary and **never** leaking secret content (there is no
content field) or an anonymous author (`actor_id` is nulled for anonymous marks).

### `kind` vocabulary (canonical, reconciled with C1)
Emitted by triggers: **`mark_left`**, **`shared_wall_mark`**, **`reaction`**, **`friend_request`**,
**`friend_accepted`**, **`shared_wall_invite`**. Reserved (no trigger this cycle, but accepted for forward compat):
**`comment`**. C1's `notificationMessage`/`notificationRoute` already map every one of these exact strings (it also
carries harmless synonyms `mark`/`friend_accept` that triggers never emit) → **no C1 change required**.

Enforced additively via a CHECK constraint documenting the vocabulary (only triggers write, so this is safe; an enum
type change was rejected as more invasive — ADR-010):
```
alter table notifications
  add constraint notifications_kind_ck
  check (kind in ('mark_left','shared_wall_mark','reaction','friend_request',
                  'friend_accepted','shared_wall_invite','comment'));
```
**Payload:** existing columns only — `user_id` (recipient), `actor_id` (nullable; NULL for anonymous marks), `kind`,
`mark_id` (nullable), `wall_id` (nullable). No new columns.

### Trigger set (migration `0006_notification_triggers.sql`; all `SECURITY DEFINER set search_path=public`)
| Trigger (on) | Event | Recipient (`user_id`) | `actor_id` | `kind` | Skip / no-leak rule |
|---|---|---|---|---|---|
| `marks` AFTER INSERT | Mark left | wall `owner_id` | `auth.uid()`, or **NULL if `new.anonymous`** | `mark_left` (personal) / `shared_wall_mark` (shared, by `walls.type`) | skip if `auth.uid() = owner` (self); anon → actor NULL, no de-anon |
| `mark_reactions` AFTER INSERT | Reaction | **true** mark author (anon → from `anonymous_mark_authors`, else `marks.author_id`) | `new.user_id` (reactor) | `reaction` | skip if author NULL or author = reactor |
| `friendships` AFTER INSERT | Friend request | `new.addressee_id` | `new.requester_id` | `friend_request` | (pair guaranteed distinct by 0001 CHECK) |
| `friendships` AFTER UPDATE | Request accepted | `new.requester_id` | `new.addressee_id` | `friend_accepted` | only when `old.status='pending' AND new.status='accepted'` |
| `wall_members` AFTER INSERT | Shared-wall invite | `new.user_id` (invitee) | `auth.uid()` (owner) | `shared_wall_invite` | only when `new.status='pending'` |

Notes:
- **Why SECURITY DEFINER:** `notifications` has **no** client insert policy (0001:334-341, deliberate). A caller-invoked
  trigger must run as the table owner to insert on the recipient's behalf. Validated: the insert succeeds under an
  ordinary `authenticated` caller. (ADR-010.)
- **Skip-self** for the mark trigger uses `auth.uid()` (the true author) — correct even when the base row's `author_id`
  is NULL because the poster is an owner posting anonymously on their own wall.
- **No-leak guarantees:** notifications carry no content column → secret content cannot leak; `actor_id` is NULL for
  anonymous marks → the mark trigger cannot de-anonymize; the reaction trigger notifies the author *about their own*
  mark (actor = the non-anonymous reactor), which reveals nothing hidden.
- **Shared-wall Mark fan-out (MVP):** notify the wall **owner only**, not every member (avoids N-row inserts per mark
  and notification spam). Member fan-out is deferred (Future Extensions / TDR).
- **Comment notifications** are **out of scope** this cycle (not in the Batch-C event list); `comment` is reserved in
  the vocabulary so C1's existing branch and a future trigger need no rework.
- **De-dup / rate limiting** on reactions (react/unreact churn) is **not** built (MVP). Logged as DEBT-C2-1.

---

## Area D — Profile Social-Link Columns
**One-liner:** Five additive nullable `text` columns on `profiles`; existing RLS already governs them.

### DB objects (migration `0007_profile_social_links.sql`)
```
alter table profiles
  add column if not exists instagram text,
  add column if not exists tiktok    text,
  add column if not exists youtube   text,
  add column if not exists x         text,
  add column if not exists website   text;
```
- Writes: covered by the existing `"profiles update self"` policy (0001:231-233) — self-update only. Reads: covered by
  world-readable `"profiles read"` (0001:226-227). **No new policy.**
- Format/URL validation (handle vs full URL, scheme allow-listing) is **left to the client** — noted deliberately; a DB
  CHECK is not added at MVP (§21 avoids premature constraint; validation is a UX concern owned by Frontend/Product).
  Individual named columns (not a `social_links` jsonb) are chosen for discoverability/naming-as-interface (Playbook §6).

---

## Test-Harness Additions (extend SEC-001 psql harness — never weaken)
New per-area files, same idiom (`SET LOCAL ROLE` + `SET LOCAL "test.uid"` + `DO`-block assertions), wired into
`run_tests.sh`'s load order (add `0004`–`0007` after `0003`) and its area loop; seed extended additively in `01_seed.sql`.

- **`60_secret_marks.sql`** — author sends `text` on a `type='secret'` mark → base `marks.text` is NULL; a non-owner
  authenticated reader gets **0 rows** from `mark_secrets`; the wall owner reads the content; `service_role` reads the
  content; `pg_publication_tables` shows `mark_secrets` **absent** from `supabase_realtime` and `marks` present; an
  anonymous+secret mark hides **both** author (base row) and content (base row) while the owner reads content without
  learning the author. **Lifecycle assertion (closes F1/R-A2):** after a secret is created, an author `update marks set
  text='…'` on that secret is **rejected** (`check_violation`) and the base row's `text` stays NULL — proving the leak
  cannot be re-introduced by an authorized editor; the same UPDATE by the wall owner is likewise rejected; a normal
  (non-secret) mark's `text` UPDATE still succeeds (the CHECK does not over-restrict).
- **`70_wall_members.sql`** — accepted member can view+contribute a private shared wall; non-member cannot view or
  contribute; owner can; a public shared wall stays viewable+contributable for an unrelated non-blocked user; the
  invite-as-owner / accept-as-invitee transition guard holds (non-owner cannot insert a membership; a third party
  cannot accept someone else's invite; no move back to pending); an owner's invite targeting a **personal** wall is
  rejected by the invite WITH CHECK (F3 — `type='shared'` required); `wall_members` roster SELECT does not recurse.
- **`80_notifications.sql`** — each of the five triggers inserts exactly one row for the right recipient with the right
  `kind`; **no** self-notification (mark by owner on own wall; self-reaction); a reaction on an **anonymous** mark
  notifies the true author with `actor_id` = reactor and **no** de-anon of the base row; a `mark_left` for an anonymous
  mark carries `actor_id = NULL`; the `kind` CHECK rejects an out-of-vocabulary value.
- **`90_profile_links.sql`** — a user updates their own link columns and they persist; a different user's update of
  those columns affects **0 rows** (existing `"profiles update self"` RLS); the columns read back world-readable.

Seed (`01_seed.sql`) additions (additive, existing fixtures unchanged): a private shared wall owned by O, an accepted
member (B), a pending invitee, and a non-member (an unrelated non-blocked user for the public-wall control). Secret and
anonymous-secret marks are created inline in `60`/`80` (as `30_anonymity.sql` does), not seeded.

**Regression guard reused:** `run_tests.sh`'s storage-ownership ALTER guard stays; none of `0004`–`0007` touches
`storage.objects`, so it remains green.

---

## Risk Register (Playbook §20)
| ID | Risk | Cat | L | I | Mitigation |
|---|---|---|---|---|---|
| R-A1 | A future column added to `marks` re-introduces a content leak via realtime (whole row is published) | Security | Med | High | Rule (ADR-008): no confidential field ever lands on a realtime-published table; harness asserts `mark_secrets` stays out of the publication. Reviewer checks any later `marks` column. |
| R-A2 | Secret-content leak/consistency across the row lifecycle: an INSERT-only trigger let an author/owner `update marks set text` re-populate the realtime-published base row (broadcast to all viewers) and leave a stale duplicate vs `mark_secrets` | Security | Med | High | **Fixed (design review F1):** plain table CHECK `type<>'secret' or text is null` — evaluated after BEFORE triggers, so INSERT passes and any later secret-text UPDATE (author or owner) is rejected; harness asserts both. Also documents that deferrable-FK BEFORE-INSERT write is non-obvious → ADR-008 records the reason and contrasts 0002's two-trigger anonymity. **Verified.** |
| R-A3 | Secret on a **public** shared wall is readable by that wall's owner, who may be a stranger to the author | Product/Trust | Med | Med | **Founder decision F-1** (below). Design supports restricting via one predicate if Product wants secrets limited to personal/friend walls. |
| R-B1 | Private-shared walls change from friend-gated to member-gated (semantic change to `can_view_wall`) | Security/Product | Low | Med | ADR-009; no private shared walls exist today (C1 = public only); harness proves personal + public paths unchanged. |
| R-B2 | `is_wall_member` used inside `wall_members`' own SELECT policy could recurse | Technical | Low | High | SECURITY DEFINER bypasses RLS on the queried table (same as `are_friends`); **validated** no recursion. |
| R-C1 | Reaction churn (react/unreact) spams notifications | Product | Med | Low | Accepted for MVP; DEBT-C2-1 (dedup/rate-limit trigger later). |
| R-C2 | A trigger de-anonymizes or leaks secret content | Security | Low | High | Structural: no content column on `notifications`; `actor_id` NULLed for anon marks; **validated**. |
| R-C3 | `kind` CHECK too tight blocks a future trigger | Maintainability | Low | Low | Reserved `comment`; adding a kind is an additive `alter … drop/add constraint`. |
| R-D1 | Unvalidated social links (phishing URL in a profile) | Security/Product | Low | Low | Client-side validation owned by Frontend/Product; world-readable but self-write-only. |

## Reversibility (Constitution §7)
Every change is a **two-way door**: all DDL is additive (new tables/columns/enums/triggers; `create or replace` of two
helpers whose prior bodies are recoverable from `0001`/`0002`). No destructive DDL, no backfill, no data loss path
(pre-launch, expected zero rows). Rollback = drop the new objects and restore the `0002` bodies of
`can_view_wall`/`can_contribute`. The one **product** commitment worth naming as sticky is the secret-content
confidentiality guarantee itself (R-A3 / F-1) — reversible in code, but a trust promise once users rely on it.

## Technical Debt seeded (Playbook §18 — new `docs/TECHNICAL_DEBT_REGISTER.md`)
- **DEBT-C2-1** (Performance/Product): no de-dup/rate-limit on reaction notifications. Repayment trigger: first report of
  notification spam, or before reactions ship at scale.
- **DEBT-C2-2** (Architecture): shared-wall Mark notifications go to the owner only, not members. Repayment trigger:
  when member activity feeds are prioritized.
- **DEBT-C2-3** (Data): secret Marks have no author read-back and no directed `recipient_id`. Repayment trigger: when
  "secret to a specific person" or "re-read your own secret" becomes a product requirement.

---

## ADRs

### ADR-008: Secret Marks — content moved to an RLS-gated side table via a single deferrable-FK BEFORE-INSERT trigger; owner-read; never published to realtime
Status: Proposed · Date: 2026-08-12 · Reversibility: two-way door.
**Context:** `marks.text` is world-readable and streamed via `supabase_realtime`; a "secret" is only client-blurred →
content leaks over REST and realtime. Confidentiality must be enforced at the data boundary with a moderation carve-out,
analogous to SEC-001's F4 anonymity fix but for *content*, not *authorship*.
**Decision:** A `mark_secrets(mark_id, content)` side table holds the content; the base `marks` row carries `text = NULL`
for secrets. RLS grants SELECT to the wall **owner** (the recipient) only; `service_role` gets an explicit grant for
moderation. `mark_secrets` is **not** added to the realtime publication. A **single** `BEFORE INSERT` trigger on `marks`
moves the content into `mark_secrets` and nulls `text`; the side table's FK to `marks(id)` is
`DEFERRABLE INITIALLY DEFERRED` so the child insert (which precedes the parent's visibility) validates at commit.
`mark_secrets` deliberately stores **no `author_id`**, so an anonymous+secret mark cannot be de-anonymized by the owner
reading its content. A plain table CHECK on `marks` — `check (type <> 'secret' or text is null)` — makes the guarantee
hold across the **whole row lifecycle**, not just at INSERT: because table CHECKs run *after* BEFORE triggers, the
trigger-nulled INSERT passes, while any later `update marks set text=…` on a secret (by the author or the wall owner) is
rejected. This closes the lifecycle leak an INSERT-only trigger left open — an authorized editor re-populating the
client-readable, realtime-published `text` and broadcasting the secret to all viewers — and also prevents a stale
duplicate diverging from `mark_secrets`. Editing a secret's content is therefore a `mark_secrets` operation, never a
`marks.text` write.
**Why single trigger here, vs. SEC-001's two triggers for anonymity:** anonymity's `AFTER` trigger only needs
`auth.uid()`, which is available fresh in the `AFTER` phase — no data must cross from `BEFORE`. Secrets are different:
the content exists only on the incoming row in the `BEFORE` phase and must not persist on `marks` at all (else the
realtime WAL row leaks it), so it has to be moved out *during* `BEFORE`. The deferrable FK lets one `BEFORE` trigger both
write the child and null the parent column, which is simpler and more explicit than carrying the content across a
`BEFORE`/`AFTER` pair via a transaction-local GUC. (SEC-001 ADR-004 explicitly considered the deferrable-FK option and
chose two triggers *for anonymity's* self-documentation; the trade-off resolves the other way for content.)
**Consequences:** Strongest boundary — nothing secret on the client-readable row or the realtime payload, with **no**
publication change and **no** client write change (C1 keeps sending `text`). The owner reads content via a new additive
client query; everyone else sees the existing lock for free. Requires the explicit `service_role` grant (BYPASSRLS is
not a table GRANT — same lesson as 0002 F4).
**Alternatives rejected:** (a) client writes `mark_secrets` directly + a `marks` WITH-CHECK forbidding secret `text` on
INSERT — two non-atomic round trips and rejects C1's current honest write (note: the chosen design keeps the honest
client write via the trigger, and uses a *table* CHECK — which also covers UPDATE — rather than an INSERT-only WITH
CHECK); (b) a BEFORE UPDATE trigger branch to block secret-text UPDATEs — works, but the plain table CHECK is cheaper,
declarative, and self-documenting, and was preferred by the design review; (c) two triggers carrying content via a
transaction-local GUC — more magic than a deferrable FK (Constitution §5 explicitness); (d) a security-barrier VIEW or
`revoke select on marks` — cannot mask the realtime payload and breaks `postgres_changes` delivery; (e) encrypting
content in-row — key management out of scope, still streams ciphertext.
**Confidence: Verified** end-to-end in `c2_scratch` (throwaway DB, dropped): a secret INSERT with content leaves base
row `text` NULL and stores it in `mark_secrets`; non-owner 0 rows; owner + `service_role` read; absent from the realtime
publication; and — post design-review — an author's **and** the owner's `update marks set text` on a secret is rejected
by the `marks_secret_text_null` CHECK while a non-secret text edit still succeeds (the lifecycle-leak fix).

### ADR-009: Shared walls are membership-gated; private **personal** walls stay friend-gated
Status: Proposed · Date: 2026-08-12 · Reversibility: two-way door (interaction rules); the shared-wall access *model* is
a product commitment.
**Context:** No `wall_members` table exists; C1 can only build public shared walls. Private shared walls need a
membership boundary distinct from friendship. `0001`/`0002` gated **all** private walls by `are_friends`.
**Decision:** Add `wall_members` (roles owner/member; status pending→accepted) and `is_wall_member`. Rewire
`can_view_wall`/`can_contribute` so a **shared** wall is gated by accepted membership, a **private personal** wall stays
friend-gated, and **public** walls are unchanged. Invites follow the SEC-001 friendship pattern: owner-only INSERT that
must start `pending`/`member`; invited-user-only accept guarded by a transition trigger; owner-or-self DELETE.
**Consequences:** Private shared walls become member-gated (a deliberate semantic refinement; no such walls exist today).
The invite/accept flow reuses a proven, already-reviewed shape (transition guard + WITH-CHECK). `is_wall_member` is
SECURITY DEFINER, so referencing it inside `wall_members`' own SELECT policy does not recurse (validated) — same
mechanism as `are_friends`.
**Alternatives rejected:** (a) `friendship_status`-style flag on friendships to model membership — conflates two
different relationships; (b) a `wall_members.role='admin'` hierarchy, channels, threads — YAGNI for MVP; (c) deriving
membership from a JSON array on `walls` — violates the many-to-many join-table rule (Playbook §11).
**Confidence: Verified** (member/non-member/owner/public paths and non-recursion all validated).

### ADR-010: Notifications populated by SECURITY DEFINER triggers over a fixed, CHECK-enforced `kind` vocabulary; structurally leak-proof
Status: Proposed · Date: 2026-08-12 · Reversibility: two-way door.
**Context:** `notifications` has no client insert policy by design; it is empty until server-side population exists. Six
Batch-C events must create notifications without leaking secret content or anonymous authorship, and must match C1's
already-shipped `kind` resolvers.
**Decision:** One SECURITY DEFINER `AFTER` trigger per source table inserts on the recipient's behalf (definer = table
owner, so the missing client insert policy is bypassed intentionally and only for these audited paths). `kind` is a fixed
vocabulary (`mark_left`, `shared_wall_mark`, `reaction`, `friend_request`, `friend_accepted`, `shared_wall_invite`; plus
reserved `comment`) enforced by an additive CHECK constraint. `actor_id` is NULL for anonymous marks; the reaction
trigger resolves the true author (from `anonymous_mark_authors` for anon marks) but notifies **that author**, revealing
nothing hidden. Self-events are skipped via `auth.uid()`.
**Consequences:** C1 needs no change (it maps these exact strings and degrades on unknowns). No content column exists, so
secret content cannot leak; anon authorship cannot leak because `actor_id` is nulled. Reaction de-dup and shared-wall
member fan-out are deferred (DEBT-C2-1/2).
**Alternatives rejected:** (a) converting `kind` to an enum type — a column type change, more invasive than an additive
CHECK; (b) a client insert policy on `notifications` with a WITH-CHECK — clients could forge notifications to other users
and set arbitrary `kind`; (c) an Edge Function/RPC per event — more moving parts than a trigger, same privilege need.
**Confidence: Verified** for the reaction path (SECURITY DEFINER insert succeeds with no client policy; anon author
notified without de-anon; self-reaction skipped). Believed-likely for the other four (identical mechanism; to be proven
green in `80_notifications.sql`).

### ADR-011: Profile social links as additive nullable columns (no DB validation)
Status: Proposed · Date: 2026-08-12 · Reversibility: two-way door.
**Context:** Profiles need Instagram/TikTok/YouTube/X/website. Trivial, but it is a schema change.
**Decision:** Five nullable `text` columns on `profiles`; rely on the existing self-write / world-read RLS; no new
policy; format validation left to the client.
**Consequences:** Minimal surface; discoverable named columns beat a `social_links` jsonb for naming-as-interface. No DB
CHECK at MVP (validation is a UX concern; premature-constraint avoided).
**Alternatives rejected:** (a) `social_links` jsonb — less discoverable, invites stringly-typed keys; (b) DB URL CHECK —
premature; format policy is Product/Frontend's.
**Confidence: Verified** (additive nullable columns under existing RLS — trivially correct; harness confirms).

---

## AI Readiness Check (Playbook §6) — all met
Zero-context executable (named SQL objects, exact migration filenames, exact trigger/policy bodies, harness file list and
idiom, the one new Frontend read function named); responsibilities explicit (Backend owns 4 migrations + 4 harness files;
Frontend owns the secret read path); new-file locations specified against `supabase/migrations` and `supabase/tests`;
naming consistent with 0001/0002 (side-table + guard-trigger idioms); interfaces concretely typed (`kind` vocabulary,
notification payload columns, `wall_members` shape); tier stated; each migration+harness pair fits one agent session.

## Build Readiness Assessment (Playbook §25)
**Status: NOT READY — blocked on Two-Key.** Architecture is complete and the three riskiest mechanisms are validated in
local PG16; dependencies (0001/0002/0003, C1 contracts) are understood; APIs/DB changes/migration steps are specified;
harness additions are defined. The **only** remaining blockers are governance-mandated, not design gaps:
- **Blocker 1 (mandatory):** independent HIGH-RISK design review of this plan before implementation begins (Charter §19,
  Constitution §16). This plan does **not** self-certify.
- **Blocker 2 (Founder Gate):** Founder approval of the schema/auth changes, and a decision on **F-1** below.

## Founder Gate — genuine (non-engineering) decision to confirm
- **F-1 — Secret Marks on public shared walls.** The sole non-moderation reader of a secret is the **wall owner**. On a
  **public** shared wall the owner may be a stranger to the author, so "secret" there means "readable by that stranger-
  owner." Is that the intended trust model, or should secret Marks be limited to personal/friend walls (or made
  owner-unreadable there)? **Default recommendation:** allow, owner = recipient, consistent across wall types — the
  design supports restricting later via a single predicate. This is a product/trust call, not an engineering one; every
  other C2 security decision is implied by the task and resolved in this plan.
- **F-2 — acknowledge (not a choice):** private **shared** walls become **member-gated** rather than friend-gated
  (ADR-009). No such walls exist today (C1 creates public shared walls only), so this is additive in practice, but it is
  a forward-only change to the authorization model and is flagged for explicit Founder acknowledgement. No decision is
  requested — just awareness that the private-shared access rule is set here.

---
*Handoff:* **Backend** — `0004`–`0007` + `supabase/tests/{60,70,80,90}` + seed/runner edits. **Frontend** — the secret
read path in C1 (owner-visible secret content). **Gate:** independent design review + Founder approval (incl. F-1)
before any implementation. **No production Supabase deploy** is authorized by this plan.
