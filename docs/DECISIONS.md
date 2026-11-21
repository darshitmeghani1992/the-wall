# The-Wall Decision Log

## D-21 · 2026-11-21 · Atomic completion is mandatory before any event-driven worker pilot
- **Finding:** On draft PR #72's simulated local dispatcher, a lease was released before an event ID was recorded and completed tasks were not stored; a repeated event could release a second valid lease, and a finished task could be reassigned on later ticks.
- **Decision (reversible internal bugfix):** BACKEND makes the local SQLite completion/event/fencing/closed-task transition one `BEGIN IMMEDIATE` transaction, rejected duplicate/stale events have zero effect, and every next dispatch excludes durably completed simulation tasks. Add negative multi-tick and duplicate-event tests; do not change or rewrite the canonical queue.
- **Boundary:** Local completion means **simulation worker bookkeeping only**, not QA acceptance, actual code completion, deploy readiness, or product completion. SQLite still cannot coordinate ephemeral GitHub hosts; a crash between local completion and external wakeup requires a future transactional shared outbox or polling reconciliation. No hosted schema/migration write, real worker, Gemini call or paid fallback.
- **Gate:** Independent Reviewer and behavioral QA for exact PR candidate; new shared coordination architecture, security and hosted infrastructure activation remain gated. This change does not declare the cloud agent continuous.


## D-20 · 2026-11-21 · Prototype fenced three-worker leases and immediate handoff without activating AI
- **Decision:** Build a no-cost SQLite transactional single-host coordination **prototype** using `BEGIN IMMEDIATE`, monotonically increasing fencing token, bounded leases, task/branch ownership, deduplicated event ID, and max three active implementation leases. Simulate completion-to-next-task without hourly polling.
- **Limits:** SQLite file is not shared across ephemeral GitHub Actions hosts and **must not be used as multi-run production coordinator**; any real cloud loop requires a shared durable transactional service plus security/operational review. A simulated task handoff is not evidence of authenticated Gemini coding, PR creation, QA or continuous deployment.
- **Gate:** Founder authorized autonomous draft coding/testing only, not protected operations. No live model calls, secrets, hosted writes, merges or paid fallback; independent review and CI required. Existing queue remains canonical.
- **Next:** verify branch contract CI, implement event-driven multi-host coordination design and sandbox actor with bounded Gemini free requests, first real no-charge pilot only after review.


## D-19 · 2026-11-21 · Prepare one-request Gemini free-tier authentication smoke, not coding activation
- **Founder evidence:** User reports creating Google AI Studio Free-tier project and saving `GEMINI_API_KEY` through GitHub secrets. Never disclose or copy the key. Billing absence cannot be inferred from user's free tier label alone.
- **Decision:** Probe only `gemini-2.5-flash-lite` with an exact static test phrase, using the secret **only** inside a manual GitHub workflow after independent review. No repository source/metadata sent, no response body logged, one request/no retries. Environment, permissions and no-spend configuration fail closed. Paid fallback never configured.
- **Activation gate:** New workflow must be reviewed and integrated with approved GitHub workflow controls before manual dispatch; no source SHA or CI proof can claim live authentication before that explicit run. Review Github permissions and default-branch workflow availability. A working credential probe is not a coding-agent runtime or continuing dispatch.
- **Next:** PR review and CI, then one manual credential proof, and separate durable task leasing/agent-sandbox execution work.


## D-18 · 2026-11-21 · Free-first agent preparation with no billing or credentials
- **Decision:** Use existing public GitHub-hosted standard runner for zero-charge development smoke; keep Gemini headless integration unconfigured until free-tier eligibility/account authentication is verified. Do not use potentially billed model endpoints merely because an API key exists.
- **Evidence:** GitHub public-runner free policy and Gemini API free-model/headless-auth documentation linked in `docs/architecture/FREE_FIRST_WORKER_V2.md`. New smoke has read-only GitHub token, no cloud API credential, preflight denial of production/project and paid settings.
- **Limits:** Manual dry run is not autonomous cloud coding. Durable leases, triggered execution and authenticated AI agent remain missing; external account action unavoidable. Reversible draft-only change; no main merge, payment, hosted write, or release.


## D-17 · 2026-11-21 · Choose GitHub-hosted ephemeral Linux as cloud worker computer, keep AI billing separate and disabled
- **Decision:** Prefer existing GitHub-hosted Ubuntu runners instead of a dedicated paid VM for first external coding-agent loop; reserve model/provider decision for explicit account/cost approval. GitHub public standard runner compute may be included, but model inference and optional hosting remain separately billable.
- **Security:** The configuration begins disabled and zero budget; no secrets in PR CI, no privileged service-role Supabase credentials, no auto-merge/deploy, staging only; three-worker ceiling, durable leases and independent Reviewer/QA required before activation.
- **Tradeoff/reversibility:** Fast setup, ephemeral runtime, limited persistent state; durable coordination will require an independently reviewed control plane. Switching providers is possible without changing the canonical task queue. Source: `docs/architecture/CLOUD_LOOP_V2_SETUP.md`.
- **Founder gate:** Paid provider, actual account spending cap, connection and activation withheld. **No authenticated agent yet.**


## D-16 · 2026-11-21 · Founder-approved event-driven engineering loop; activation withheld pending actual runtime
- **Decision:** Build a maximum-three-worker external coding-agent loop; keep canonical `docs/BUILD_STATUS.md` task queue, isolate FRONTEND/BACKEND execution roles, enforce unique durable leases, retain independent Reviewer/QA and all Founder release/security gates. Preserve the existing hourly engineering automation as fallback.
- **Authority:** Explicit Founder approval of Continuous Engineering Loop v2.0. Architecture planned under ARCHITECT; implementation must retain its distinct authorized implementation role.
- **Evidence:** Connected Mac device is online but `/usr/local/bin/claude` fails at dynamic load on macOS 11.7.11 (binary built for macOS 13); external runtime is **NOT VERIFIED**. Draft-only dry-run queue dispatcher, contract tests and workflow are a foundation, not a persistent worker.
- **Alternatives:** Increasing hourly run frequency cannot provide uninterrupted execution; blindly running a broken Mac agent would fail unpredictably. Prefer an OS-compatible authenticated worker with idempotent event dispatch and bounded lease concurrency.
- **Reversibility:** New isolated draft, no automated commits from worker, no deployment or infrastructure mutation. **Next:** independent review plus DEVOPS runtime provisioning, leasing and end-to-end test. See `docs/architecture/CONTINUOUS_ENGINEERING_LOOP_V2.md`.


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
