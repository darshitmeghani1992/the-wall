# 07 · Engineering Plan

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

**A · Write-a-Mark**
- A1+A2 — Create picker → **Sticky writer** (first slice)
- A3 — Roast & Secret (same Writer, different config)
- A4 — Memory / Photo writer (camera/gallery + caption; reuse `upload.ts`)
- A5 — Poll builder (question + 2–4 options)
- A6 — Award picker (choose + note)
- A7 — Prediction writer (text + unlock date)
- A8 — Doodle canvas (Skia → export image → save)

**B · Mark interactions** — B1 detail (react + comment) · B2 report / hide / owner pin & approve

**C · Friends & social** — C1 find/invite + search · C2 requests · C3 Friend Wall (permission-gated) · C4 Discover

**D · Feeds & identity** — D1 Home feed · D2 Profile edit · D3 Notifications + push (incl. DB notification producers)

**E · Games (plugins)** — E1 Who Said This · E2 Roast Me · E3 Awards Night

**F · Settings & moderation** — F1 Settings · F2 moderation queue · F3 privacy + block list

**G · Ship** — G1 polish + tests + perf + security hardening · G2 EAS build + store submission

## First slice — Create → Sticky writer
Files: `app/create.tsx` (wire tiles → `write/[type]`),
`app/write/[type].tsx` (new Writer), `src/lib/marks.ts`
(`createMark`). Reuse `MarkCard`/`MarkView`, `Input`/`Button`, `stickySwatches`,
`getPersonalWall`. Acceptance: `03_ → Sticky mark`. Edge: `04_ → Marks`.

## Timeline
Budget ~10 weeks for the full V1 (optimistic 6 / typical 8–10 / with polish
10–12). Foundation/auth/wall already done; docs add ~2–3 days but cut rework.
