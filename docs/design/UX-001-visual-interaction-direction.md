# UX-001 · Visual & Interaction Direction — FTUE + Personal Wall

**Role:** Frontend (visual/interaction authority, transferred from Product Charter §4)
**Status:** DIRECTION PROPOSAL — for a Founder UI/UX Gate. Not build-ready; no code written.
**Governs under:** Frontend Charter v2.0 / Playbook v2.0 / AIOS Constitution v1.1
**Inputs:** `docs/product/PRD-001-FTUE-and-Personal-Wall.md` (structure/journey Founder-approved 2026-08-10), `docs/architecture/ADR-001-FTUE-feasibility.md`, `src/theme/*`, `src/components/*`, `app/*`
**Date:** 2026-08-10 · **Confidence on all "current build does X" claims:** Verified (read against cited files). **Confidence on user-reaction claims:** Inferred (zero users, Founder Mode).

> Scope discipline: this document defines HOW the approved experience should look and feel — visual language, interaction, motion, and the design-token direction behind them. It does **not** re-open Product's approved WHAT (journeys, scope, the seed-Mark guardrails of Decision C / §10 / AC-8, deferral of Interests and deep-link landing). Where it names a screen it describes feeling and visual moves, not a code spec. It proposes direction; the Founder chooses at the decision points in the final section.

---

## Founder UI/UX Decisions of Record (2026-08-10) — UX-001 APPROVED with modification

The Founder reviewed this direction and **approved it overall**, resolving the seven decisions in the final section as follows. These are binding and override any conflicting recommendation earlier in this doc (notably the §3 dock bullet and final-section item 2, corrected in place).

- **VD-1 — APPROVED:** Modern, clean base; physical/tactile detail concentrated where emotion matters (Marks, paper, shadows, tilt, fasteners, tactile interactions, arrival/drop animations). Navigation, forms, buttons, and general chrome stay clean and modern. Not heavily skeuomorphic.
- **VD-2 — APPROVED WITH MODIFICATION → refined into the GLOBAL `+` NAVIGATION CONTRACT (2026-08-10, supersedes the earlier VD-2 wording):** The global `+` has ONE long-term meaning — **LEAVE A MARK** — consistent everywhere. `+` must **NOT** mean *Invite*, **NOT** mean *post to my own wall*, and **NOT** mean *generic create*. Its core message is *"I want to leave something for someone"* — The-Wall is "leave something for someone," not "create a post." This aligns with the existing product spec's target-first "whose wall?" model (`docs/01_Product_Spec.md:24-43`). The future navigation model:
  - **(A) On my OWN wall:** `+` should eventually open an **eligible-recipient selector** — *"Who do you want to leave a Mark for?"* — showing only people whose walls I'm permitted to contribute to → choose recipient → choose/create Mark → Mark lands on that person's wall. **This recipient/permission system is NOT built in PRD-001** (friends/permissions infra isn't ready); but PRD-001 must **preserve this contract and introduce no conflicting `+` behavior** (i.e. `+` must not be wired to permanently mean "post to my own wall").
  - **(B) On someone else's wall, with permission:** recipient is already known → `+` → Mark composer → leave Mark. No selector needed. *(Other-person-wall viewing is future scope — not built this cycle.)*
  - **(C) On someone else's wall, without permission:** the UI must not misleadingly suggest I can leave a Mark; the eventual experience may hide/disable/replace the contribution action per the approved permissions model. *(Future scope.)*
  - **(D) Onboarding Seed Mark:** the one-time seed on my own wall is a **special onboarding mechanism, NOT the normal meaning of `+`** — it must not teach "`+` = post to myself."
  - **(E) Invite:** Invite Friends remains an important, potentially dominant CTA on an empty Personal Wall, but it is its **OWN action** — do **not** redefine `+` as Invite.
  - **This cycle's obligation:** on the owner's empty/own wall, **Invite is the dominant CTA**, the Seed Mark is the bounded one-time exception, and the `+` control is de-emphasized/contextualized **in a way that keeps its "Leave a Mark" identity intact and leaves clean room for the future recipient picker** — no misleading navigation semantics, fully reversible.
- **VD-3 — APPROVED:** Move toward two primary fonts; remove/reduce the technical mono/code aesthetic. Typography should feel social, personal, expressive — not developer-product.
- **VD-4 — APPROVED:** Retire the `//` code-comment label motif for a warmer, more natural visual language.
- **VD-5 — APPROVED:** Reduce fastener variety first — one excellent, recognizable physical fastener rather than many mediocre effects.
- **VD-6 — APPROVED:** Restrained-but-confident personality; do not overload every screen with scrapbook decoration. Marks and emotional moments carry the strongest personality.
- **VD-7 — APPROVED:** Invest motion heavily in **DROP** (a signature product interaction). Other motion (press, settle, reveal, necessary transitions) stays purposeful. No decorative animation for its own sake.

**Overriding product principle (Founder):** *My wall is interesting because other people leave things for me.* Every UX decision must reinforce this; the app must not become a self-posting feed. The empty wall must feel beautiful and intentional; Invite Friends is the natural next action on an empty wall; the one-time Seed Mark exists to teach the object and remove blank-wall discomfort — **not** to establish self-posting as the core loop. The populated wall is emotionally rewarding because it holds things *others* chose to leave.

---

## 0. A load-bearing gap in the design record

`src/theme/tokens.ts` states it was *"Ported verbatim from the design handoff (DESIGN.md + developer_handoff_spec.md)."* **Neither file exists in this repository.** The same phantom handoff is cited across the codebase as if authoritative: `Fastener.tsx` ("handoff §Elevation & Depth"), `BottomDock.tsx` ("handoff §Bottom Dock"), `Button.tsx` / `Input.tsx` ("handoff §Buttons & Inputs"), `Icon.tsx` ("the handoff ships icons as inline SVG… swap them for a library"). PRD §0 independently confirms: **there are no `.fig`/`.png`/`.svg`/mockup assets anywhere in the repo.**

Consequence: **the shipped tokens and components ARE the design system now** — the only surviving record of intent. There is no higher source to defer to and nothing to "match." That is exactly why this document exists as a Founder Gate: the visual language is being (re)authored here, from the code that survived, not recovered from a lost spec. Every proposal below is grounded in a cited file, per the Frontend Verification Rule — not in a remembered design.

---

## 1. Current-identity assessment — keep vs. challenge

### Genuinely distinctive — protect this
- **Hard-offset, zero-blur shadows** (`tokens.ts:80-102`, `shadowRadius: 0`, offset 3–5px). This is the single most ownable move in the whole system. Real apps almost never do a zero-blur offset shadow — it reads as *a physical thing casting a hard shadow under raking light*, not a Material elevation. It is the visual spine of "physical-digital." **Keep, and push harder** (see §3).
- **The inverted "written by others" model as a felt thing.** `welcome.tsx:26-31` shows a Mark from "SOFIA" *before* asking for anything — show-don't-tell. `InviteCrew.tsx` copy ("Walls are written by the people around you") nails the tone. This is the product's soul and the hardest thing to get right. **Keep the instinct; make it the organizing visual principle** (§2, §3, surfaces 5–9).
- **Paper + ink base** (`#fbf9f4` / `#0b0c0c`, `tokens.ts:11,20`). Warm off-white, near-black ink, 2px ink borders. Calm, intimate, anti-feed. **Keep.**
- **Seeded per-mark tilt** (`tiltFor`, `tokens.ts:122-127`, ±2.5°, id-seeded so it never jumps on re-render). Deterministic tilt is both charming AND technically correct — cards keep their identity across renders. **Keep the mechanism; see §3 on discipline.**
- **Functional mark-color palette** (`markColors`, `tokens.ts:34-46`). Roast = orange + mandatory ink border, secret = purple, memory = cream, award = dark+gold. Color carries *type meaning*, not decoration. Strong system thinking. **Keep; tighten usage (§3).**
- **Expression font on user content** (Bricolage on Marks and typed input, `fonts.ts`, `Input.tsx:54`). Typing in the display face makes writing on a wall feel authored, not form-filled. **Keep.**

### Weak, dated, or off-identity — challenge this
- **Unicode-glyph icons** (`Icon.tsx:21-32`: `⌂ ▦ ＋ ⌕ ☺ ◔ ⚙`). This is the most damaging single thing in the build. A dock built on `☺` and `▦` reads as an unfinished prototype, not a distinctive consumer product. Its own comment admits it's a "stand-in… replace in the polish phase." **Non-negotiable challenge: real vector icons before any redesign ships** (§3).
- **The `// LABEL` code-comment aesthetic** (`// WELCOME TO`, `// HOME`, `// ACTIVE GAME`, `// WHAT IS A WALL?` — `welcome.tsx:16`, `home.tsx:28`, `about.tsx:21`). Space-Mono, uppercase, slash-prefixed. It reads as *developer / terminal*, which is the opposite of "seen, not sold to, warm and personal" (PRD §4). It's a borrowed IDE trope, not a wall metaphor. **Challenge hard** (§3 type, surfaces 1–4).
- **The fasteners under-deliver their own promise.** `Fastener.tsx`: "tape" is a flat 50%-white rectangle with a 1px border (`:48-54`) — on paper it reads as a faint grey box, not washi tape. "pin" is a 14px circle faking a radial highlight with a single top border (`:14-36`). The *idea* (things are pinned/taped up) is the best part of the metaphor and the execution is the weakest. **Challenge: make fasteners feel real or make them fewer and better** (§3).
- **The signature "drop-in" is a lie the tokens tell.** `MarkCard.tsx:56` uses `FadeIn.duration(320)` for the realtime arrival — a plain opacity fade. Yet `tokens.ts` and `06_Tech_Architecture.md:6` both call it a "drop." The most emotional moment in the entire product — *someone just wrote on your wall, live* — is currently a fade. **Challenge: build the drop the system already claims to have** (§3 motion, surface 9).
- **Yellow is doing too many jobs.** `brandYellow`/`stickyYellow` is the FAB (`BottomDock.tsx:99`), the avatar (`profile-setup.tsx:107`, `wall.tsx:98`), the hero wall card (`walls.tsx:69`), the invite icon (`InviteCrew.tsx:36`), the About number chips (`about.tsx:36`), AND the default sticky. When everything is the accent, nothing is. **Challenge: give yellow one job** (§3 color).
- **Emoji as UI furniture** (`🤫 TAP TO REVEAL`, `🏆`, `🔒/🔮` in `MarkView.tsx`; `✦` as a brand glyph in several places). Emoji inside *user* Marks is fine and human. Emoji as *chrome/iconography* is fragile across platforms and cheapens a premium tactile feel. **Challenge for chrome; keep in user content.**
- **Three type families, and the mono one fights the brief.** Bricolage + Geist + Space Mono (`fonts.ts`). Space Mono is used for *all* metadata/labels and leans techy-utilitarian; that clashes with intimate/warm. Legitimate Founder decision (§ final). **Flag, don't unilaterally cut.**
- **Shadows currently whisper.** `shadowOpacity: 0.12–0.16` (`tokens.ts:80-102`). The most ownable move in the system is dialed down to near-subliminal. **Challenge: let it speak** (§3).

---

## 2. Experience & design principles (governs everything below)

1. **The wall is a place, not a feed.** Every surface should feel like *looking at a physical wall of things people pinned up* — depth, edges, overlap, light — not a vertical list of cards. Layout, shadow, and tilt exist to make "place," not to decorate a list. This is the visual translation of Product's inversion bet (PRD §1).

2. **Others' words are the hero; your chrome is the frame.** The most saturated color, the strongest shadow, the display type — reserved for *Marks other people left*. App chrome (nav, headers, buttons, your own seed) is deliberately quieter so that when a real Mark from a real person lands, it is unmistakably the main event. This is how the "written by others" model reads visually (Principle applied across surfaces 5–9; it is also the visual guardrail behind Decision C / AC-8 — your seed is framed *quieter* than others' Marks).

3. **Tactile with restraint — skeuomorphic soul, modern discipline.** Push the physical metaphor where it carries emotion (the Mark, the pin, the drop, the wall surface) and stay clean/modern everywhere it would only add noise (forms, nav, empty states). The target is "a beautifully art-directed physical object," not "a 2008 desktop skeuomorph." Every physical flourish must earn its place; when in doubt, remove one (Constitution §4 Practicality, §10 Delete-before-adding).

4. **Motion is physics, not decoration.** Things fall, settle, lift, and press as if they have weight and are attached to a surface. Motion always has a *cause* the user can name (I pressed it; someone posted; I arrived). No ambient looping animation, no motion-for-delight-with-no-referent. One signature moment done excellently (the drop-in) beats ten small flourishes.

5. **Honest by construction.** No fabricated fullness, ever (PRD AC-1). Empty is a designed, anticipatory state — a fresh wall waiting — not an error or a blank. The design must make "nobody's written here yet" feel like *potential*, not *failure* (PRD §4, §7).

6. **One clear next move, always.** Every first-run surface foregrounds exactly one primary action, with at most one quiet secondary. On the Personal Wall the primary gravity is always *invite* (bring others to write); the seed-Mark is the quieter secondary and disappears as a primary once used (AC-8). Never a blank stare, never three equal choices.

---

## 3. Cross-cutting system moves

These are proposals to the token/component *language*; concrete token values are set at implementation time and reported per Playbook §7. Nothing here is applied now.

### Shadow & depth — lean into the one ownable move
- **Raise the signature.** Bump the hard-offset shadow opacity up from 0.12/0.16 so "pinned paper" is felt, not guessed. Keep `shadowRadius: 0` sacred — the zero-blur is the identity.
- **Depth = importance.** Establish 2–3 discrete elevation "tiers" (a real Mark sits highest, chrome/quiet surfaces sit lowest, your own seed sits in the middle). Depth becomes a *ranking language*, reinforcing Principle 2.
- **Fix the Android truth-gap.** `tokens.ts:76-79` admits Android elevation can't reproduce a zero-blur offset and "leans on a bottom/right border trick at the component layer." Make that a *first-class, tokenized* dual-edge treatment, not an ad-hoc per-component patch — otherwise the signature look silently degrades on half the devices (Frontend Failure Recovery / Verification across the device matrix).

### Tilt — keep the mechanism, add discipline
- Keep `tiltFor` (deterministic, id-seeded — correct). Consider **narrowing the default range** (e.g. toward ±1.5–2°) so a dense wall reads as *casually pinned*, not *chaotic*, and **letting a few loud types (roast) tilt more** — tilt becomes expressive, not uniform noise. Chrome (buttons, nav, headers) should tilt **0°**; static UI that tilts reads as unstable rather than playful. The current Button press-tilt (`Button.tsx:39`, -1.5° on every press) is charming on the FAB and gimmicky on a form's submit — reserve press-tilt for *Mark-adjacent* actions.

### Fasteners — real, or fewer and better
- The tape/pin idea is worth saving; the execution isn't (§1). Two viable directions, a Founder call (§ final):
  - **Elevate:** invest in genuinely convincing fasteners — washi tape with real translucency/texture and a soft contact shadow; push-pins with a believable dome and cast shadow — used sparingly on the highest-tier Marks.
  - **Reduce:** drop the fastener to a single, perfectly-executed motif (e.g. one tape style) and let shadow+tilt carry most of the "pinned" feeling. Fewer, better.
- Either way: **a fastener is a signal, not wallpaper.** Not every card needs one; a wall where *everything* is taped reads busier than a real wall.

### Color-usage discipline — give yellow one job
- **Reserve `brandYellow` for a single meaning** — the primary "act on the wall" gesture (the ✚/create path and its direct echoes). Pull it *off* avatars, hero cards, number chips, and invite badges; let those use ink/paper/neutral so the yellow, when it appears, always means "this is how you add to a wall."
- **Keep the functional mark palette exactly as-is** (`markColors`) — it's the disciplined part. The rule: **type-color belongs to Marks; it should rarely appear on chrome.** When chrome borrows a mark color it dilutes the code that lets users read a wall at a glance.
- Color is never the *sole* signal (Constitution accessibility / Playbook §11): roast already pairs orange with a mandatory ink border — extend that pairing discipline (color + shape/label) to every state.

### Type hierarchy — warm the labels, keep the voice
- **Retire the `// slash-comment` label motif** (§1). Replace the *developer-terminal* metaphor with a *wall/label* one — small hand-label / index-card / embossed caption feeling — without necessarily deleting the mono face. The words "WELCOME TO," "WHAT IS A WALL" should feel like a caption on a scrapbook, not a code comment.
- **Protect the Bricolage-for-expression rule** (user Marks + typed input). That's the emotional core of the type system.
- **The three-family question is a genuine Founder decision** (§ final): keep Space Mono as a deliberate "machine timestamp" counterpoint, or consolidate to two families for a warmer, more consumer feel. Recommendation leans consolidate; not Frontend's call to make unilaterally.

### The bottom dock + the re-aimed ✚
- **The dock stays** — Decision A / Option C is explicit: wall-as-home *with the dock preserved* (PRD §10, ADR §3 Option C). Do not propose removing it.
- **Fix the icons first** (§1) — the dock is the most-seen chrome in the app and currently rides on unicode glyphs.
- **De-emphasize the ✚ on the owner's wall — but preserve its meaning and its future contract (VD-2 GLOBAL `+` CONTRACT, RESOLVED).** Today the ✚ routes to `/create` which self-targets the author's own wall (`create.tsx:47`, ADR §1) — i.e. on the wall-as-home surface the biggest, brightest, raised button currently means "post to your own wall," which contradicts the receive-first model and Decision C / AC-8. **Per the Founder's global `+` contract, `+` means one thing everywhere — *Leave a Mark* (for someone)** — never Invite, never post-to-self, never generic create. The fix is *gravity, not relabeling*: on the owner's own Personal Wall, **Invite Friends is the dominant CTA (its own action)**, and the `+` control is **de-emphasized / contextualized after the one-time Seed Mark** — so the owner is not nudged to keep posting to themselves. Critically, the implementation must **preserve the future contract** where, on my own wall, `+` eventually opens an *eligible-recipient picker* ("who do you want to leave a Mark for?") → composer → Mark lands on *their* wall (aligned with `01_Product_Spec.md:24-43`). The recipient picker + permissions/friends infra is **future scope, not this cycle** — but this cycle must introduce **no conflicting `+` behavior** (do not hard-wire `+` to mean post-to-self) and must leave clean room for that picker. Architect/Frontend choose the cleanest **reversible** mechanism without misleading navigation semantics.
- Keep the dock's raised/tilted FAB *character* (it's distinctive) but make sure what it *means* matches the product.

### Motion vocabulary (build this small, shared set — reuse everywhere)
- **DROP** — a Mark arriving (realtime or just-created): falls in from slightly above with a short overshoot/settle and its hard shadow snapping in on landing. This is THE signature moment (surface 9) and is currently just a fade (`MarkCard.tsx:56`) — the highest-value motion investment in the product.
- **PRESS** — tap feedback: the card/button presses *down* and its shadow *collapses* (already prototyped correctly in `MarkCard.tsx:46-52` / `Button.tsx:38-41` — generalize it as the one true tap language).
- **LIFT** — the inverse, on focus/hover where relevant.
- **REVEAL** — secret/prediction uncovering: a physical uncover, not a crossfade (today `BlurView`, `MarkView.tsx:49`).
- **SETTLE** — first paint of a populated wall: cards land in quick succession rather than appearing at once, so arriving on a full wall feels like *walking up to it*.
- Discipline: no ambient/looping motion; every motion has a nameable cause (Principle 4); respect reduced-motion at the token level (accessibility).

---

## Per-surface direction

Format per surface: **Feeling · Key visual moves · Interaction & motion · Keep · Change/Challenge (why).**

### 1. Welcome  (`app/(onboarding)/welcome.tsx`)
- **Feeling:** "Oh — this isn't another feed." Warm, intimate, a little intriguing; a hand-made object, not a growth funnel.
- **Visual moves:** The example Sofia Mark is the star of the screen, not a footnote — give it real presence (top-tier shadow, a convincing fastener, a confident tilt) so the *first* thing the user understands is what a Mark feels like. The wordmark "the wall" in big Bricolage; everything else recedes.
- **Interaction & motion:** On entry, the example Mark does a single **DROP** and settles — the product demonstrates its signature moment in the first two seconds, wordlessly.
- **Keep:** the show-don't-tell example Mark and the receive-first headline (PRD §9 calls this the best comprehension asset in the build).
- **Change/Challenge:** kill the `// WELCOME TO` code-comment label (§3 type) — it undercuts warmth in the very first impression. Reconsider the ghost secondary button styling so "I already have an account" reads as clearly secondary, not equal.

### 2. What is a Wall?  (`app/(onboarding)/about.tsx`)
- **Feeling:** one clean "aha" — *you write on other people's walls; other people write on yours.* One breath, not a three-bullet lecture (PRD §5 step 2: tighten toward the single inversion idea).
- **Visual moves:** Lead with the inversion as a single visual: two walls, an arrow of authorship between them (your Mark going *out* to a friend; friends' Marks coming *in* to you). Demote the current three numbered points to at most a light supporting caption. The yellow number-chips (`about.tsx:36`) should lose the brand-yellow (§3 color) — they're chrome.
- **Interaction & motion:** the inversion diagram can animate once — a Mark travels from "you" to "them," then two arrive back on "you" — teaching the model by motion, not paragraphs.
- **Keep:** the concept and the tightened, warm copy voice.
- **Change/Challenge:** it currently only *tells* (PRD §3 problem 4). Push it toward one *shown* idea. Repoint "Next" to `/sign-in` (Interests deferred — Decision B, ADR §2c); do not route to `/interests`.

### 3. Sign in  (`app/(onboarding)/sign-in.tsx`)
- **Feeling:** frictionless and trustworthy — get out of the user's way. This is chrome; it should be the *calmest* surface in the app.
- **Visual moves:** Maximum restraint (Principle 3). Paper, ink, one clear input, one primary action. No tilt, no fasteners, minimal shadow — a form is not a Mark. The OTP step already reads well.
- **Interaction & motion:** PRESS feedback only; nothing decorative. Clear inline validation states (email invalid, code wrong) that don't rely on an `Alert` popup alone where an inline field message is friendlier — but this is Two-Key-adjacent (auth), so any change is Verified-only and joins the auth review flow (§ note below).
- **Keep:** passwordless OTP + OAuth, low friction (PRD §9 "strong, keep").
- **Change/Challenge:** drop the `// SIGN IN` / `// CHECK YOUR EMAIL` comment labels for a warmer caption (§3). Keep visual changes minimal and treat as auth-adjacent.

### 4. Profile setup  (`app/(onboarding)/profile-setup.tsx`)
- **Feeling:** "I'm claiming *my* wall" — a small moment of ownership, warmer than a settings form.
- **Visual moves:** The tilted yellow avatar tile is a nice tactile touch — but per §3 color, the avatar shouldn't be brand-yellow; make the *identity* (name, handle) the warm focal point and let the avatar be neutral/paper until a photo is chosen. The live "@handle available ✓" is good UX; make the available/taken state a clear color+icon+text triple (not color alone — accessibility).
- **Interaction & motion:** PRESS only; the "Create my wall ✦" button is the one place a tiny celebratory beat is earned on success (a single settle, not confetti).
- **Keep:** live handle availability, auto-wall-creation (PRD §9 foundational).
- **Change/Challenge:** `// ALMOST THERE` label → warm caption. "Create my wall ✦" copy is good and on-theme; keep the sentiment. Frame the button as *creating a place*, reinforcing the payoff on the next screen.

### 5. First arrival on the Personal Wall — the "this is really mine" moment  (target: wall-as-home per Option C)
- **Feeling:** recognition and ownership — *this is my wall, and it's real (even though it's empty).* The most important emotional beat after signup (PRD §5 step 5, AC-2).
- **Visual moves:** The header must say *whose wall* unmistakably — the user's name/handle/avatar as a small identity plate at the top of the surface, so there is zero ambiguity this is *theirs* (AC-2). The wall surface itself (paper, subtle texture) is visible and inviting even with nothing on it — the "place" exists before it's filled (Principle 1). The dock is present (Option C).
- **Interaction & motion:** a gentle arrival — the header/identity settles in; the empty-state content (surface 6) is the focus, not a spinner. Avoid any fake content mid-load (AC-1).
- **Keep:** routing to the *real* wall (PRD §9; this is the honest hero replacing fake Home).
- **Change/Challenge:** this surface must be built as the *consolidated* wall-as-home (Option C, ADR §3) — not the old fake `home.tsx` (delete its fabricated content entirely, AC-1) and not a third "walls hub." One honest "this is my wall" home.

### 6. Empty Personal Wall — honest, anticipatory, exactly two actions  (`InviteCrew.tsx` elevated; PRD §7, AC-3)
- **Feeling:** anticipation, not emptiness — *a fresh page waiting to be filled*, warm and reassuring, never a dead end (PRD §4).
- **Visual moves:** Make the emptiness *designed*: the paper wall with one or two *faint, unmistakably-placeholder* pin/tape marks (empty, ghosted, clearly not real content — honest per AC-1) suggesting "things go here." One honest line ("No one's written on your wall yet") and **exactly two actions** with a clear hierarchy: **Invite (primary, the loud one)** and **Pin your first Mark (secondary, quiet)** — per Principle 6 and AC-3. Invite carries the single brand-yellow accent (§3 color) so the primary next move is unm-issable.
- **Interaction & motion:** the two actions PRESS; nothing fake animates in. If the user leaves and returns before inviting, the state is unchanged and honest.
- **Keep:** `InviteCrew`'s tone and copy ("Walls are written by the people around you") — elevate it from a buried `markCount === 0` conditional (`wall.tsx:159`, `walls.tsx:86`) to the first-run headline (PRD §8A).
- **Change/Challenge:** today the two actions are split and unequal in placement — invite is a card, "✦ LEAVE A MARK" is a tiny mono link at the very bottom (`wall.tsx:177`). **Co-present them as a deliberate two-action pair with invite dominant** (AC-3). Retire the dashed-border `InviteCrew` box styling toward something that feels like part of the wall, not a form widget.

### 7. Seed Mark creation — introduce yourself / seed, NOT feed posting  (`app/create.tsx` + writer; Decision C, AC-8)
- **Feeling:** "I'm setting the tone / leaving the first note on my own wall" — a *one-time* warm gesture, framed as seeding, explicitly not "posting to my feed" (PRD §5, §7, Decision C).
- **Visual moves:** Frame this as a **distinct, one-time seeding moment**, visually different from how *others'* Marks appear: e.g. a "start your wall" / "leave the first note" framing, and — critically — the seed, once placed, should read as *your intro* (quieter, middle elevation tier per Principle 2), not the same visual weight as a Mark from another person. This visual demotion is how AC-8 is enforced in the design: your own note never becomes the loud, repeatable hero. The type picker (`create.tsx`) is fine as a picker but its copy should say *seed/introduce*, not *post*.
- **Interaction & motion:** on submit, the seed does a single **DROP** onto the wall (teaching the signature moment by doing it once — PRD §7 "understanding by doing, once"), then the surface visibly **re-centers on invite** — the wall says, in effect, "nice — now get others to add to it."
- **Keep:** the working self-target write path (ADR §1 — already works end-to-end; only CTA + framing is new).
- **Change/Challenge:** the hard guardrail (Decision C / §10 / AC-8): **once seeded, there is no standing/repeatable "post to your wall" primary affordance.** The design must make the *ongoing* gravity be invite, and must not present the seed path as a persistent primary button on the user's own wall. **This is the crux of the ✚ re-aiming (§3 dock) and a Founder decision (§ final).** Flagged, not silently resolved.

### 8. Invite friends — the cold-start hero  (`InviteCrew.tsx`; PRD §8A, AC-4)
- **Feeling:** "This is the obvious first move" — inviting should feel generous and easy, framed as *giving people a place to say something to you*, not a growth-hack ask (PRD §4 "seen, not sold to").
- **Visual moves:** This is the one place brand-yellow should be loudest (§3 color) — the primary gesture of the whole first run. Present it as *the* headline action on the empty wall (surface 6), and make the shareable artifact feel like *your wall* (a preview of the paper surface with the user's identity), so the sender feels they're handing someone a real place, and the recipient later recognizes it.
- **Interaction & motion:** PRESS → native share sheet (already `Share.share`, `InviteCrew.tsx:12`). A small confirming beat when the sheet is invoked; no fake "invite sent" state (honesty — we can't verify delivery).
- **Keep:** the share mechanism and the receive-first message ("come leave a mark on my wall") — correct and on-model (PRD §8A).
- **Change/Challenge:** elevation and visual weight only — this is surfacing/art-direction, not new capability (ADR §1 "already works; only elevation"). Make the invite message/link feel personal and branded rather than a bare URL.

### 9. Populated Personal Wall — the payoff  (`app/wall.tsx`; realtime, filters; AC-7)
- **Feeling:** warmth, surprise, being *seen* — "look what people said about me." The moment the whole inverted bet pays off (PRD §6 state 3).
- **Visual moves:** This is where "wall as place" (Principle 1) and "others are the hero" (Principle 2) go fullest — a rich masonry of others' Marks at the top elevation tier, real fasteners, expressive tilt, the full functional color palette carrying type-meaning at a glance. Your identity plate stays small at the top; the *people's words* dominate. Filters (All / Roasts / Photos / Awards) as quiet, tactile chips (they already exist, `wall.tsx:125-147`) — keep them chrome-quiet so they never compete with content.
- **Interaction & motion:** the payoff moments — (a) **DROP** when a friend's Mark arrives live (`subscribeToWall`, `wall.tsx:74-80`), currently just a fade (`MarkCard.tsx:56`): **this is the #1 motion investment** — a real fall-and-settle with the hard shadow snapping in, so a live arrival feels like someone literally pinning something up while you watch. (b) **SETTLE** on first paint — cards land in quick succession so arriving on a full wall feels like walking up to it. (c) PRESS to open a Mark; REVEAL for secrets.
- **Keep:** realtime drop-in architecture, filters, masonry, per-type chrome (`MarkView.tsx`) — the honest hero already does what fake Home pretended to (PRD §9).
- **Change/Challenge:** build the DROP the tokens already promise (§1, §3 motion). Verify masonry balance and the drop animation with *real, varied, long/short* content across breakpoints — not placeholder text (Verification Rule; masonry uses estimated heights, `Masonry.tsx` / `estimateMarkHeight`, which can misbalance on real content). Keep the header/filters visually subordinate to Marks (Principle 2).

---

## Founder visual decisions required

Real tensions where the Founder must choose. Each carries a Frontend recommendation; the choice is the Founder's (Constitution §16 — UX/UI is Founder-gated; these are Propose-and-wait, not Act-and-report).

1. **Skeuomorphic depth vs. modern-minimal-with-tactile-accents.** How far to push the physical metaphor overall.
   - *Recommendation:* **modern-minimal base, tactile where it's emotional** (Principle 3) — clean chrome, and lavish the physicality on the Mark, the pin, the drop, the wall surface. Protects the identity without dating the product.

2. **The ✚ / seed vs. invite gravity — the sharpest one. RESOLVED per the Founder's GLOBAL `+` NAVIGATION CONTRACT (VD-2 refined).** On the wall-as-home surface, what does the big raised dock button *mean*, given Decision C forbids a standing "post to your wall" primary (AC-8)?
   - *Founder decision:* **`+` means *Leave a Mark* (for someone) — one meaning everywhere.** It is NOT Invite, NOT post-to-self, NOT generic create. Its message is *"I want to leave something for someone."* Future model: on my own wall `+` → eligible-recipient picker → composer → lands on *their* wall (per contract A–E in the Decisions of Record). **This cycle:** Invite is its own dominant CTA on the empty/own wall; the Seed Mark is the bounded one-time exception (D); `+` is de-emphasized/contextualized on the owner's wall while keeping its "Leave a Mark" identity and leaving clean room for the future picker — no conflicting `+` semantics, fully reversible. *(Supersedes the original Frontend recommendation, which proposed re-aiming `+` to mean invite — the Founder fixed `+` to mean "Leave a Mark" and gave Invite its own separate action.)*

3. **Keep three type families or consolidate to two.** Space Mono's techy tone vs. a warmer consumer feel.
   - *Recommendation:* **lean toward consolidating to two** (display + body), or deliberately re-cast the mono as a *sparse* "machine timestamp" accent only — not the voice of every label. System-wide type identity change → Propose-and-wait (Charter §8).

4. **Retire the `// code-comment` label motif?** It's distinctive but reads developer-terminal, against "warm/intimate."
   - *Recommendation:* **retire it** in favor of a scrapbook-caption / hand-label motif. Cheap to change, high impact on first impression.

5. **Fasteners: elevate vs. reduce.** Invest in genuinely convincing tape/pins, or cut to one perfect motif and let shadow+tilt carry "pinned."
   - *Recommendation:* **reduce first, elevate one** — ship one excellent fastener rather than several weak ones (Constitution §10 Delete-before-adding); revisit richer fasteners as earned polish.

6. **How loud is the personality overall?** Bold/maximal tactile character vs. restrained/premium.
   - *Recommendation:* **restrained-but-confident** — one ownable signature (the hard-offset drop-in Mark) executed impeccably, rather than many competing flourishes. Distinctiveness through one thing done unmistakably well.

7. **How far to push motion.** A single signature moment vs. motion throughout.
   - *Recommendation:* **invest almost everything in the DROP** (live/first Mark arrival) and keep everything else to PRESS/SETTLE. It's the emotional core of "someone wrote on your wall," and it's currently just a fade.

*(Adjacent, non-visual, already decided — noted so they aren't re-opened: Icon replacement (unicode → real vectors) and building the real drop animation are quality-bar fixes, not open questions; the Interests deferral, deep-link deferral, and the seed-Mark guardrails are Product-approved and out of scope to re-litigate here.)*

---

## Boundaries honored (Frontend Charter/Playbook)
- **No code written or edited.** No changes under `app/`, `src/`, or Supabase. The only file created is this document (`docs/design/UX-001-visual-interaction-direction.md`).
- **Product's approved WHAT untouched** — journeys, scope, Decision C guardrails, and deferrals are honored, not redefined (Charter §7).
- **System-wide token/identity changes flagged as Propose-and-wait Founder decisions**, not silently applied (Charter §8, Playbook §7).
- **Confidence labeled:** all "current build does X" claims are **Verified** against cited files; all user-reaction/emotional-outcome claims are **Inferred** (zero users, Founder Mode).
- **No implementation begun.** This is direction for a Founder Gate, per PRD §13 step 1.
