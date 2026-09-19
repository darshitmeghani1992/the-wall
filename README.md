# The Wall

**The Wall** (Social Wall) — a native app where your identity is written by the
people around you. Friends leave **Marks** (stickies, roasts, secrets, memories,
photos, and other supported formats) on your personal **Wall**.

> Personal Wall = My Story. Shared Wall = Our Story.

Native **Expo / React Native** app backed by **Supabase** (Postgres, Auth,
Realtime, Storage). Standalone repository with its own backend. The design system
is a faithful native re-creation of the "The Wall" handoff.

Full spec lives in [`docs/`](docs/00_README.md) — product, flows, acceptance
criteria, database, architecture, and the engineering plan.

## Stack
Expo (expo-router) · React Native · Supabase · Reanimated · FlashList ·
expo-image-picker · private protected-media services.

## Setup
```bash
npm install
cp .env.example .env      # fill in your Supabase URL + anon key (see below)
npx expo start            # press i / a for simulators, or scan in Expo Go
```

Create a disposable **Supabase development project**, then:
1. Apply all ordered files in [`supabase/migrations/`](supabase/migrations/).
   Never apply only `0001_init.sql` to represent the current backend.
2. **Auth → Providers:** enable **Email** (OTP), optionally **Google/Apple**; add
   `thewall://auth/callback` as a redirect URL.
3. Follow the private protected-media design and operations gates in
   [`docs/architecture/ADR-012-protected-mark-media.md`](docs/architecture/ADR-012-protected-mark-media.md).
   Do not create or restore a public Mark-media path.
4. Put the project URL + anon key in `.env` (`EXPO_PUBLIC_SUPABASE_URL`,
   `EXPO_PUBLIC_SUPABASE_ANON_KEY`).

> **Fonts:** drop Bricolage Grotesque / Geist / Space Mono `.ttf` files into
> `assets/fonts/` and load them via `expo-font` in `app/_layout.tsx`. Until then
> the app falls back to system fonts.

## Layout
```
app/                     expo-router routes (screens)
  _layout.tsx            root stack, wrapped in <AuthProvider>
  index.tsx              auth gate → onboarding | profile setup | Home
  (onboarding)/          welcome · about · interests · sign-in · profile-setup
  (tabs)/                Home · Walls · Discover · Profile (custom BottomDock)
  create.tsx             "Leave a Mark" type picker (modal)
  wall.tsx               My Wall (hero)
  auth/callback.tsx      deep-link OAuth/magic-link landing
src/
  theme/                 design tokens + type scale (single source of truth)
  components/            Text, Screen, Button, Input, MarkCard, Fastener,
                         BottomDock, Masonry, InviteCrew, marks/MarkView
  lib/                   supabase, auth, profiles, marks, upload, types
docs/                    the specification suite (start at docs/00_README.md)
supabase/migrations/     database schema + RLS
```

## Status & roadmap
The active status, verification boundary, and remaining gates are recorded in
[`docs/BUILD_STATUS.md`](docs/BUILD_STATUS.md). The draft includes auth and
onboarding, Personal and Shared Walls, Mark creation and interaction, social
relationships, Alerts, settings/safety flows, protected-media source, and
recoverable account deletion. Hosted integration, physical-device,
accessibility, performance, store, and release gates remain explicitly open.
