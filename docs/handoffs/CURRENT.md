# CURRENT — Operational Handoff

> Operational state, NOT canonical governance. Canonical authority is `docs/aios/`.

## Feature
**SEC-001 — Security Foundation** (friendship integrity, blocking, moderated anonymity, mark-moderation authorization, reproducible Storage authorization, + an executable RLS security test suite).

## Status
**COMPLETE + hosted-Supabase production fix applied.** Reviewer APPROVE + QA PASS on the fixed version. NOT merged, NOT deployed. **Blocked on the Founder hosted retest** (below) — the fix targets a real hosted deploy failure that can only be finally proven on the hosted project.

## Role results
- **Product:** PRD-SEC-001 — guarantees A–E → AC-S1…AC-S10. ✅
- **Architect:** FP-SEC-001 (Rev 2) + 7 ADRs; block-vs-public-content resolved in-model (no gate). ✅
- **Independent high-risk design review:** REQUEST-CHANGES (Rev 1: BLOCKER anon-insert FK timing + INSERT self-friend vector + service_role grant gap) → **APPROVE-DESIGN (Rev 2).** ✅
- **Backend:** `0002` (F1–F5) + `0003` (F6) + `supabase/tests/` harness; suite green. ✅
- **Frontend:** one-line anon hardening in `src/lib/marks.ts`. ✅
- **Reviewer (code Two-Key):** APPROVE `4452552` (initial) → **APPROVE `cbe9725`** (after fix). ✅
- **QA (behavioral Two-Key):** PASS `4452552` (initial) → **PASS `cbe9725`** (after fix). ✅
- **Hosted-Supabase fix (Founder deploy finding):** `0003:19 ALTER TABLE storage.objects ENABLE RLS` → `ERROR 42501: must be owner of table objects`. Removed the ownership-gated ALTER (Supabase pre-enables RLS on `storage.objects`); RLS-enable moved into the test shim; regression guard + `relrowsecurity` assertion added. F6 guarantee unchanged. ✅

## Founder decisions (pre-approved, encoded)
A moderated anonymity · B blocking = hard interaction boundary · C friendship transitions (no self-accept) · D one relationship per unordered pair · E server-side mark moderation. No new decision surfaced.

## Branch
`claude/sec-001-security-foundation` (off latest `main`).

## Latest commit
`cbe9725` — `fix(sec-001): hosted-Supabase storage compat — don't toggle RLS on storage.objects (F6)`

## PR
**#8 (draft)** — https://github.com/darshitmeghani1992/the-wall/pull/8 (updated in place with the fix). **Do not merge without Founder approval + a successful hosted retest.**

## Known issues
- Advisory/cosmetic only (non-blocking): harness `exception when others` breadth (Reviewer/QA independently SQLSTATE-pinned real causes); moderation guard admits `postgres`/`service_role` (admin, not JWT-reachable); regression guard is line-based (matches the single-line pattern that caused the incident; `relrowsecurity` assertion + hosted platform pre-enable are the real defenses). Tracked debts: DEBT-001 unused `'blocked'` enum; DEBT-002 moderator == `service_role` only.
- A **pre-existing, differently-named `attachments` storage policy** exists on the hosted project — the Founder should review/remove it so the effective policy set matches `0003` exactly.

## Manual Founder tests required (the load-bearing final gate)
1. Apply `0002`+`0003` in ONE transaction on hosted → confirm **no `42501: must be owner of table objects`**.
2. Confirm the `attachments` bucket is public and the four `attachments …` policies took.
3. Review/remove any pre-existing differently-named `attachments` storage policy (its `drop policy if exists` only clears its own names).
4. Confirm `relrowsecurity = true` on hosted `storage.objects`.
5. Run one end-to-end anonymous-mark flow (author identity must not reach an ordinary client) + one upload flow (own-avatar allowed; cross-uid/anon rejected).

## Recommended next action
Founder: run the hosted retest above; if green, approve PR #8 merge. Next cycle candidate: **Friends system (server + minimal UI)** — its security primitives (friendship integrity, blocking, eligibility) now exist and are proven.

---
_Related: FP-001 (FTUE) is a separate branch `claude/the-wall-aios-product-zlc5on` / draft PR #7, awaiting your device test — independent of SEC-001._
