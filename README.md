# The Wall

**The Wall** (Social Wall) — a native app where your identity is written by the
people around you. Friends leave **Marks** (stickies, roasts, secrets, memories,
photos, awards, polls, doodles, predictions) on your personal **Wall**.

> Personal Wall = My Story. Shared Wall = Our Story (later version).

Native **Expo / React Native** app backed by **Supabase** (Postgres, Auth,
Realtime, Storage). Standalone repository with its own backend. The design system
is a faithful native re-creation of the "The Wall" handoff.

Full spec lives in [`docs/`](docs/00_README.md) — product, flows, acceptance
criteria, database, architecture, and the engineering plan.

## Stack
Expo (expo-router) · Supabase · Reanimated · Skia (doodle) · FlashList (masonry
wall) · expo-image-picker/camera · expo-blur · expo-notifications · PostHog · EAS.

## Setup
```bash
npm install
cp .env.example .env      # fill in your Supabase URL + anon key (see below)
npx expo start            # press i / a for simulators, or scan in Expo Go
```

Create a **Supabase project** for The Wall, then:
1. Run the migration once (SQL editor or `supabase db push`):
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) —
   creates the Wall/Mark schema, RLS, triggers (auto personal-wall, moderation
   status), and realtime.
2. **Auth → Providers:** enable **Email** (OTP), optionally **Google/Apple**; add
   `thewall://auth/callback` as a redirect URL.
3. **Storage:** create a public **`attachments`** bucket (avatars, mark photos,
   doodles upload there).
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
See [`docs/07_Engineering_Plan.md`](docs/07_Engineering_Plan.md) and
[`docs/14_Changelog.md`](docs/14_Changelog.md). Built so far: foundation + design
system, backend (schema/RLS/triggers/realtime), auth & onboarding, and the My
Wall hero screen. Next: the Write-a-Mark flow, then friends, feeds, games,
settings, and store release. We build **one screen at a time**, each a complete
vertical slice held to the [Definition of Done](docs/09_Definition_of_Done.md).
