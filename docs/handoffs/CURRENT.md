# CURRENT — Operational Handoff

> Operational state, NOT canonical governance. Canonical authority is `docs/aios/`.

## Feature
**MVP Product Batch C** — reactions, notifications, arrival motion, shared walls, true secret marks, viral CTAs, profile links. Split by governance: **PR C1 (NORMAL)** + **PR C2 (HIGH_RISK_TWO_KEY)**.

## Status
- **PR #11 (C1, NORMAL):** open, awaiting independent review. Reactions, notifications read-surface, arrival motion, public shared walls, viral CTAs, analytics — existing contracts, no schema.
- **PR #12 (C2, HIGH_RISK):** **complete through all AIOS gates at `37cfecf`** (Reviewer APPROVE + QA PASS). Secret Marks (true RLS isolation), `wall_members`, notification triggers, profile-link columns, + Founder-approved final hardening (0008 friendships fail-open fix, 0009 walls-view membership) + frontend (secret reveal UI, social links, member data layer). **NOT merged, NOT deployed.**

## C2 gate history
- Design-Two-Key: independent design review APPROVE-DESIGN (caught+fixed a secret-lifecycle leak).
- Reviewer: caught+fixed **F-B1** (wall_members fail-open) → APPROVE `4626bb6` → re-APPROVE `37cfecf` (after final hardening).
- QA: PASS `4626bb6` → PASS `37cfecf`. 83 RLS assertions green, twice. DB-layer Verified; hosted not run (Believed-likely).

## Founder decisions — RESOLVED
- **F-1 APPROVED:** secret Marks allowed on public shared walls (owner = recipient).
- **F-2 APPROVED:** private shared walls are member-gated.
- **0002 friendships hardening APPROVED:** implemented as forward migration `0008` (0002 untouched).

## Migrations in PR #12 (source-controlled; NOT applied to hosted)
`0004` secret_marks · `0005` wall_members · `0006` notification_triggers · `0007` profile_social_links · `0008` friendships_guard_hardening · `0009` walls_view_membership. `0001`–`0003` byte-identical to main.

## Open items (non-blocking / follow-ups)
- **F-A1 (Architect flag):** `walls view` still admits an owner's friends to a private *shared* wall's **metadata** row (pre-existing `are_friends` disjunct; marks + secret content remain member/owner-gated). Architectural-fit consistency question vs `can_view_wall`; not a confidentiality breach.
- **F-A2:** shared-wall **member UI screens** deferred — `app/shared/*` live on the C1 branch (PR #11), not present on C2. `src/lib/walls.ts` member data layer is in place (unwired here). Build the screens once C1 + C2 are both on a branch (e.g. after both merge to main).
- Push notifications (native infra), universal/HTTPS App Links (domain/AASA/assetlinks), reaction de-dup debt.

## FOUNDER GATE — before any deploy (C2 hosted apply)
1. Apply `0004`–`0009` to hosted Supabase in ONE transaction; confirm no `42501 must be owner of table objects`.
2. Verify hosted `service_role` grants (mark_secrets moderation read works; no side-table re-exposure).
3. Confirm `mark_secrets` NOT in the hosted `supabase_realtime` publication (`marks` still is).

## Branches / heads
- C1: `claude/mvp-batch-c-normal` → PR #11.
- C2: `claude/mvp-batch-c-secure` @ `37cfecf` → PR #12 (code) [+ this docs commit].

## Recommended next action
Founder: review PR #11; run the C2 hosted pre-deploy checklist; then decide merge order (C1 then C2, or combine). Device QA of both PRs still recommended.
