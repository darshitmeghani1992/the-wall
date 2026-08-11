# CURRENT — Operational Handoff

> Operational state, NOT canonical governance. Canonical authority is `docs/aios/`.

## Feature
**SEC-001 — Security Foundation** (friendship integrity, blocking, moderated anonymity, mark-moderation authorization, reproducible Storage authorization, + an executable RLS security test suite). Hardening the authorization foundation before Friends / Friend Wall / recipient picker / Shared Walls.

## Status
**COMPLETE — Reviewer APPROVE + QA PASS.** Awaiting Founder acceptance + merge. NOT merged, NOT deployed. All work is on the feature branch below.

## Role results
- **Product:** PRD-SEC-001 — guarantees A–E → acceptance criteria AC-S1…AC-S10. ✅
- **Architect:** FP-SEC-001 (Rev 2) + 7 ADRs; block-vs-public-content resolved within approved model (no Founder gate). ✅
- **Independent high-risk design review (Two-Key design key):** REQUEST-CHANGES on Rev 1 (found a BLOCKER: anon insert FK-timing; + INSERT self-friend vector; + service_role grant gap) → **APPROVE-DESIGN on Rev 2.** ✅
- **Backend:** `0002_security_foundation.sql` (F1–F5), `0003_storage_attachments.sql` (F6), `supabase/tests/` harness. `run_tests.sh` exit 0, all AC-S1…AC-S10 + moderator-read + storage PASS. ✅
- **Frontend:** one-line defense-in-depth in `src/lib/marks.ts` (anon marks don't transmit `author_id`; DB trigger is the real enforcement). typecheck/lint 0 errors. ✅
- **Reviewer (code Two-Key key):** APPROVE (commit `4452552`) — independently re-executed + adversarially re-attacked F1/F4/F5 with SQLSTATE capture. ✅
- **QA (behavioral Two-Key key):** PASS — drove end-user authorization scenarios against live PostgreSQL 16; every denial confirmed as the intended rule. ✅

## Founder decisions (pre-approved, encoded)
A moderated anonymity (no irreversible crypto) · B blocking = hard interaction boundary · C friendship transitions (no requester self-accept) · D one logical relationship per unordered pair · E server-side mark moderation. No new Founder decision surfaced.

## Branch
`claude/sec-001-security-foundation` (based on latest `main`, which includes merged PR #6 AGENTS.md).

## Latest commit
`4452552` — `feat(sec-001): don't transmit author_id for anonymous marks (defense-in-depth)`

## PR
Draft PR (SEC-001) — see repository PR list. Base `main`. **Do not merge without Founder approval** (security/schema/Two-Key category).

## Known issues
- Advisory/cosmetic only (non-blocking): harness uses a broad `exception when others` catch (QA/Reviewer independently pinned SQLSTATEs to confirm genuine causes); moderation guard allows `postgres`/`service_role` (admin/superuser, not a JWT-reachable client path). Tracked debts: DEBT-001 (retained unused `'blocked'` enum value on `friendship_status`), DEBT-002 (moderator == `service_role` only; no first-class moderator identity — a Non-Goal this cycle).

## Manual Founder tests required (before/at deploy)
1. Apply `0002`/`0003` to the real Supabase project.
2. Confirm production `service_role` has no blanket grant that re-exposes `anonymous_mark_authors`; confirm prod default privileges match the test shim's assumptions.
3. Confirm `storage.objects` RLS is enabled on the hosted project and the `attachments` bucket policies took.
4. Run one end-to-end anonymous-mark flow through the live app + Realtime (author identity must not appear to an ordinary client).

## Recommended next action
Founder: review the draft PR + `docs/qa/QA-SEC-001-report.md`, run the manual verification list, then approve merge. Next cycle candidate: **Friends system (server + minimal UI)** — the security primitives it depends on (friendship integrity, blocking, eligibility) now exist and are proven.
