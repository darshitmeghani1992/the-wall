# 03 · Acceptance Criteria

Per-feature checklists. A feature is **correct** only when every ✓ passes. These
are the concrete half of the Definition of Done (`09_`). `[built]` = shipped,
`[ ]` = pending.

---

## Auth & onboarding `[built]`
- ✓ Signed-out user lands on Welcome; signed-in-without-profile on Setup; else Home
- ✓ Email sign-in sends a 6-digit code; verifying it creates a session
- ✓ Apple/Google sign-in returns via deep link and creates a session
- ✓ Handle is unique (case-insensitive), ≥3 chars, `[a-z0-9_]`, live availability check
- ✓ Display name required; bio & avatar optional
- ✓ Creating a profile auto-creates the user's Personal Wall (DB trigger)
- ✓ Session persists across app restarts

## My Wall `[built]`
- ✓ Header shows avatar, wall name, `N marks · M friends`
- ✓ Marks render in a 2-column masonry, each tilted with a pin/tape + hard shadow
- ✓ Each mark type renders its own layout (sticky/roast/secret/photo/award/poll/doodle/prediction)
- ✓ Filter chips (All/Roasts/Photos/Awards) narrow the list
- ✓ New marks arrive live and drop in at the top (realtime)
- ✓ Empty wall shows "invite your crew" with a share action
- ✓ Only `active` marks show to viewers; author & owner also see their `pending`

## Sticky mark `[built]` (first build slice)
- ✓ Can choose one of 4 colors; default yellow
- ✓ Text required, non-empty, **≤ 500 chars** (counter shown near limit)
- ✓ Anonymous toggle; when on, author is hidden everywhere for that mark
- ✓ Live preview reflects text + color + anonymity as you type
- ✓ "Stick it on the Wall" inserts the mark and returns to the wall
- ✓ Mark appears instantly via realtime drop-in
- ✓ Chosen color persisted and re-rendered
- ✓ RLS: only a permitted contributor can insert (owner always can)
- ⏳ Author can edit/delete their own mark; owner can pin/hide it *(UI in slice B2)*

## Roast / Secret marks `[built]`
- ✓ Roast: orange bg, 2px ink border, larger type; no color picker
- ✓ Secret: purple; text hidden (blurred) until tapped; author line still shows
- ✓ Both honor anonymous toggle and ≤500 chars

## Memory / Photo mark `[ ]`
- ✓ Pick from gallery **or** capture with camera (permission requested)
- ✓ Image ≤ 6 MB; over-limit rejected with a clear message
- ✓ Optional caption ≤ 200 chars
- ✓ Uploads to the `attachments` bucket; renders as a polaroid on the wall
- ✓ Upload progress shown; failure offers retry

## Poll mark `[ ]`
- ✓ Question required; 2–4 options, each non-empty
- ✓ One vote per user; tapping shows live percentages
- ✓ Author cannot see who voted what (only counts)

## Award mark `[ ]`
- ✓ Choose an award from a preset list; optional note
- ✓ Renders dark card + gold badge

## Prediction mark `[ ]`
- ✓ Text + a future unlock date/time required
- ✓ Locked state hides text and shows "unlocks {date}"
- ✓ Auto-reveals at/after unlock time

## Doodle mark `[ ]`
- ✓ Freehand drawing with at least stroke + clear + undo
- ✓ Exports a PNG, uploads it, renders on the wall
- ✓ Empty canvas cannot be submitted

## Reactions & comments `[ ]`
- ✓ React with an emoji; toggling adds/removes; counts update live
- ✓ Comment ≤ 300 chars; appears live; author or wall owner can delete
- ✓ Reacting/commenting notifies the mark's author

## Friends `[ ]`
- ✓ Search by handle/name; send request; can't friend yourself
- ✓ Incoming/outgoing requests listed; accept/decline
- ✓ Accepting unlocks private walls + friends-only contribution both ways
- ✓ Unfriend and block available

## Notifications `[ ]`
- ✓ Every relevant event creates a notification for the recipient
- ✓ In-app badge count is accurate; opening marks them read
- ✓ Push delivered to opted-in devices; tapping deep-links to the target
- ✓ A user never gets notified about their own actions

## Discover / Friend Wall `[ ]`
- ✓ Discover shows public/trending walls + search
- ✓ Friend Wall respects visibility (private walls blocked for non-friends)
- ✓ Contribution rules enforced (e.g. friends-only)

## Settings & moderation `[ ]`
- ✓ Change who-can-mark, allow-anonymous, require-approval, private/public
- ✓ Moderation queue lists pending marks; approve/reject works
- ✓ Block list add/remove; blocked users can't view/contribute/notify
- ✓ Report creates a report row; reported content flagged for owner

## Games (each plugin) `[ ]`
- ✓ Registered via the plugin interface (metadata/entry/rules/scoring/rewards/analytics)
- ✓ Entry, play, result, and "play again"/"home" all work
- ✓ Emits its analytics events (started/finished)
- ✓ Adding a game requires **no** change to wall/mark core
