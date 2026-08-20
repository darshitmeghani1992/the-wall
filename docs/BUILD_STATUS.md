# The-Wall Build Status

> Restart anchor. On `Continue The-Wall build`: read `THE_WALL_MASTER_BUILD_SPEC_v1.1.md`,
> then this file, then `docs/DECISIONS.md`, inspect git, run the checks below, and
> resume from **Next Actions**. Operational state only — canonical governance is `docs/aios/`.

_Last updated: 2026-08-20 · branch `claude/kickoff-execution-chx2mh` (= `origin/main` at session start)._

## Current Slice
**Slice 7 — Anonymous + Secret (high-risk).** Completing the Secret Mark lifecycle:
one-time atomic reveal + 1-hour expiry (Master Spec §27.3 / §27.4 / §68), which the
prior batches left as content-isolation-only.

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
| Slice 2 Discover→Friend/Follow→Other Wall | **Partial** | Screens + `friendships`/`follows` libs; RLS **verified**. UI not device-verified. |
| Slice 3 Text Mark→Reaction→Alert | **Partial** | Composer + reactions + notification triggers present; triggers **verified**. |
| Slice 4 Photo/Voice/Video | **Partial/Missing** | Photo Mark implemented (upload to `attachments`). **Voice + Video MISSING** — no `expo-av`/audio recorder, no audio/video storage policy, no playback. |
| Slice 5 Permissions/Blocking/Reporting | **Partial** | RLS block/permission **verified**; report write path present; owner-removal quota (§33) needs verification. |
| Slice 6 Shared Walls | **Partial** | `walls.ts` member data layer + `app/shared/*` screens; membership RLS **verified**. Ownership-transfer/delete UI needs verification. |
| Slice 7 Anonymous | **Working (verified)** | anonymity side-table RLS **verified**. |
| Slice 7 Secret | **Working (verified, DB layer)** | isolation + one-time reveal + 1h expiry **verified**; Two-Key APPROVE+PASS @ `7d36458`. On-device UI pass pending. |
| Slice 8 Deep links/Sharing/Account deletion/Moderation | **Partial** | pending-link + share libs present; account-deletion lifecycle (§82) not implemented. |

## Reconciliation Debt (Master Spec vs current code) — tracked, not yet actioned
- **Mark type model conflicts §21/§4.** Current composer is a *type picker*
  (`app/create.tsx`) with obsolete/excluded types (`roast`, `award`, `poll`, `doodle`,
  `prediction`) and treats `secret` as a *type*. Spec requires a **single integrated
  composer** (text + inline Photos/Video/Voice) with **Anonymous** and **Secret** as
  *toggles/modes*, no type-picker, no games/doodles/polls. See DECISIONS D-2. This is the
  next major frontend reconciliation after the Secret lifecycle lands.
- **Alerts vs Notifications label** (§6 default **Alerts**) — audit copy for consistency.

## Blocked
- **On-device / hosted verification** blocked without a device build + a hosted Supabase
  project (external credentials = Founder Gate). DB-layer security is verified locally.

## Founder Decision Required
- None this session. (Reconciliation choices D-1..D-3 are engineering decisions per §89.)
- Pending prior gate (unchanged): applying migrations `0004`–`0010` to hosted Supabase is a
  destructive-production step requiring Founder go + credentials.

## Security / High-Risk Review (Two-Key)
- Secret lifecycle: **Key 1 Reviewer APPROVE + Key 2 QA PASS, bound to `7d36458`** — both
  independent, both re-executed against the live DB. No BLOCKER/HIGH/MEDIUM. On draft PR #17.
- Remaining Two-Key surface for a future on-device/staging pass: UI reveal, hosted expiry job.

## Tests / Builds Run
- `npm ci`; `npx tsc --noEmit` (0 err); `npx eslint .` (0 err / 6 warn).
- `supabase/tests/run_tests.sh` on local PG16 — full pass (91 assertions incl. 8 in `61`).

## Known Issues
- 6 eslint warnings (pre-existing, non-blocking).
- Voice/Video Marks unimplemented (Slice 4 remainder).
- Secret expiry cleanup needs a scheduled job (pg_cron) on hosted — `expire_secret_marks()`
  is provided and callable; scheduling is a deploy task.

## Next Actions
1. ✅ Secret one-time reveal + expiry — Two-Key APPROVE+PASS @ `7d36458`, draft PR #17.
2. **Founder Gate (when ready to deploy):** apply migrations `0004`–`0010` to hosted
   Supabase in one transaction; schedule `expire_secret_marks()` via `pg_cron`; on-device
   pass of the Secret reveal UI. (Needs Founder go + credentials.)
3. Reconcile Mark composer to the integrated single-composer model (remove excluded types
   `roast`/`award`/`poll`/`doodle`/`prediction`; Secret/Anonymous as toggles) — §21/§4.
4. Plan Voice + Video Mark slice (recorder + protected media storage + playback + RLS).
5. Account-deletion lifecycle (§82) and moderation/admin surface (§53).
6. Consider wiring `supabase/tests/run_tests.sh` into CI with a Postgres service container so
   the launch-blocking security suite runs on every PR (today CI is tsc + lint only).
