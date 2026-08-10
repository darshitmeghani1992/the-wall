# FP-001 · Feature Plan — FTUE & Personal Wall (Build-Ready)

**Role:** Architect · **Status:** BUILD-READY (pending Founder Implementation Gate on this plan)
**Governs under:** Architect Charter v2.1 / Playbook v1.1 / AIOS Constitution v1.1
**Supersedes advisory:** `docs/architecture/ADR-001-FTUE-feasibility.md` (pre-approval estimate — still valid as the feasibility record; this plan is the build artifact)
**Inputs (both Founder-approved):** `docs/product/PRD-001-FTUE-and-Personal-Wall.md` (scope §10, AC-1…AC-8, Decisions A–E) · `docs/design/UX-001-visual-interaction-direction.md` (VD-1…VD-7)
**Confidence:** all "current code does X" claims **Verified** against cited files; user-reaction claims inherited from PRD/UX are **Inferred** (zero users, Founder Mode).

> Scope discipline: this turns the approved WHAT (PRD) and approved LOOK/FEEL (UX-001) into a file-by-file build plan. It does not re-open product scope or visual direction. It is **frontend-only, reversible, and requires no backend/schema/RLS/auth change**. The one item that would require a backend/authz change (deep-link invite landing) is out of scope and flagged separately in §14.

---

## 1. Complexity Estimate

| Field | Value |
|---|---|
| **Tier** | **Medium** (spans multiple surfaces + shared design-system/token changes + a navigation restructuring; no schema/auth/payment/public-API/infra → **not** High-Risk, **not** design-level Two-Key) |
| **Complexity** | Moderate |
| **Rough effort** | ~2–4 agent sessions, one implementation Role (Frontend) |
| **Files affected** | ~20 (app screens, dock, mark components, theme tokens, one new feature folder, one new motion module) — all UI |
| **Database impact** | **None.** No migration, no new column, no RLS change. |
| **Dependency risk** | **Low.** One icon library (`@expo/vector-icons`, Expo-canonical) — see §9. No other new dependency. |
| **Operational risk** | **Low.** UI-only, no auth/payments/public UGC surface added; all two-way-door. |

**Build-readiness posture:** **READY.** Both blockers named in ADR-001 §8 have cleared — the five PRD §12 gates are Founder-resolved (Decisions A–E) and the IA direction is decided (Option C). No High-Risk item exists in this slice, so no independent Two-Key design review is required; the gate on this plan is the Founder Implementation Gate (§16).

---

## 2. Goal

Replace a first-run that fabricates activity (`home.tsx`) and strands a zero-friend user, with an honest wall-as-home: the user lands on their real (empty) Personal Wall, is offered exactly two truthful cold-start actions (invite dominant, one-time seed quiet), and the app's signature tactile identity (real icons, the DROP, one fastener, disciplined shadow/tilt/color/type) is realized. The seed self-Mark stays a one-time introduction and never becomes a self-posting feed (Decision C / AC-8), enforced through affordance de-emphasis, not new backend logic.

---

## 3. Required implementation Role(s) & sequencing

- **Frontend — ~100% of this slice.** Every in-scope item is UI, navigation, copy, tokens, or motion.
- **Backend — 0%.** No schema, endpoint, RLS, or auth change. Confirmed against `0001_init.sql` (§8). Backend is pulled in only if the deferred deep-link invite (§14) is later greenlit — which is a separate High-Risk / Two-Key / Founder-gated slice, **not** this one.
- **Architect — this plan + the two ADR-level decisions recorded in §15.** No production code.
- **Downstream:** Frontend → **Reviewer** (independent, re-executes) → **QA** against AC-1…AC-8. QA only after Reviewer APPROVE.

No cross-Role API contract to negotiate (single Role). Sequencing is intra-feature only (§13).

---

## 4. Determination 1 — Exact screens affected (file-by-file)

| File | Change | Drives |
|---|---|---|
| `app/index.tsx` | **UNCHANGED.** Already redirects a fully-set-up user to `/home`; `/home` now renders the real wall, so the gate needs no edit. | AC-2 |
| `app/(tabs)/_layout.tsx` | Remove `<Tabs.Screen name="walls" />`. Tabs become Home · Discover · Profile; the center dock `+` is de-emphasized/hidden this cycle (§8, refined VD-2). | Decision A / Option C |
| `app/(tabs)/home.tsx` | **Delete all fabricated content** (`:36` "4 new Marks", `:40-52` fake Active Game, `:59-64` Sofia sticky, `// HOME` label). Render `<PersonalWall/>` (§6). | AC-1, AC-2, Decision A |
| `app/(tabs)/walls.tsx` | **Remove** (third competing surface). Its `InviteCrew` usage already lives in the wall empty state. Shared-Walls "OUR STORY · V3" teaser retires with it (future scope — reversible; re-homed when Shared Walls ships). | Decision A / Option C |
| `app/(tabs)/discover.tsx` | **UNCHANGED** (stub, deferred). | — |
| `app/(tabs)/profile.tsx` | Cosmetic only: avatar tile off `brandYellow` (yellow-one-job, §7); inherits dock FAB behavior (§8/§13). | VD-1, VD-6 |
| `app/wall.tsx` | Body extracted to `PersonalWall` (§6). File becomes a thin `<Redirect href="/home" />` — a legacy shim so nothing that references `/wall` breaks (reversible; the real surface is now the Home tab). | Decision A / Option C |
| `app/create.tsx` | Copy reframe from generic "post" toward **seed/introduce** ("Start your wall" / "Leave the first note"); type picker mechanics unchanged. | Decision C, AC-5, VD (surface 7) |
| `app/write/[type].tsx` | Post-submit route change: `/wall?justCreated=<id>` → `/home?justCreated=<id>` so the seed DROP plays on the consolidated wall-as-home. Writer/preview/`createMark` logic unchanged. | AC-5, DROP |
| `app/(onboarding)/welcome.tsx` | Retire `// WELCOME TO` (VD-4); example Sofia Mark gets DROP-on-entry + top-tier presence (VD-7, §5); make "I already have an account" read clearly secondary. | VD-3/4/7 |
| `app/(onboarding)/about.tsx` | Retire `// WHAT IS A WALL?`; tighten toward the single inversion idea; number-chips off `brandYellow`; **"Next" → `/sign-in`** (skip Interests, Decision B). | Decision B, AC-6, VD-3/4 |
| `app/(onboarding)/sign-in.tsx` | **Auth logic strictly UNTOUCHED.** Optional cosmetic-only `//`-label retire; auth-adjacent, lowest priority, may defer. See §12. | VD-4 (cosmetic) |
| `app/(onboarding)/profile-setup.tsx` | Cosmetic: `// ALMOST THERE` → warm caption; avatar off `brandYellow`; handle availability as color+icon+text triple (not color alone — accessibility). Live-handle + auto-wall logic unchanged. | VD-3/4, accessibility |
| `app/(onboarding)/interests.tsx` | **Now unreachable** (edge removed from `about.tsx`). File left dormant, not deleted — Decision B keeps interest storage harmless. Tracked as minor dead-route debt (§17). | Decision B |

---

## 5. Determination 5 — Animation architecture (do early; underpins §7/§8)

reanimated `~3.10.1` is already a dependency; `MarkCard` already uses it. No new animation dependency.

- **New shared module `src/theme/motion.ts`** — motion tokens only: durations, easings, drop distance/overshoot, and a **reduced-motion** flag (read from `AccessibilityInfo` / reanimated reduced-motion config). Single source of truth for timing; every primitive references it. Exported via `src/theme/index.ts`.
- **DROP** — replace `MarkCard.tsx:56` `FadeIn.duration(320)` with a real fall-and-settle: translateY from above → short overshoot → settle, with the hard offset shadow snapping in on landing. The DROP builder lives **with `MarkCard`** (the mark container owns its entrance); it consumes `motion.ts` tokens. This is THE signature moment (VD-7) and the #1 motion investment.
- **PRESS** — already prototyped correctly in `MarkCard.tsx:46-52` and `Button.tsx:38-41`; **generalize the values into `motion.ts`** so it is one shared tap language. Reserve press-**tilt** for Mark-adjacent controls only (not the form Submit) per VD tilt discipline.
- **SETTLE** — first paint of a populated wall: cards land in quick succession (stagger) rather than all at once. Implemented at the wall/masonry render boundary (§6).
- **REVEAL** — secret uncovering stays a physical uncover (existing `BlurView`, `MarkView.tsx:49`); keep, just bring under the shared vocabulary.
- **Reduced-motion (Non-Functional / accessibility):** every primitive degrades to fade/instant when reduce-motion is on. Mandatory, token-gated.

*Boundary:* the reanimated implementation detail (worklets, keyframes) is Frontend's; this plan fixes **where motion lives, what the primitives are, and the reduced-motion requirement**.

---

## 6. Determination 3 — Navigation changes (Option C, concrete)

**The one real restructuring in this slice** (ADR-001 §3 hidden coupling). `app/wall.tsx` is a standalone route outside the `(tabs)` group; the honest wall must become the Home tab while keeping the dock.

Concrete IA (recommended, decided as ADR-FP-A in §15):

1. **Extract** the wall body from `app/wall.tsx` into a reusable component **`src/features/personal-wall/PersonalWall.tsx`** (Search-Before-Create: reuse the shipped, working wall logic — realtime `subscribeToWall`, filters, masonry, empty-state — do not rewrite). It accepts an optional `justCreatedId?: string` for the DROP.
2. **`(tabs)/home.tsx` renders `<PersonalWall/>`** and nothing else fabricated. The Home tab **is** the user's real wall. Because `index.tsx` already targets `/home`, the auth gate needs no change.
3. **`app/wall.tsx` → `<Redirect href="/home" />`** (thin, reversible shim). The writer is repointed to `/home?justCreated=` (§4), so the seed still DROPs on the consolidated surface.
4. **Remove the `walls` tab** from `(tabs)/_layout.tsx` and from `BottomDock`'s slot layout — this is the "collapse three surfaces to one" half of Decision A.

**Dependency direction (Playbook §10):** `PersonalWall` lives under `src/features/` and may use `src/components/*` and `src/lib/*`; `app/(tabs)/home.tsx` (composition root) imports it. Clean, one-way.

**Reversibility:** every step is git-revertable, UI-only, no data change. Two-way door.

---

## 7. Determination 4 — Reusable design-system / component changes (flag wide ripple)

All within approved VD-1…VD-7. **Two changes ripple widely — flagged for a deliberate Reviewer visual pass:**

- **Type: retire the mono "voice" (VD-3, WIDE RIPPLE).** `type.label` in `fonts.ts` currently uses `SpaceMono-Bold` and is used on nearly every screen (section labels, `AuthorLine`, timestamps). Re-point the `label` variant to a Geist-based treatment (uppercase, letter-spaced) for warmth; keep the `mono` token in the file for sparse literal timestamps only. This touches every `variant="label"`. Reversible (one token edit + optional per-site tweaks).
- **Color: give `brandYellow` one job (WIDE-ISH RIPPLE).** Reserve `brandYellow` for the "act on the wall / create + its direct echo, Invite." Pull it **off** avatars (`profile.tsx`, `profile-setup.tsx`, `wall.tsx` header), hero cards, number chips (`about.tsx`), and the invite badge glyph — those go ink/paper/neutral. **Keep `markColors` (functional per-type palette) exactly as-is** — it is the disciplined part; type-color belongs to Marks, rarely to chrome.

Narrower, lower-ripple token/primitive changes:

- **Shadow tiers (`tokens.ts`):** establish 2–3 discrete elevation tiers (real Mark highest, chrome lowest, own seed middle — Principle 2 ranking language); bump `shadowOpacity` up from 0.12/0.16 so "pinned paper" is felt; keep `shadowRadius: 0` sacred; make the Android dual-edge fallback a first-class tokenized treatment (`tokens.ts:76-79` gap).
- **Tilt discipline (`tiltFor`):** narrow default range (~±1.5–2°); allow loud types (roast) to tilt more; chrome tilts 0°. Reserve `Button` press-tilt for Mark-adjacent actions.
- **Fasteners (VD-5, `Fastener.tsx`):** **reduce to one excellent motif** (a convincing tape or pin with real contact shadow); a fastener is a signal, not wallpaper — not every card gets one. Retire the weaker second kind.
- **Icons (`Icon.tsx`):** see §9.
- **Emoji-as-chrome retire:** `🤫`/`🏆`/`🔒`/`🔮`/`✦`-as-glyph in `MarkView.tsx` / `InviteCrew.tsx` → real icons or type treatment. Emoji inside **user** Mark content stays (human, fine).

`Text.tsx` primitive is unchanged — it consumes tokens.

---

## 8. Determination 2 & 10 — Components affected + the VD-2 `+` treatment (the subtle crux)

### Components
- **`Icon.tsx`** — internal glyph map swapped unicode → real vectors; **public API (`name`, `size`, `color`, `IconName`) held stable** (§9).
- **`BottomDock.tsx`** — (a) now renders real icons; (b) rebalance slots after `walls` removal (Home left; Discover, Profile right; even distribution, and an even 3-tab layout when the FAB is hidden); (c) the FAB de-emphasis mechanism below.
- **`MarkCard.tsx`** — DROP replaces FadeIn (§5); PRESS generalized; shadow tiers; tilt discipline.
- **`MarkView.tsx`** — per-type chrome maps to the new shadow tier (others' Marks = top tier, own seed = middle — Principle 2); emoji-chrome → icons; feeds SETTLE.
- **`Fastener.tsx`** — reduced to one motif (§7).
- **`Masonry.tsx`** — verify balance on real varied content (risk R2); host the SETTLE stagger.
- **`Button.tsx`** — press-tilt reserved for Mark-adjacent (§7).
- **`InviteCrew.tsx`** — elevated into the two-action empty state (§10 below).
- **New `src/features/personal-wall/PersonalWall.tsx`** (§6) and an **`EmptyWall`** piece (§10).

### The `+` control — Global `+` Navigation Contract (refined VD-2; Architect fixes the mechanism as ADR-FP-B, §15)

**The refined contract (supersedes the earlier "create / leave a Mark" wording — UX-001 VD-2 A–E, PRD-001 "Global `+` Navigation Contract"):** `+` has **ONE** long-term meaning everywhere — **LEAVE A MARK (for someone)**, *"I want to leave something for someone."* It is **NOT** Invite, **NOT** post-to-my-own-wall, **NOT** generic create. Its future model: on my own wall `+` eventually opens an **eligible-recipient picker** → composer → the Mark lands on *their* wall (needs the friends/permissions infra — **not built this cycle**). Invite is its own separate action, never `+` (E). The one-time onboarding Seed Mark is a **special mechanism, explicitly not the meaning of `+`** (D). This cycle must introduce **no conflicting `+` behavior**.

**Consequence for this cycle (the key change): the dock `+` is NOT wired to the seed.** The seed self-target write path exists and works, but routing the global `+` to it — even pre-seed — would teach exactly the "`+` = post to myself" semantic the contract forbids (D). And `+`'s one true meaning ("leave a Mark for someone") has no buildable target this cycle (no recipient picker, no other-person walls). Therefore:

- **On the owner's own wall this cycle (the only wall surface that exists), de-emphasize / hide the dock `+`.** It never self-targets and never acquires a misleading meaning. The FAB's single tap-target indirection is preserved in code so the future recipient-picker step slots in with no rework (see §8A).
- **The one-time Seed is reached ONLY through its own dedicated EmptyWall CTA** ("Leave the first note" / "Pin your first Mark", §10/§11) — a special onboarding affordance, visually distinct from `+`.
- **Invite is the dominant CTA** on the empty/own wall (the single loud `brandYellow`), always its own action (E).

**Driving state — derived from existing data, no schema:**
`hasSeeded` = *the signed-in owner has authored ≥1 active Mark on their own Personal Wall*, computed from Marks the wall already loads: `marks.some(m => m.author_id === session.user.id)` (or an additive read-only count mirroring the existing `walls.tsx` `markCount` pattern — **no new column, no contract change**). `isEmpty` = `marks.length === 0`. `hasSeeded`/`isEmpty` govern **only the dedicated Seed CTA and empty-state** (Seed CTA present when `isEmpty && !hasSeeded`; gone once `hasSeeded`, enforcing AC-8). They do **not** govern the dock `+` — the `+` is de-emphasized/hidden on the owner's wall for the whole cycle (until the recipient picker ships), independent of seed state.

**Why hide, not disable, and not self-target:** a greyed dead control violates Least Surprise (Constitution §9); a self-targeting `+` violates the contract (D). Hiding the `+` on the owner's own wall — where its real action isn't buildable yet — is the only option that keeps `+`'s identity clean and is fully reversible (a single render-gate). Because the owner's own wall is this cycle's only wall surface (and no other-person "leave a Mark" target exists), the `+` has no valid in-scope action anywhere this cycle; the dock renders an even tab layout without the raised FAB, with the tap-target indirection retained (§8A).

**Wiring:** `BottomDock` (drawn at the `(tabs)` layout) hides the FAB this cycle; `EmptyWall`/`PersonalWall` own the Seed CTA and read `hasSeeded` via one lightweight Marks-sourced read (single source of truth — no second global store, Playbook §13).

**Reversibility:** two-way door — restore the FAB by re-enabling the render-gate; the seed CTA is a conditional. **Reviewer + QA must verify AC-8, that `+` never self-targets or reads as "Invite," and that nothing teaches a `+` meaning that conflicts with the contract.**

---

## 8A. Determination 13 (new) — Preservation of the future eligible-recipient-picker contract

The Founder asked explicitly that this plan leave clean room for `+` → **eligible recipient → Leave a Mark** to slot in later **without rework or conflicting semantics**. How this plan preserves it:

1. **`+` is never wired to self-target this cycle.** The dock `+` is de-emphasized/hidden on the owner's own wall (§8); it does not route to `/create` or any self-post path. So no code and no user-visible behavior this cycle teaches "`+` = post to myself" or "`+` = create" — nothing to unlearn when the picker ships.
2. **Single tap-target indirection is retained.** `BottomDock`'s FAB press handler stays a **single indirection point** (today it is `router.push("/create")`; this cycle it is hidden, not deleted). The future recipient-selection step occupies exactly that one handler: `+` → *"Who do you want to leave a Mark for?"* (eligible-recipient picker) → composer → Mark lands on the recipient's wall. No structural change to the dock is needed then beyond swapping that one route and un-hiding — the FAB's raised/tilted character and slot are preserved in code (behind the render-gate), not removed.
3. **The seed uses a separate, clearly-onboarding entry point** (the EmptyWall CTA, §10/§11), so the seed mechanism never occupies or contaminates the `+` handler. When `+` gains its real meaning, the seed CTA (a bounded onboarding affordance) is orthogonal and can be retired independently.
4. **Invite stays its own action** (its own CTA/button, §10), never the `+` — so `+` is never spent on Invite semantics either (E).
5. **No other-person-wall navigation, recipient picker, friends/permissions infra, or RLS `contribution_policy` change is built** (§12, §14) — those are the future contract's dependencies and are correctly deferred; this cycle neither builds nor blocks them.

**Confirmation:** nothing in this cycle contradicts the Global `+` Navigation Contract. `+` acquires no meaning this cycle (it is contextually hidden where its real action isn't yet buildable); the seed and invite live in their own dedicated affordances; the dock's single FAB indirection is preserved for the future recipient picker to occupy. Fully reversible, frontend-only, no schema/RLS/auth change.

---

## 9. Determination 6 — Icon strategy

Replace the unicode-glyph `Icon.tsx` (`⌂ ▦ ＋ ⌕ ☺`) — the single most prototype-looking thing in the build — with real vectors.

**Recommendation: `@expo/vector-icons` using the Feather set.**
- Feather is clean 24px / 2px-stroke monoline — matches the handoff's stated "Lucide / SF Symbols, 24px, 2px stroke" intent (`Icon.tsx:3-8`).
- **Font-glyph based → needs no `react-native-svg`** (confirmed absent from `node_modules`, §Discovery). Expo-canonical; the lowest-cost path.
- **Keep `Icon.tsx`'s public API and `IconName` union stable** — swap only the internal mapping (unicode → Feather names). Drop-in; every call site (`BottomDock`, etc.) is untouched. AI-native "stable interface" win.

**Dependency call-out (Playbook §17):** `@expo/vector-icons` normally ships with the Expo SDK; it is **absent in this pruned sandbox `node_modules`** (Verified). Treat as: install via `npx expo install @expo/vector-icons` if not resolved by the toolchain. Font-based, well-maintained, Expo-first-party, negligible bundle cost, permissive license. **A dependency add is not a backend/schema change**, but it is called out here for a deliberate yes.

**Alternative (not recommended):** `lucide-react-native` matches the handoff name exactly but pulls in **two** new deps (`lucide-react-native` + `react-native-svg`, both absent) — more surface for no meaningful gain over Feather. Flag only if the Founder wants pixel-exact Lucide.

Reversible either way (revert the mapping).

---

## 10. Determination 7 & 9 — Empty state + Invite behavior

**Empty state (AC-3):** elevate `InviteCrew` from a buried `markCount===0` conditional into the **first-run headline** on `PersonalWall`, presented as a deliberate **two-action pair**:
- **Invite (dominant)** — the loud `brandYellow` CTA (§7 color). Reuse `InviteCrew`'s existing `Share.share` path and receive-first copy ("Walls are written by the people around you"). **Personalize** the message with display name; **no fake "invite sent" state** (we can't verify delivery — honesty, AC-1/AC-4). No deep-link landing (deferred, §14).
- **Seed (quiet secondary)** — a low-emphasis "Pin your first Mark" action → `/create` (self-target). Disappears as a primary once `hasSeeded` (§8, AC-8).
- **Honest ghost empty (AC-1):** one or two faint, unmistakably-placeholder pin/tape marks suggesting "things go here" — clearly not real content. Retire the dashed form-widget box toward "part of the wall."

**Composition:** build an `EmptyWall` piece under `src/features/personal-wall/` that composes the invite (reusing `InviteCrew`'s share logic) + the quiet seed CTA + ghost placeholders. `PersonalWall` renders `EmptyWall` when `isEmpty`, the masonry otherwise. Search-Before-Create honored — `InviteCrew`'s invite logic is reused, not re-implemented.

**Invite is surfacing/art-direction only** — no new capability (ADR-001 §1).

---

## 11. Determination 8 — Seed Mark behavior

- **Entry point is the dedicated EmptyWall Seed CTA, NOT the dock `+`** (refined VD-2 / §8). The one-time seed is reached only from the empty-state "Leave the first note" / "Pin your first Mark" action — a special onboarding affordance visually distinct from `+`, so nothing teaches "`+` = post to myself."
- **Reuse the shipped self-target write path unchanged** end-to-end: the Seed CTA → `create.tsx` → `write/[type].tsx` → `createMark` (`marks.ts:21`) → owner's Personal Wall. **Only the ENTRY POINT changes (dedicated CTA instead of the dock `+`); the write path, RLS, and trigger are untouched** (`can_contribute` true for owner; `marks_set_defaults` forces owner marks to `active` — `0001_init.sql:160,199`). **No backend work.**
- **"One-time" is derived, not schema'd:** the Seed CTA is gated by `hasSeeded` (§8) from the Marks query — no new column.
- **Framing (Decision C):** create/writer copy says *seed / introduce / start your wall*, not *post to your feed*. Type picker unchanged.
- **DROP-then-re-center flow (AC-5, VD surface 7):** on submit → land on `/home?justCreated=<id>` → the seed does a single DROP onto the wall → surface visibly **re-centers on Invite** (Invite is now the sole foregrounded action; the dedicated Seed CTA is gone per `hasSeeded`, and the dock `+` was already de-emphasized/hidden for the cycle per §8).
- **AC-8 is enforced by affordance removal, not server blocking.** No need to hard-block `createMark` for a second self-post — that would be logic change and over-engineering; AC-8 is about standing affordances. (Stated so QA tests the affordance, not a server error.)

---

## 12. Determination 12 — What must remain UNTOUCHED

- **Auth:** `lib/auth.tsx` and the auth **logic** in `sign-in.tsx` (OTP/OAuth, `signInWithOtp`, `verifyOtp`, OAuth exchange). Any `sign-in.tsx` change is cosmetic label-only, auth-adjacent, lowest priority, may defer.
- **Supabase / schema / RLS / triggers:** `0001_init.sql` — no migration, no policy edit, no trigger change. `profiles_personal_wall` auto-wall trigger and `marks_set_defaults` stay as-is.
- **Marks data-layer contracts:** `createMark`, `getWallMarks`, `subscribeToWall`, `hydrateAuthors`, `setPinned`, `hideMark` signatures stable (`marks.ts`). Profile creation (`createProfile`) and the `interests` column stay (Decision B — do not delete storage).
- **Deferred features (untouched, not started):** friend system, Discover, viewing another user's wall + "whose wall?" picker, deep-link invite landing (§14), Shared Walls V3, games, notifications/push, reactions/comments, new Mark-type writers.

---

## 13. Recommended Build Order (Playbook §7/§8)

Riskiest bits: **the Option C nav restructuring (Phase 1)** and **the VD-2 `+` de-emphasis (Phase 2)**. Sequence to de-risk both.

- **Phase 0 — Design-system foundation (parallelizable within itself; unblocks visual quality).** Icons (Feather swap, stable API) · `motion.ts` + DROP/PRESS/SETTLE primitives + reduced-motion · shadow tiers + tilt discipline + fastener-to-one · type mono-retire · color yellow-one-job. **T-shirt: M** (breadth + two wide-ripple token changes).
- **Phase 1 — Option C IA restructuring (deliberate, single-threaded).** Extract `PersonalWall` · `home` renders it + delete fake data · `wall.tsx` → redirect · repoint writer `justCreated` → `/home` · remove `walls` tab + rebalance dock · retire `//` labels. **T-shirt: M.** *Onboarding Interests-defer (about → sign-in) is independent and runs in parallel.* **T-shirt (onboarding): S.**
- **Phase 2 — First-run activation (the refined-VD-2 crux).** `EmptyWall` two-action state + ghost placeholders · elevate + personalize Invite · dedicated Seed CTA (gated by `hasSeeded`) + "seed" framing · DROP-then-re-center · de-emphasize/hide the dock `+` on the owner's wall for the cycle (never self-target), preserving the tap-target indirection (§8A). **T-shirt: M.**
- **Phase 3 — Verify.** Reviewer (independent, re-executes) → QA against **AC-1…AC-8**. QA only after APPROVE.

Parallelizable: Phase 0 items among themselves; the onboarding edge is independent of the wall work. Phase 2 depends on Phase 0 (motion/tokens) and Phase 1 (the consolidated surface).

---

## 14. Deferred item requiring backend/authz change — FLAGGED, NOT IN SCOPE

**Deep-link invite landing** (invited user leaves a Mark on the *inviter's* wall) — Decision D, deferred. Restated here per the hard constraint that any backend/schema/RLS/auth need be flagged as a separate gated item:

- It is **not additive**: requires (i) arbitrary-wall-by-handle viewing (today `wall.tsx` is hardcoded to the user's own wall), (ii) deep-link `@handle → wall` resolution, and (iii) **an RLS/authorization change** — default `contribution_policy` is `'friends'` (`0001_init.sql:51,179`), so a non-friend invitee cannot contribute without a permission-model change (auto-friend-on-invite or an invite-token grant).
- That is **authorization architecture → High-Risk / design-level Two-Key / Founder-gated on its own.** If ever greenlit it re-enters as its own slice with an ADR and independent second review **before** implementation. **Nothing in this plan builds toward it, and this plan does not depend on it.**

No other in-scope item requires any backend/schema/RLS/auth change (verified against `0001_init.sql`, §8/§11/§12).

---

## 15. ADR-worthy decisions (recorded here; both two-way doors)

**ADR-FP-A — Option C realized as "Home tab = PersonalWall."**
*Context:* `app/wall.tsx` is outside `(tabs)`; Decision A wants one wall-as-home with the dock. *Options:* (A) route gate to `/wall` (loses dock); (B) route to `walls` hub (keeps the third surface); (C) fold the wall into the Home tab. *Decision:* **C** — extract `PersonalWall`, render from `(tabs)/home.tsx`, `wall.tsx` becomes a redirect, remove the `walls` tab. Only option that satisfies AC-2 and keeps the dock. *Reversibility:* two-way door (UI/nav only). *Confidence:* Verified against `_layout.tsx`, `index.tsx`, `wall.tsx`.

**ADR-FP-B — Global `+` Navigation Contract (refined VD-2): de-emphasize the dock `+` on the owner's own wall this cycle; seed via a dedicated CTA; never self-target `+`.**
*Context:* `+` has ONE long-term meaning — **Leave a Mark (for someone)** — whose real target (an eligible-recipient picker → the recipient's wall) is not buildable this cycle; the contract forbids `+` meaning post-to-self, Invite, or generic create (UX-001 VD-2 A–E, PRD-001 Global `+` Navigation Contract). *Options:* (i) wire `+` to the self-target seed (violates D — teaches "`+` = post to myself"); (ii) relabel `+` as Invite (violates E); (iii) disable/grey (dead control, Least-Surprise violation); (iv) **de-emphasize/hide the dock `+` on the owner's own wall this cycle, reach the one-time seed via a dedicated onboarding CTA, and keep Invite as the dominant separate action.** *Decision:* **(iv).** `+` acquires no meaning this cycle and never self-targets; the FAB's single tap-target indirection is preserved for the future recipient picker (§8A); `hasSeeded` (Marks-derived, no schema) governs only the dedicated Seed CTA / empty-state, enforcing AC-8. *Reversibility:* two-way door (a render-gate + a conditional CTA). *Confidence:* Verified (RLS/seed path, contract text) + Inferred (user reaction). *Watch:* Reviewer/QA confirm AC-8, that `+` never self-targets or reads as Invite, and that nothing this cycle contradicts the contract.

*(ADR-001 remains the feasibility record; its status note is updated to reference this plan and the resolved gates.)*

---

## 16. Risks (Risk Register)

| # | Risk | Cat. | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R1 | Option C nav restructuring regresses back-stack / `justCreated` param flow / dock slot math | Technical | Med | Med | Keep `wall.tsx` as redirect; verify writer→`/home` DROP; QA the reduced tab-count dock (FAB present & hidden) |
| R2 | Masonry misbalances or the DROP misbehaves on **real varied** content (estimated heights, `estimateMarkHeight`) | Technical/UX | Med | Med | Frontend + QA test with real long/short/photo Marks across breakpoints — not placeholder text (UX Verification Rule) |
| R3 | Global `+` contract broken: `+` wired to self-target/Invite, or AC-8 not honored (standing self-post affordance survives), or a `+` meaning taught that conflicts with the future recipient picker | Product/UX | Med | High | `+` never wired to self-target (de-emphasized/hidden this cycle, §8); seed via dedicated CTA only; single `hasSeeded` source; Invite its own dominant action; tap-target indirection preserved (§8A); Reviewer + QA assert AC-8 and contract-consistency explicitly |
| R4 | Wide-ripple token changes (mono retire, yellow-one-job, shadow tiers) cause visual regressions on surfaces not individually specced | UX | Med | Med | Treat as a discrete Phase-0 workstream; per-surface Reviewer visual pass |
| R5 | Dock needs `hasSeeded` → state-plumbing coupling / duplicated server state | Technical | Low | Med | One Marks-derived read/context, single source of truth (Playbook §13); no second global store |
| R6 | Feather mapping misses an `IconName` key | Technical | Low | Low | Map every key in the `IconName` union; typecheck |
| R7 | DROP/motion ignores reduced-motion (accessibility) | Accessibility | Low | Med | Token-gated reduced-motion in `motion.ts`; every primitive checks it |
| R8 | Scope creep into deferred deep-link / RLS while "elevating invite" | Process | Low | High | Hard boundary §14; that path is a separate High-Risk Two-Key slice |

No unmitigated risks. No regulated-domain feature is built this cycle (Decision E acknowledged; latent age/anonymity/moderation surface in the data model is untouched — carried forward, not resolved here — Constitution §23).

---

## 17. Reversibility / rollback

Entirely UI-only and two-way-door. **No migration, no data change → rollback = `git revert`.** No feature flag strictly required; the two behavioral changes most worth isolating in commits are the Option C nav swap (Phase 1) and the `+` de-emphasis + dedicated Seed CTA (Phase 2), so either can be reverted independently. Minor tracked debt: dormant `interests.tsx` route (Decision B — intentionally kept), and the retired Shared-Walls teaser (re-homed when Shared Walls ships).

---

## 18. Acceptance Criteria (carried from PRD §11, for QA)

AC-1 no fabricated activity · AC-2 first landing is the user's own real wall · AC-3 honest empty state, exactly two actions · AC-4 invite reachable first session · AC-5 seed first Mark performs the gesture · AC-6 streamlined onboarding, no dead-payoff step · AC-7 returning user sees only real Marks · **AC-8 seed is one-time, no standing self-post affordance** (the VD-2 crux — QA against §8/§11).

---

## 19. AI-Readiness / Definition of Done check

- [x] A zero-context agent could execute file-by-file (§4/§6/§8) without a silent judgment call — the one subtle decision (VD-2 `+`) is fully specified in §8 + ADR-FP-B.
- [x] New file locations specified against structure (`src/features/personal-wall/`, `src/theme/motion.ts`).
- [x] Data-layer contracts stated stable; no new interface introduced (§9 keeps `Icon` API stable).
- [x] Fast Lane tier stated (Medium, §1); no High-Risk item → no design Two-Key required; deferred deep-link flagged (§14).
- [x] Each phase is context-bounded to a realistic agent session (§13).
- [x] Reversibility stated for every decision. Technical Debt Register: no new intentional debt beyond the two tracked, benign items in §17.
