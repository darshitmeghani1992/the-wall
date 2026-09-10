# Feature Plan: Activation Correction

**Status:** Proposed — product behavior is already approved by the Master Build Spec; the
schema/RLS unit requires independent Two-Key review before implementation.
**Date:** 2026-09-08
**Authority:** `THE_WALL_MASTER_BUILD_SPEC_v1.1.md` §§3.2, 7, 9.5, 10–13, 20, 47, 49,
59, 62–64, 76, 84, 87, 92 and 103.
**Fast Lane tier:** Large overall; Unit A is High-Risk because it adds schema and RLS.
**Reversibility:** Source and additive schema are two-way doors before hosted apply. Hosted
migration remains a separate Founder/deployment gate.

## Executive Summary

Correct the first-use journey around the actual activation goal: a new user finishes a safe
Personal Wall, finds or invites another person, and can receive a genuine Mark. The authenticated
shell must expose exactly four primary tabs — **My Wall, Discover, Alerts, Profile** — with no
global create button. Onboarding must capture the approved privacy, writing and Anonymous choices,
then show the short once-only walkthrough. A Personal Wall owner may maintain exactly one
non-reactable, non-Mark **Status**, visible only wherever that Personal Wall is viewable.

This plan does not change Mark creation, media upload or media reading. In particular it does not
touch C4 writer-owned files until C4 is committed and the activation branch is rebased.

## Repository Discovery

- `app/(tabs)/_layout.tsx` and `src/components/BottomDock.tsx` currently register Home/Walls/
  Discover/Profile and inject a center `+` that opens `people-picker`.
- `app/(tabs)/home.tsx` is an intermediary; the real Personal Wall is `app/wall.tsx`.
- `app/notifications.tsx` plus `src/lib/notifications.ts` already provide the reusable in-app
  notification list, unread count, read transition and destination mapping.
- `app/(tabs)/walls.tsx`, `src/lib/walls.ts` and `app/shared/[id].tsx` provide reusable Shared-Wall
  cards/routes, but the current list returns owned Walls only.
- `app/(onboarding)/profile-setup.tsx`, `src/lib/profiles.ts` and `src/lib/onboarding.ts` provide
  profile creation, handle validation and an in-memory draft. The current About/Interests path is
  not the functional setup required by Master Spec §10.
- `walls.visibility`, `walls.contribution_policy` and `walls.allow_anonymous` already exist and are
  owner-updateable under RLS. `walls_guard_identity` prevents client relocation/type mutation.
- `ensure_personal_wall()` currently hard-codes a **public** Personal Wall and omits
  `allow_anonymous`, whose table default is `true`; both conflict with §§10.3–10.5.
- No Status table, onboarding-completion field, walkthrough state or Help replay route exists.
- `Button`, `Input`, `Screen`, `Text`, `Icon`, theme tokens and reduced-motion helpers are reusable;
  no new UI or state-management dependency is needed.

## Binding Product Requirements

1. Authenticated primary navigation is My Wall, Discover, Alerts, Profile; no global center `+`
   (§7). Mark creation remains contextual to an eligible recipient Wall or eligible Shared Wall.
2. My Wall is authenticated home (§§9.5, 12, 59). Shared Walls remain one obvious tap/gesture away
   through the Wall switcher (§§7.1, 12.3), so removing the Walls tab must not bury them.
3. Onboarding captures profile basics, optional bio, Wall privacy (Private default), contribution
   permission (Friends only default), Anonymous permission (OFF default), and Find Your People
   (§10.1–10.6). It then enters the short, skippable, once-only, replayable walkthrough (§11).
4. Contribution choices map without interpretation: Friends only → `friends`, Everyone →
   `everyone`, Approved people → `selected`.
5. Exactly one Status may exist for each Personal Wall; it is 1–150 trimmed characters, is not a
   Mark, is not reactable and is not counted as a Mark (§§3.2, 13, 64).
6. The owner sees Set/Edit/Remove controls; an eligible visitor sees only the current Status as
   Wall context (§§12.2, 20). Status visibility never exceeds Wall visibility or block/account
   authorization.

## Unit A — Activation Persistence and Status Contract

**Owner:** Backend. **Depends on:** approved review of this contract.
**Exact files:**

- `supabase/migrations/0025_activation_foundation.sql`
- `supabase/tests/58_activation_foundation.sql`
- `supabase/tests/run_tests.sh`
- `supabase/tests/00_bootstrap.sql` and `01_seed.sql` only if implementation proves a load-bearing
  harness need; no change is expected.

### Migration inventory and ordering

Media owns `0022_media_operations.sql`, `0023_mark_writer_contract.sql`, and the final
`0024_mark_creation_cutover.sql`. Activation therefore starts at `0025`; it must not reuse or
renumber those versions.

The local test runner lists migrations explicitly. On an integration branch it must load
`0022`, `0023`, `0024`, then `0025`, and load `01_seed.sql` only after all migrations. If Unit A is
tested before media 0022–0024 are implemented, a temporary activation-only branch may load 0025
after 0021, but that branch must never be applied to hosted Supabase. Hosted application of 0025
is forbidden until 0022–0024 exist in the same ordered release history.

`00_bootstrap.sql` already establishes Supabase-compatible default privileges before migrations;
the new table needs no bootstrap exception. Because clean CI seeds profiles after migrations,
seeded fixtures correctly look like new, incomplete accounts unless explicitly updated by a test.
The production backfill described below affects profiles that exist when 0025 is applied.

### Profile/onboarding state

- Add `profiles.onboarding_completed boolean not null default false`.
- Add `profiles.walkthrough_completed_at timestamptz null`.
- In the same migration, backfill existing profiles to `onboarding_completed=true` and
  `walkthrough_completed_at=now()` before applying the false default for future profiles. This
  prevents established accounts from being forced through first-use setup.
- These are self-write progress fields under the existing profile policy. They grant no Wall,
  Mark or identity authorization. Backend authorization continues to derive from Wall and
  relationship state, never from these client-visible progress fields.

### Actor-bound account bootstrap route

The current client cannot infer account existence from `profiles SELECT`: final P0 profile RLS
intentionally hides the row from an inactive viewer. Treating a hidden deactivated/suspended row
as a missing profile would incorrectly send the user into setup and attempt to recreate their
profile/Wall.

Add one parameterless, actor-bound function:

```sql
public.get_current_account_route() returns text
```

It is `STABLE SECURITY DEFINER`, uses `set search_path = pg_catalog, public`, derives the subject
only from `auth.uid()`, accepts no user/profile identifier, and returns exactly one fixed value:

| Outcome | Server condition | Client destination |
|---|---|---|
| `unavailable` | `auth.uid()` is null or state is not classifiable | generic account-unavailable screen with Sign out |
| `missing_profile` | no profile exists for `auth.uid()` | profile setup |
| `onboarding` | own profile is active and `onboarding_completed=false` | profile setup/resume |
| `walkthrough` | own profile is active, onboarding complete, walkthrough timestamp null | walkthrough |
| `ready` | own profile is active and both gates complete | preserved destination or My Wall |
| `deactivated` | own profile status is deactivated | account-recovery screen using existing `reactivate_account()` |
| `suspended` | own profile status is suspended | account-unavailable screen; no setup or self-reactivation |

The function returns no profile data, user id, dates, moderation reason or existence result for any
supplied identity; there is no identity parameter to substitute. Revoke it from `PUBLIC` and
`anon`, grant execute only to `authenticated`. Do not restore app execution on
`is_active_account(uuid)`, `can_view_profile(uuid,uuid)` or any other arbitrary-actor helper.
Its decision order is binding: null actor; absent own profile; `deactivated`; `suspended`; active
but onboarding incomplete; active but walkthrough incomplete; active ready. The implementation
must select only `profiles where id=auth.uid()` inside the DEFINER body and must return
`unavailable` for any unexpected `account_status` rather than treating it as active or missing.

After a `ready`, `onboarding` or `walkthrough` outcome, the client may load its profile through the
normal RLS path. It must not use a null profile read to override the bootstrap outcome. A
deactivated user may explicitly invoke the existing actor-bound `reactivate_account()` and then
re-run bootstrap; the existing function changes only `deactivated`, not `suspended`, accounts.

### Safe new-Personal-Wall defaults

- Redefine `ensure_personal_wall()` in 0025 so its insert explicitly uses
  `visibility='private'`, `contribution_policy='friends'`, and `allow_anonymous=false`.
- Also set the column defaults for `walls.visibility` and `walls.allow_anonymous` to `private` and
  `false` as fail-safe defaults for omitted values. Existing Wall rows are not rewritten.
- Preserve one-Personal-Wall uniqueness and all current identity/authorization guards.

### `wall_statuses`

Create:

```sql
wall_id     uuid primary key references public.walls(id) on delete cascade
body        text not null check (body = btrim(body) and char_length(body) between 1 and 150)
created_at  timestamptz not null default now()
updated_at  timestamptz not null default now()
```

- One row is the one active Status; absence is no Status. Replace uses an upsert; remove uses
  delete. No history/version table is required for MVP.
- A `BEFORE UPDATE` trigger stamps `updated_at` and makes `wall_id` immutable.
- Enable RLS. `SELECT` requires the existing actor-bound
  `current_user_can_view_wall(wall_id)` and a Personal Wall. It must never call or grant the
  revoked arbitrary-actor `can_view_wall(wall_id, auth.uid())` helper.
- `INSERT`, `UPDATE`, and `DELETE` require an owner-correlated Personal Wall row
  (`w.id=wall_id`, `w.type='personal'`, `w.owner_id=auth.uid()`) **and**
  `current_user_can_view_wall(w.id)`. The latter supplies the current active-account/block-aware
  boundary without exposing or invoking an arbitrary-actor predicate. `WITH CHECK` repeats the
  full invariant after insert/update.
- Revoke all access from `anon`; grant only the table operations required by authenticated users.
- Revoke direct execution on the redefined `ensure_personal_wall()` and the new Status stamp/
  identity trigger function from `PUBLIC`, `anon`, and `authenticated`; triggers continue to run
  under their defined database context.
- Do not add Status to realtime, notifications, reactions, Marks or Mark counts.

The policy predicate shape is binding for SELECT/INSERT/UPDATE/DELETE (with the appropriate
`USING`/`WITH CHECK` placement):

```sql
exists (
  select 1
  from public.walls w
  where w.id = wall_statuses.wall_id
    and w.type = 'personal'
    and public.current_user_can_view_wall(w.id)
    -- write policies additionally require:
    and w.owner_id = auth.uid()
)
```

The SELECT policy omits only the owner clause. No policy accepts a caller-supplied actor id.

### P0 helper/grant invariant

Migration 0025 must preserve the final 0018 rule: app-callable authorization helpers either take
no actor or derive the actor exclusively from `auth.uid()`. It must not grant app execution on
`is_blocked(uuid,uuid)`, `are_friends(uuid,uuid)`, `is_wall_member(uuid,uuid)`,
`is_approved_writer(uuid,uuid)`, `is_active_account(uuid)`, `can_view_wall(uuid,uuid)`,
`can_contribute(uuid,uuid)`, `can_view_profile(uuid,uuid)`, `is_mark_true_author(uuid,uuid)`, or
`can_react_to_mark(uuid,uuid)`. Correlated RLS must use row identity plus the existing
`current_user_*` wrappers; protected trigger/RPC internals may use revoked predicates only under
their fixed actor-bound contract.

### Unit A acceptance tests

- Established profile backfill is complete; profile inserted after 0025 is incomplete with no
  walkthrough timestamp.
- Newly triggered Personal Wall is Private/Friends-only/Anonymous-OFF. Existing Walls keep their
  prior settings.
- Owner can insert, replace and delete one Status; a second logical Status replaces rather than
  coexists.
- Blank, padded, over-150-character, Shared-Wall and relocated-Wall rows fail.
- Unrelated, friend, follower, approved writer, Shared-Wall member, blocked and `anon` actors
  cannot write Status.
- Public non-blocked and accepted-private viewers can read; private non-friend, blocked, inactive
  and suspended boundaries match `current_user_can_view_wall`.
- Direct authenticated execution of every arbitrary-actor helper above remains denied after 0025;
  `anon` cannot execute the new bootstrap function or Status trigger functions.
- Bootstrap has no UUID/profile argument or overload and returns only the seven fixed outcomes.
  Two authenticated sessions cannot substitute or infer one another's account state.
- Bootstrap returns, and client routing tests consume: no-row → `missing_profile`; active/
  incomplete → `onboarding`; active/complete/no walkthrough → `walkthrough`; active/complete →
  `ready`; deactivated → `deactivated`; suspended → `suspended`; null actor → `unavailable`.
- A deactivated or suspended session cannot read its profile through normal RLS, write Status, or
  enter the create-profile route. Explicit `reactivate_account()` changes deactivated to the
  appropriate active bootstrap outcome; it leaves suspended unchanged.
- Blocked/public and blocked/private Status reads remain denied; no Status policy bypasses the
  bilateral P0 block boundary.
- Full pre-existing security suite remains green.

## Unit B — Canonical Navigation Shell

**Owner:** Frontend. **May run in parallel with Unit A in an isolated worktree.**
**Exact files:**

- `app/(tabs)/_layout.tsx`
- `src/components/BottomDock.tsx`
- `app/(tabs)/home.tsx`
- new `app/(tabs)/alerts.tsx`
- `app/wall.tsx`, `app/notifications.tsx`, `app/(tabs)/walls.tsx`
- `app/index.tsx`, `app/person/[id].tsx`, `app/u/[handle].tsx`
- `src/lib/notifications.ts`, `src/lib/walls.ts`

Register only `home`, `discover`, `alerts`, and `profile`; their visible and accessibility labels
are My Wall, Discover, Alerts and Profile. Remove the injected `+`. Keep `people-picker` only as a
contextual recovery route when a composer lacks a target. Make `home` render the real Personal
Wall. Convert old `/wall`, `/notifications`, and Walls-tab entries into compatibility redirects so
old internal/deep links do not dead-end.

Move/reuse the current notification presentation as the Alerts tab and remove excluded-comment
copy. Integrate owned and accepted-member Shared Walls into the My Wall switcher before removing
the Walls tab; RLS remains the authority. Notification and own-handle fallbacks target My Wall.

## Unit C — Functional Onboarding and Walkthrough

**Owner:** Frontend. **Depends on:** Unit A contract approval; rebase after C4 writer.
**Exact files:**

- `app/(onboarding)/welcome.tsx`, `profile-setup.tsx`, `about.tsx`, `interests.tsx`
- new `app/(onboarding)/find-people.tsx`
- new `app/(onboarding)/walkthrough.tsx`
- new `app/account-recovery.tsx`, `app/account-unavailable.tsx`
- `app/index.tsx`, `src/lib/auth.tsx`, `src/lib/onboarding.ts`, `src/lib/profiles.ts`,
  `src/lib/types.ts`, `src/lib/account.ts`
- Help replay routing in the existing Profile/Settings path; if no Settings route has landed,
  add `app/settings.tsx` and `app/help.tsx` as a separate small Frontend commit rather than a
  misleading partial settings screen.

`Get Started` enters auth. About/Interests leave the happy path. Profile setup becomes a concise
state sequence for basics, bio, privacy, write permission and Anonymous. Persist unfinished draft
values with the already-installed AsyncStorage; the draft is convenience only, while actual
privacy/write/Anonymous state is saved to Supabase.

Finish in a retry-safe order: create/reuse profile → update its Personal Wall → set
`onboarding_completed=true`. Never show completion before all writes succeed. The auth gate routes
exclusively from `get_current_account_route()`, not from whether `getProfile()` returned null.
`missing_profile` and `onboarding` enter setup; `walkthrough` enters walkthrough; `ready` consumes
the permitted pending destination or enters My Wall. `deactivated` enters recovery and may call
the existing `reactivate_account()`; `suspended` and `unavailable` enter a non-setup unavailable
screen. Neither inactive state may attempt profile/Wall creation. Skip and Finish both persist the
timestamp before leaving. Help replay opens the walkthrough without clearing or rewriting that
timestamp.

The walkthrough contains no more than the exact four §11 moments, uses unmistakably instructional
placeholders if needed, respects reduced motion, and ends in a useful activation action.

## Unit D — Owner Status Client

**Owner:** Frontend. **Depends on:** reviewed Unit A. **Exact files:**

- new `src/lib/status.ts`
- new `src/components/WallStatus.tsx`
- new `app/status.tsx`
- `app/_layout.tsx`, `app/(tabs)/home.tsx`, `app/person/[id].tsx`

Load Status alongside Wall data. Owner sees **Set a Status** when absent and text plus an edit
affordance when present. Eligible visitors see the current Status without controls. The modal
supports create/replace/remove, the 150-character counter, busy/error/retry states, and closes only
after a confirmed backend result. It has no reaction, Mark, Secret or Anonymous behavior.

## C4 Collision and Integration Sequence

C4 owns `app/create.tsx`, `src/lib/upload.ts`, `src/lib/marks.ts`, `src/lib/mark-media.ts`,
`src/lib/types.ts`, `package.json`, and `package-lock.json`.

1. Independently review Unit A architecture (Two-Key).
2. Unit A and navigation-only Unit B may run on isolated worktrees while C4 proceeds.
3. Do not edit `src/lib/types.ts` for activation until C4 is committed.
4. Rebase activation on the reviewed C4 head; then implement Units C and D.
5. Backend and Frontend make separate role-owned commits.
6. Independent Reviewer checks exact commits; QA runs clean CI and device/hosted matrices.
7. Do not merge, apply hosted migrations or deploy under this plan.

## Verification and Quality Gates

Automated evidence:

- TypeScript and ESLint: zero errors.
- `58_activation_foundation.sql` plus the complete PostgreSQL suite.
- Pure tests for onboarding option mapping, retry/resume routing, walkthrough gating and
  compatibility redirects, including all seven fixed bootstrap outcomes and proof that
  deactivated/suspended never select setup, using the existing lightweight test convention rather
  than adding an overlapping framework.
- Route audit: exactly four registered tabs; no global-create action; no stale internal Wall/
  Notifications destination except explicit compatibility redirects.

Physical iOS and Android evidence:

- Small/large viewport and safe-area layout; keyboard never covers onboarding input/CTA.
- Dynamic Type, VoiceOver, TalkBack, logical focus, announced radio/switch state and 44×44 targets.
- Reduced-motion walkthrough; skip and replay.
- Background, force-close, relaunch, logout and offline/retry at each onboarding step.
- No public-Wall flash while defaults/settings load.
- Status create/edit/remove and eligible/ineligible visitor views.
- My Wall ↔ Shared Wall access and Alerts unread/read behavior.

## Product Proposals — Not Yet Binding

These resolve gaps between approved requirements but are not silently added to the product contract:

1. **Pending deep link versus first-use walkthrough.** §9.5 prioritizes restoring a pending target
   after onboarding, while §§10.7–11 require the first-use walkthrough and say it ends on My Wall.
   **Recommendation:** complete/skip the once-only walkthrough first, then restore the preserved
   destination. This protects both education and link intent. Product/Founder confirmation is
   required before Frontend binds the route order.
2. **Search during Find Your People.** §10.6 names “Search The-Wall” but does not say whether search
   is embedded in onboarding or transitions into Discover. **Recommendation:** after walkthrough,
   open the existing Discover surface with search focused. This avoids a duplicate relationship
   surface. Product/Founder confirmation is required before Frontend binds this transition.

## Architectural Review Checklist

- Migration is named `0025_activation_foundation.sql`; no activation artifact claims 0024.
- 0022–0024 media ownership and hosted migration ordering are preserved.
- Safe defaults exist at the database trigger/boundary, not only in UI state.
- Status RLS delegates visibility only to actor-bound `current_user_can_view_wall` and permits
  writes only to the correlated active owner of a Personal Wall.
- No arbitrary-actor helper grant or P0 actor-substitution path is reintroduced.
- Auth bootstrap is parameterless/actor-bound and distinguishes missing, active onboarding,
  walkthrough, ready, deactivated and suspended states without exposing another user's state.
- Deactivated/suspended/hidden-profile states cannot fall through to setup or recreation.
- Onboarding flags never grant access or substitute for Wall/relationship authorization.
- Four-tab navigation does not strand Shared Walls or introduce a new create entry point.
- C4 writer files are untouched until the documented rebase point.
- Neither product proposal is implemented as approved behavior without confirmation.

## Build Readiness

**NOT READY for Unit A implementation until independent Two-Key approval of this High-Risk
contract.** Unit B navigation is technically READY in an isolated worktree. Units C and D become
READY after Unit A approval and the C4 rebase boundary.
