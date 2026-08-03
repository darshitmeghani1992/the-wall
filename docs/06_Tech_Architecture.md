# 06 · Tech Architecture

## Stack
- **Client:** Expo (React Native) + **expo-router** (file-based nav) — this repo
- **Backend:** Supabase — Postgres, Auth, Realtime, Storage (`@supabase/supabase-js`)
- **Animation:** react-native-reanimated (tilt, press, drop-in)
- **Drawing:** @shopify/react-native-skia (Doodle)
- **Lists:** @shopify/flash-list (masonry perf at scale)
- **Media:** expo-image-picker / expo-camera / expo-image
- **Blur:** expo-blur (secret reveal)
- **Push:** expo-notifications
- **Fonts:** expo-font (Bricolage Grotesque, Geist, Space Mono)
- **Analytics:** posthog-react-native
- **Builds:** EAS Build / Submit

The Wall is a **standalone repository** with its own Supabase project. (It was
originally prototyped inside the "Here Community" web-app repo, then extracted
here so the two platforms are fully independent.)

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

## Environment
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
`EXPO_PUBLIC_AUTH_REDIRECT` (`thewall://auth/callback`). Providers (Email + Apple
+ Google) and the `attachments` bucket configured in the shared Supabase project.

## Build & release
EAS Build produces iOS/Android binaries; EAS Submit uploads to TestFlight / Play
internal track. See `13_Release_Checklist.md`.
