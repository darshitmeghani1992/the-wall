# 14 · Changelog *(living)*

Version-per-feature log for The Wall (Expo app). Newest first. Bump the
minor version per shipped slice; note schema/doc changes.

## Unreleased
- Extracted The Wall into its own standalone repository (`the-wall`) with its own
  Supabase project, independent of the "Here Community" web app it was prototyped
  in. App code promoted to the repo root; first migration renumbered `0001_init.sql`.
- Documentation suite added under `docs/` (product spec, flows, acceptance
  criteria, edge cases, DB, architecture w/ games-as-plugins, AI rules, DoD,
  and living analytics/perf/security/release docs).

## 0.4 — Write a Mark (Sticky / Roast / Secret)
- Create picker tiles open the Writer (`app/write/[type].tsx`).
- Writer: adaptive title, paper textarea (≤500 chars), **color picker** (Sticky),
  **anonymous** toggle, and a **live preview** rendered with the real `MarkView`.
- "Stick it on the Wall ✦" inserts the mark (`createMark` in `lib/marks.ts`);
  it drops in at the top of My Wall via realtime (+ `justCreated` animation).
- Analytics: `Mark Created` event via `lib/analytics.ts` (no-op without a key).
- CI: GitHub Actions type-check + lint on every PR; ESLint (`eslint-config-expo`);
  disabled expo-router typed-routes (needs generated types) to keep `tsc` green.

## 0.3 — My Wall hero
- 2-column masonry of tilted, pinned marks with hard shadows.
- Per-type renderers: sticky, roast, secret (tap-to-reveal), memory/photo
  (polaroid), award (gold badge), poll (bars), doodle, prediction (locked).
- Filter chips (All/Roasts/Photos/Awards).
- Live realtime drop-in of new marks; empty wall → invite-crew.

## 0.2 — Auth & onboarding
- Auth gate (welcome / setup / home) over the Supabase session.
- Onboarding: welcome → what-is-a-wall → interests → email-OTP/OAuth sign-in →
  profile setup (handle with live availability, name, bio, avatar upload).
- Auto Personal Wall on profile creation; profile tab + sign-out; invite-crew.

## 0.1 — Foundation & backend
- Expo/expo-router scaffold.
- "The Wall" design system (tokens, type scale) + core primitives (MarkCard,
  Fastener, BottomDock, Screen, Text, Button, Input).
- Supabase RN client with session persistence.
- Migration `0001_init.sql`: profiles/walls/marks/reactions/comments/
  poll_votes/friendships/notifications/reports + helper fns + triggers + RLS +
  realtime.

---
### Template for new entries
```
## 0.x — <feature>
- <what changed, user-facing first>
- Schema: <migration/table changes, if any>
- Analytics: <events added>
```
