# 06 · Tech Architecture

## Official stack (locked)

The Wall is a **standalone repository** with its own Supabase project. "Status"
= installed/wired in the repo vs. planned.

| Category | Choice | Status |
|---|---|---|
| Frontend | Expo (React Native) + **expo-router** | ✅ installed |
| Language | TypeScript | ✅ |
| Backend / DB / Auth / Storage / Realtime | Supabase (PostgreSQL) | ✅ |
| Styling | **Design tokens in `src/theme`** (see decision below) | ✅ |
| Animation / gestures | reanimated + gesture-handler | ✅ |
| Drawing (Doodle) | @shopify/react-native-skia | ✅ installed |
| Lists (masonry) | @shopify/flash-list | ✅ installed |
| Media | expo-image, expo-image-picker, expo-camera | ✅ |
| Image compression | **expo-image-manipulator** (resize/compress before upload) | ⬜ to add |
| Blur | expo-blur | ✅ |
| Push | expo-notifications | ✅ installed |
| Deep links / invites | **expo-linking** + universal links | ⬜ to add |
| Fonts | expo-font (Bricolage / Geist / Space Mono) | ⬜ ttf pending |
| Local state | Zustand (add when first needed) | ⬜ |
| Server state | TanStack Query (adopt deliberately — see below) | ⬜ |
| Forms / validation | React Hook Form + **Zod** | ⬜ (Zod prioritized) |
| Analytics + feature flags | PostHog (`posthog-react-native`) | ✅ analytics wired |
| Crash reporting | Sentry | ⬜ add before beta |
| Lint / format | ESLint (eslint-config-expo) + **Prettier** | ✅ eslint / ⬜ prettier |
| Tests | Jest + RN Testing Library (core logic); Maestro E2E later | ⬜ |
| CI | GitHub Actions (type-check + lint) | ✅ |
| Builds / release | **EAS Build / Submit** + EAS Update (OTA) | ⬜ configure |
| Payments (future) | RevenueCat | later |

### Standing decisions
- **Styling — keep the `src/theme` token system, defer NativeWind.** The tactile
  look (hard offset shadows, per-mark tilt, tape/pin fasteners) is custom styling
  Tailwind classes don't express, so NativeWind is a refactor with modest payoff.
  Revisit only if the team strongly prefers Tailwind DX; if adopted, do it early.
- **TanStack Query — adopt, deliberately.** It rewires how screens fetch and must
  be integrated with Supabase Realtime (patch/invalidate cache on live events).
  Cheaper to retrofit now (few screens) than later.
- **Zod first** among forms/validation — validate inputs *and* mark `payload`
  shapes (poll options, prediction dates).

## App structure (repo root)
```
app/                       expo-router routes
  _layout.tsx              root stack, wrapped in <AuthProvider>
  index.tsx                auth gate → onboarding | setup | Home
  (onboarding)/            welcome · about · interests · sign-in · profile-setup
  (tabs)/                  home · walls · discover · profile (custom BottomDock)
  create.tsx               "Leave a Mark" type picker (modal)
  write/[type].tsx         the Writer (per-type)            [in progress]
  wall.tsx                 My Wall (hero)
  auth/callback.tsx        deep-link OAuth/magic-link landing
src/
  theme/                   design tokens + type scale (single source of truth)
  components/              Text, Screen, Button, Input, MarkCard, Fastener,
                           BottomDock, Masonry, InviteCrew, marks/MarkView
  lib/                     supabase, auth, profiles, marks, upload, onboarding, types
```

## Data layer
- One Supabase client (`src/lib/supabase.ts`) with AsyncStorage session persistence.
- Feature modules in `src/lib/*` own their queries (`marks.ts`, `profiles.ts`, …)
  — screens call these, never inline SQL in components.
- **Author hydration** respects anonymity (`marks.ts#hydrateAuthors`).
- **Realtime**: `subscribeToWall(wallId, onInsert)` streams new marks → drop-in.

## Design system
Tokens in `src/theme/` (colors, mark palette, spacing, radius, hard-offset
shadows, tilt helper, type scale). **Never hardcode colors or fonts in screens** —
always import tokens (`08_AI_Coding_Rules.md`). Aesthetic: paper surface, marks
tilt ±2.5° with a pin/tape fastener and a 4px hard shadow.

## Auth
`AuthProvider`/`useAuth` (`src/lib/auth.tsx`) tracks the Supabase session + the
user's profile and exposes `signInWithEmail`/`verifyEmailOtp`/`signInWithOAuth`/
`signOut`. The entry gate branches on `session` + `needsProfile`.

## Games as plugins (architecture requirement)

Games must **not** be wired into the wall/mark core. Each game is a self-contained
plugin implementing a shared interface, registered in a registry the Games screen
reads. Adding a future game = adding one plugin file + registering it; **zero**
changes to walls/marks.

```ts
// src/games/types.ts
export interface GamePlugin {
  id: string;                       // 'who-said-this'
  metadata: { title: string; blurb: string; icon: string; color: string };
  EntryScreen: React.ComponentType<GameProps>;   // route target
  rules: string;                                  // shown pre-game
  score: (state: unknown) => number;              // pure scoring
  rewardHooks?: (result: GameResult) => Promise<void>; // points/badges
  analyticsEvents: { started: string; finished: string };
}

// src/games/registry.ts
export const GAMES: GamePlugin[] = [whoSaidThis, roastMe, awardsNight];
```
- Route: `app/game/[id].tsx` looks the plugin up in `GAMES` and renders its
  `EntryScreen`. The dock/Home lists `GAMES` metadata.
- Reward hooks and analytics are the plugin's responsibility, keeping the core clean.
- First three plugins: **Who Said This**, **Roast Me**, **Awards Night** (E1–E3).

## Environments & secrets
- **Two environments, each its own Supabase project:** `dev` and `prod`.
- **Client config (safe):** `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_AUTH_REDIRECT`
  (`thewall://auth/callback`), `EXPO_PUBLIC_POSTHOG_KEY`. Anon key only — never a
  service-role key.
- **Server-only secrets** (service-role key, moderation API keys) live in **EAS
  secrets** and **Supabase Edge Function** env — never in the app bundle or git.
- Each project needs: Email + Apple + Google auth providers, the
  `thewall://auth/callback` redirect, and a public **`attachments`** bucket.
- Migrations run against `dev` first, then `prod` at release (`05`).

## Feature flags
**PostHog feature flags** gate risky/incomplete surfaces so they can be
dark-launched, rolled out gradually, or killed without a redeploy. New
user-facing features default **off** until validated.

## Moderation & anti-abuse (MVP approach)
- **Decision (revisit at scale):** lightweight **in-house** moderation for MVP —
  a **wordlist + a Supabase Edge Function** screens text marks/comments; image
  marks get basic type/size validation on upload. Reports go to `reports` for the
  wall owner. **Upgrade path:** swap in a moderation API (e.g. OpenAI Moderation
  for text, an image-moderation service for photos) behind the same Edge Function
  when volume warrants — no client change.
- **Rate limiting:** enforce per-user action caps in the Edge Function (a
  `rate_events` table or a counter), not in the client. See `12_Security`.
- **Search (Discover):** Postgres full-text / `pg_trgm` — no external search
  engine for MVP.

## Build & release
EAS Build produces iOS/Android binaries; EAS Submit uploads to TestFlight / Play
internal track; **EAS Update** ships OTA JS fixes and enables instant rollback
(see hotfix/rollback in `15_Workflow`). See `13_Release_Checklist.md`.
