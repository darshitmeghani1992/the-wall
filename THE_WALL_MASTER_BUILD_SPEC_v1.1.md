# THE-WALL — MASTER AUTONOMOUS BUILD SPECIFICATION
## Version 1.0 — Founder-Approved Product, UX, Engineering, Security & AIOS Handoff

> **Purpose:** This is the single authoritative build document for Claude Code and any AI engineering agent working on The-Wall.  
> **Goal:** Build a complete, testable, scalable MVP with minimal Founder intervention.  
> **Founder role:** Make product/brand decisions and visually validate the experience. The Founder must **not** be asked to make technical implementation decisions.

---

# 0. READ THIS FIRST — OPERATING INSTRUCTIONS FOR CLAUDE CODE

You are the autonomous engineering team for **The-Wall**.

Read this document **in full before changing code**.

This file is the source of truth for:
- product behavior
- user flows
- terminology
- screen requirements
- relationship rules
- privacy rules
- Mark behavior
- Shared Wall behavior
- visual direction
- navigation
- errors/loading/empty states
- security
- data model intent
- testing
- scalability
- AIOS governance
- Founder Gates
- Definition of Done

Do not ask the Founder routine technical questions.

If a technical choice is not specified:
1. choose the safest option;
2. prefer the simplest maintainable implementation;
3. prefer reversible decisions;
4. prefer standards already used in the repository;
5. document the decision;
6. continue.

Only stop for the Founder when a **Founder Gate** defined in this document is reached.

You are responsible for continuously planning, implementing, testing, reviewing, fixing, committing, and updating project status.

A feature is **not complete because code exists**. It is complete only when its user-facing acceptance criteria and applicable security checks pass.

---

# 1. AUTHORITY & CONFLICT PRECEDENCE

When sources disagree, use this order:

1. **This Master Build Specification**
2. Explicit new Founder instruction
3. Approved screen images supplied with this project
4. `README.md` / The-Wall handoff describing the reference prototype
5. The supplied The-Wall HTML prototype
6. Existing code
7. Generic design-system files
8. Agent preference

Important:
- The supplied screenshots are the visual target.
- The supplied The-Wall handoff/HTML are useful references, but contain older product assumptions.
- Older prototype behaviors such as password login, global Mark lifespan controls, text-only composer limitations, or friend-only contribution must **not** override this specification.
- Generic design-system files are not authoritative if they conflict with the approved The-Wall screenshots.

---

# 2. FOUNDER INTENT

The-Wall is not another self-posting social network.

The central emotional idea is:

> **Your Wall becomes meaningful because other people leave things on it.**

Every user has one Personal Wall. Other people can leave **Marks** on that Wall when allowed.

Users can also create and join **Shared Walls** for trips, college groups, teams, weddings, friend groups, events, classes, clubs, families, and other shared memories.

The product should feel:
- social
- warm
- playful
- human
- tactile
- personal
- slightly imperfect
- easy to understand
- emotionally rewarding
- naturally shareable

Do not turn the product into:
- a conventional feed
- an Instagram clone
- a TikTok clone
- a SaaS dashboard
- a forum
- a chat app
- a blogging platform
- a creator-first broadcasting platform

---

# 3. NON-NEGOTIABLE PRODUCT PRINCIPLES

## 3.1 The owner does not post normal Marks on their own Personal Wall
Personal Walls are authored by other people.

The owner receives Marks; they do not fill their own Wall with ordinary posts.

## 3.2 Owner self-expression uses one Status / Pin
The owner may maintain exactly one active **Status / Pin** at the top of their Personal Wall.

Examples:
- “Tell me your funniest memory of us 😂”
- “Graduation week 🎓”
- “What’s something I’ll never admit?”
- “Moving next month.”

Status is not a Mark.

## 3.3 Friends and Followers are different
**Friend** = mutual relationship.  
**Follower** = one-way relationship to keep up with a public Wall.

Following never automatically grants writing permission.

## 3.4 Wall visibility and Mark permission are separate
A Wall can be publicly viewable but still restrict who may write.

## 3.5 No comments in MVP
The response to a person should be:
- a reaction; or
- another Mark on an eligible Wall.

Do not create comment threads.

## 3.6 No fake success
Never display success until the backend operation succeeds.

## 3.7 No dead ends
Every screen must have:
- a useful primary next action; or
- a clear back/close destination.

## 3.8 Security is backend-enforced
Frontend hiding is never sufficient for:
- private Walls
- Secret Marks
- anonymous identity
- blocking
- Shared Wall membership
- write permissions

---

# 4. MVP SCOPE

## Included
- opening / welcome experience
- Email OTP authentication
- Google authentication
- Apple authentication where production-capable
- profile setup
- unique usernames
- profile photo
- bio
- optional social links
- Personal Wall
- public/private Personal Wall
- owner Status / Pin
- friends
- followers
- approved writers
- people search
- Shared Wall search
- public Shared Walls
- private Shared Walls
- open-join Shared Walls
- invite-only Shared Walls
- text Marks
- photo Marks
- voice Marks
- video Marks
- up to 5 photos per Mark
- Anonymous mode
- Secret mode
- reactions
- in-app notifications
- realtime Mark arrival where supported
- native sharing
- deep-link intent preservation
- blocking
- reporting
- basic moderation/admin capability
- settings
- account deletion workflow
- analytics for core funnel
- error/loading/empty states
- reduced motion/accessibility support

## Explicitly excluded for now
- doodles
- games
- comment threads
- algorithmic content feed
- stories
- DMs/chat
- contact-book syncing
- complex creator analytics
- paid subscriptions/payments
- live streaming

Do not quietly add excluded features.

---

# 5. APPROVED VISUAL DIRECTION

The supplied screen images are the target visual language.

Core characteristics to preserve:

- bright/light background
- warm neutral surfaces
- bold, clean typography
- expressive, colorful Mark cards
- compact mobile layout
- tactile “objects on a Wall” metaphor
- generous white space around primary chrome
- simple black primary actions
- soft pastel supporting surfaces
- visible identity hierarchy
- compact bottom navigation
- colorful Walls and Marks without making the app visually noisy

The reference prototype uses Archivo-style bold typography, a warm light ground, black/near-black primary text, and a red/orange accent in the sign-in/brand treatment. The supplied handoff explicitly frames the design assets as high-fidelity references to be recreated in the production mobile stack rather than copied as production code.

## 5.1 Wall metaphor
A Mark should feel like something someone **left there**, not like a standard feed card.

Potential physical cues:
- sticky note
- paper card
- pinned memory
- photo card
- taped note
- subtle rotation
- slight variation in scale
- tactile shadow/elevation
- imperfect but controlled placement

## 5.2 Automatic placement
Users do not manually drag Marks.

The system automatically arranges Marks using a controlled masonry / free-placement-inspired layout.

Must:
- avoid overlaps
- keep text readable
- remain deterministic/stable enough that content does not reshuffle randomly on every render
- handle different content heights
- support incremental loading
- preserve smooth scrolling

## 5.3 Motion language
Use a small reusable vocabulary:

**DROP** — new Mark arrives/gets posted.  
**SETTLE** — Wall loads Marks with a fast stagger.  
**PRESS** — button/card tactile feedback.  
**REVEAL** — Secret content opens physically/intentionally rather than generic crossfade.

Rules:
- motion must never block interaction
- no endless decorative animation except subtle approved welcome decoration
- respect Reduce Motion
- multi-Mark realtime arrival must not cause chaos
- wall-load stagger should finish quickly

---

# 6. BRAND & CORE TERMINOLOGY

Use these exact product nouns consistently:

- **The-Wall**
- **Wall**
- **Personal Wall**
- **Shared Wall**
- **Mark**
- **Leave a Mark**
- **Friends**
- **Followers**
- **Status**
- **Anonymous**
- **Secret**
- **Alerts** or **Notifications**: choose one label and use it consistently; default to **Alerts** to match approved screens unless Founder changes it.

Avoid calling Marks:
- posts
- tweets
- messages
- cards (internally okay, not as product noun)

Avoid using “followers” to mean “friends.”

---

# 7. INFORMATION ARCHITECTURE & PRIMARY NAVIGATION

Authenticated primary bottom navigation:

1. **My Wall**
2. **Discover**
3. **Alerts**
4. **Profile**

Do not add a global center “+” button.

The act of creating a Mark belongs contextually to:
- another eligible person’s Wall; or
- a Shared Wall where the user is an eligible member.

## 7.1 My Wall ↔ Shared Walls
This transition is one of the product’s signature interactions.

Shared Walls should not feel buried in a separate unrelated product.

Inside the Wall surface, provide a clearly visible Wall switcher:
- active Personal Wall
- user’s Shared Walls
- horizontal scroll if needed

Allow an elegant swipe or tap transition between Walls.

Requirements:
- one obvious gesture/tap from My Wall to a Shared Wall
- preserve visual continuity
- current Wall identity must always be unmistakable
- Shared Wall must never look like the user’s Personal Wall by accident

---

# 8. MASTER USER STATE MODEL

A user may be:

- logged out
- authenticated but onboarding incomplete
- fully onboarded
- friend-request relationship: none / outgoing pending / incoming pending / accepted
- follower relation: following / not following
- blocked relation
- Shared Wall: owner / member / invited / non-member
- contribution eligibility: allowed / denied
- Wall visibility: allowed / denied

Every screen must render from actual state, not fake assumptions.

---

# 9. AUTHENTICATION FLOW

## 9.1 Opening screen
Use the supplied approved login/welcome visual direction as the visual anchor.

Important product change from old prototype:
- do not use password-first authentication.

Preferred hierarchy:

**Get Started**
→ authentication choices

Secondary:
**Already have a Wall? Sign in**

The opening screen may retain:
- The-Wall icon/wordmark
- “Your friends write your story.” or Founder-approved final line
- floating visual Mark objects
- restrained motion

## 9.2 Authentication methods
Support:
- Continue with Google
- Continue with Apple where production-capable
- Email OTP / magic code

If Apple/Google cannot be safely completed in the current environment:
- do not fake success
- clearly mark integration blocked
- leave architecture ready

## 9.3 Email OTP screen
Contains:
- email field
- continue/send code button
- validation
- back

States:
- idle
- invalid email
- sending
- sent
- network failure
- rate limited

## 9.4 OTP verification screen
Contains:
- destination email
- code input
- verify
- resend
- resend cooldown
- change email

States:
- idle
- verifying
- incorrect
- expired
- resend available
- network failure
- success

## 9.5 Post-auth routing
If profile incomplete:
→ onboarding.

If complete and a deep-link destination is pending:
→ restore destination.

Else:
→ My Wall.

---

# 10. ONBOARDING

Do not use a long carousel of explanatory slides.

Use concise functional setup followed by a short interactive walkthrough.

## 10.1 Profile Basics
Required:
- profile image: optional initially but strongly encouraged
- display name
- unique @handle

Handle rules:
- normalized case
- unique
- allowed character validation
- availability check
- clear available/unavailable state
- no silent collisions

Primary CTA:
**Continue**

## 10.2 Bio
- optional
- max 160 characters
- character counter

Primary CTA:
**Continue**

Secondary:
**Skip**

## 10.3 Wall Privacy
Options:
- Private — default
- Public

Explain in plain language.

Private:
accepted friends can view Personal Wall content.

Public:
any logged-in non-blocked user may view.

Primary:
**Continue**

## 10.4 Who can leave Marks?
Options:
- Friends only — default
- Everyone
- Approved people

Explain that viewing and writing are separate.

## 10.5 Anonymous Marks
Default OFF.

Explain:
“People can hide their identity from you and other users. The platform may retain identity for safety/moderation.”

Do not imply the recipient can reveal anonymous identity.

## 10.6 Find Your People
Actions:
- Search The-Wall
- Share invitation
- Skip for now

No contact-book permission in MVP.

## 10.7 Onboarding complete
Do not show a useless success page.

Continue directly into first-use walkthrough + My Wall.

---

# 11. FIRST-USE INTERACTIVE WALKTHROUGH

Must be:
- short
- contextual
- skippable
- shown once
- replayable from Help

Teach in no more than 4 moments:

1. “This is your Wall.”
2. “Your people leave Marks here.”
3. Point to invite/find people.
4. “Visit someone else’s Wall to leave them a Mark.”

Do not fabricate example activity as though it were real.

If ghost/placeholders are used, make them unmistakably instructional.

End on My Wall with a useful CTA.

---

# 12. MY WALL — HOME

My Wall is the authenticated home.

Do not create a separate feed.

## 12.1 Header content
Show:
- avatar
- display name
- @handle
- Friends count
- Followers count
- share action
- settings/customize action where relevant

Optional:
- profile shortcut only if it does not duplicate bottom nav awkwardly

## 12.2 Owner Status
Display owner Status/Pin below identity.

If none:
show subtle **Set a Status** prompt to owner.

If set:
show status text and edit affordance.

Other visitors see the active Status as context.

## 12.3 Wall switcher
Show:
- My Wall
- joined/owned Shared Walls

Horizontal scroll when necessary.

## 12.4 Marks
Automatically arranged in tactile Wall layout.

Each normal Mark card may display:
- content preview
- author or Anonymous
- time/relative metadata if useful
- reaction summary
- Secret locked state where applicable

Do not display a “Leave a Mark” CTA on the user’s own Personal Wall.

## 12.5 Owner primary actions
For empty Wall:
1. **Invite someone** — primary
2. **Find people** — secondary

For populated Wall:
- Share My Wall
- Status
- settings
- tap Marks

---

# 13. OWNER STATUS / PIN

Exactly one active Status per Personal Wall.

Max 150 characters.

Optional emoji.

Owner can:
- create
- edit
- replace
- remove

Status is not:
- a Mark
- reactable by default
- counted as a received Mark

A Status can inspire Marks.

Example:
“Tell me the dumbest thing I’ve ever done.”

---

# 14. PERSONAL WALL VISIBILITY

## Public
Any authenticated, non-blocked user can view the Wall.

Viewing does not:
- create friendship
- create follow automatically
- grant Mark permission

## Private
Only:
- owner
- accepted friends

can view Wall content.

Non-friend visitor sees:
- profile identity if searchable
- clear private state
- relationship actions if allowed
- no protected Marks

Followers who are not friends lose content access if Wall becomes Private.

---

# 15. CONTRIBUTION PERMISSIONS

Personal Wall owner chooses:

### Friends only
Only accepted friends can leave Marks.

### Everyone
Any authenticated, non-blocked user may leave Marks.

### Approved people
Only users specifically approved by owner may leave Marks.

Approved writer status does not imply friendship.

All permissions must be server-enforced.

---

# 16. FRIENDS

Friendship is mutual.

States:
- none
- outgoing request
- incoming request
- accepted

## Send
Person profile/Wall:
**Add Friend**

After success:
**Requested**

## Incoming
Recipient sees:
- alert
- friend requests surface

Actions:
- Accept
- Decline

## Accept
Both become friends.

UI updates everywhere.

## Decline
No friendship.

## Cancel outgoing request
Requester may cancel while pending.

## Unfriend
Either party may unfriend.

Must require a confirmation if accidental taps are likely.

---

# 17. FOLLOWERS

Following is one-way.

Only relevant to Public Personal Walls.

Actions:
- Follow
- Following / Unfollow

Follower:
- can easily find the Wall again
- may receive eligible non-sensitive activity in future
- does not gain write permission

Following must never bypass privacy or blocking.

---

# 18. DISCOVER

Use supplied visual direction: simple bold title, People/Walls segmented switch, compact pastel cards.

## 18.1 People tab
Search by:
- display name
- @handle
- partial matching

Suggested people may use:
- mutual friends
- product-local relevance
- recent legitimate connection signals

Do not build an algorithmic content feed.

Person card:
- avatar
- name
- @handle
- short bio if space
- mutual friends where real
- relationship state
- follow/friend action as appropriate

Never show fake online dots unless true presence exists. If presence is not implemented, remove them.

## 18.2 Walls tab
Search public Shared Walls.

Card:
- Shared Wall name
- optional icon/emoji/cover
- Public label
- description
- member count
- join/view state

Private Shared Walls must not appear in public search unless user has an invite.

---

# 19. OTHER PERSON PROFILE

Purpose:
identity and relationship control.

Show:
- avatar
- name
- @handle
- bio
- Friends count
- Followers count
- Shared Walls count if public/appropriate
- social links
- Follow state
- Friend state
- View Wall
- Share profile
- More menu: report/block

Do not turn profile into a content feed.

Wall is where content lives.

---

# 20. OTHER PERSON WALL

Header:
- back
- avatar
- name
- @handle
- relationship state
- follow state where useful

Show Status if active.

## If user can write
Prominent:
**Leave a Mark**

## If user cannot write
Do not show a misleading composer action.

Explain reason:
- “Be friends to leave a Mark”
- “Only approved people can leave Marks”
- other accurate rule

Offer relevant action:
- Add Friend
- Requested
- Follow
- back

## Private inaccessible state
No Marks.

Explain:
“This Wall is private.”

Offer relationship action if allowed.

---

# 21. MARK COMPOSER — UX MODEL

Use a single full-screen composer inspired by the supplied reference.

Do **not** force users through a separate “pick Mark type” screen.

The composer opens ready for text and offers inline media attachments.

Header:
- Cancel
- New Mark
- Post

Recipient identity should remain visible.

Body:
- avatar/recipient context
- auto-growing text field
- 500 character max
- text counter

Bottom attachment actions:
- Photos
- Video
- Voice

Toggles:
- Anonymous, if recipient allows
- Secret

Anonymous and Secret may both be ON.

Post is disabled until valid content exists.

If draft contains content and user exits:
show:
**Discard Mark?**
- Keep Editing
- Discard

Preserve draft after recoverable post failure.

---

# 22. TEXT MARK

Maximum 500 characters.

Allow:
- line breaks
- emoji

Prevent:
- empty whitespace-only post
- >500 chars

Counter:
- normal
- warning near limit
- clear blocked state over limit

---

# 23. PHOTO MARK

Maximum 5 images per Mark.

Flow:
1. tap photo
2. request permission at first use
3. select/capture
4. preview
5. add more until 5
6. reorder if feasible
7. remove individual image
8. optional text/caption in same composer
9. post

Requirements:
- image preview sufficient to catch wrong photo
- compressed/optimized upload
- thumbnail rendering
- preserve aspect reasonably
- distinguish upload progress from post creation
- if one upload fails, provide retry/removal rather than silent partial corruption

---

# 24. VOICE MARK

Maximum 60 seconds.

Flow:
1. tap mic
2. request microphone permission
3. recording UI
4. visible timer
5. stop
6. playback preview
7. re-record/remove
8. optional text
9. post

Do not request mic permission during onboarding.

States:
- permission denied
- recording
- paused only if implemented correctly
- processing
- ready
- upload
- failure

---

# 25. VIDEO MARK

Maximum 30 seconds.

Flow:
1. choose/capture video
2. request permissions only as needed
3. preview
4. remove/replace
5. optional caption/text
6. post

Requirements:
- enforce duration
- compression/transcoding strategy appropriate to stack
- show upload progress
- retry on failure
- do not freeze UI

---

# 26. ANONYMOUS MARKS

Owner setting:
Allow Anonymous ON/OFF.

If OFF:
Anonymous toggle does not appear.

If ON:
sender may toggle Anonymous.

User-facing author:
**Anonymous**

Recipient cannot reveal identity.

Backend may retain true author for:
- abuse handling
- reports
- security

Security requirements:
- never return hidden author to ordinary client responses
- do not leak through realtime payload
- do not leak through notification payload
- do not leak through analytics
- do not leak through media metadata exposed to user
- do not leak through share links

---

# 27. SECRET MARKS

Secret is a visibility/lifecycle mode, not a content type.

Any supported Mark may be Secret.

Secret may also be Anonymous.

## 27.1 Core promise
Only intended recipient may reveal Secret content.

Other viewers may see a locked shell:
**Secret Mark 🔒**

They must never receive Secret content payload.

## 27.2 Sender behavior
Sender can compose and preview before posting.

After successful post:
sender cannot reopen Secret content through normal app flows.

## 27.3 Recipient one-time reveal
Before open:
show locked state with intentional:
**Open once**

Upon confirmed open:
- server atomically records opened state
- content becomes available for that one reveal session
- second reveal must fail
- do not rely on client-only flag

After recipient closes/leaves/reloads:
content is no longer user-accessible.

## 27.4 One-hour lifetime
Secret Mark expires 1 hour after creation.

Before expiry:
locked shell may remain visible.

At/after expiry:
- shell removed from Wall
- secret payload unavailable
- cleanup performed according to secure backend capability

If unopened by expiry:
expires unopened.

## 27.5 Notifications
Notification may say:
“Someone left you a Secret Mark.”

If anonymous:
do not leak sender.

Do not include Secret content in notification.

---

# 28. MARK POST SUCCESS

After backend success:
- close composer
- return to exact recipient Wall
- insert Mark
- play DROP placement animation
- briefly focus/highlight new Mark

Do not send user to generic success screen.

If post fails:
- keep composer/draft
- show actionable error
- enable retry
- never show Mark as permanently posted unless reconciled

---

# 29. MARK CARD

Each card should have a tactile, slightly varied treatment.

Minimum information:
- content preview
- author / Anonymous
- reactions summary
- media indication/content as relevant
- Secret state if applicable

Text cards can use color variation.

Photo cards should visually feel like memories attached to the Wall.

Voice cards should use a compact waveform/playback affordance.

Video cards should have preview/play state.

Long text:
- clamp on Wall
- tap for full detail

Do not overload cards with metadata.

---

# 30. MARK DETAIL

Open as modal/sheet/full-screen treatment consistent with approved design.

Show:
- full content
- author if non-anonymous
- reaction controls
- share if eligible
- report
- owner removal where eligible
- sender edit/delete only inside 10-minute window

Back/close returns to same Wall and ideally same scroll position.

Secret Marks do not use ordinary detail flow.

---

# 31. REACTIONS

Allowed:
❤️ 😂 🥹 🔥 👏

One active reaction per user per Mark.

User may:
- add
- change
- remove

Counts update quickly and reconcile with server.

No reaction may reveal Anonymous author.

No comments.

---

# 32. SENDER EDIT/DELETE WINDOW

Normal Mark sender may edit/delete for:
**10 minutes after creation.**

After window:
- edit disabled
- delete disabled through normal sender action

Moderation/reporting remains available.

Server time is authoritative.

Do not trust client clock alone.

---

# 33. OWNER MARK REMOVAL / AUTHENTICITY

Wall owner may remove received Marks.

Two pathways:

## Normal removal
To preserve authenticity:
default maximum **3 normal removals per rolling 30 days**.

Before confirmation:
show remaining allowance.

## Safety removal
If user reports, blocks, or chooses an abuse/safety path:
removal/hiding must not be limited by authenticity quota.

Safety always wins.

Admin moderation also bypasses quota.

This rule applies to Personal Wall owner moderation, not platform safety tools.

---

# 34. SHARE MY WALL

Own Wall includes clear:
**Share My Wall**

Suggested share copy:
“Leave something on my Wall 👀”

Use native share sheet.

Share target should identify:
- whose Wall
- why recipient should open it

If user has no account:
deep link must preserve target through auth/onboarding.

---

# 35. DEEP LINKS

Support stable conceptual destinations:
- user profile
- Personal Wall
- Shared Wall
- Shared Wall invite
- Mark when safe

Logged out flow:
deep link
→ auth
→ onboarding if needed
→ original destination

Never lose intent and drop user on generic Home.

Invalid/deleted destination:
show safe not-found state with useful next action:
- My Wall
- Discover

---

# 36. SHARED WALLS — CORE

Users may create multiple Shared Walls.

Examples:
- Goa Trip ’25
- College Friends
- Football Team
- Wedding Crew
- Class of 2026

Shared Wall owner **can** leave Marks on the Shared Wall.

This differs from Personal Wall.

Roles for MVP:
- OWNER
- MEMBER

---

# 37. CREATE SHARED WALL FLOW

Entry:
Wall switcher / appropriate create affordance.

Steps can be one concise form or short sequence.

Required:
- name
- privacy: Public / Private
- membership mode

Optional:
- description
- emoji/icon/cover

Public membership:
- Open Join ON/OFF

After create:
go directly to created Shared Wall.

Empty Shared Wall:
- if owner/member: **Leave the first Mark**
- owner: also **Invite people**

Never end on generic “Created!” page.

---

# 38. PUBLIC SHARED WALL

Visible to authenticated non-blocked users.

Searchable.

Only members can post.

## Open Join ON
Non-member sees:
**Join Wall**

Successful join:
→ becomes member
→ stays on Wall
→ Leave a Mark available

## Open Join OFF
Non-member may view but cannot post/join without invite.

Show accurate state.

---

# 39. PRIVATE SHARED WALL

Only:
- owner
- accepted members

may access:
- Marks
- full member list
- protected metadata

Non-member must not receive private payload.

An invitee may see only minimal invite preview necessary to decide.

Private Walls do not appear in public search.

---

# 40. SHARED WALL INVITES

Owner can invite:
- existing The-Wall users
- share link

Existing user:
INVITED
→ Accept / Decline

Accept:
→ Member
→ Shared Wall

Decline:
→ invitation closed
→ useful return destination

Logged-out invite link:
→ auth
→ onboarding if needed
→ restore invite
→ Accept/Decline

---

# 41. SHARED WALL MEMBERS

Owner can:
- view members
- invite
- remove member
- transfer ownership

Member can:
- leave Wall

Existing Marks remain when member voluntarily leaves unless moderation rules remove them.

---

# 42. OWNERSHIP TRANSFER

Only current owner can transfer.

Target must be current member.

Flow:
select member
→ explain consequence
→ confirm

After success:
- target becomes owner
- previous owner becomes member
- permissions update immediately

No ownerless Shared Wall.

---

# 43. OWNER LEAVING SHARED WALL

Owner cannot simply leave while owner.

Must:
- transfer ownership; or
- delete Shared Wall

Explain clearly.

---

# 44. DELETE SHARED WALL

Owner only.

Strong destructive confirmation.

Explain:
- Shared Wall disappears
- its Marks/content are deleted or scheduled for secure deletion according to backend policy
- cannot be undone after final confirmation

Do not make deletion one accidental tap.

---

# 45. ALERTS / NOTIFICATIONS

Use supplied visual direction:
flat, readable activity list with subtle unread treatment.

MVP uses in-app notifications.

Architecture should permit push later.

Events:
- Mark received
- reaction on my Mark
- friend request
- friend accepted
- Shared Wall invite
- Shared Wall invite accepted
- Shared Wall relevant activity
- ownership transfer
- Secret Mark received without content leakage

Every notification must have a valid destination or graceful fallback.

---

# 46. NOTIFICATION ROUTING

Mark received
→ destination Wall
→ focus Mark

Reaction
→ destination Wall
→ focus Mark

Friend request
→ requests surface

Friend accepted
→ person profile/Wall

Shared invite
→ invite decision screen

Shared activity
→ Shared Wall

Ownership transfer
→ Shared Wall management/info

Deleted/missing destination:
→ graceful unavailable state
→ Alerts or My Wall

---

# 47. PROFILE — OWN

Use supplied centered visual structure.

Show:
- profile image
- name
- @handle
- bio
- Friends
- Followers
- Shared Walls count

Actions:
- Edit Profile
- Share My Wall
- Settings

Optional social links:
- Instagram
- TikTok
- YouTube
- X
- Website

Do not show a personal content feed.

---

# 48. EDIT PROFILE

Editable:
- photo
- display name
- @handle
- bio
- social links

Handle change:
- validate uniqueness
- prevent collisions
- handle deep-link implications safely

Show unsaved-change protection.

Success returns to Profile with updated data.

---

# 49. SETTINGS

Include:

### Wall
- Public/Private
- Who can leave Marks
- Approved writers
- Anonymous Marks ON/OFF

### Account
- email/account identity
- social links shortcut
- blocked users
- notification preferences
- help
- privacy/terms placeholders until real docs exist
- logout
- delete account

Do not expose technical settings.

---

# 50. APPROVED WRITERS

Only relevant when contribution policy is Approved People.

Owner can:
- search users
- add
- remove

Approved writer can write even without friendship, subject to blocking.

Approval does not automatically:
- friend
- follow
- grant private Wall viewing if current privacy rule would otherwise deny it

Important implementation rule:
If a Wall is Private and an approved writer is not a friend, they still cannot view/write unless product access semantics explicitly allow it. For MVP, **private visibility wins**: approved-writer mode is practically useful on Public Walls unless the user is also a friend.

---

# 51. BLOCKING

Blocking is a hard bilateral product boundary.

When A blocks B:
- friendship removed
- follow relationship removed
- pending friend requests removed
- no new friend request
- no new follow
- no Personal Wall viewing
- no Mark creation
- no reactions
- no Shared Wall invitations directly between them
- hide from each other’s people search
- suppress direct notifications

Public status never bypasses block.

Shared Wall edge case:
If both remain members of the same Shared Wall, safest MVP behavior is to suppress direct identity interaction and prevent blocked pair actions while preserving Shared Wall integrity. If the platform cannot safely represent this, flag for Product/Founder rather than leaking private blocked-person data.

---

# 52. REPORTING

Report targets:
- Mark
- user
- Shared Wall where appropriate

Reasons:
- Harassment
- Hate or abuse
- Sexual/inappropriate content
- Spam
- Impersonation
- Privacy
- Other

Flow:
Report
→ reason
→ optional details
→ submit
→ confirmation

Where relevant offer:
**Block user**

Reports must create real moderation records.

---

# 53. ADMIN / MODERATION

Build minimal protected admin capability where supported.

Admin can:
- inspect reports
- inspect target content
- remove content
- suspend/disable abusive account
- resolve report

Admin routes must never be accessible to ordinary users.

Do not expose anonymous author identity except to appropriately protected moderation capability.

---

# 54. EMPTY STATES

Every empty state must create forward motion.

## Empty Personal Wall
Copy direction:
“Your Wall is waiting for its first Mark.”

Primary:
Invite someone

Secondary:
Find people

## Empty Shared Wall — owner
Primary:
Invite people

Secondary:
Leave the first Mark

## Empty Shared Wall — member
Primary:
Leave the first Mark

## No friends
“Find your people.”
→ Discover

## No search results
Offer:
- adjust search
- invite someone via link

## No alerts
“Quiet for now.”
→ My Wall or Discover

No empty screen may look broken.

---

# 55. LOADING STATES

Use contextual skeleton/loading states for:
- auth
- Wall
- Marks
- Discover
- search
- profile
- Shared Walls
- Alerts
- media upload
- friend action
- follow action
- invite action

Rules:
- no indefinite blank screen
- prevent double-submit
- allow retry when safe
- loading UI must not fabricate data

---

# 56. ERROR STATES

Every asynchronous operation must model:
- idle
- loading
- success
- error

Errors should be understandable, not developer text.

Examples:
- “Couldn’t load this Wall. Try again.”
- “That code has expired. Send a new one.”
- “Your photo couldn’t upload. Retry.”
- “You no longer have permission to leave a Mark here.”

Do not expose raw stack traces or database errors.

---

# 57. OFFLINE / NETWORK FAILURE

At minimum:
- detect failed requests
- show retry
- preserve unsent composer draft locally where practical
- no false success
- recover safely after session expiration

Do not attempt complex offline-first social synchronization for MVP unless already supported cleanly.

---

# 58. NO-DEAD-END TRANSITION RULE

For every screen, implementation must answer:

1. How did the user get here?
2. What is the primary thing they can do?
3. What happens on success?
4. What happens on failure?
5. Where does Back/Close go?
6. Can the user get trapped?
7. Does this action feed another useful loop?

If trapped:
fix the flow before marking complete.

---

# 59. CORE TRANSITION MATRIX

Opening
→ Get Started
→ Auth
→ Onboarding
→ Walkthrough
→ My Wall

My Wall empty
→ Invite
→ Share / Find People

My Wall
→ Shared Wall via Wall switcher

Discover People
→ Person Profile
→ Person Wall
→ Leave a Mark
→ Composer
→ Post
→ Person Wall

Received Mark
→ Mark Detail
→ Author Profile if known
→ Author Wall
→ Leave a Mark

Friend Request Alert
→ Requests
→ Accept
→ Person Wall/Profile

Discover Walls
→ Public Shared Wall
→ Join/View
→ Leave a Mark if member

Shared Wall
→ Invite
→ recipient opens invite
→ accepts
→ Shared Wall
→ Leave a Mark

Secret Alert
→ My Wall
→ locked Secret
→ Open once
→ content reveal
→ close
→ no second reveal

Profile
→ Share My Wall
→ external invite loop

Every major successful action should return the user to the social object involved, not a generic success page.

---

# 60. PRIMARY VIRAL LOOP

Target loop:

User receives Mark
→ emotional reaction
→ reacts
→ visits author
→ leaves Mark on author’s Wall
→ shares own Wall
→ friend opens
→ friend signs up/onboards if needed
→ friend leaves Mark
→ friend discovers they have own Wall
→ friend invites another person

The product must minimize friction in this loop.

---

# 61. SHARED WALL LOOP

Create Shared Wall
→ invite/share
→ people join
→ people contribute
→ activity brings owner/members back
→ members invite relevant people
→ Wall becomes richer

Shared Wall should not cannibalize Personal Wall; they are complementary.

---

# 62. DATA MODEL — CONCEPTUAL SOURCE OF TRUTH

Exact SQL/types may vary, but use a relational model compatible with Supabase/Postgres unless existing architecture dictates otherwise.

Minimum conceptual entities:

- auth users
- profiles
- personal_walls
- wall_statuses
- friendships
- follows
- approved_writers
- shared_walls
- shared_wall_members
- shared_wall_invites
- marks
- mark_media
- secret_mark_payloads
- mark_reactions
- notifications
- blocks
- reports
- moderation_actions
- analytics events only through approved analytics layer

Do not store security-sensitive state only in frontend state.

---

# 63. PROFILE DATA

Profile fields should support:
- id linked to auth user
- display_name
- handle
- avatar
- bio
- social links
- onboarding complete
- account status
- created/updated timestamps

Handle must be uniquely indexed/case-normalized.

---

# 64. PERSONAL WALL DATA

One Personal Wall per profile.

Fields/relations:
- owner
- visibility
- contribution policy
- allow anonymous
- timestamps

Status kept separately or clearly separated from Marks.

---

# 65. FRIENDSHIP DATA

Represent mutual friendship safely.

Must prevent:
- duplicate parallel requests
- self-friend requests
- contradictory states

Operations:
- request
- cancel
- accept
- decline
- unfriend

Use database constraints where appropriate.

---

# 66. FOLLOW DATA

One-way:
follower_id
followed_user_id

Prevent:
- self-follow if product considers it meaningless
- duplicates

Automatically revoke/ignore as needed for block/private transitions.

---

# 67. MARK DATA

Normal Mark fields should support:
- id
- target Wall id/type
- author internal id
- display author semantics
- text
- anonymous bool
- secret bool
- created_at
- editable_until
- moderation status
- removed state/reason if needed
- created source/context

Media stored separately.

Do not place protected Secret payload in ordinary broadly-readable row if it can leak.

---

# 68. SECRET PAYLOAD DATA

Use a separate protected resource/entity/table if necessary.

Must support:
- secret Mark id
- encrypted/protected content reference
- intended recipient
- created_at
- expires_at
- opened_at
- consumed state
- cleanup state

One-time reveal must be atomic on server.

Race condition requirement:
two simultaneous reveal attempts must not both succeed.

---

# 69. MEDIA STORAGE

Media:
- photo
- voice
- video

Metadata:
- owner/author
- Mark
- media type
- storage path
- thumbnail where applicable
- duration where applicable
- ordering for photo carousel
- created time

Private/Secret media must not use permanently public unrestricted URLs.

Use signed/protected access where appropriate.

---

# 70. SHARED WALL DATA

Support:
- id
- owner
- name
- description
- icon/cover
- visibility
- open_join
- timestamps
- deletion status

Member relation:
- wall
- user
- role: owner/member
- status
- joined time

Only one owner.

---

# 71. NOTIFICATION DATA

Store:
- recipient
- actor where safe
- event type
- destination type/id
- read state
- created time
- safe metadata

Never store Secret content in notification.

Anonymous notification must not reveal author.

---

# 72. PERMISSIONS / RLS SECURITY CONTRACT

If using Supabase, use Row Level Security and server-side operations where required.

At minimum, independently verify:

- stranger cannot read Private Personal Wall Marks
- non-member cannot read Private Shared Wall data
- non-eligible user cannot create Mark
- blocked user cannot bypass by direct API request
- sender cannot edit/delete after 10 minutes
- owner normal removal quota enforced server-side
- safety removal not blocked by quota
- anonymous true author not exposed
- Secret payload only intended recipient can consume
- Secret cannot be consumed twice
- Secret expires
- non-owner cannot modify Wall settings
- Shared Wall member cannot promote self
- only owner can transfer ownership/delete
- client cannot forge notifications/moderation actions

Security tests are launch blockers.

---

# 73. INPUT VALIDATION

All untrusted input must be validated.

Validate:
- auth values
- handles
- names/bio lengths
- URLs/social links
- Mark text
- image count
- media type/size
- voice duration
- video duration
- Wall names/descriptions
- invitation ids
- reaction enum
- report reason

If TypeScript is used, maintain strict types.

Use Zod or the project’s chosen schema-validation library at trust boundaries.

Do not require Zod purely for internal typed function calls where it adds no value.

---

# 74. ERROR HANDLING ENGINEERING RULE

Use a consistent application error model.

UI should receive:
- stable error category/code
- safe user message
- retryability information where useful

Logs may contain technical context but never:
- passwords
- OTP codes
- Secret content
- access tokens
- private media URLs unnecessarily

---

# 75. TECHNICAL STACK

Preferred production stack unless existing repository already has an approved equivalent:

## Mobile
- Expo
- React Native
- TypeScript strict mode

## Backend
- Supabase
- Postgres
- Auth
- Storage
- Realtime
- RLS
- Edge/server functions only where client-direct operations are insufficient or unsafe

Avoid introducing a separate Express server merely by habit.

## State/data
Choose maintainable libraries appropriate to existing repo.
Prefer minimal dependencies.

## Validation
Zod or equivalent at external/data trust boundaries.

## Testing
Use the stack’s established unit/integration/e2e tools.
Do not add five overlapping test frameworks.

---

# 76. ARCHITECTURAL PRINCIPLES

Prefer separation:

UI
→ product/domain logic
→ data/service layer
→ backend

Do not scatter raw backend calls throughout every visual component.

Reasons:
- maintainability
- testing
- future portability
- Base44/vendor escape if ever needed
- easier security review

---

# 77. SCALABILITY REQUIREMENTS

Do not prematurely build hyperscale infrastructure.

Do avoid obvious traps.

Required:
- paginated Wall Mark queries
- indexed relationship lookups
- indexed handles
- efficient Shared Wall membership checks
- no N+1 loops where avoidable
- media thumbnails/compression
- lazy loading
- realtime subscriptions scoped to relevant Wall/user
- cleanup/expiry strategy for Secret Marks
- avoid loading full friend graph for routine screen
- avoid fetching all Marks for a large Wall

Design for growth from early users to meaningful scale without mandatory rewrite of core data semantics.

---

# 78. PERFORMANCE TARGETS

Optimize perceived speed.

- app launches without unnecessary blocking work
- cached identity can render quickly where safe
- Wall skeleton appears promptly
- images load progressively
- Mark cards do not cause severe layout thrash
- realtime insert does not rerender entire app
- media uploads run with visible progress
- interactions should feel immediate

Do not sacrifice correctness/security for superficial speed.

---

# 79. REALTIME

Use realtime where valuable:
- new Mark arrival on open Wall
- reaction count updates
- new alerts
- relevant Shared Wall activity

Requirements:
- reconcile duplicates
- handle reconnect
- avoid duplicate Mark on optimistic + realtime path
- respect access revocation
- unsubscribe on screen/account changes

---

# 80. ACCESSIBILITY

Minimum:
- touch targets approximately 44×44pt where practical
- screen-reader labels for icon buttons
- semantic labels for Mark reactions
- sufficient contrast
- keyboard-safe forms
- dynamic text should not clip major controls
- Reduced Motion support
- do not encode unread/state solely by color
- meaningful media labels where possible

---

# 81. PRIVACY

Collect only necessary data.

Do not expose:
- hidden anonymous author
- Secret payload
- private Wall content
- private Shared Wall membership/content to unauthorized users

Do not log private content to analytics.

User-facing privacy copy must match actual behavior.

---

# 82. ACCOUNT DELETION

Use 30-day recoverable deletion where practical.

Flow:
Settings
→ Delete Account
→ explain consequences
→ strong confirmation
→ deactivate account
→ schedule deletion

During deactivated period:
account not normally discoverable/interactable.

Before final deletion:
handle Shared Wall ownership:
- transfer required or safe ownership workflow

If platform cannot automate complete 30-day lifecycle:
implement safest practical equivalent and mark the remaining task clearly.

---

# 83. ANALYTICS — MINIMUM USEFUL FUNNEL

Track product events, not private content.

Core:
- app_open
- signup_started
- signup_completed
- onboarding_completed
- wall_viewed
- wall_shared
- invite_sent
- friend_request_sent
- friend_request_accepted
- follow_created
- mark_composer_opened
- mark_created
- first_mark_received
- reaction_added
- shared_wall_created
- shared_wall_joined
- secret_mark_created
- secret_mark_opened

Never include:
- Secret content
- private Mark text
- OTP
- token
- hidden anonymous author in event properties

---

# 84. PRIMARY PRODUCT METRIC

Activation:
**A new user who completes a Wall and receives at least one genuine Mark from another person.**

Supporting metrics:
- time to first friend
- time to first Mark sent
- time to first Mark received
- Wall shares
- invite conversion
- return after first received Mark
- Wall-to-Wall traversal
- Shared Wall participation

Do not optimize vanity follower counts before activation.

---

# 85. DESIGN TOKENS & IMPLEMENTATION

Create one central theme/tokens layer for production UI.

Do not scatter hardcoded colors/spacing/fonts across screens.

Use supplied visual references to derive:
- background
- ink
- muted text
- brand accent
- pastel Mark palette
- Shared Wall palette
- border
- radii
- shadow/elevation
- spacing
- typography

Important:
The uploaded generic `styles.css` contains a Modernist token system, but its zero-radius/red-grid rules conflict with several approved The-Wall screens. Do not blindly copy it. The approved The-Wall screenshots and this Master Spec have higher authority.

---

# 86. SCREEN INVENTORY — REQUIRED

Implement all applicable states for:

### Entry/Auth
1. Welcome
2. Auth method
3. Email entry
4. OTP verification
5. auth errors

### Onboarding
6. profile basics
7. bio
8. Wall privacy
9. contribution permission
10. anonymous setting
11. find people/invite
12. interactive walkthrough

### Wall
13. My Wall populated
14. My Wall empty
15. Status edit
16. Wall settings
17. approved writers
18. followers/friends surface as needed
19. Other Person Wall — eligible
20. Other Person Wall — ineligible
21. Other Person Wall — private/locked

### Mark
22. Composer text
23. Composer photos
24. Composer voice
25. Composer video
26. upload/progress state
27. Mark detail
28. edit Mark within window
29. delete confirmation within window
30. Anonymous state
31. Secret locked
32. Secret one-time reveal
33. Secret consumed
34. Secret expired
35. removal flow
36. report flow

### Discover/Social
37. Discover People
38. People search results
39. Discover Walls
40. Shared Wall search results
41. Friend requests
42. Other Profile
43. own Profile
44. Edit Profile
45. social links

### Shared Walls
46. Shared Wall populated
47. Shared Wall empty
48. Create Shared Wall
49. Shared Wall settings
50. member list
51. invite user
52. invite acceptance
53. open join
54. ownership transfer
55. leave Wall
56. delete confirmation

### Notifications/Settings
57. Alerts list
58. Alerts empty
59. Settings
60. Blocked users
61. Account deletion
62. Help/walkthrough replay

Also implement:
- loading
- error
- permission denied
- offline/retry
- not found
for relevant screens.

---

# 87. SCREEN-BY-SCREEN VISUAL QA RULES

## Welcome/Auth
- primary action obvious in 3 seconds
- no corporate dashboard feeling
- keyboard never covers input/CTA

## My Wall
- identity immediately clear
- Marks are product hero
- tactile/varied without chaos
- empty Wall feels full of potential
- Shared Wall switch visible

## Person Wall
- recipient identity unmistakable
- contribution eligibility obvious
- “Leave a Mark” targets current person

## Composer
- recipient stays clear
- writing space comfortable
- media preview clear
- anonymous/secret explicit
- posting/uploading distinct

## Shared Wall
- Shared Wall identity obvious
- cannot be confused with Personal Wall
- public/private/member state understandable

## Alerts
- actor/action/destination scan quickly
- unread subtle
- not enterprise inbox UI

## Profile
- identity > stats
- Wall remains content home
- no fake activity feed

---

# 88. AIOS ROLE MODEL

Claude may internally use subagents or role passes.

Roles:

## Product
Checks product spec, user flow, terminology, no-dead-ends.

## Architect
Owns system design, schema proposals, migrations, scalability.

## Backend/Security
Implements auth, DB, RLS, storage, realtime, protected functions.

## Frontend
Implements screens, states, navigation, animations, accessibility.

## Reviewer
Independent review of exact changed code.

## QA
Runs acceptance/regression/build checks.

Builder and Reviewer should not be treated as the same approval key for high-risk changes.

---

# 89. AUTONOMY RULES — DO NOT ASK FOUNDER TECH QUESTIONS

Claude may decide without Founder:
- folder structure
- component boundaries
- query hooks
- indexes
- cache strategy
- internal API shape
- test implementation
- library choice if low-risk and justified
- refactoring
- naming of internal code symbols
- migration implementation details consistent with approved model
- error codes
- logging implementation
- CI configuration
- accessibility implementation

Choose safest/simple/reversible and continue.

---

# 90. FOUNDER GATES — ONLY STOP HERE

Stop for Founder only when:

1. product behavior is genuinely unspecified and multiple choices materially change user experience;
2. a new user-facing feature is proposed;
3. visual direction materially departs from approved references;
4. privacy promise changes;
5. payment/monetization is introduced;
6. a major irreversible architecture/vendor change is needed;
7. destructive production migration/deployment is required;
8. public launch approval is required.

Do not ask:
“Should I use index X?”
“Should I use RPC or function?”
“Should I use Zustand?”
“Should I normalize this table?”

Those are engineering decisions.

---

# 91. HIGH-RISK TWO-KEY CHANGES

Require independent Reviewer + QA/Security pass before considered ready:

- auth changes
- RLS/authorization
- anonymous identity handling
- Secret Mark storage/reveal
- blocks
- private Walls
- Shared Wall membership security
- account deletion
- storage policies
- destructive migrations
- public API/security boundaries

Founder does not need to understand implementation details, but receives a plain-English summary before production use.

---

# 92. VERTICAL-SLICE BUILD STRATEGY

Do not build “all DB, then all API, then all frontend.”

Build complete user journeys.

Recommended order:

## Slice 0 — Foundation
- repo audit
- dependencies
- config
- environment handling
- theme/tokens
- navigation shell
- test foundation
- CI/preflight

## Slice 1 — Auth → Onboarding → My Wall
Complete and verify end-to-end.

## Slice 2 — Discover → Friend/Follow → Other Wall
Complete relationship states and permissions.

## Slice 3 — Text Mark → Receive → Reaction → Alert
First complete social loop.

## Slice 4 — Photo/Voice/Video Marks
Media permissions/storage/upload/rendering.

## Slice 5 — Public/Private + Approved Writers + Blocking/Reporting
Permission hardening.

## Slice 6 — Shared Walls
Create, search, open join, invite, membership, transfer, delete.

## Slice 7 — Anonymous + Secret
High-risk security slice.

## Slice 8 — Deep Links + Sharing + Account deletion + Moderation
Lifecycle and viral loop hardening.

## Slice 9 — Full polish + performance + launch readiness
Regression, builds, visual QA, security audit.

Each slice includes:
plan
→ implementation
→ tests
→ security checks
→ app/build validation
→ end-to-end verification
→ fix
→ review
→ commit
→ status update.

---

# 93. BUILD STATUS FILE — REQUIRED

Maintain:
`docs/BUILD_STATUS.md`

Update after meaningful progress.

Template:

# The-Wall Build Status

## Current Slice
...

## Completed & Verified
- ...

## In Progress
- ...

## Blocked
- ...

## Decisions Made Autonomously
- decision
- reason

## Founder Decision Required
- only if true Founder Gate

## Security/High-Risk Review
- ...

## Tests/Builds Run
- ...

## Known Issues
- ...

## Next Actions
1. ...
2. ...

This file is the restart point if the Claude session stops.

---

# 94. DECISION LOG

Maintain:
`docs/DECISIONS.md`

For meaningful technical decisions:
- date
- decision
- reason
- alternatives considered briefly
- reversibility
- Founder Gate? yes/no

Do not create bureaucracy for trivial choices.

---

# 95. WORK SESSION RESTART PROTOCOL

Whenever a new Claude Code session begins:

1. read this Master Spec
2. read `docs/BUILD_STATUS.md`
3. read relevant recent decisions
4. inspect git status/log
5. run minimum sanity checks
6. continue from highest-priority unverified item

Do not ask Founder to restate history.

---

# 96. GIT WORKFLOW

Use one repository unless existing approved structure differs.

Prefer:
- focused feature branches for substantial slices
- small coherent commits
- meaningful commit messages
- no generated junk/secrets
- no arbitrary “50 commits” target

A commit count is not a success metric.

Before merge-ready:
- clean diff
- tests/build green
- independent review for high-risk work
- docs/status updated

Do not rewrite shared history destructively.

---

# 97. ENVIRONMENT & SECRETS

Never commit:
- service-role keys
- DB passwords
- OAuth client secrets
- signing credentials
- private tokens

Only public client configuration may be exposed to mobile client as intended.

Validate required environment variables at startup/build in a safe way.

Errors should identify missing configuration without printing secret values.

---

# 98. BUILD READINESS GATE

Before declaring a slice/build ready, run applicable:

- install from lockfile
- dependency health check
- TypeScript/typecheck
- lint
- unit/integration tests
- relevant security tests
- Expo doctor if Expo
- mobile bundle/export where feasible
- config validation
- environment mapping validation
- prebuild in disposable environment if relevant

Fix issues before moving on where they block the slice.

Do not wait for EAS/TestFlight to discover obvious dependency/build failures.

---

# 99. ACCEPTANCE TEST — USER A / USER B / USER C

Use three test users where needed.

## A — New user
- signup
- onboarding
- private Wall default
- tutorial
- empty state
- share/find actions

## B — Friend
- signup
- find A
- request
- A accepts
- B views A private Wall
- B leaves text Mark
- A receives alert
- A sees Mark
- A reacts
- B sees reaction
- A opens B Wall
- A leaves Mark

## C — Unauthorized/adversarial
- cannot view A private Wall
- cannot post if not eligible
- cannot read Secret
- blocked behavior enforced

Then:
- A makes Wall public
- C can view
- C can only write if contribution policy allows

Shared Wall:
- A creates public Open Join
- B finds and joins
- posts
- A creates private Shared Wall
- invites B
- C cannot access

Anonymous:
- B posts anonymous where enabled
- A cannot discover identity in UI/API payload intended for client

Secret:
- B posts Secret
- A opens once
- second open fails
- C cannot read
- expires within 1 hour

---

# 100. SECURITY ADVERSARIAL CHECKLIST

Attempt, through legitimate test tooling:
- direct fetch of private Wall
- direct insert Mark without permission
- forged target Wall
- reaction on inaccessible Mark
- fetch anonymous author
- fetch Secret as wrong user
- reveal Secret twice
- reveal expired Secret
- self-promote Shared role
- delete Shared Wall as member
- remove Mark quota bypass
- sender edit after 10 min
- use old link after block
- access private media URL without authorization
- duplicate friend/request rows
- session expiry mid-post

Any successful bypass = blocker.

---

# 101. QA SEVERITIES

**BLOCKER**
Privacy/security loss, auth broken, data corruption, core loop impossible, app crash on key path.

**HIGH**
Major feature broken, wrong permissions without data leak, deep-link failure, unusable media flow.

**MEDIUM**
Noticeable UX bug with workaround, layout issue, secondary error state.

**LOW**
Cosmetic polish not affecting core use.

Do not ship public beta with BLOCKER.

---

# 102. FOUNDER QA — PLAIN-LANGUAGE OUTPUT

When a slice needs Founder visual/product validation, report only:

**What changed**
Plain English.

**What I verified**
Plain English.

**What you should try**
3–7 simple steps.

**What decision I need**
Only if required.

Never dump logs unless requested.

Example:

“Friends + Other Wall are ready. Please open Discover, add the test user, accept from the second account, and check whether the Other Wall screen feels clear. Engineering tests are green. I only need visual approval.”

---

# 103. DESIGN REVIEW AGAINST PROVIDED REFERENCES

For each major screen compare:
- layout hierarchy
- typography weight/scale
- Mark card feel
- spacing
- bottom navigation
- color balance
- rounded/soft tactile surfaces
- empty state
- controls
- motion

Do not copy obsolete prototype functionality merely because it appears visually.

Examples:
- reference login shows password field → production spec says OTP/social auth, so preserve visual language, not password behavior.
- reference Wall handoff mentions Mark lifespan control → current spec does not use normal Mark expiry, so do not implement it.
- reference composer stubs media → current spec requires real photo/voice/video.

---

# 104. NORMAL MARK PERSISTENCE

Normal Marks do not expire automatically by a Wall lifespan setting in this version.

They remain unless:
- owner removes under rules
- sender deletes during 10-minute window
- moderation removes
- associated Shared Wall/account lifecycle requires deletion

Secret Marks are the exception with a 1-hour lifecycle.

Do not implement the older prototype’s 12h–Forever normal Mark lifespan selector.

---

# 105. WALL CUSTOMIZATION

Do not prioritize complex visual customization before core loop works.

The screenshots demonstrate a strong default visual identity.

For MVP:
- use cohesive default Mark palette/variation
- allow only safe simple customization if already built cleanly
- do not make every user manually configure a theme before activation

Any older prototype “Mark Vibe / Scatter” controls are optional/deferred unless they already exist and do not distract from core work.

---

# 106. SOCIAL COUNTS

Show on profile/Wall:
- Friends
- Followers
- Shared Walls where useful

Do not emphasize:
- Marks sent
- Marks received
- engagement scores

Avoid vanity-metric pressure in early product.

---

# 107. SEARCH BEHAVIOR

People:
- name
- username
- case-insensitive
- partial query
- safe pagination/debounce

Shared Walls:
- public only unless invited/member
- name
- relevant description text if appropriate

Blocked relationships:
must not appear to each other in people search.

No raw database wildcard query from every keystroke without debounce/limits.

---

# 108. MEDIA LIMITS & ABUSE SAFETY

Enforce client + server where appropriate:
- 5 photos max
- voice 60s
- video 30s
- reasonable file size caps
- supported MIME types

Reject invalid/unsafe upload types.

Strip or avoid exposing unnecessary sensitive metadata where practical.

---

# 109. PUSH NOTIFICATIONS

Native push is not required for first implementation if it materially delays MVP.

In-app Alerts are required.

Design notification event/data model so push can be added later.

Do not request OS notification permission until there is a user-value moment and push actually exists.

---

# 110. LOGOUT

Logout:
- confirm only if necessary
- clear sensitive cached session state
- unsubscribe realtime
- return to welcome
- deep-link state handled safely

---

# 111. NOT-FOUND / DELETED CONTENT

If a user opens a stale link:
show:
“This isn’t available anymore.”

Actions:
- My Wall
- Discover

Never crash.

Secret after expiry uses a specific expired state before shell disappears if user is already on screen.

---

# 112. COPY STYLE

Copy should be:
- short
- conversational
- human
- confident
- not corporate
- not childish
- not technical

Examples:
Good: “Leave a Mark”
Bad: “Create content”

Good: “Your Wall is waiting for its first Mark.”
Bad: “No records available.”

Error copy should explain what user can do next.

---

# 113. APP LAUNCH STATE RESTORATION

On launch:
- restore valid auth session
- route to pending deep link if valid
- otherwise My Wall
- avoid duplicate navigation
- handle expired session cleanly

---

# 114. SESSION EXPIRY

If session expires mid-action:
- do not lose draft if practical
- prompt re-auth
- after success restore safe intended action/state
- never submit under wrong account/session

---

# 115. DUPLICATE ACTION PREVENTION

Prevent:
- double Mark post
- duplicate friend requests
- duplicate joins
- duplicate reactions
- multiple ownership transfers
- repeated report submits

Use idempotency/constraints where appropriate.

---

# 116. REAL USER DATA ONLY

Demo/seed data is allowed only in explicit development/demo environment.

Production UI must not show:
- fake friends
- fake followers
- fake Marks
- fake alerts
- fake Shared Walls
- fake “online” status

Empty states are preferable to fake activity.

---

# 117. DOCUMENTATION REQUIRED

At minimum maintain:
- this Master Spec
- BUILD_STATUS
- DECISIONS
- README setup/run/build
- environment-variable names (without secrets)
- migration notes
- test instructions
- release checklist

Keep docs current enough for another agent to resume.

---

# 118. DEFINITION OF DONE — FEATURE

A feature is done only when:

1. acceptance behavior implemented
2. authorization correct
3. loading/error/empty states exist
4. relevant tests pass
5. app/build still works
6. accessibility basics checked
7. no obvious dead end
8. no fake data/success
9. status docs updated
10. high-risk independent review complete if applicable

---

# 119. DEFINITION OF DONE — MVP CANDIDATE

MVP candidate requires:

- auth works
- onboarding works
- My Wall works
- friends/followers work
- Discover works
- Other Wall works
- Text/Photo/Voice/Video Marks work
- Anonymous works
- Secret passes one-time security tests
- reactions work
- Alerts work
- Public/Private permissions work
- Shared Walls work
- blocking/reporting works
- share/deep-link loop works at intended level
- account settings/delete path exists
- no BLOCKER bugs
- mobile build/export succeeds
- Founder visual QA completed

“Day 7” is not a reason to ship if these fail.

---

# 120. PUBLIC LAUNCH GATE

Do not publicly launch without explicit Founder approval.

Before launch provide a plain-English report:

- what works
- what is partially working
- what is blocked
- security review result
- known risks
- build status
- Founder test steps
- recommendation: READY / NOT READY

Founder chooses Ship / Do Not Ship.

---

# 121. EXECUTION COMMAND

After reading this specification:

1. inspect the current repository and design assets;
2. compare current implementation against this spec;
3. create/update `docs/BUILD_STATUS.md`;
4. create/update `docs/DECISIONS.md`;
5. identify the current vertical slice;
6. implement highest-priority unblocked work;
7. test it;
8. review it;
9. fix failures;
10. commit coherent verified work;
11. continue automatically;
12. stop only at a true Founder Gate.

Do not ask the Founder to translate technical language.

Do not wait after producing a plan if implementation is unblocked.

---

# 122. FINAL AUTONOMOUS-AGENT PROMPT

Treat this document as an executable product contract.

At all times ask yourself:

- Is this what the product spec says?
- Is the user allowed to do this?
- Is protected data truly protected?
- Does the screen have a useful next action?
- Does success return to the social loop?
- Did I test the real behavior?
- Could another user bypass this through the backend?
- Did I preserve the approved The-Wall visual identity?
- Can the next Claude session understand exactly where I stopped?

If the answer is no, the work is not finished.

**Build The-Wall from end to end.**
---

# 123. EXISTING AIOS INTEGRATION — MANDATORY

This Master Build Specification does **not** replace the existing The-Wall AIOS governance already present in the repository.

Before implementation begins, inspect and read all existing AIOS/governance material in the repository, including where present:

- `CLAUDE.md`
- `AGENTS.md`
- `docs/aios/**`
- AIOS Constitution
- Role Charters
- Definition of Done
- Workflow
- Tech Architecture
- ADRs / decision records
- security / QA / reviewer instructions

Do not ask the Founder to manually reconcile these files.

Claude must perform the reconciliation automatically.

## Authority order

Use this precedence when documents conflict:

1. Founder’s newest explicit instruction
2. `THE_WALL_MASTER_BUILD_SPEC_v1.1.md` for current product behavior
3. Existing AIOS Constitution for governance/safety/autonomy
4. Approved architecture decisions / ADRs
5. Role Charters
6. Existing implementation
7. Agent preference

The Master Spec is authoritative for **what the product must do**.

The existing AIOS system is authoritative for **how engineering work is governed, reviewed, tested, approved, handed off, and escalated**, unless this Master Spec introduces a stronger rule.

Never weaken an existing AIOS security, review, QA, Founder Gate, or Two-Key requirement.

## Automatic reconciliation task

At the beginning of the first Claude Code session:

1. Read this Master Spec.
2. Read all existing AIOS files.
3. Inspect the repository and current implementation.
4. Identify contradictions between:
   - old product behavior,
   - current Master Spec,
   - AIOS governance,
   - existing implementation.
5. Resolve product contradictions in favor of the newest Founder-approved Master Spec.
6. Preserve stronger AIOS governance/security rules.
7. Record meaningful reconciliations in `docs/DECISIONS.md`.
8. Update `docs/BUILD_STATUS.md`.
9. Continue building.

Do not stop merely because older documents are stale.

If a conflict is purely technical, choose the safest/reversible implementation and continue.

Only escalate if the conflict changes a Founder-facing product decision, privacy promise, irreversible production architecture, or launch decision.

## Required AIOS execution loop for each vertical slice

Every meaningful slice must follow:

PRODUCT CHECK
→ ARCHITECT CHECK
→ IMPLEMENTATION
→ TESTS
→ INDEPENDENT REVIEW
→ QA
→ SECURITY CHECK where applicable
→ FIX FINDINGS
→ RE-RUN CHECKS
→ COMMIT
→ UPDATE BUILD STATUS
→ CONTINUE

### Independent Reviewer requirement

The Builder must not count its own implementation assessment as independent approval.

For high-risk work, use an independent reviewer/subagent/pass with fresh review instructions and bind the review to the exact changed version/commit/diff where technically possible.

### High-risk Two-Key requirement

The following require Two-Key verification:

- authentication
- authorization / RLS
- anonymous identity
- Secret Marks
- private Personal Walls
- private Shared Walls
- Shared Wall membership/roles
- blocking
- protected media/storage
- account deletion
- destructive migrations
- security-sensitive backend functions

KEY 1:
Independent Reviewer approval.

KEY 2:
Independent QA/Security verification.

If exact code/version being reviewed cannot be established, mark the review BLOCKED rather than claiming approval.

### Founder Gate

Founder involvement is required only for actual Founder Gates.

Do not repeatedly ask the Founder to approve ordinary:
- code structure
- schemas that faithfully implement an already approved product contract
- indexing
- internal APIs
- libraries
- refactors
- test strategy
- error handling details
- implementation techniques

For a Founder Gate, explain only:

**What decision is needed**
**Why it affects the product/user**
**Options**
**Recommended option**

Avoid technical jargon unless necessary.

---

# 124. CONTINUOUS AUTONOMY / SESSION LIMIT RULE

Claude Code may encounter:
- session limits
- usage limits
- build queues
- unavailable credentials
- external service setup
- temporary tool failures

These are not reasons to lose progress.

Before any forced stop, whenever possible:

1. save all coherent work;
2. run available checks;
3. update `docs/BUILD_STATUS.md`;
4. update `docs/DECISIONS.md` if needed;
5. commit safe completed work;
6. write the exact next action.

When the next Claude Code session starts, the user should only need to say:

> Continue The-Wall build.

Claude must then:
- read the Master Spec;
- read BUILD_STATUS;
- inspect git history/status;
- continue from the next unverified item.

The Founder must not be required to re-explain the project.

---

# 125. AUTONOMOUS PROGRESS REPORT FORMAT

Do not send long engineering essays after every task.

Report to Founder only at meaningful milestones using:

## THE-WALL BUILD UPDATE

**Completed**
Plain-English description.

**Verified**
What was actually tested.

**Now building**
Next product slice.

**Blocked**
None, or exact blocker.

**Founder decision needed**
None, unless a true Founder Gate exists.

**Preview/test**
Simple instructions only when Founder action is useful.

Then continue automatically if no Founder Gate exists.

---

# 126. FIRST SESSION BOOTSTRAP — DO THIS WITHOUT ASKING FOUNDER

On the first run after this file is supplied:

1. Read the full Master Spec.
2. Read existing `CLAUDE.md`, `AGENTS.md`, and `docs/aios/**`.
3. Audit current repository state.
4. Determine which existing code is reusable.
5. Do not destroy working functionality merely to recreate it.
6. Produce a gap map: Specified / Already Working / Partial / Missing / Conflicting.
7. Create/update BUILD_STATUS and DECISIONS.
8. Run baseline tests/build checks.
9. Start Slice 0/Foundation or the earliest incomplete slice.
10. Continue implementation.

Do not ask the Founder:
“Should I start?”

The instruction to use this Master Spec is authorization to start all non-Founder-Gated work.

---

# 127. FINAL KICKOFF BEHAVIOR

When the Founder provides this Master Spec and says to build The-Wall:

DO NOT merely respond with a plan.

DO NOT restate the specification.

DO NOT wait for another prompt.

Begin repository inspection and implementation immediately.

The correct first response should be a short acknowledgement followed by tool/work execution.

If work can continue safely, continue.

Stop only for:
- a true Founder Gate;
- missing external credential/access that cannot be worked around;
- an unsafe/irreversible action requiring approval;
- an actual technical blocker after reasonable attempts to fix it.
