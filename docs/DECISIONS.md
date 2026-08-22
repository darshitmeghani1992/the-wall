# The-Wall Decision Log

Meaningful technical decisions. Trivial choices are omitted (§94). Format:
date · decision · reason · alternatives · reversibility · Founder Gate?

---

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
