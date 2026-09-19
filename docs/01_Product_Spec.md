# 01 · Product Spec

## Vision

People don't just tell their own story — the people around them help write it.
The Wall preserves **memories, not conversations**. Every important relationship,
event, or community can have a wall that becomes more valuable over time.

- **Personal Wall = My Story**
- **Shared Wall = Our Story**

Audience: Gen-Z / late-millennial users who want authenticity over polished feeds.
Aesthetic: tactile "physical digital" — paper surface, marks pinned with tape and
push-pins, hand-cut shadows. (See design system in `06_Tech_Architecture.md`.)

## Core interaction model (important)

The Wall **inverts the feed model.** In a feed app the primary action is "post to
my own timeline." Here, the primary action is **leaving a Mark on *someone
else's* wall.** Your own wall is mostly what *others* write about *you* — a
living guestbook / yearbook page — not a place you broadcast from.

Consequences for the UI:

- **The primary create action is target-first and aimed at others.** "Leave a
  Mark" always answers "on *whose* wall?" — it never silently defaults to your
  own wall. Two entry points:
  1. **On a wall you're viewing** (a friend's wall) → a "Leave a Mark" button
     pre-aimed at *that* wall. This is the star path.
  2. **The dock ✚** → opens a **"whose wall?" picker** (a friend / search) →
     then the writer, aimed at the chosen wall. Keeps a fast global entry, but
     the target is always explicit.
- **Your own wall is receive-first** (read the marks others left). Posting to
  your *own* wall is **allowed but secondary** (e.g. pin a short intro) — never
  the headline action, never the default of the ✚.
- The backend already supports this: a Mark may target any wall the user is
  permitted to contribute to (`can_contribute`), so this is a navigation/UX
  rule, not a data change.

> Design note: the raised yellow ✚ stays (it's part of the tactile identity) —
> it's re-aimed, not removed. It means "leave a Mark on someone," which requires
> picking who, so it depends on the **friend system** (built before the ✚ picker
> goes live). Until then, creating is reachable but self-targeted by necessity.

## Core objects

| Object | Meaning |
|---|---|
| **User / Profile** | An account with a handle, display name, avatar, bio, interests |
| **Wall** | A surface with a Personal or Shared lifecycle |
| **Mark** | A single contribution on a wall (see Mark Types) |
| **Reaction** | An emoji response to a mark |
| **Friendship** | A two-way accepted relationship; gates private walls & "friends-only" contribution |
| **Notification** | An activity record for a user (Mark, reaction, friend request, Shared Wall activity…) |
| **Report** | A safety flag raised on a mark |

## Wall types

### Personal Wall (MVP)
- Exactly **one per user**, created automatically at signup.
- Represents the person's identity; friends leave Marks.
- Public or Private (visibility) with independent contribution rules.

### Shared Wall (MVP)
- Any user can create multiple Shared Walls (family, trip, class, team, event…).
- Roles: Owner / Member. Non-members may view public Walls but cannot contribute.
- Supports Public/Private visibility, Open Join for Public Walls, invitations, ownership transfer,
  member leave/removal, and owner deletion.

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
| Text | A text Mark with optional color treatment | ✅ |
| Photo | One to five ordered photos with optional caption | ✅ |
| Voice | A recorded voice Mark | ✅ |
| Video | A selected or recorded short video Mark | ✅ |

Anonymous and Secret are orthogonal modes, not separate Mark types. Doodles, polls, awards,
predictions, and games are explicitly outside this MVP.

## Features

Marks · Reactions · Pinning · Hiding · Search · Sharing ·
Privacy · Contribution permissions · Moderation (report/hide/approve) ·
in-app Alerts · Friend/follower system · Shared Walls · Settings · recoverable account deletion.

## MVP scope

Authentication · Profiles · Personal and Shared Walls · Friend/follower system · Public and
Private visibility · independent view/contribution permissions · text/photo/voice/video Marks ·
Anonymous and Secret modes · reactions · in-app Alerts · Search/Discover · basic moderation ·
privacy controls · settings · account deletion.

**Deferred (V2+):** comments, doodles, games, polls, awards, predictions, algorithmic feeds,
stories, DMs/chat, contact-book syncing, subscriptions/payments, live streaming, Wall Wrapped,
and On-This-Day.

## Product evolution

- **V1** — approved MVP in the Master Build Specification v1.1
- **V2+** — evidence-led additions after launch; excluded ideas do not become committed backlog
