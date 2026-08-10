# PRD-001 · First-Time User Experience & Personal Wall

**Role:** Product · **Status:** Scope Founder-Approved (2026-08-10) — visual/interaction direction pending a separate UI/UX Founder Gate; not Build-Ready until that gate resolves + Architect Feature Plan.
**Validation Tier:** Spec-Ready (§7 Playbook). Evidence is repository-cited; user-demand evidence is **Inferred** (zero users, zero traction — Founder Mode).
**Date:** 2026-08-10 · **Author:** Product Role · **For handoff to:** Architect

> Scope discipline: this document defines WHAT the first-run and Personal Wall experience must accomplish and WHY. It does **not** specify layout, colors, components, or navigation implementation — that is Architect/Frontend authority. Where it names a screen, it names the *experience problem* on that screen, not its design.

---

## Founder Decisions of Record (2026-08-10)

The Founder has reviewed this PRD and **approved the product structure and user journey**. The decisions below are now binding and are reflected in the sections cited. The **visual/interaction experience is not yet approved** — see the Scope Modification.

- **Decision A — APPROVED (Option C):** The Home surface becomes the user's real Personal Wall experience while preserving the primary bottom navigation (bottom dock). We do **not** maintain three competing surfaces (Home / My Wall / Walls) — consolidate to one honest wall-as-home. *(Reflected in §9, §10, §12 gate #4.)*
- **Decision B — APPROVED:** Defer/remove the Interests onboarding step until Discover (or another feature) actually consumes interests. *(Reflected in §10, §12 gate #2.)*
- **Decision C — APPROVED WITH CONSTRAINT:** Allow a bounded first/seed self-Mark as an onboarding mechanism, but preserve the core principle that the Personal Wall is primarily written by **other people**. The self-Mark is strictly a first-time introduction/seed — it must **not** evolve into a conventional self-posting feed or a repeat/primary posting affordance this cycle. *(Reflected in §5 step 6, §6 state 2, §7, §10 Non-Goals, §11 AC-8, §12 gate #3.)*
- **Decision D — APPROVED TO DEFER:** Do **not** build deep-link invite landing this cycle; preserve it as an important fast-follow / viral-loop candidate with its rationale documented. *(Reflected in §8, §12 gate #1.)*
- **Decision E — ACKNOWLEDGED:** Regulated-domain / moderation / anonymity / younger-user concerns are real and must be resolved before those features harden, but do **not** block this FTUE cycle. *(Reflected in §12 gate #5.)*
- **Scope Modification — No blanket visual-redesign Non-Goal:** The Founder does **not** approve "any visual/design system rework" as a permanent Non-Goal. The product structure and user journey are approved; the **visual experience is not yet approved**. A dedicated **UI/UX direction Founder Gate** (owned by Frontend authority) will define visual/interaction direction and must be Founder-approved **before** Frontend implementation. *(Reflected in §10 Non-Goals and §13 next build step.)*
- **Global `+` Navigation Contract (Founder, 2026-08-10 — UI/UX Gate):** The global `+` control has ONE long-term meaning across The-Wall — **LEAVE A MARK (for someone)**. It is **not** Invite, **not** post-to-my-own-wall, **not** generic create. Its message is *"I want to leave something for someone"* — this is central to product identity (The-Wall is "leave something for someone," not "create a post"). This reinforces the existing target-first "whose wall?" model in `docs/01_Product_Spec.md:24-43`. Future model: on my own wall, `+` eventually opens an **eligible-recipient picker** (only walls I may contribute to) → composer → Mark lands on *their* wall; on a wall I'm permitted to write on, `+` → composer directly. **This cycle preserves the contract but does NOT build** the recipient picker, friends/permissions infra, or other-person-wall navigation (out of scope, unless already trivially supported and Architect proves it in-scope). The one-time Seed Mark (Decision C) is a special onboarding mechanism, explicitly **not** the normal meaning of `+`. Invite Friends is its own separate action (the dominant CTA on an empty wall), never `+`. This cycle must introduce **no conflicting `+` behavior**. *(Full contract A–E recorded in `docs/design/UX-001` VD-2; drives the Architect Feature Plan's `+`-treatment item.)*

---

## 0. Method & a load-bearing finding

Every claim below is grounded in the actual repository, not the spec's aspiration. Key inspection finding, stated plainly per the task:

**There are no design or prototype assets in this repo — no `.fig`, `.png`, `.svg`, or mockups.** The "design system" is code-level tokens/components (`@/theme`, `@/components`). The FTUE therefore cannot lean on prototypes that do not exist; this PRD reasons from the *shipped code's actual behavior* and the product docs, and hands the experience bar to Architect/Frontend to realize.

---

## 1. Problem statement & why now

The Wall makes a deliberate, unusual bet (`docs/01_Product_Spec.md:16-43`): it **inverts the feed**. The primary action is leaving a Mark on *someone else's* wall; your own wall is **receive-first** — "a living guestbook / yearbook" written by others. That bet is the product's whole identity — and it is also its single largest risk, because a brand-new user arrives with **no friends, an empty wall, and no one to leave a Mark for.** The one moment the bet is weakest is the first five minutes, which is exactly the moment that decides whether the user stays.

The current build handles that moment poorly and, in one place, dishonestly:

- The first screen a new user lands on after signup is a **fabricated dashboard** — "4 new Marks while you slept," a hardcoded Sofia sticky, and an "Active Game" that does not exist (`app/(tabs)/home.tsx:36, 40-52, 59-64`). A new user whose wall is genuinely empty is told, on their first screen, that things happened that did not happen.
- The core action is a **dead-end** for that same user: leaving a Mark requires someone else's wall to leave it on, but the friend system, Discover, friend-wall viewing, and the "whose wall?" picker are all unbuilt/deferred (`app/(tabs)/discover.tsx:12`, `app/create.tsx` self-targets, `docs/01_Product_Spec.md:39-43`).

**Why now:** this is the first real AIOS product cycle and no code should be written on top of a first-run flow that misrepresents state and strands the user. Fixing the FTUE is cheaper before feature build accelerates, and an honest, motivating cold-start is the prerequisite for every downstream feature (friends, discover, games) to have any users to serve.

---

## 2. Current experience assessment (evidence-cited, screen by screen)

| Screen (file) | What it does today | Assessment |
|---|---|---|
| **Auth gate** (`app/index.tsx:28-30`) | Signed-out → `/welcome`; no profile → `/profile-setup`; else → `/home`. | Routing logic is sound. Problem: the "fully set up" destination is `/home` — the fabricated dashboard, not the user's real wall. |
| **Welcome** (`app/(onboarding)/welcome.tsx:20-31`) | Value prop + an example Sofia sticky, "Get started" / "I already have an account." | **Strong.** The example Mark shows-not-tells what a Mark is; the copy captures receive-first ("written by the people around you"). Keep. |
| **About / What is a Wall** (`about.tsx:8-12`) | Three points: wall-not-feed, friends leave Marks, worth revisiting. | Good conceptual framing, but purely *told*. The user reads about the gesture without ever performing it. |
| **Interests** (`interests.tsx:33-38`) | Pick interest tags; "Helps us surface walls and people you'll vibe with." | **Payoff is missing this cycle.** Its only consumer is Discover, which is explicitly deferred (`discover.tsx:12`). A friction step that promises a benefit the build cannot deliver. |
| **Sign-in** (`sign-in.tsx`) | Passwordless email OTP + Apple/Google. | **Strong, low-friction.** Keep. |
| **Profile setup** (`profile-setup.tsx:35-44, 66-73`) | Handle (live availability), display name, bio, avatar → creates profile, DB trigger auto-creates the Personal Wall. | **Strong.** Live handle check is good UX; auto-wall-creation is the right foundation. Keep. |
| **First landing → Home** (`home.tsx:36, 40-52, 59-64`) | Greeting + "4 new Marks while you slept" + fake Active Game + hardcoded Sofia sticky. | **Broken & dishonest.** Fabricated activity shown to a user whose wall is empty. Highest-priority fix. |
| **Walls hub** (`walls.tsx:64-90`) | "MY STORY" card → `/wall`; shows `InviteCrew` when `markCount === 0`; "OUR STORY · V3" teaser. | Reasonable, but adds a *third* surface competing with Home and Wall for "where is my stuff." |
| **My Wall** (`wall.tsx:159-162`) | Real masonry of marks from Supabase, realtime drop-in, empty → `InviteCrew`. | **This is the honest hero.** It already does what Home pretends to do. The FTUE should route here, not to the fake Home. |
| **Discover** (`discover.tsx:12`) | "Trending Walls and search arrive in Phase 4." | Stub. Confirms interests has no payoff yet and that "visit another wall" has no in-app path yet. |
| **Create** (`create.tsx:12-17, 47`) | Type picker (sticky/roast/secret/memory live) → `/write/[type]`. Self-targets the author's own wall. | Works, but with no friend/target picker it can only post to *self* — the secondary action, not the star path. |
| **InviteCrew** (`src/components/InviteCrew.tsx:11-16`) | Share sheet: "come leave a mark on my wall ✦ https://thewall.app/@handle". | **The single most important cold-start lever in the build.** Correct mechanism; currently buried behind a `markCount === 0` conditional inside two secondary screens. |

---

## 3. Biggest UX/product problems (ranked)

1. **The first landing lies.** A brand-new user is shown fabricated activity ("4 new Marks while you slept," a Sofia sticky, an Active Game) on a wall that is actually empty (`home.tsx:36, 59-64`). This is a trust breach in the first ten seconds and contradicts the product's honesty-first ethos.
2. **Cold-start dead-end.** The primary action — leave a Mark on someone else's wall — is impossible for a user with no friends, and every path that would create a friend (friend system, Discover, friend-wall view, "whose wall?" picker) is unbuilt (`discover.tsx:12`, `01_Product_Spec.md:39-43`, `create.tsx`). The user lands with genuinely nothing to *do*.
3. **"Where is my stuff?" — three competing wall surfaces.** Home (fake), Walls hub, and the real Wall (`home.tsx` / `walls.tsx` / `wall.tsx`) all claim territory; first landing goes to the fake one. The user cannot form a clear model of where their wall lives.
4. **Comprehension is told, never done.** The product's core gesture is explained (`about.tsx`) but the user never performs it in onboarding; an empty wall offers no worked example on their own surface. People learn an inverted, unfamiliar model by *doing it once*, not by reading three bullets.
5. **Invite is buried, not foregrounded.** The one lever that breaks cold-start (`InviteCrew`) only appears as a conditional inside secondary screens (`walls.tsx:86-90`, `wall.tsx:159-162`), never as the headline of the first-run moment.
6. **Interests asks for effort it can't repay.** `interests.tsx` collects data whose only consumer (Discover) is deferred — friction now, payoff never (this cycle).

---

## 4. Target user & emotional tone / experience principles

**Target user (lightweight persona, Inferred — no user data yet):** Gen-Z / late-millennial who is tired of performing on polished feeds and wants something more intimate and authentic among people they actually know (`01_Product_Spec.md:12`). They arrive curious but skeptical of "another social app," and they will judge it in the first minute.

**JTBD:** *When something happens between me and the people I care about, I want a place where those people can pin what they'd say about me, so I can keep it and look back on it later — instead of it scrolling away in a chat.*

**Emotional tone — what a first-timer should FEEL:**
- **Seen, not sold to.** The product is about what others say about *you*; the first run should feel warm and personal, not like a growth funnel.
- **Curious, then "oh, I get it."** A small moment of understanding the inverted model — ideally by doing the gesture once.
- **Anticipation, not emptiness.** An empty wall should feel like *a fresh page waiting to be filled*, not a dead end. The honest framing ("nobody's written here yet") is a feature, not a failure — but only if it comes with a clear next move.
- **Never lied to.** Nothing fabricated. Trust is the whole product.

**Experience principles (standing list for this surface):**
- Show, don't tell — teach the model by letting the user perform the gesture once.
- Honest empty states over fake fullness — always.
- One clear next action on every first-run screen — never a blank stare.
- Never ask for effort we can't repay this cycle.

---

## 5. Proposed first-time user journey (goal of each step — not visual design)

Each step states its **goal** and **what it must accomplish**, not how it looks.

1. **Welcome** — Goal: communicate the one-line bet ("your story, written by the people around you") and offer new-vs-returning. Must accomplish: a skeptical visitor understands this is *not* a feed, and sees one concrete example of a Mark. *(Keep current, `welcome.tsx`.)*
2. **What is a Wall** — Goal: land the inverted model in one breath. Must accomplish: the user can answer "whose wall do I write on?" (someone else's) and "what shows on mine?" (what others write). Tighten from three told points toward the single inversion idea. *(Simplify current `about.tsx`.)*
3. **Sign in** — Goal: get them in with minimum friction. Must accomplish: account created via email OTP or OAuth with no dead ends. *(Keep current, `sign-in.tsx`.)*
4. **Claim identity (profile setup)** — Goal: establish who this wall belongs to. Must accomplish: a valid unique handle, display name, optional bio/avatar; on completion the Personal Wall exists. *(Keep current, `profile-setup.tsx`.)*
5. **First landing = the user's real Personal Wall** — Goal: put the user on the honest surface that is actually theirs. Must accomplish: they see their *actual* (empty) wall, correctly framed, with clear next moves — **never** a fabricated dashboard. *(Change: route away from fake `home.tsx`.)*
6. **First-run activation moment** — Goal: break cold-start with the two levers that actually work for a zero-friend user: **(a) invite people to write on your wall**, and **(b) pin your own first Mark** as a seed so the wall isn't dead and the user performs the core gesture once. Must accomplish: the user leaves the first session having done at least one of invite-sent or first-Mark-pinned. **Founder-decided constraint (Decision C, APPROVED WITH CONSTRAINT):** the seed self-Mark is a bounded, first-time introduction only. It is **not** a repeat or primary posting affordance this cycle — the Personal Wall stays primarily written by *other people*, and the self-Mark must not be surfaced as an ongoing "post to your wall" action once the wall is seeded.

**Success (user's view):** "I understand what this is, my wall is really mine, and I've either invited someone or left my first Mark — I have a reason to come back when someone writes on it."

**Friction points to watch:** step 6's self-Mark must be framed as *seeding your wall*, not as "posting to your feed" — it must not quietly retrain the user into feed behavior the product is trying to invert. Per Decision C this is a hard product constraint, not just a tone preference: the affordance is a one-time seed, guarded by a Non-Goal (§10) and an acceptance criterion (§11 AC-8).

---

## 6. Proposed Personal Wall journey (receive-first + cold-start resolution)

**Goal:** the Personal Wall is where the user reads what others have written about them, and — for a new user — the launchpad that turns an empty wall into a filled one.

**Steps / states:**
1. **Empty (new user):** honest framing — "No one's written on your wall yet" — paired with the two cold-start actions (invite; pin your first Mark). This is the default first-landing state and must feel like anticipation, not failure.
2. **Seeded (self-Mark pinned, still no friends):** the wall shows the user's own intro Mark, so the surface demonstrates the format and isn't barren while invites are pending. **Per Decision C (Founder-approved with constraint):** this is a one-time seed state, not the beginning of a self-posting feed. Once seeded, the wall does not present the self-Mark as a repeatable primary action; the surface continues to point the user toward inviting others so real Marks arrive from *other people*.
3. **Alive (others have left Marks):** realtime drop-in of friends' Marks (`wall.tsx:74-80` already does this); filters narrow by type. This is the payoff state the whole product points at.

**Receive-first is preserved:** the user's own Mark in state 2 is explicitly a *seed/intro*, secondary by design (consistent with `01_Product_Spec.md:33-38` "posting to your own wall is allowed but secondary") — it is a bounded exception for cold-start, not a new "post to your own feed" default.

**Cold-start resolution:** with friends/Discover deferred, the only honest levers this cycle are **invite** (pull others onto your wall) and **seed** (one self-Mark). Everything richer (visiting a friend's wall to leave a Mark) depends on the friend system and is explicitly out of scope (§10) — but the invite link is the bridge that eventually delivers those friends.

---

## 7. Empty-state strategy & "what is a Mark" comprehension strategy

**Empty state (the central tension):** Do not hide the emptiness and do not fake fullness. The empty wall's job is to (a) reassure that empty is normal and temporary, (b) explain in one line *why* it's empty (walls are written by others), and (c) offer exactly two next actions (invite, pin first Mark). `InviteCrew.tsx` already carries the right tone ("Your wall is empty… for now / Walls are written by the people around you") — elevate it from a buried conditional to the first-run headline.

**"What is a Mark" comprehension — show + do, not decorate:**
- **Show:** the Welcome example Mark (`welcome.tsx:26-31`) is a good worked example — keep it as illustration.
- **Do:** the strongest comprehension lever is letting the user *leave one Mark themselves* during first-run (the seed intro Mark). Performing the gesture once teaches the inverted model faster than any explainer screen. This is the comprehension strategy's core: **understanding by doing, once.** **Founder constraint (Decision C):** emphasis on *once* — the seed Mark is a first-time introduction, not a standing self-posting feature. Comprehension is bought with a single bounded gesture; the wall then reverts to receive-first and steers the user toward invites, never toward repeat self-posting.
- Comprehension is measured behaviorally (did they create/invite), not by whether they read the explainer.

---

## 8. Invite / visit-another-wall strategy (the cold-start breakers)

There are exactly two mechanics that break cold-start; only one is buildable this cycle.

**A. Invite (in scope, the primary lever):** Elevate `InviteCrew` from a `markCount === 0` conditional to a first-class first-run action. The share already emits a personal wall link (`InviteCrew.tsx:12`). The job: make inviting the obvious first move for a user with no friends, and make the invite message clearly say "come write on *my* wall" (receive-first), which it already does.

**B. Visit another wall & leave a Mark (deferred this cycle; documented fast-follow):** The in-app version requires friend-wall viewing + a "whose wall?" picker + the friend system — all deferred (§10). The highest-leverage cold-start breaker in the whole product is the *invited* user's path: someone taps a friend's invite link, installs, and their very first action is leaving a Mark **on that friend's wall**. That converts install → core-gesture in one step and seeds a real relationship. It requires deep-link handling that lands an invited user on the inviter's wall — a genuine scope expansion.

**Founder decision (Decision D — APPROVED TO DEFER):** deep-link invite landing is **not** built this cycle. The rationale above is preserved deliberately: this is the strongest viral-loop / cold-start candidate and is the priority **fast-follow** once the honest FTUE ships and the friend-wall view exists. Deferring is fully reversible/additive — nothing in this cycle's scope forecloses it.

---

## 9. What stays / What changes / What gets removed

### Stays (evidence it works)
- **Passwordless email OTP + Apple/Google sign-in** — `sign-in.tsx`. Low-friction, complete.
- **Profile setup with live handle availability + auto-created Personal Wall** — `profile-setup.tsx:35-44, 66-73`; `03_Acceptance_Criteria.md:15`. Foundational and good UX.
- **Welcome value prop + example Mark** — `welcome.tsx:20-31`. Best comprehension asset in the build.
- **The real My Wall surface** — `wall.tsx:74-80, 159-162`. Realtime, honest, already does what Home fakes.
- **InviteCrew share component** — `InviteCrew.tsx`. Right mechanism and tone; keep and *elevate*.
- **The "what is a Wall" concept** — `about.tsx:8-12`. Keep the idea; tighten the delivery.

### Changes (evidence of the current problem)
- **First landing must be the user's real wall, not the fabricated Home** — `index.tsx:30` routes to `/home` (`home.tsx`), which is fake. Route new users to their actual wall surface instead.
- **Elevate invite + add a seed first-Mark as the first-run activation moment** — today invite is a buried conditional (`walls.tsx:86-90`) and no seed gesture exists.
- **Tighten "What is a Wall" toward the single inversion idea and teach-by-doing** — `about.tsx` currently only tells.
- **Make the empty wall the honest, motivating default first state** — `wall.tsx:159-162` has the pieces; promote them to the primary first-run experience.

### Removed / Simplified (evidence)
- **All fabricated Home content** — `home.tsx:36` ("4 new Marks while you slept"), `:40-52` (fake Active Game), `:59-64` (hardcoded Sofia sticky). Non-negotiable: never show a new user activity that didn't happen.
- **The Interests onboarding step (defer)** — `interests.tsx`; its only consumer, Discover, is deferred (`discover.tsx:12`). Remove from first-run until Discover (or another consumer) ships, so we don't ask for effort we can't repay. *(DECIDED — Decision B, Founder-approved 2026-08-10.)*
- **Consolidate the three competing wall surfaces into one honest wall-as-home** — Home vs Walls hub vs Wall (`home.tsx`/`walls.tsx`/`wall.tsx`). *(DECIDED — Decision A, Option C, Founder-approved 2026-08-10.)* The Home surface becomes the user's **real Personal Wall experience** while the primary bottom navigation (bottom dock) is preserved. We do **not** keep three competing surfaces; the experience requirement is one clear "this is my wall" home. The exact IA/implementation remains Architect/Frontend's call within that decided direction.

---

## 10. MVP scope for THIS cycle

**In scope (shippable, honest cold-start):**
- Honest first landing: a newly-signed-up user lands on their *actual* Personal Wall, never fabricated activity.
- **Wall-as-home consolidation (Decision A, Option C):** the Home surface becomes the user's real Personal Wall experience, the primary bottom navigation (bottom dock) is preserved, and the three competing surfaces (Home / My Wall / Walls) collapse to one honest "this is my wall" home.
- Remove all fake data from the current Home surface.
- Streamlined onboarding: Welcome → What is a Wall (tightened) → Sign in → Profile setup. **Interests step deferred/removed (Decision B — DECIDED).**
- A strong Personal Wall empty state: honest framing + exactly two next actions (invite, pin first Mark).
- Elevated invite flow as a first-class first-run action.
- Seed first-Mark: the user may pin **one** intro Mark to their own wall during/after first-run (bounded, first-time self-target seed — Decision C, guarded by the Non-Goal below and AC-8).

**Explicitly out of scope (Non-Goals — as load-bearing as the goals):**
- **Self-Mark as a repeat or primary posting affordance (Decision C guardrail).** The seed self-Mark is a one-time introduction only. This cycle does **not** turn the Personal Wall into a self-posting feed: no standing "post to your wall" button, no repeat self-Mark flow, no self-authored content presented as the wall's primary input. The wall stays primarily written by *other people*.
- Friend system (search, request, accept) — deferred (`03_Acceptance_Criteria.md:74-79`).
- Discover / trending / search — deferred (`discover.tsx:12`).
- Viewing another user's wall in-app and the "whose wall?" target picker — deferred (`01_Product_Spec.md:39-43`).
- Deep-link invite landing on the inviter's wall — **deferred this cycle (Decision D)**; preserved as the priority fast-follow (§8).
- Games, notifications/push, reactions/comments — not part of this cycle.
- New Mark types beyond what already ships (poll/award/prediction/doodle writers) — untouched.
- Shared Walls — V3, teaser only (`walls.tsx:94-130`).
- **Visual/interaction direction is not a permanent Non-Goal.** The Founder has *not* foreclosed a visual/design-system redesign. The product structure and journey are approved here; the **visual experience is being defined separately in a dedicated UI/UX direction Founder Gate (owned by Frontend authority)** and must be Founder-approved before Frontend implementation (§13). This PRD does not specify visual design, but it no longer rules a redesign out of scope.

---

## 11. Acceptance criteria (behavioral, testable — for QA)

**AC-1 — No fabricated activity, ever**
Given a newly-created account with an empty wall and no friends, When the user reaches their first landing surface, Then no activity counts, sample Marks, or games that did not actually occur are shown (specifically: none of "N new Marks while you slept," the hardcoded Sofia sticky, or a fake Active Game appear).

**AC-2 — First landing is the user's own real wall state**
Given a user completes profile setup, When the auth gate routes them onward, Then they arrive on a surface that reflects their real wall's actual contents (empty for a new user), identifiable as *their* wall.

**AC-3 — Honest, actionable empty state**
Given a user is on their Personal Wall with zero Marks, When the wall renders, Then they see an honest "no one's written here yet" framing and exactly two available next actions: invite people, and pin their first Mark.

**AC-4 — Invite is reachable in the first session**
Given a new user in their first session, When they choose to invite, Then a share action opens carrying a personal link to their wall inviting others to leave a Mark on it.

**AC-5 — Seed first Mark performs the core gesture**
Given a new user with an empty wall, When they choose to pin their first Mark and submit valid content, Then that Mark appears on their own wall, and the wall is no longer in the empty state.

**AC-6 — Streamlined onboarding, no dead-payoff step**
Given a user going through onboarding this cycle, When they progress from Welcome to their wall, Then they are not asked to complete the Interests step (deferred per Decision B), and no onboarding step promises a capability the build cannot deliver this cycle.

**AC-7 — Returning user with real Marks sees only real Marks**
Given a user whose wall has real Marks left by others, When they open their wall, Then they see those actual Marks (with live drop-in of new ones) and no fabricated content.

**AC-8 — Seed self-Mark is a one-time seed, not a repeat/primary posting affordance (Decision C guardrail)**
Given a user who has already pinned their seed first Mark (wall no longer empty), When they view their Personal Wall this cycle, Then the interface does not present a standing or repeatable "post to your own wall" action, and the only foregrounded next action toward filling the wall is inviting others — i.e., the self-Mark cannot be used as an ongoing primary posting mechanism this cycle.

---

## 12. Founder decisions on the product gates (RESOLVED 2026-08-10)

These were true product decisions (they change WHAT we build, are user-facing, or are scope trade-offs) — not implementation choices. Product recommended; the Founder has now decided. Each gate below records its resolution.

1. **Deep-link invite landing (the strongest cold-start breaker).** Should an invite link, opened by a new user, route them to leave a Mark on the *inviter's* wall as their first action? **Recommendation:** high value, but it expands scope (requires friend-wall view + deep-link handling). **DECIDED — DEFER (Decision D):** not built this cycle; preserved as the priority fast-follow / viral-loop candidate with rationale documented in §8. *Reversible: yes (additive).*
2. **Defer the Interests onboarding step.** Remove it from first-run until Discover exists? **Recommendation:** yes — it asks for effort with no payoff this cycle. **DECIDED — YES (Decision B):** deferred/removed until a real consumer of interests ships.
3. **Seed self-Mark as a first-run action.** Endorse letting a new user pin one intro Mark to their own wall, as a bounded exception to receive-first, to break cold-start and teach the gesture? **Recommendation:** yes, framed as "seed your wall," not "post to your feed." **DECIDED — APPROVED WITH CONSTRAINT (Decision C):** allowed as a bounded first-time seed only. It must **not** become a conventional self-posting feed or a repeat/primary posting affordance this cycle; the wall stays primarily written by other people. Guarded by the §10 Non-Goal and §11 AC-8.
4. **Wall-surface consolidation (IA).** Make the user's Wall the single honest landing surface and collapse the Home/Walls redundancy? **Recommendation:** yes in principle; exact IA is Architect/Frontend's. **DECIDED — APPROVED, Option C (Decision A):** the Home surface becomes the user's real Personal Wall experience while the primary bottom navigation (bottom dock) is preserved; the three competing surfaces consolidate to one honest wall-as-home. Exact IA/implementation stays within Architect/Frontend authority.
5. **Regulated-domain flag (Constitution §23).** The audience skews Gen-Z / potentially under-18 (`01_Product_Spec.md:12`), and the product centers anonymous Marks and "roasts" among peers — an age-sensitive + safety surface. **ACKNOWLEDGED (Decision E):** the Founder acknowledges these regulated-domain / moderation / anonymity / younger-user concerns are real and **must be resolved before those features harden** — but they are **not resolved here and do not block this FTUE cycle**, which builds none of those features. This remains an open concern to carry forward, not a gate on this cycle.

---

## 13. Recommended next build step

Status of the prior gates: the five §12 gates are **RESOLVED** (Decisions A–E, 2026-08-10) and the Architect Complexity Estimate on the in-scope slice is **complete** (`docs/architecture/ADR-001-FTUE-feasibility.md` — the slice is Small, Frontend-only, reversible; Backend ≈ 0% unless the deferred deep-link gate is later greenlit). The remaining sequence, per the Founder's scope modification, is:

1. **UI/UX direction Founder Gate (next):** Frontend (visual/interaction authority) proposes the visual/interaction direction for the approved journey; **Founder approves** the visual direction before any implementation. The product structure/journey are approved here; the visual experience is approved *there*.
2. **Architect Feature Plan:** once the visual direction is approved, Architect pins the IA change (Decision A / Option C) and the build plan to Build-Ready.
3. **Frontend implementation** of the approved journey + approved visual direction → **Reviewer** → **QA against §11 (AC-1…AC-8)**.

**Do not begin implementation** until the UI/UX direction is Founder-approved and the Architect Feature Plan is issued — this PRD's *structure* is approved, but it is not Build-Ready until visual direction + Feature Plan land.

---

## Assumptions (calibrated confidence)

- **ASSUMPTION-1:** New users judge the product in the first minute and fabricated activity erodes trust. *Confidence: Inferred* (no user data; strong general product principle). *Breaks if:* user testing shows fake "social proof" boosts activation without trust cost.
- **ASSUMPTION-2:** For a zero-friend user, invite + one seed Mark are the only honest cold-start levers this cycle. *Confidence: Verified* against the repo — friend system/Discover/friend-wall are unbuilt (`discover.tsx:12`, `01_Product_Spec.md:39-43`).
- **ASSUMPTION-3:** Performing the Mark gesture once teaches the inverted model better than an explainer screen. *Confidence: Inferred* (learn-by-doing heuristic; no user data yet).
- **ASSUMPTION-4:** The Interests step has no user-facing payoff this cycle. *Confidence: Verified* — its only consumer, Discover, is deferred (`discover.tsx:12`).

## Kill / failure criteria
- If, once instrumented (`10_Analytics.md`), the majority of new users who reach their wall neither send an invite nor pin a first Mark in their first session, the activation design has failed — revisit the cold-start model rather than layer more onboarding copy on top.
