# The-Wall Build Status

> Restart anchor. On `Continue The-Wall build`: read `THE_WALL_MASTER_BUILD_SPEC_v1.1.md`,
> then this file, then `docs/DECISIONS.md`, inspect git, run the checks below, and
> resume from **Next Actions**. Operational state only — canonical governance is `docs/aios/`.

_Last updated: 2026-08-20 · branch `claude/kickoff-execution-chx2mh` (= `origin/main` at session start)._

## Current Slice
**Slice 3/4 reconciliation + media (Founder-directed).** Reconciled the Mark model to
the Master Spec's integrated composer (Secret/Anonymous as modes; canonical content
types) and added Voice + Video Marks. Preceded by the Secret one-time-reveal + expiry
slice (below), which is complete through Two-Key.

### Slice A — Mark model + integrated composer ✅ (committed)
- Migration `0011`: `mark_type` gains text/voice/video; `marks.secret` boolean; the three
  `type='secret'` couplings (extract trigger, F1 CHECK, expiry cleanup) repointed to the
  flag. Full suite green. **High-risk (secret storage) → Two-Key pending on this range.**
- Frontend: single integrated composer (`app/create.tsx`) — text + photo + Anonymous +
  Secret toggles; removed the type-picker and `app/write/[type].tsx`; MarkView pruned of
  the excluded prototype types (roast/award/poll/doodle/prediction). Resolves the §21/§4
  reconciliation debt.

### Slice B — Voice + Video Marks ✅ (committed)
- `expo-av` recorder (≤60s voice) + ImagePicker video capture (≤30s); `uploadMedia` with
  per-kind caps + MIME allowlist; MarkView voice/video renderers; app.json mic permission.
- Reuses the verified public `attachments` bucket (path-scoped, ADR-006/0003) — **no new
  storage policy/migration, no new security surface.**
- **Device QA pending:** real mic/camera recording + on-device playback (no device here).

## Verified This Session (real Postgres 16, local cluster)
- **Baseline build health (Slice 0):** `npm ci` clean; `tsc --noEmit` → 0 errors;
  `eslint .` → 0 errors, 6 pre-existing warnings (unused var + exhaustive-deps + a
  design-reference file). No source changes needed for green baseline.
- **Security suite `supabase/tests/run_tests.sh` → ALL ASSERTIONS PASS** against a real
  Postgres (previously only "Believed-likely / hosted not run"). Now **Verified** at the
  DB layer:
  - SEC-001 AC-S1…AC-S10: friendships, blocking (bilateral override), anonymity side-table
    (author never exposed to client/realtime/notifications), mark moderation, storage scoping.
  - FP-C2: Secret **content** isolation (content off base row + off realtime + RLS side
    table), `wall_members` gating + invite/accept + F-B1 self-escalation guards, 5
    notification triggers (no anon de-anonymization), profile-link self-write/world-read.
  - Hosted-incompatibility guard (no ownership-gated `ALTER` on `storage.objects`) passes.

## In Progress
- None. The Secret one-time-reveal + expiry slice is **complete through both AIOS keys**
  (see below) and shipped on draft PR #17. Next unstarted work is in **Next Actions**.

## Just Completed — Secret one-time reveal + expiry (migration `0010`, ADR-010) ✅
- `expires_at`/`opened_at` columns; atomic `reveal_secret(uuid)` RPC (recipient-only,
  one-time, expiry-classified: `ok`/`consumed`/`expired`/`not_authorized`/`missing`); revoke
  of direct client `SELECT` on `mark_secrets` (reads go only through the gated RPC);
  `expire_secret_marks()` cleanup fn; client `revealSecret()` + `MarkView` consumed/expired
  states; adversarial tests `61_secret_reveal.sql`.
- **Two-Key satisfied, bound to commit `7d36458`:**
  - **Key 1 — independent Reviewer: APPROVE.** Re-executed a real two-session concurrency
    race (exactly one reveal returned content), confirmed direct `authenticated` read is
    revoked, expiry + purge, DEFINER hygiene, no realtime/anonymity regression. Caught one
    LOW (`missing` reason unreachable) — fixed in `7d36458` and re-APPROVED.
  - **Key 2 — independent QA/Security: PASS.** Independently reproduced one-time consume,
    atomic race, expiry+cleanup, wrong-user `not_authorized` (no consume), no content leak
    on any failure branch, `authenticated` direct SELECT denied, full regression suite green.
    No BLOCKER/HIGH/MEDIUM.
  - **Out of scope (Inferred, later on-device/staging pass):** UI reveal flow on a device,
    `pg_cron` scheduling of `expire_secret_marks`, live Realtime, hosted GoTrue `auth.uid()`.

## Gap Map (Specified / Working / Partial / Missing / Conflicting)
| Area | State | Notes |
|---|---|---|
| Slice 0 Foundation | **Working (verified)** | deps/tsc/lint green; theme tokens, nav shell, Supabase client present. |
| Slice 1 Auth→Onboarding→My Wall | **Partial** | Screens + libs present; Email-OTP/OAuth wired. On-device flow **not** verified (no device/hosted). |
| Slice 2 Discover→Friend/Follow→Other Wall | **Partial** | Friends + **Followers (§17/§66) implemented + Two-Key @ `ddec951`** (follows table/RLS, block/active-gated, no write grant; Follow button on person wall). Discover-card Follow + profile counts are follow-on UI. RLS **verified**. |
| Slice 3 Text Mark→Reaction→Alert | **Mostly done** | Integrated composer; **reactions one-per-user §31 done + Two-Key (`0016`)**; notification triggers **verified**. On-device UI pass pending. |
| Slice 4 Photo/Voice/Video | **Implemented (device QA pending)** | Photo + **Voice (≤60s) + Video (≤30s)** in the integrated composer; `expo-av` recorder + playback; `uploadMedia` caps/MIME; reuses verified `attachments` bucket. Real recording/playback pending on a device. |
| Slice 5 Permissions/Blocking/Reporting | **Mostly done** | RLS block/permission **verified**; §32 edit window + §33 removal quota server-enforced + verified (`0012`); **Approved Writers §50 done + Two-Key (`0015`)**; report write path present. Owner-removal/edit **UI** (§30), moderation/admin (§53), blocking/reporting UI are frontend follow-ons. |
| Slice 6 Shared Walls | **Partial** | `walls.ts` member data layer + `app/shared/*` screens; membership RLS **verified**. Ownership-transfer/delete UI needs verification. |
| Slice 7 Anonymous | **Working (verified)** | anonymity side-table RLS **verified**. |
| Slice 7 Secret | **Working (verified, DB layer)** | isolation + one-time reveal + 1h expiry **verified**; Two-Key APPROVE+PASS @ `7d36458`. On-device UI pass pending. |
| Slice 8 Deep links/Sharing/Account deletion/Moderation | **Partial** | pending-link + share libs present; **account deactivation (§82) backend done + Two-Key @ `3b58be7`** (Settings UI + hosted purge job pending); moderation/admin (§53) still thin. |

## Reconciliation Debt (Master Spec vs current code)
- ✅ **Mark type model (§21/§4) — RESOLVED (Slice A).** Single integrated composer; Secret/
  Anonymous are modes; canonical content types text/photo/voice/video; excluded prototype
  types retired from the app surface.
- **Alerts vs Notifications label** (§6 default **Alerts**) — audit copy for consistency (open).
- **Protected media for Secret Marks** — Secret is text-only today; secret media needs
  signed/protected storage (a later slice). Composer clears Secret when media is attached.
- **Server-side media limits** — client enforces caps/MIME (§108); the `attachments` bucket's
  `file_size_limit` / `allowed_mime_types` are a hosted-config hardening task.

## Blocked
- **On-device / hosted verification** blocked without a device build + a hosted Supabase
  project (external credentials = Founder Gate). DB-layer security is verified locally.

## Founder Decision Required
- None this session. (Reconciliation choices D-1..D-3 are engineering decisions per §89.)
- Pending prior gate (unchanged): applying migrations `0004`–`0010` to hosted Supabase is a
  destructive-production step requiring Founder go + credentials.

## Security / High-Risk Review (Two-Key)
- Secret lifecycle: **Reviewer APPROVE + QA PASS @ `7d36458`** — no BLOCKER/HIGH/MEDIUM.
- Mark-model reconciliation (`0011`) + Voice/Video: **Reviewer APPROVE + QA PASS @ `725d7ba`**
  — both independent, both re-executed against the live DB (incl. a two-session concurrency
  race and secret+media rejection). No Two-Key secret guarantee regressed; no new storage
  surface. No BLOCKER/HIGH/MEDIUM. One LOW (server-side storage MIME/size limits are
  client-only) → routed to the hosted storage-hardening task (below).
- Mark-lifecycle §32/§33 (`0012`): **Reviewer APPROVE + QA PASS @ `e291269`.** Independent
  review caught **3** real authorization bypasses (created_at window-anchor reset; non-owner
  quota-poisoning of removal-accounting columns; owner rewriting another author's content) —
  all fixed in the trigger and regression-tested. Final head clean; no open findings.
  - _Informational (pre-existing, deploy task):_ `service_role` has no table grants on `marks`
    in the migration schema — the moderation-write path relies on hosted-Supabase default
    grants / `postgres`; verify on hosted apply.
- Approved Writers §15/§50 (`0015`): **Reviewer APPROVE + QA PASS @ `41d7253`** (Two-Key
  interrupted by the account session limit, then re-run cleanly after reset). `can_contribute`
  body preserved with only the `'selected'` branch added; §50 private-visibility-wins enforced;
  approval is write-only (no view grant); owner-only management; block/active override intact.
  No SEC-001/etc regression. **Zero findings.**
- Moderation/Admin §53 + Reporting §52 (`0017`): **committed @ `ea88d7b` — Two-Key PENDING.**
  Independent Reviewer/QA are **blocked on the account session limit (resets 11:10 UTC)** — the
  reviewer terminated mid-review of the pre-fix `4c7a71a`. Do NOT treat as verified.
  - **Escalation caught + fixed:** the reviewer's probe #1 (and my own analysis) found that the
    0001 `profiles update self` policy would let a client `set is_admin=true` (self-promote).
    Fixed in `ea88d7b` with a BEFORE-UPDATE `profiles_guard_privileged` trigger that reverts
    is_admin/account_status/deactivated_at for non-privileged callers (lifecycle/admin RPCs run
    SECURITY DEFINER, so they remain the only writers). Author checks: full suite green (117
    assertions incl. `85 (no self-promote to admin)`), and a standalone probe as an
    **authenticated** client confirms `update … set is_admin=true` leaves is_admin=false.
    **CI green on `ea88d7b`.** But this is author verification only.
  - **Next action: re-run Reviewer (bind `ea88d7b`, review the guard delta + full §52/§53
    surface) + QA once the limit resets (11:10 UTC).**
- Reactions one-per-user §31 (`0016`): **Reviewer APPROVE + QA PASS @ `85da09f`.** PK repointed
  to (mark_id,user_id) (fixes the emoji-stacking "de-dup debt"); self-only UPDATE policy; client
  single-active reaction; emoji set aligned to §31. A reaction *change* fires no duplicate
  notification. No regression. **Zero findings.**
- Followers §17/§66 (`0014`): **Reviewer APPROVE + QA PASS @ `ddec951`.** One-way follow of a
  public Personal Wall; self-only; block/active-gated both ways; block tears down follow rows;
  grants no write; no SEC-001/etc regression. **Zero findings.** Edge-list world-readable = D-10.
- Account deactivation §82 (`0013`): **Reviewer APPROVE + QA PASS @ `3b58be7`.** Re-gates the
  two SECURITY DEFINER chokepoints + friendships-insert on `is_active_account`; deactivate/
  reactivate RPCs are self-only. No SEC-001/secret/anon/quota regression; shared walls not
  over-gated. No BLOCKER/HIGH/MEDIUM. Two LOW/informational (fail-closed, non-blocking):
  (a) `walls.owner_id`→`auth.users` means a profile-less owner's wall is hidden (fail-closed);
  (b) the `profiles update self` policy lets a user self-set `account_status` directly,
  skipping `deactivated_at` stamping (self-only; recoverable) — optional future hardening: a
  BEFORE-UPDATE trigger to keep `deactivated_at` in sync with `account_status`.
- Remaining Two-Key surface for a future on-device/staging pass: Secret reveal UI, voice/video
  recording+playback, hosted expiry job + bucket limits.

## Tests / Builds Run
- `npm ci`; `npx tsc --noEmit` (0 err); `npx eslint .` (0 err / 6 warn).
- `supabase/tests/run_tests.sh` on local PG16 — full pass (91 assertions incl. 8 in `61`).

## Known Issues
- 6 eslint warnings (pre-existing, non-blocking).
- Voice/Video Marks unimplemented (Slice 4 remainder).
- Secret expiry cleanup needs a scheduled job (pg_cron) on hosted — `expire_secret_marks()`
  is provided and callable; scheduling is a deploy task.

## Next Actions
1. ✅ Secret one-time reveal + expiry — Two-Key APPROVE+PASS @ `7d36458`.
2. ✅ Slice A (Mark model + integrated composer) + ✅ Slice B (Voice + Video) — committed.
3. **Two-Key on the A+B range** (migration `0011` is the high-risk part): independent
   Reviewer + QA bound to the head commit. — **in progress.**
4. ✅ Slice C (Mark-lifecycle §32/§33 enforcement, migration `0012`) — Two-Key @ `e291269`.
5. **Founder Gate (when ready to deploy):** apply migrations `0004`–`0012` to hosted Supabase
   in one transaction; schedule `expire_secret_marks()` via `pg_cron`; set the `attachments`
   bucket `file_size_limit`/`allowed_mime_types`; verify `service_role` moderation grants on
   `marks`. (Needs Founder go + credentials.)
6. **Device QA:** real recording/playback for Voice/Video; on-device Secret reveal UI.
7. Owner Mark-removal / sender-edit **UI** (Mark detail sheet §30) — frontend slice; data
   layer ready (`removeMark`/`editMarkText`/helpers).
8. **Account-deletion / deactivation lifecycle (§82)** — NEXT high-risk backend slice.
   Design (keep RLS blast-radius small; each step guarded by the security suite):
   - Migration `0013`: `profiles.account_status text not null default 'active'
     check (in ('active','deactivated'))` + `deactivated_at timestamptz`; helper
     `is_active_account(uid)`.
   - Enforce "a deactivated account disappears" at the interaction points, NOT by hiding the
     profile row (that would break author display on existing Marks): deny in `can_view_wall`
     when the wall owner is deactivated; deny in `can_contribute` when actor or target owner is
     deactivated; block new friend requests / follows to a deactivated user; exclude deactivated
     profiles in the search query (`profiles.ts`).
   - Reactivation-on-login within 30 days (data layer); `deactivate_account()` /
     `reactivate_account()` RPCs. Before FINAL deletion, require Shared-Wall ownership transfer
     or delete (§43/§82) — surface as a blocker, don't auto-transfer.
   - If a full automated 30-day purge can't run without a scheduler, implement deactivation +
     `deletion_scheduled_at` and mark the purge job as a hosted/pg_cron deploy task (§82).
   - New test `95_account_lifecycle.sql`: deactivated owner's wall not viewable by others;
     deactivated user can't contribute or be friend-requested; reactivation restores access;
     the SEC-001/anon/secret/quota suites stay green. Two-Key.
9. ✅ Followers §17/§66 (`0014`) — Two-Key @ `ddec951`.
10. ✅ Approved Writers (§15/§50, `0015`) — Two-Key @ `41d7253`.
10b. ✅ Reactions one-per-user (§31, `0016`) — Two-Key @ `85da09f`.
10c. Reporting §52 + Moderation/admin §53 (`0017`) — implemented @ `ea88d7b`; **Two-Key
     PENDING** (re-run Reviewer + QA bound to `ea88d7b` once the session limit resets 11:10 UTC).
11. Owner Mark-removal / sender-edit **UI** (Mark detail sheet §30); moderation/admin (§53);
    blocking/reporting UI (§51/§52); Discover-card Follow + profile counts; Alerts-label copy.
12. ✅ CI runs the security suite on every PR (postgres:16 service).
