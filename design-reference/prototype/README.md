# Handoff: The Wall — Social "Mark" Wall App

## Overview
The Wall is a mobile social app where friends leave short messages ("Marks") on each other's profile wall — similar in spirit to old-school Facebook wall posts, sticky notes, or a birthday card everyone signs. Each person has a personal Wall that only accepted friends can post to. There are also shared/group Walls (e.g. "Goa Trip '25", "College Friends") where any accepted member can post. Marks are colorful sticky-note-style cards, can be text (with room to add photo/voice/video later), can be anonymous or "Secret" (hidden until revealed), can carry reactions (emoji), and expire after a lifespan the Wall owner sets (12h – 7 days, or Forever).

## About the Design Files
The files in this bundle are **design references built in HTML/CSS/JS** (React-like component style) — they demonstrate intended layout, visual style, copy, and interaction behavior. They are **not production code to copy directly**. The task is to **recreate these designs in the target codebase's actual stack** (React Native / Flutter / SwiftUI / native Android / whatever the team standardizes on for a mobile app) using that stack's own component and state-management patterns. If no mobile framework is chosen yet, React Native or Flutter are reasonable defaults given the design is single-column, mobile-width (430px), and componentized.

## Fidelity
**High-fidelity.** Colors, spacing, type sizes, and copy in the HTML files are final/near-final. Recreate pixel-close using the values documented below. The one placeholder area is real user/friend data and the photo/voice/video mark composer, which is stubbed (see "Known Gaps" at the end).

## Core Product Rule (important — drives permissions logic)
- **Personal Wall**: the owner CANNOT post on their own Wall. Only people the owner has **accepted as friends** can leave a Mark there. Someone who isn't yet a friend sees a locked message instead of a compose button.
- **Shared/Group Wall**: any member **accepted into the group** can leave a Mark — this includes the wall's own owner/creator.
- Marks have a lifespan set by the Wall owner (12h / 1 day / 2 days / 3 days / 7 days / Forever) — after expiry a Mark should stop being shown (current prototype just dims it to 40% opacity as a placeholder for the real removal behavior).

## Screens / Views

### 1. Login
- **Purpose**: Auth entry point. Google OAuth button, or email/password, plus a highlighted "Demo credentials" box for quick access during development/testing (dev@thewall.app / wall2026) — remove or gate this box in production.
- **Layout**: Centered column, `max-width: 430px`, padding 40px/28px, full-height white background.
- **Components**:
  - Logo mark: 60×60px rounded-16px black-ish square (`var(--color-accent)` bg — #ec3013) with a small "note" glyph inside; two small floating decorative shapes behind it (a trophy emoji card, a red-tinted square) with slow float animations (not essential to rebuild — decorative only).
  - Wordmark: "the·wall" — "the" and "wall" in `#1a1a1a` 28px/800 weight, the middle dot in accent color.
  - Subhead: "Your friends write your story." 14px `#999`.
  - "Continue with Google" button: white bg, 1px `#eee` border, 12px radius, 14px/600 text, Google "G" logo SVG (included inline in file), full width up to 340px.
  - Divider: "OR" centered between 1px `#eee` lines.
  - Email field: label 12px/600 `#999`, input row 44px tall, 1px `#eee` border, 10px radius, bg `#faf9f7`, placeholder-only in prototype (no real input wired for email/password — needs real form fields + validation in dev).
  - Password field: same style, "Forgot?" link top-right in accent color.
  - "Sign In" button: solid `#1a1a1a` bg, white text, 12px radius, 700 weight.
  - Demo credentials callout: `#fef9f3` bg, `#f0e0c8` border, 12px radius; shows email/password pair and a "Use demo account" button.
  - Footer link: "Don't have a Wall yet? **Get Started**" — Get Started is styled as a bold black inline link.
- **Behavior**: Any of the CTA buttons (Google, Sign In, Use demo account, Get Started) currently route straight to the loading state then My Wall — in production, Google/Sign In should do real auth; only "Use demo account" should skip to a seeded demo state.

### 2. Loading
- Simple full-screen centered state: 60×60 accent-colored rounded-16px icon, 3-dot pulse loader (staggered opacity animation, 0.2s delay increments), "Loading your Wall..." 14px `#999`. Shown for ~800ms after login before landing on My Wall.

### 3. My Wall (home / personal wall)
- **Purpose**: The user's own wall — browse Marks friends left them, switch between owned/shared walls, adjust wall settings.
- **Layout**: Header block (padding 20px sides) + 2-column CSS masonry-style card grid (`column-count: 2; column-gap: 10px`) below + bottom CTA.
- **Header components**:
  - Avatar 52×52 circle, initials, colored background (deterministic hash-based color from a palette — see Design Tokens), subtle shadow.
  - Name (20px/800 `#1a1a1a`) + handle (13px `#999`).
  - 3 icon buttons top-right, all 36×36 circles bg `#f5f4f2`, hover `#eeece8`: **Customize** (sliders/settings icon, opens Customize Wall panel), **Share** (upload icon, not yet wired), **Profile** (person-in-gear icon, navigates to Profile tab).
  - Stats row: "**47** Friends   **128** Followers" 13px, bold numbers in `#1a1a1a`, rest `#999`.
  - Prompt banner: gradient bg (`linear-gradient(135deg,#fff8f0,#fff3e8)`), 1px `#f0e0c8` border, 14px radius, pin emoji + prompt text ("Tell me your funniest memory of us 😊") + pencil/edit icon on the right — this is a conversation-starter prompt the owner can set; tapping the pencil should open an edit field (not yet wired in prototype).
  - "WALLS" section label (11px/700 `#bbb`, letter-spacing 1.5px) + a lifespan control on the right: clock icon + current label (e.g. "2 days"), tapping cycles through 12h → 1 day → 2 days → 3 days → 7 days → Forever. This setting belongs to the Wall owner only and should apply to all future Marks on that Wall (retroactive vs. forward-only is a product decision to confirm).
  - Horizontal-scroll wall-switcher tabs: pill buttons, active = solid `#1a1a1a` bg + white text, inactive = `#f5f4f2` bg + `#888` text. Icons + labels, e.g. 🏠 My Wall, 🏖️ Goa Trip '25, 🎓 College Friends.
- **Marks grid**: see "Mark Card" component spec below. 6 seeded marks shown, `hint-placeholder-count` staggered load.
- **Footer CTA**: full-width black button "Share My Wall" with upload icon, 14px radius — should open a native share sheet with the Wall's shareable link/QR in production.
- **No compose button on this screen** — per the core product rule, owners cannot post on their own wall.

### 4. Other Wall (viewing a friend's / another person's wall)
- **Purpose**: View someone else's Wall, either to browse or (if friends) leave a Mark.
- **Layout**: Back button + avatar + name/handle header, then a 2-button action row, then the same masonry Marks grid (read-only truncation/expand behavior identical to My Wall).
- **Action row — two states**:
  - **If already friends**: "✓ Friends" (outlined, green text, disabled/status-only) + "**Leave a Mark**" (solid black, opens Composer).
  - **If not yet friends**: "+ Add Friend" (outlined, sends a friend request) + a disabled-looking locked pill: "🔒 Be friends to leave a Mark" (`#f9f8f6` bg, `#bbb` text) — no click action, purely informational.
- This same friends-gate logic is what a developer should implement as the permission check: `canPostMark = isOwner ? false : (isFriend(currentUser, wallOwner))` for personal walls.

### 5. Shared/Group Wall (not fully mocked, but implied by wall-switcher tabs)
- Same visual shell as My Wall/Other Wall, but the permission rule differs: **any accepted group member** (including the creator) can post a Mark — there is no "friends" gate, only "is a member of this wall." The compose entry point for shared walls should be a persistent button (e.g. reuse the "Leave a Mark" button style) shown to all members, not just non-owners. This screen still needs to be designed in follow-up work — flag to design before building.

### 6. Discover
- **Purpose**: Find new people to friend, or public/private walls to join.
- **Layout**: Header "Discover" (24px/800) + search icon button (36×36 circle) + segmented tab control (`People` / `Walls`, `#f5f4f2` track, active tab solid black pill).
- **People tab**: "SUGGESTIONS" label, 2-column grid of person cards (16px radius, tinted pastel bg rotating through 6 colors, 1px `#f0ece6` border). Each card: avatar (initials, colored circle) + green online dot, name (14px/700), @handle (11px `#999`), short bio (11px `#666`, 2-line min-height), mutual-friends count, and a status button: `+ Add Friend` / `Requested` (outlined, disabled-style) / `Accept` (solid) / `Friends ✓` (solid, disabled-style — shown but the prototype treats "friends" as terminal).
- **Walls tab**: "PUBLIC WALLS" label, 2-column grid of wall cards (16px radius, colored bg per wall). Each: emoji icon + privacy tag (Public/Private pill), wall name (14px/700), description (11px `#666`), member count with people icon, and a "Join Wall" / "View" button (dark translucent bg, becomes "View" once joined).

### 7. Alerts (Notifications)
- **Purpose**: Activity feed — new Marks, reactions, friend acceptances, invites.
- **Layout**: Header "Alerts" (24px/800), flat list, each row: 36×36 circle icon bg `#f5f4f2` with an emoji (📝 mark, ❤️ reaction, 🤝 friend, ✉️ invite), text (13px, bold+black if unread / regular+gray if read) + relative timestamp (11px `#ccc`), unread rows get a subtle `#fef9f3` row background and a small accent-colored dot on the right.

### 8. Profile
- **Purpose**: The signed-in user's own profile/settings hub.
- **Layout**: Centered header (80×80 avatar, name 22px/800, handle, bio line, 3-stat row: Friends/Followers/Walls), then a stacked list of full-width outlined buttons: Edit Profile, Share My Wall, Settings, then a divider gap, then a red-tinted "Log Out" button (bg `#fef0ee`, text in accent color).

### 9. Composer (New Mark) — full-screen modal
- **Purpose**: Compose and post a text Mark. Only reachable from "Leave a Mark" on someone else's wall (friend-gated) or a shared wall's compose entry point — never from the user's own personal wall.
- **Layout**: Full-screen sheet (slides up), header bar: "Cancel" (left, gray text) / "New Mark" (center, 15px/800) / "Post" (right, pill button — disabled gray until text entered, solid black + white text once valid).
- **Body**: Small avatar (36×36) + large auto-growing textarea, 18px/500, placeholder "Write something on their Wall...", 500 character max (character counter bottom-right, turns orange at 400+, accent-red at 450+).
- **Footer**: A row of 4 disabled-looking media icons (image, video, mic, "face"/gif) at 20px, currently decorative only — **these need to be built out as real attach flows** in production (image picker, video recorder, voice recorder, GIF/sticker picker) per the "smooth, best-in-class composer" requirement discussed earlier — i.e. don't gate the whole composer behind a "pick a type first" screen; let users start typing immediately and attach media inline, matching Instagram/X-style composers.
- Two toggle chips: "🎭 Anonymous" and "🔒 Secret" — both start unselected (`#f5f4f2` bg, `#666` text), turn solid black (Anonymous) or solid dark green `#2d5a3d` (Secret) with white text when active. These are mutually independent (both can be on at once in current prototype — confirm if that's intended or if Secret should imply Anonymous).

### 10. Mark Detail — modal
- **Purpose**: Tap any Mark to see it full-size (handles the "long text" case — cards on the grid clamp to 4 lines with a "tap to read more →" hint).
- **Layout**: Dimmed backdrop (35% black), centered card using the Mark's own background/text color at 20px radius, 24px padding, full untruncated text at 20px/800, author line at 55% opacity, reactions if any.
- **Reactions row**: 5 circular white buttons (44×44, 1px `#eee` border) for ❤️ 😂 🥹 🔥 👏 — tapping increments that reaction's count on the Mark (optimistic local update in prototype; needs a real API call + optimistic-then-reconcile pattern in production). Buttons scale up slightly on hover/tap for feedback.
- "Close" button below the card.
- **Secret Marks are never tappable/openable this way** in the current prototype (excluded from the click handler) — confirm the intended "reveal" interaction for Secret Marks (tap-to-reveal once? Requires a specific unlock action? Time-gated?) — this is a gap to resolve with the user before building.

### 11. Customize Wall — bottom sheet
- **Purpose**: Let the Wall owner personalize their wall's look and Mark lifespan.
- **Layout**: Bottom sheet, drag-handle bar, header + close (X) button.
- **Mark Vibe**: 5 palette options (Original, Pastel, Neon, Mono, Warm) shown as 3-swatch previews + label; selecting re-colors all Marks using a deterministic per-mark palette index (`(mark.id * 7) % palette.length`) — replace with a stable per-mark seed in production so colors don't shuffle unexpectedly when marks are added/removed.
- **Scatter**: 4 options (None, Subtle, Playful, Chaotic) controlling how much random rotation each Mark card gets (0°, 1.5°, 3.5°, 7° amplitude via a sine-based formula keyed to mark id — see Design Tokens).
- **Mark Lifespan**: 6 pill options (12h, 1 day, 2 days, 3 days, 7 days, Forever) — same control as the clock icon shortcut on My Wall.

## Interactions & Behavior Summary
- **Navigation**: 4-tab bottom nav — My Wall, Discover, Alerts (badge shows unread count), Profile. No center "+"/compose button in the nav (explicitly removed — composing only happens contextually from a friend's wall or a shared wall, never globally).
- **Animations**: fade-in on screen transitions (~0.3–0.4s translateY), slide-up for sheets/modals (~0.25s), a few decorative float/pulse loops on the login screen — all "nice to have," not core to functionality.
- **Truncation**: Mark card body text is clamped to 4 lines (`-webkit-line-clamp: 4`); if the original text is longer than 80 characters, a "tap to read more →" hint appears and tapping opens the Mark Detail modal with full text.
- **Expiry (placeholder behavior)**: each Mark stores `hoursAgo`; remaining time = `expiryHours - hoursAgo`. The prototype computes a percentage and dims expired cards to 40% opacity — **this needs a real scheduled/computed-at-render expiry check server-side**, and per the last product decision, the visual countdown/progress-bar treatment was explicitly removed from the card UI (do not re-add a per-card timer bar) — expiry should instead surface as a standard rule described elsewhere in the wall UI (exact placement TBD with the user).
- **Friend actions** (Discover → People tab): tapping the status button cycles `add → requested` or `accept → friends` locally; wire to real friend-request API with pending/accepted states.
- **Wall join** (Discover → Walls tab): tapping "Join Wall" flips button to "View" locally; wire to real membership API.

## State Management
Minimal state shape needed (naming illustrative — adapt to chosen framework):
```
{
  currentUser: { id, name, handle, avatarColor },
  screen: 'login' | 'mywall' | 'otherwall' | 'discover' | 'notifications' | 'profile',
  activeWallId: string,
  viewingUserId: string | null,
  composer: { open: bool, text: string, isAnonymous: bool, isSecret: bool, wallId: string },
  selectedMarkId: string | null,
  customizePanelOpen: bool,
  wallSettings: { markVibe, scatterLevel, expiryHours }
}
```
Data needed from the backend:
- `User` (id, name, handle, avatar, bio, friend count, follower count)
- `FriendEdge` (userId, friendId, status: pending/accepted)
- `Wall` (id, ownerId | isSharedGroup, type: 'personal' | 'group', members[] for group walls, settings: {markVibe, scatterLevel, expiryHours}, promptText)
- `Mark` (id, wallId, authorId | null (if anonymous), text, mediaAttachments[], isSecret, isAnonymous, createdAt, expiresAt, reactions: {emoji: count} or {emoji: [userIds]} if you need "who reacted")
- `Notification` (id, userId, type, payload, read, createdAt)

## Permissions logic to implement (critical)
```
function canPostMark(currentUser, wall):
  if wall.type === 'personal':
    return wall.ownerId !== currentUser.id
       && isAcceptedFriend(currentUser.id, wall.ownerId)
  if wall.type === 'group':
    return isAcceptedMember(currentUser.id, wall.id)
  return false
```

## Design Tokens

**Colors**
- Background: `#ffffff`
- Primary text: `#1a1a1a`
- Secondary text: `#999999`
- Tertiary/muted text: `#bbbbbb` / `#cccccc`
- Borders/dividers: `#eeeeee` / `#f0ece6` / `#f0e0c8`
- Accent (brand red): `var(--color-accent)` = `#ec3013`
- Icon button bg: `#f5f4f2`, hover `#eeece8`
- Success/friend green: `#4caf50`
- Secret mark green: `#2d5a3d`
- Mark card palette: `#c8f065`, `#1a1a1a`, `#ffd54f`, `#e94b35`, `#f0f0f0`, `#2d5a3d`, `#e8f5e9`, `#a8d8ea`
- Avatar color palette: `#5c6bc0, #ab47bc, #26a69a, #ef5350, #ff7043, #66bb6a, #42a5f5, #8d6e63`
- Customize palettes:
  - Pastel: `#ffd6e0, #d4e4ff, #d4f5d4, #fff3cd, #e8d4ff, #ffe0cc`
  - Neon: `#39ff14, #ff073a, #00f0ff, #ffef00, #ff00ff, #ff6600`
  - Mono: `#f5f5f5, #e8e8e8, #d0d0d0, #b0b0b0, #888888, #555555`
  - Warm: `#ff8a65, #ffcc80, #fff176, #ffab91, #f48fb1, #ce93d8`

**Typography** — Archivo (system-ui fallback).
- Wordmark/hero: 28px / 800
- Screen titles: 24px / 800
- Card/section titles: 18–20px / 800
- Body / Mark text: 14–15px / 600–700, line-height 1.35–1.4
- Secondary labels: 11–13px / 500–700
- Section eyebrows: 11px / 700, letter-spacing 1.5px

**Spacing / Radius**
- Screen side padding: 20px
- Card radius: 16px; modals 20px; buttons/inputs 10–14px; avatars/icon buttons 50%
- Card internal padding: 14–16px
- Grid gap: 10px
- Bottom nav height: ~56px + safe-area inset

**Shadows**
- Cards: `0 1px 6px rgba(0,0,0,.06)`
- Floating buttons/avatars: `0 2px 8px rgba(0,0,0,.1)` – `0 8px 32px rgba(236,48,19,.2)`

**Card rotation formula**
`rotation_deg = sin(mark.id * 3.7) * scatterAmplitude`, where `scatterAmplitude` = 0 / 1.5 / 3.5 / 7.

## Assets
- Use Lucide-style icons / real Lucide package in production where applicable.
- Google "G" logo SVG is included inline in Login.
- Emoji are used directly as content.
- Avatars are colored-initial placeholders in prototype; real photo upload/display must be added.

## Known Gaps / Open Questions to confirm before/while building
1. **Secret Mark reveal mechanic** — currently un-tappable; needs a defined unlock interaction.
2. **Shared/Group Wall screen** — only implied via the wall-switcher tabs.
3. **Media composer** (photo/voice/video attach) — footer icons are decorative placeholders; real attach flows need design + build.
4. **Expiry enforcement** — needs backend behavior and replacement UI treatment.
5. **Prompt banner edit flow** — pencil icon has no wired interaction yet.
6. **Share My Wall** — no real share-sheet/link-generation wired yet.

## Files
- `The Wall.dc.html` — main interactive prototype covering the screens above.
- `Wall Retro Concept.dc.html` — alternate theme exploration; not the selected direction.
- `screenshots/` — static PNG captures of every screen and state.