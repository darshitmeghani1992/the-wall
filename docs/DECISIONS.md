# The-Wall Decision Log

## D-27 · 2026-11-22 · HTTP preflight never follows redirects carrying public API credentials
- **Trigger:** The staging-only preflight issued Auth/REST requests with the `apikey` header but retained default fetch redirect-follow, unlike the independently prepared three-JWT harness. Unexpected 30x responses may lead to additional outbound requests outside approved staging.
- **Decision:** Set `redirect: 'error'` for every credential-bearing staging preflight GET; 302 and thrown redirect failures are NO-GO. Keep exact approved origin validation, public-key checks, and private table negative gates; no new endpoint or hosted permission change.
- **Verification/gates:** New draft #160 BACKEND source and regression tests; exact final SHA CI, independent security Reviewer, staging read-only and device QA remain required. Original production protected; media/Secret/analytics OFF.


## D-26 · 2026-11-22 · EAS/preflight accept only Supabase public API key formats accepted by runtime
- **Trigger:** #158 closes a runtime Expo credential leak, but `validatePublicClientConfig` and EAS CLI still accepted opaque strings that runtime explicitly rejects. This produces an unusable/broken beta build while reporting EAS configuration success and risks sending unrecognized credentials in read-only HTTP probes.
- **Decision:** Fail closed on noncanonical keys at the shared Node validation entrypoint: accept modern `sb_publishable_*` and legacy JWT-shaped public key only; require exact staging project and `role=anon` for legacy credentials before any HTTP. Preserve staging-only origin and existing secret-key bans; print no secret values. Align EAS and preflight contract fixture keys accordingly.
- **Alternatives:** Keep accepting opaque keys (inconsistent and potentially unsafe); rely on Expo runtime to reject (too late after packaging).
- **Gates:** Draft #159 (BACKEND) with unit/mocked no-network/no-log tests; exact CI and independent security review plus EAS/device QA needed. No hosted config, provider, auth, migrations, original production or deployment changed.


## D-25 · 2026-11-22 · Validate legacy public JWT role/project in local runtime before Supabase client creation
- **Trigger:** #155–#157 guard EAS builds, read-only staging probes and the 3-JWT audit; #156's Expo runtime gate only checked staging URL and obvious modern `sb_secret_*`. Local Metro/alternative builds bypass EAS hooks and could bundle or forward a privileged or foreign legacy JWT.
- **Decision:** Keep staged runtime config accessible only for exact approved staging host and keys of two known public formats: `sb_publishable_*`, or legacy JWT locally decoded (portable bounded base64url UTF-8) with `role=anon` and `ref=ewintxgdxdvschiqodkq`. Fail closed on unknown, malformed or privileged keys. This is a local consistency check **not signature verification**; backend must still validate every JWT and read-only probes must prove connectivity. Same `selectBetaClientConfig` API, no OAuth/hosted/policy/feature change.
- **Alternatives:** Allow opaque keys (unsafe); depend solely on EAS (bypassable outside EAS); introduce Node Buffer/atob polyfill inside Expo (unnecessary dependency/platform risk).
- **Reversibility / gates:** Small reversible frontend-only runtime guard and fake-credential unit tests, draft #158, independent Reviewer + installed-device QA required. Production enablement is a separate Founder decision; never weaken this in an unrelated PR. No live credentials or hosted writes.


## D-24 · 2026-11-22 · Add runtime staging origin guard for client outside EAS
- **Trigger:** EAS pre-install and read-only staging preflight now enforce the approved project, but `src/lib/config.ts` previously exported arbitrary EXPO_PUBLIC URL directly to `createClient`. A local Expo or non-EAS start could accidentally use the original production origin.
- **Decision:** For the held staging-only beta, select Supabase runtime client settings only for `https://ewintxgdxdvschiqodkq.supabase.co`, allowing a trailing slash; otherwise export undefined so the existing inert localhost fallback is used. Refuse modern `sb_secret_*` in the client runtime. Keep the stronger legacy JWT role/ref validation before EAS builds and HTTP preflight, and do not misrepresent the client-side filter as complete legacy-key validation.
- **Alternatives:** Rely only on EAS lifecycle hook (rejected, local Metro can bypass); auto-rewrite arbitrary origins (rejected, may hide misconfigured environments); touch original production (prohibited).
- **Reversibility/gates:** Reversible staging-only client code and regression tests, draft #156, no hosted writes. Requires independent security Reviewer and runtime QA prior to release. Future production enablement needs an explicit separate authorized release decision, not removal of the guard as a side effect.


## D-23 · 2026-11-22 · Fail closed on privileged Supabase keys in all preview clients and probes
- **Trigger:** Release train is staging-only. EAS and preflight accepted a nonempty key without rejecting modern `sb_secret_*` or, on the read-only preflight path, privileged/mismatched legacy role-bearing JWTs. Unsafe keys must not be bundled, logged, or sent over the network even for read-only checks.
- **Decision:** Enforce public-key-only client settings: block `sb_secret_*` at common config validation and check legacy JWT role `anon` and exact approved staging project reference before any preflight HTTP. Preserve approved staging-only hostname from PR #153. Source-only changes staged in draft PR #155. Never print key values or URLs on EAS failure.
- **Alternative rejected:** Rely exclusively on server enforcement or read-only intent to tolerate service-role/secret credentials; doing so could disclose a high-privilege key in a distributed Expo binary or CI request headers.
- **Reversibility / gate:** Easily reversible test+tooling code, but weakening it would need explicit authorized environment and security review. No live credentials read or changed, no new provider/Auth/hosted policy. Independent Reviewer and QA, CI and release authorization remain required.


## D-22 · 2026-11-21 · Stage real-JWT privacy smoke without creating accounts or leaking tokens
- **Purpose:** BETA-P0-04 distinguishes synthetic SQL role tests from actual authenticated HTTP JWT boundary checks. Pre-existing authorized staging accounts are required; current staging has none.
- **Decision:** Build a **read-only**, opt-in Node test utility that verifies three distinct actor IDs via Auth `/user` and checks private Shared-Wall visibility for owner, permitted member and unrelated outsider using six GETs. Hard-code only the approved staging host; reject original production, missing opt-in, repeated actors, 401s, unexpected visibility; never log tokens or response bodies. Mock it in ordinary CI with zero credentials.
- **Boundaries:** Does not create/modify accounts, invoke migrations, test mutation RPCs, send OTP or assert full three-user QA. Credential management stays with authorized runtime, not PR secrets or chat. Higher-risk follow-up real JWT tests and independent review still required. Rollback is removal of the source-only utility.


Meaningful technical decisions. Trivial choices are omitted (§94). Format:
date · decision · reason · alternatives · reversibility · Founder Gate?

---

## D-15 · 2026-11-21 · Separate definer catalog exposure from per-caller security verification
- **Decision:** For BETA-P0-04, inventory staging `public` SECURITY DEFINER routines by effective `anon`/`authenticated` `EXECUTE` grants, separate trigger-only functions from directly invokable RPCs, and track individual `auth.uid()` guard checks. Catalog metrics are **read-only triage evidence**, not proof of secure function behavior or successful hosted authenticated HTTP denial.
- **Evidence and reason:** `ewintxgdxdvschiqodkq` query returned 113 SECURITY DEFINER functions, 0 `anon` callable, 59 `authenticated` executable (33 direct functions + 26 trigger-returning), 54 internal-only, 0 missing explicit `search_path`. All 33 direct routines contain `auth.uid()` text. The former blanket '59 risky definer functions' label conflated ordinary SQL RPC endpoints and trigger functions and could lead to unsafe blind revocation.
- **Alternatives:** Blanket REVOKE (rejected without caller/trigger audit); automatically classify `auth.uid()` reference as authorization proof (rejected); skip real three-actor JWT tests in favor of catalog SQL (rejected).
- **Reversibility:** Reversible documentation methodology only. **Founder Gate?** No for this read-only audit; **yes** for unapproved hosted grant/schema/function changes and releases. No roles, grants, flags or production data changed.
- **Next:** source/body/callsite trace for each exposed RPC, reviewed code tests for confirmed defects, independent Reviewer + QA using hosted JWT actors and migration-safe rollout. See `docs/handoffs/STAGING_DEFINER_CALLER_TRIAGE_2026-11-21.md`.

## D-14 · 2026-11-21 · Single tracked first-beta release train and exact-SHA evidence
- **Decision:** Use `docs/BUILD_STATUS.md` as the single resumable development queue and issue #57 as its linked human-facing tracker. The first-beta scope is explicitly expanded through Enhanced Beta; a controlled text-first source candidate is only an **internal certification checkpoint**. Complete photo/voice/video and Secret runtime verification before any final first-beta GO. Keep domain/DNS and Apple Developer enrollment/signing held per Founder; no implication that SMTP delivery can be skipped.
- **Reason:** A linear set of unmerged draft PRs and multiple older checkpoint documents have allowed stale source/status claims. The latest source line descends from #30; CI #221 succeeded for #58, but independent review and E2E/device/hosted requirements remain open.
- **Alternatives:** Treat `main` or an older September status percentage as current (rejected); mark feature-flagged media and Secret functionality complete (rejected); merge the entire long stack without independent review (rejected).
- **Reversibility:** Documentation and sequencing only; reversible. No role charter, Constitution, schema, prod environment or feature-flag modification. **Founder Gate?** This decision records explicit Founder sequencing and does not grant permission to merge/deploy, mutate hosted state, create accounts or activate unfinished features.
- **Process:** Every task records role, acceptance criteria, dependency, evidence, blocker, next action; every certification binds exact SHA and staging runtime. Changing source invalidates earlier SHA CI/Review/QA where affected.


## D-0 · 2026-08-20 · Verify the security layer against a real Postgres each session
- **Decision:** Run `supabase/tests/run_tests.sh` against a locally-initialized Postgres 16
  cluster (server binaries are present in the environment) as the standard QA/Security gate,
  instead of leaving RLS "Believed-likely / hosted not run."
- **Reason:** The kickoff mandates adversarial security testing and Two-Key QA. A real DB
  turns RLS/anonymity/secret/membership claims from *believed* into *verified*.
- **Alternatives:** Docker Postgres (daemon unavailable here); hosted Supabase (needs Founder
  credentials — a Gate); static review only (insufficient for a security gate).
- **Reversibility:** Fully reversible (test-only infra).
- **Founder Gate?** No.

## D-1 · 2026-08-20 · Complete Secret lifecycle via migration 0010 + a gated reveal RPC
- **Decision:** Implement Master Spec §27.3/§27.4/§68 as an additive migration `0010`:
  add `expires_at` (default now()+1h) and `opened_at` to `mark_secrets`; add a
  `SECURITY DEFINER` `reveal_secret(uuid)` RPC that (a) authorizes the caller as the wall
  owner/recipient, (b) performs a single atomic `UPDATE … WHERE opened_at IS NULL AND now()
  < expires_at RETURNING content`, and (c) classifies failure as `consumed` / `expired` /
  `not_authorized` / `missing` without leaking content. **Revoke** direct `SELECT` on
  `mark_secrets` from `authenticated` so all reads go through the one-time RPC (a retained
  direct SELECT would defeat one-time reveal). Add `expire_secret_marks()` cleanup fn for a
  scheduled job.
- **Reason:** One-time reveal must be **server-atomic** (spec: "do not rely on client-only
  flag"; two simultaneous reveals must not both succeed). A row-locked conditional UPDATE is
  the simplest correct primitive; `RETURNING` gives content only to the single winning caller.
- **Alternatives:** Client-side "opened" flag (rejected — spoofable, not atomic); advisory
  locks (heavier, unnecessary); trigger-based consume (less legible than one gated RPC).
- **Reversibility:** Additive/idempotent migration; reverting means dropping the columns/fn
  and restoring the SELECT grant. Reversible pre-hosted-apply.
- **Founder Gate?** No for code; **hosted apply is a destructive-production Gate** (unchanged).

## D-2 · 2026-08-20 · Distinct `expired` vs `consumed` reveal states (not a single "gone")
- **Decision:** `reveal_secret` returns `jsonb {ok, reason, content?}` so the client can show
  §111's *specific expired state* separately from *already opened*.
- **Reason:** Spec §111 wants a specific expired message; distinguishing costs one extra
  classify query and leaks nothing (content only ever returned on `ok`).
- **Reversibility:** Reversible (return-shape only).
- **Founder Gate?** No.

## D-3 · 2026-08-20 · Reads of `mark_secrets` are RPC-only for clients; moderation stays direct
- **Decision:** After 0010, `authenticated` has **no** direct table privilege on
  `mark_secrets`; the client uses only `reveal_secret`. `service_role` keeps its explicit
  `SELECT` grant for the moderation read path (§53). The now-moot owner SELECT policy is
  dropped for clarity. Existing `60_secret_marks.sql` owner/non-owner reads are updated to
  the RPC path; new `61_secret_reveal.sql` proves the lifecycle.
- **Reason:** One-time reveal is only real if the content cannot be re-read out-of-band.
- **Reversibility:** Reversible (re-grant + re-add policy).
- **Founder Gate?** No.

## D-4 · 2026-08-20 · Reconciliation posture — Master Spec wins over prototype Mark types
- **Decision:** The obsolete prototype Mark types (`roast`, `award`, `poll`, `doodle`,
  `prediction`) and the "pick a type" composer conflict with §4 (excluded: games/doodles)
  and §21 (single integrated composer; Secret/Anonymous are modes, not types). They are
  **flagged for reconciliation** (BUILD_STATUS Reconciliation Debt) and will be collapsed to
  the integrated composer in a following frontend slice — **not** touched in the same commit
  as the high-risk Secret DB change, to keep the Two-Key security diff minimal and reviewable.
- **Reason:** Authority order (§1) puts the Master Spec above existing code; but sequencing a
  large frontend refactor separately from a security migration keeps each diff auditable.
- **Reversibility:** Reversible (product/UI).
- **Founder Gate?** No (engineering sequencing, §89). Visual result later merits Founder QA.

## D-5 · 2026-08-20 · Secret is an orthogonal mode; canonical Mark types are text/photo/voice/video (migration 0011)
- **Decision:** Retire the prototype Mark *types* (sticky/roast/award/poll/doodle/prediction)
  from the app; the canonical content types are text/photo/voice/video, and Secret (like
  Anonymous) is a boolean MODE that can apply to any of them. Migration 0011 adds the enum
  values + `marks.secret` and repoints the extract trigger, F1 CHECK, and expiry cleanup from
  `type='secret'` to the flag. Legacy enum values remain (Postgres can't drop them) but are
  unused.
- **Reason:** Master Spec §21 (single integrated composer, no type-picker), §27 ("any
  supported Mark may be Secret"), §4 (games/doodles excluded). The flag is safe on the
  realtime row — content still lives only in `mark_secrets`.
- **Alternatives:** Rebuild the enum (destructive column swap — rejected); keep `secret` as a
  type (breaks orthogonality with photo/voice/video — rejected).
- **Reversibility:** Additive/idempotent migration; pre-hosted-apply. **Founder Gate?** No
  (product behavior already fixed by the Master Spec); hosted apply remains a deploy Gate.

## D-6 · 2026-08-20 · Voice/Video reuse the existing `attachments` bucket (no new storage surface)
**Status:** Superseded by ADR-012 for all Mark media. Public `attachments` remains only for the
explicit non-Mark uses retained by that architecture.

- **Decision:** Voice + Video media use the already-verified public, path-scoped `attachments`
  bucket (ADR-006/0003) under `marks/<wallId>/…`, exactly like photos — no new bucket, policy,
  or migration. Client enforces per-kind byte caps + a MIME allowlist; server-side bucket
  limits (`file_size_limit`/`allowed_mime_types`) are a hosted-config hardening task.
- **Reason:** Reuse the verified protection model rather than open a new storage security
  surface; Secret media (which would need signed URLs) does not exist yet (Secret is text-only).
- **Reversibility:** Fully reversible (client + config). **Founder Gate?** No.

## D-7 · 2026-08-20 · expo-av for voice recording + audio/video playback
- **Decision:** Use `expo-av` (~14.0.7, SDK 51) for mic recording and audio/video playback;
  video capture via `expo-image-picker` with a 30s cap. Mic permission requested on first
  record only (never during onboarding — §24).
- **Reason:** First-party Expo module already in the managed workflow; minimal new surface.
- **Alternatives:** expo-video/expo-audio (newer, not in SDK 51's stable set) — deferred.
- **Reversibility:** Reversible (dependency). **Founder Gate?** No.

## D-8 · 2026-08-20 · Mark-lifecycle rules are trigger/RLS-enforced, not client-trusted (migration 0012)
- **Decision:** Enforce §32 (sender 10-min edit/delete window) and §33 (owner normal-removal
  quota 3/30d, safety unlimited) in the DB: the `marks_guard_moderation` BEFORE-UPDATE trigger
  rejects late author edits (`MARK_EDIT_WINDOW`) and over-quota normal removals
  (`MARK_REMOVAL_QUOTA`) and stamps `removed_by`/`removed_at`; the DELETE RLS policy is
  author-only within the window. The owner's 0001 hard-delete path is removed so removal can't
  bypass the quota. Removal reason is `normal`/`safety`/`moderation`; safety/moderation are
  never limited.
- **Reason:** These are API-abuse vectors (§100 "sender edit after 10 min", "remove Mark quota
  bypass") — client checks are insufficient; server time is authoritative.
- **Alternatives:** Client-only gating (rejected — bypassable); a bypassable RPC for removal
  (rejected — owner could UPDATE directly); an `editable_until` column (redundant with
  created_at + a fixed window).
- **Reversibility:** Additive/idempotent migration; pre-hosted-apply. **Founder Gate?** No
  (fixed product rule); hosted apply remains a deploy Gate.
- **Follow-up:** the owner Mark-removal / sender edit **UI** (a Mark detail/action sheet, §30)
  is a separate frontend slice; the data layer (`removeMark`/`editMarkText`/helpers) is ready.
  MVP treats a `safety` reason as owner-asserted; linking it to an actual report/block to
  prevent gaming is a later hardening.

## D-9 · 2026-08-21 · Account deactivation gates the two RLS chokepoints, not the profile row (migration 0013)
- **Decision:** Implement §82 deactivation by adding `profiles.account_status`/`deactivated_at`
  + `is_active_account(uid)` and gating the existing `can_view_wall`/`can_contribute` SECURITY
  DEFINER functions and the friendships-insert policy — NOT by hiding the profile row. A
  deactivated account's PERSONAL wall becomes non-viewable/non-contributable, the account can't
  contribute anywhere or be friend-requested, and it's excluded from people search. SHARED
  walls it owns stay accessible to members (gate is personal-wall-only). Self-service
  `deactivate_account()`/`reactivate_account()` RPCs (self-only) stamp `deactivated_at`.
  **Correction (2026-09-15, migration 0027):** the zero-argument
  `deactivate_account()` surface is retired and non-callable by API roles. Clients use
  `deactivate_account(p_expected_actor_id uuid)`, which compares the expected account with
  the request token's `auth.uid()` in the same authoritative transaction. Reactivation is
  unchanged.
- **Reason:** Hiding the profile row would break author display on existing Marks. Gating the two
  chokepoints (already the tested centre of visibility/contribution) keeps blast-radius minimal
  and the SEC-001 suite as the regression guard. Shared walls aren't gated on owner-active
  because deactivation is reversible and members must keep access; Shared-Wall ownership is
  handled at FINAL deletion (§43/§82).
- **Alternatives:** RLS on `profiles` SELECT to hide deactivated rows (breaks Mark authorship —
  rejected); a dedicated `deactivations` table (more surface, no benefit — rejected).
- **Reversibility:** Additive/idempotent migration; pre-hosted-apply. **Founder Gate?** No for
  code; the hosted 30-day purge job (hard delete + ownership transfer) is a deploy Gate.

## D-10 · 2026-08-21 · Follow edges are world-readable (public), not just aggregate counts (migration 0014)
- **Decision:** The `follows` table's SELECT policy is `using(true)` — the full follow
  edge-list (who follows whom) is world-readable, not only the aggregate follower/following
  counts §106 declares public. `getFollowCounts`/`isFollowing` read it directly.
- **Reason:** Following is defined (§3.3/§17) as a one-way relationship to keep up with a
  **public** Personal Wall — an inherently public act, matching the standard public-social
  model and the repo's existing world-readable `profiles`. Blocked-pair edges never persist
  (the `blocks_remove_follows` trigger tears them down), so no blocked relationship leaks.
- **Alternatives:** Count-only-public via a SECURITY DEFINER `get_follow_counts(uid)` RPC plus a
  SELECT policy narrowed to the viewer's own edges — deferred; adopt if Product later wants the
  follow graph private. (Reviewer flagged this as a Product scope-flag, not a security defect.)
- **Reversibility:** Reversible (swap the SELECT policy + add the RPC). **Founder Gate?** No —
  the spec is silent on edge visibility and no §81 privacy promise (private wall/anon/secret/
  private membership) is weakened; edges are for public walls only.

## D-11 · 2026-08-22 · Admin capability via is_admin flag + DEFINER RPCs; privileged columns are client-immutable (migration 0017)
- **Decision:** Implement §52/§53 with a `profiles.is_admin` flag, an `is_admin()` helper, a
  `moderation_actions` audit table (admin-only read; client-unwritable), account `'suspended'`
  status, and three `SECURITY DEFINER` admin RPCs (`admin_remove_mark`/`admin_suspend_account`/
  `admin_resolve_report`) each gated on `is_admin(auth.uid())`. A BEFORE-UPDATE trigger
  `profiles_guard_privileged` reverts `is_admin`/`account_status`/`deactivated_at` for any
  non-privileged caller, so those columns change ONLY through the DEFINER RPCs — never via the
  0001 `profiles update self` policy.
- **Reason:** Independent review found the `profiles update self` policy would otherwise let any
  client `set is_admin=true` and self-promote to admin (privilege-escalation BLOCKER, caught at
  `4c7a71a`). Gating the columns at the write boundary (trigger) is the minimal, robust fix and
  also makes `is_admin` un-settable by clients (§53 "admin never reachable by ordinary users").
  In-app admins are NOT `service_role`, so they still cannot read `anonymous_mark_authors` —
  anonymity stays service_role-only (§53).
- **Alternatives:** Column-privilege GRANTs (Postgres column-level privileges don't compose with
  the existing row policy cleanly — rejected); a separate admins table (more surface — rejected).
- **Reversibility:** Additive/idempotent migration; pre-hosted-apply. `is_admin` is bootstrapped
  only by a backend/SQL actor (postgres/service_role). **Founder Gate?** No for code; hosted
  apply remains a deploy Gate.

## D-12 · 2026-09-15 · Blocked Users management uses a narrow outbound-only RPC (migration 0028)
- **Decision:** Keep the canonical bilateral profile RLS boundary unchanged. Add
  `list_my_blocked_users(expected actor, cursor)` as an authenticated-only,
  `SECURITY DEFINER` read for an active caller's own outbound block associations. It returns
  at most 20 rows containing only user id, display name, handle, avatar URL, and block time;
  it cannot accept an arbitrary blocker id and never reveals inbound blocks. The RPC compares
  the expected account with one captured `auth.uid()` before any other validation.
- **Reason:** Profile RLS correctly hides both parties across a block, so joining blocks to
  profiles through ordinary client reads erases the identity needed for the blocker to undo
  their own block. Broadening profile visibility would weaken a larger privacy boundary. A
  narrow actor-bound projection exposes only what the management screen needs.
- **Alternatives:** Broaden profile SELECT across outbound blocks (rejected — weakens general
  profile privacy); show irreversible anonymous block rows (rejected — unusable); expose an
  arbitrary blocker argument (rejected — authorization/enumeration risk).
- **Reversibility:** Client-first rollback: remove RPC callers, revoke its authenticated grant,
  then drop the exact function. Migration 0028 writes no user data. **Founder Gate?** Approved
  for source implementation and testing only; hosted migration remains unapproved.

## D-13 · 2026-09-18 · Permanent account deletion requires ownership resolution and deletes authored content
- **Decision:** Permanent deletion is distinct from ordinary deactivation. Scheduling requires
  strong `DELETE` confirmation and zero owned Shared Walls; each Shared Wall must first be
  transferred to an active accepted member or explicitly deleted by its owner. The server starts
  an immutable 30-day recovery window and deactivates the account atomically. Reactivation during
  that window cancels deletion atomically. Final service-only purge deletes all Marks authored by
  the user on every Wall before deleting the auth identity; the Personal Wall and remaining
  identity-owned/social data then follow existing cascades. Protected media uses its durable
  deletion outbox, and public avatars must be removed through the Storage API before service-only
  purge preparation and Auth Admin identity deletion.
- **Reason:** Silent Shared-Wall cascade deletion would destroy other members' group history;
  silent transfer would grant control without consent. Conversely, leaving authored Marks with a
  null author would contradict the Founder's explicit full-deletion decision. A separate lifecycle
  prevents reversible deactivation from being confused with permanent deletion.
- **Alternatives:** Keep authored Marks as `Deleted user` (superseded by the 2026-09-18 Founder
  decision); auto-transfer Shared Walls (rejected — consent/selection ambiguity); delete owned
  Shared Walls automatically (rejected — disproportionate group-data loss).
- **Reversibility:** Scheduling is reversible for 30 days; final purge is intentionally
  irreversible. Migration 0031 is additive before hosted application. **Founder Gate?** Product
  behavior and draft source implementation approved; hosted migration, scheduler, merge, and
  deployment remain unapproved and require independent Two-Key review plus QA.
