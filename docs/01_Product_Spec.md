# 01 · Product Spec

## Vision

People don't just tell their own story — the people around them help write it.
The Wall preserves **memories, not conversations**. Every important relationship,
event, or community can have a wall that becomes more valuable over time.

- **Personal Wall = My Story** (MVP focus)
- **Shared Wall = Our Story** (later version; data model already supports it)

Audience: Gen-Z / late-millennial users who want authenticity over polished feeds.
Aesthetic: tactile "physical digital" — paper surface, marks pinned with tape and
push-pins, hand-cut shadows. (See design system in `06_Tech_Architecture.md`.)

## Core objects

| Object | Meaning |
|---|---|
| **User / Profile** | An account with a handle, display name, avatar, bio, interests |
| **Wall** | A surface owned by one user. Type `personal` (one per user, auto-created) or `shared` (later) |
| **Mark** | A single contribution on a wall (see Mark Types) |
| **Reaction** | An emoji response to a mark |
| **Comment** | Text reply on a mark |
| **Friendship** | A two-way accepted relationship; gates private walls & "friends-only" contribution |
| **Notification** | An activity record for a user (mark left, reaction, comment, friend request…) |
| **Report** | A safety flag raised on a mark |

## Wall types

### Personal Wall (MVP)
- Exactly **one per user**, created automatically at signup.
- Represents the person's identity; friends leave Marks.
- Public or Private (visibility) with independent contribution rules.

### Shared Wall (later)
- Any user can create unlimited shared walls (family, trip, class, couple, club…).
- Roles: Owner / Admin / Member / Viewer.
- **Out of MVP scope**; shown only as a teaser. `walls.type='shared'` reserved.

## Permission model (two independent axes)

**Visibility** — who can *see* the wall:
- `public` — anyone
- `private` — owner + accepted friends
- `invite_only` — reserved (future)

**Contribution** — who can *leave marks*:
- `everyone`
- `friends` (default)
- `selected` (reserved; future)
- `nobody` (read-only)

Additional per-wall toggles: **allow anonymous marks**, **require approval**
(marks from non-owners land as `pending` until the owner approves).

## Mark types

| Type | Description | MVP |
|---|---|---|
| Sticky | A short colored note | ✅ |
| Roast | A playful burn (orange, bordered) | ✅ |
| Secret | Hidden until tapped to reveal | ✅ |
| Memory | Photo + caption | ✅ |
| Photo | A photo mark | ✅ |
| Award | A recognition badge + note | ✅ |
| Poll | A question with options + votes | ✅ |
| Doodle | A freehand drawing | ✅ |
| Prediction | Time-locked note that unlocks on a date | ✅ |
| Voice / Video Memory | (future) | ⬜ |

## Features

Marks · Comments · Reactions · Pinning · Archiving/Hiding · Search · Sharing ·
Privacy · Contribution permissions · Moderation (report/hide/approve) ·
Notifications (in-app + push) · Friend system · Games (Who Said This, Roast Me,
Awards Night — as plugins).

## MVP scope

Authentication · Profiles · One Personal Wall · Friend system · Public & Private
walls · Independent view/contribution permissions · All core Mark types ·
Comments · Reactions · Notifications · Search · Discover · Basic moderation ·
Privacy controls · The three launch games.

**Deferred (V2+):** Shared Wall management, Wall Wrapped, On-This-Day, Voice/Video
marks, invite-only visibility, "selected people" contribution.

## Product evolution

- **V1** — Personal Wall (this build)
- **V2** — Archives, Wall Wrapped, more mark types
- **V3** — Shared Walls (family, trip, class, community, events)
