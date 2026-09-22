# 06 · Tech Architecture

## Stack
- **Client:** Expo (React Native) + **expo-router** (file-based nav) — this repo
- **Backend:** Supabase — Postgres, Auth, Realtime, Storage (`@supabase/supabase-js`)
- **Animation:** react-native-reanimated (tilt, press, drop-in)
- **Lists:** @shopify/flash-list (masonry perf at scale)
- **Media:** expo-image-picker / expo-camera / expo-av / expo-image + private protected-media services
- **Blur:** expo-blur (secret reveal)
- **Notifications:** in-app Alerts for MVP; push-capable architecture for later
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
  (onboarding)/            welcome · sign-in · profile-setup · find-people · walkthrough
  (tabs)/                  home · discover · alerts · profile (custom BottomDock)
  create.tsx               integrated text/photo/voice/video composer
  people-picker.tsx        target-first global create entry
  shared/                  Shared Wall lifecycle routes
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

## Explicit architecture non-goals

The MVP does not include comments, doodles, games, polls, awards, or predictions. Do not reserve
routes, registries, dependencies, or core abstractions for them before a later approved scope and
architecture decision exists.

## Environment
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
`EXPO_PUBLIC_AUTH_REDIRECT` (`thewall://auth/callback`). Providers (Email + Apple
+ Google). Avatar storage and the private protected-media stack must follow the current migrations
and ADR-012; public `attachments/marks/*` is retired.

## Build & release
EAS Build produces iOS/Android binaries; EAS Submit uploads to TestFlight / Play
internal track. See `13_Release_Checklist.md`.
