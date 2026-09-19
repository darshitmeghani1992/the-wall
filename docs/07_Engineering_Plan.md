# 07 · Engineering Plan

> Scope reconciliation (2026-09-19): the Master Build Specification v1.1 is authoritative.
> Comments, doodles, games, polls, awards, and predictions are not MVP backlog items. Live
> implementation and certification status is maintained in `BUILD_STATUS.md` and
> `handoffs/CURRENT.md`; this document records build order only.

## Working method — one screen at a time

Each screen is a complete **vertical slice**:
1. Build the screen to the design system.
2. Wire its workflow (real Supabase reads/writes under RLS).
3. Link it into navigation (reachable + back/close).
4. Meet the **Definition of Done** (`09_`) and its **Acceptance Criteria** (`03_`).
5. Commit on a feature branch (open a PR); update `10_Analytics` + `14_Changelog`.
6. Send the user a **visual HTML preview + plain-language note**; wait for OK.

> The first slice pairs the type picker with the first writer (smallest unit that
> runs end-to-end). Later writers/screens are each their own slice.

## Status

| Area | Status |
|---|---|
| Foundation (scaffold, design system, primitives, Supabase client) | ✅ done |
| Backend (schema, RLS, triggers, realtime) — `0001_init.sql` | ✅ done |
| Auth & onboarding | ✅ done |
| My Wall hero (masonry + MarkView + live drop-in) | ✅ done |
| **Docs suite (this)** | ✅ in progress |
| A · Write-a-Mark flow | ⏭ **next** |
| B–G | ⬜ backlog |

## Backlog (ordered)

**A · Write-a-Mark (source implemented)**
- Text composer and Anonymous/Secret modes ✅
- Protected Photo writer, including ordered one-to-five photos ✅
- Protected Voice and Video writers ✅

> **Re-sequenced (per the Core interaction model):** the core act is marking
> *others'* walls, so we prioritize the pieces that make that real next —
> friends, the Friend Wall, and the target-first ✚ — before finishing the
> the supported MVP Mark writers.

**C · Friends & social (NEXT)** — C1 find/invite + search · C2 requests · C3 Friend
Wall (permission-gated) with a pre-aimed "Leave a Mark" · C4 Discover

**A✚ · Target-first create** — ✚ opens "whose wall?" (friend picker) → writer
aimed at that wall; writer/`createMark` take a target `wallId`; own wall becomes
receive-first (self-posts secondary). *(Depends on C1–C3.)*

**B · Mark interactions** — detail + reactions · report / hide / owner pin & approve

**D · Identity and Alerts** — Profile edit · in-app Alerts and valid destinations

**F · Settings & moderation** — F1 Settings · F2 moderation queue · F3 privacy + block list

**G · Ship** — polish + tests + accessibility/performance/security hardening · hosted integration · EAS builds + store submission

## First slice — Create → Sticky writer
Files: `app/create.tsx` (wire tiles → `write/[type]`),
`app/write/[type].tsx` (new Writer), `src/lib/marks.ts`
(`createMark`). Reuse `MarkCard`/`MarkView`, `Input`/`Button`, `stickySwatches`,
`getPersonalWall`. Acceptance: `03_ → Sticky mark`. Edge: `04_ → Marks`.

## Timeline
Budget ~10 weeks for the full V1 (optimistic 6 / typical 8–10 / with polish
10–12). Foundation/auth/wall already done; docs add ~2–3 days but cut rework.
