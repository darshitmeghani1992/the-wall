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
- ✓ Supported MVP Mark types render appropriately (text, photo, voice, video)
- ✓ Filter chips (All/Notes/Photos) narrow the list without inventing excluded types
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

## Anonymous / Secret modes `[built]`
- ✓ Anonymous mode hides the author everywhere the Mark appears
- ✓ Secret mode reveals only to the intended recipient, once, within its approved lifetime
- ✓ Secret notification and list surfaces never leak protected content
- ✓ Anonymous and Secret may be used together

## Memory / Photo mark `[built]`
- ✓ Pick from gallery **or** capture with camera (permission requested)
- ✓ Image ≤ 6 MB; over-limit rejected with a clear message
- ✓ Optional caption ≤ 200 chars
- ✓ Uses the private protected-media flow; no permanent public Mark-media URL is persisted
- ✓ One to five photos retain their selected order and render on the Wall
- ⏳ Upload progress: a "Posting…" busy state today; a % bar is a later polish. Failure re-enables the button to retry.

## Voice / Video marks `[built]`
- ✓ Voice recording requires explicit microphone permission and supports preview before posting
- ✓ Video can be selected or recorded with a maximum 30-second duration
- ✓ Media failures are visible and retryable; text-only posting remains available
- ✓ Playback uses authorized protected-media reads rather than unrestricted public URLs

## Reactions `[built]`
- ✓ React with an emoji; toggling adds/removes; counts update live
- ✓ Reacting notifies the Mark's author without notifying the actor about their own action
- ✓ No comment thread is exposed; a response is another eligible Mark or a reaction

## Friends `[ ]`
- ✓ Search by handle/name; send request; can't friend yourself
- ✓ Incoming/outgoing requests listed; accept/decline
- ✓ Accepting unlocks private walls + friends-only contribution both ways
- ✓ Unfriend and block available

## Notifications `[ ]`
- ✓ Every relevant event creates a notification for the recipient
- ✓ In-app badge count is accurate; opening marks them read
- ✓ Tapping an in-app Alert routes to the target or a graceful fallback
- ✓ A user never gets notified about their own actions
- ⏳ Native push is a later capability and is not required for the first MVP implementation

## Discover / Friend Wall `[ ]`
- ✓ Discover supports people search and public Shared Wall search
- ✓ Friend Wall respects visibility (private walls blocked for non-friends)
- ✓ Contribution rules enforced (e.g. friends-only)

## Settings & moderation `[ ]`
- ✓ Change who-can-mark, allow-anonymous, require-approval, private/public
- ✓ Moderation queue lists pending marks; approve/reject works
- ✓ Block list add/remove; blocked users can't view/contribute/notify
- ✓ Report creates a report row; reported content flagged for owner

## Explicit MVP non-goals

Comments, doodles, games, polls, awards, predictions, algorithmic feeds, stories, DMs,
contact-book syncing, subscriptions/payments, and live streaming are excluded from this MVP.
They must not be treated as missing launch work unless the Founder approves a later scope change.
