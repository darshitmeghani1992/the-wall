# CURRENT — Operational Handoff

> Operational state, NOT canonical governance. Canonical authority is `docs/aios/`.

## Feature
**MVP Product Batch C** — retention + shared walls + secret marks + reactions + notifications + arrival + viral CTAs. Split by governance into **PR C1 (NORMAL)** and **PR C2 (HIGH_RISK_TWO_KEY)**.

## Status
- **PR C1 (#11, NORMAL):** delivered, open for independent review. Reactions, notifications read-surface, arrival motion, public shared walls, viral CTAs, analytics — all on existing contracts, no schema.
- **PR C2 (#12, HIGH_RISK):** **complete through all AIOS gates** — design-Two-Key APPROVE-DESIGN, code Reviewer APPROVE (`4626bb6`), QA PASS (`4626bb6`). Secret Marks (true RLS content-isolation), `wall_members`, notification triggers, profile-link columns. **NOT merged, NOT deployed** — Founder Gate below.

## Role results (C2)
- **Architect:** FP-C2 (Rev 2) + ADR-008…011; independent design review caught a secret-lifecycle leak (F1) → fixed.
- **Backend:** migrations `0004`–`0007` + tests `60`–`90`; suite green (62 assertions), idempotent.
- **Reviewer:** BLOCK → found F-B1 (`wall_members` fail-open self-membership) → fixed → **APPROVE** at `4626bb6`.
- **QA:** **PASS** at `4626bb6` (behavioral, DB-layer Verified; hosted/app not exercised — Believed-likely).

## Founder decisions / gates OPEN (before any deploy)
1. **F-1 (product):** Secret Mark on a *public* shared wall is readable by a possibly-stranger owner — allow (recommended default, owner = recipient) or restrict to personal/friend walls.
2. **F-2 (acknowledge):** private shared walls become **member-gated** (vs friend-gated) — forward-only authz-model change.
3. **🔴 0002 friendships hardening (production security):** merged SEC-001 `friendships_guard_transition()` has the SAME early-return-before-immutability pattern as F-B1 → a user can unilaterally reassign an accepted friendship's other party to an arbitrary user (non-consensual friendship → private-wall access). Recommend a forward hardening migration (identical fix). Awaiting Founder authorization; NOT auto-applied to merged code.
4. **C2 hosted deploy** (Founder Gate): apply `0004`–`0007` in one transaction; confirm `service_role` grants/default privileges; confirm `mark_secrets` absent from the hosted realtime publication; then decide F-1.

## Deferred / follow-ups (documented, not blockers)
- Frontend **owner secret-read path** (render 🔒 to others; read `mark_secrets` for owner) — small client follow-on (C2 makes secrets secure regardless).
- `"walls view"` policy lacks a membership disjunct (fail-closed; ship with private shared walls).
- Push notifications (native infra), universal/HTTPS App Links (domain/AASA/assetlinks infra), profile-link display polish, reaction de-dup/fan-out debt.

## Branches / heads
- C1: `claude/mvp-batch-c-normal` → PR #11.
- C2: `claude/mvp-batch-c-secure` @ `4626bb6` → PR #12.

## Recommended next action
Founder: review PR #11; decide F-1 / the 0002 hardening; run the C2 hosted pre-deploy checklist. Independent review of PR #11 (C1) and device QA of both remain.
