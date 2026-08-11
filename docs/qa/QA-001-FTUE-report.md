# QA-001 · FTUE & Personal Wall (FP-001) — QA Decision

**Role:** QA · **Governs under:** QA Charter v2.1 / QA Playbook v2.1 / AIOS Constitution v1.1
**Date:** 2026-08-10 · **Entry:** Reviewer APPROVE confirmed (per task) on the uncommitted FP-001 working tree.
**Inputs:** PRD-001 (AC-1…AC-8), FP-001 Feature Plan, UX-001 direction.
**Test Depth (Playbook §4):** **Full Regression** (new screen, shared-component + token changes, navigation restructuring). **Not Two-Key** — verified no auth/schema/RLS/payment surface is touched (`git diff` of `src/lib/` and `supabase/` is empty; package.json adds only `@expo/vector-icons`).

---

## VERDICT: PASS

All eight Acceptance Criteria are satisfied and the Global `+` contract holds. Build gates (typecheck, lint) are green. No defect at Functional-recoverable severity or above was found. Two Cosmetic observations are logged (non-blocking).

**Honest confidence caveat (stated environmental constraint):** this sandbox has **no iOS/Android device or simulator**, and app fonts are not bundled (system-font fallback). Therefore every behavioral AC result below is **trace-verified** (rigorous end-to-end tracing of the actual executed code paths), **not runtime-verified** (observed on a device). This is an explicit environmental limitation, not a shortcut. The device-only items are handed to the Founder in the checklist at the end. QA does not overclaim a green on-device runtime it could not execute.

---

## Executed results

| Check | Command | Result | Confidence |
|---|---|---|---|
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | **0 errors** | Verified |
| Lint | `npm run lint` (`eslint .`) | **0 errors, 5 warnings** | Verified |
| Bundle (iOS) | `npx expo export --platform ios` | **Env-blocked** — Metro traversed the app graph (1461 modules) and failed **only** on `@babel/runtime/regenerator`, a transitive helper of third-party `posthog-react-native` reached via the **pre-existing, unchanged** `src/lib/analytics.ts`. FP-001's own new dep `@expo/vector-icons` (Feather) is installed and resolves. Not an FP-001 defect. | Verified (root cause) |
| Bundle (web) | `npx expo export --platform web` | **N/A / env-blocked** — `react-native-web` not installed (native-only app); online run also failed at Expo CLI's network-gated version pre-check (sandbox proxy). | Verified (env) |

**Lint warnings (all `react-hooks/exhaustive-deps`, baseline-consistent):** 3 pre-existing (`app/auth/callback.tsx`, `app/write/[type].tsx`, `src/lib/auth.tsx`) + 2 in the new `PersonalWall.tsx` (lines 91, 100) that mirror the exact exhaustive-deps pattern of the `wall.tsx` body it was extracted from. No new error, no new warning category.

**Bundle-integrity conclusion:** a fully-green bundle could not be *observed* here for purely environmental reasons (a pruned `node_modules` missing a babel-runtime helper needed by an unrelated analytics lib; no `react-native-web`; a network-gated CLI pre-check). Per the QA task's environmental rule, this is **not counted as a failure**. FP-001's own module-resolution integrity is corroborated by: typecheck 0 errors (every import path resolves at the TS level), the deep Metro traversal with **no FP-001-file resolution error**, and `@expo/vector-icons` being present. Confidence that FP-001's modules bundle cleanly: **Believed-likely (strong)**. A green production build is a Founder-side checklist item once `node_modules` is complete.

---

## Acceptance Criteria — per-AC result

Verification method for all: **trace-verified** (code-path trace against the running-app control flow), per the stated no-device constraint.

| AC | Result | How verified (trace) |
|---|---|---|
| **AC-1** No fabricated activity, ever | **PASS** | `app/(tabs)/home.tsx` renders only `<PersonalWall/>`; the "N new Marks", fake Active Game, and hardcoded Sofia sticky are deleted. Grep for `while you slept\|Active Game\|Sofia` in `app/`+`src/` returns only *comments describing the removal* and the legitimate Welcome example. `EmptyWall` ghost placeholders are opacity-0.45 skeleton bars (`pointerEvents="none"`), unmistakably empty — not fake Marks. |
| **AC-2** First landing is the user's own real wall | **PASS** | `app/index.tsx` (unchanged) routes a set-up user to `/home`; `/home` renders `PersonalWall`, which loads the real wall via `getPersonalWall(session.user.id)` → `getWallMarks(wall.id)`. Identity header shows the user's wall name/avatar/handle. No fabrication. |
| **AC-3** Honest, actionable empty state | **PASS** | `EmptyWall.tsx`: honest "No one's written on your wall yet" framing + **exactly two** actions — Invite (dominant, brand-yellow `Button`) and a quiet dedicated "Leave the first note" seed CTA — plus honest ghost placeholders. |
| **AC-4** Invite reachable in first session | **PASS** | `shareInvite()` calls native `Share.share({ message })` with a personal `https://thewall.app/@<handle>` link, personalized with display name. **No fake "invite sent" state** — the sheet opening is the whole action (honest by construction). |
| **AC-5** Seed first Mark performs the core gesture | **PASS** | Trace: EmptyWall seed CTA → `router.push("/create")` → type tile → `/write/[type]` → `createMark` (unchanged data-layer) → `router.dismissAll()` + `router.push("/home?justCreated=<id>")` → `home.tsx` reads `justCreated` → `PersonalWall` seeds `dropIds` → `MarkView dropIn` → DROP. Post-submit `marks.length>0` ⇒ wall leaves empty state. |
| **AC-6** Streamlined onboarding, no dead-payoff step | **PASS** | `about.tsx` "Next" → `/sign-in` (Interests skipped). Grep confirms **zero** navigation references to `/interests` anywhere — the step is unreachable. `interests.tsx` left dormant (intentional, FP-001 §17). No onboarding step promises an undeliverable capability. |
| **AC-7** Returning user with real Marks sees only real Marks | **PASS** | `PersonalWall` renders `Masonry` of real `getWallMarks` data; `subscribeToWall` prepends live-arriving Marks (flagged to DROP). Filter chips narrow by type. No fabricated content in the populated path. |
| **AC-8** Seed is one-time, no standing self-post affordance | **PASS** | Seed CTA is gated `isEmpty && !hasSeeded` and lives only inside `EmptyWall`. `hasSeeded = marks.some(m => m.author_id === uid)` (Marks-derived, no schema). Post-seed: not empty ⇒ `EmptyWall` unmounted ⇒ no seed CTA; dock FAB hidden (`SHOW_DOCK_FAB=false`); only `InviteCrew` re-center block is foregrounded (`!hasOthers`). No standing/repeatable self-post affordance exists. |

---

## Global `+` Navigation Contract (Risk R3) — PASS (trace)

- `BottomDock.SHOW_DOCK_FAB = false` ⇒ the center `+` FAB is **never rendered** this cycle; the dock renders an even 3-tab layout (Home · Discover · Profile).
- `+` **never self-targets** in any user-reachable way and **never reads as Invite or generic create** — it is simply absent. Invite is its own `InviteCrew` action; the seed is its own dedicated EmptyWall CTA.
- The single FAB indirection handler `onLeaveMark` is **preserved in code** (unreachable behind the render-gate) for the future recipient picker to occupy — exactly as FP-001 §8A specifies.
- No recipient picker, other-person-wall navigation, or friends/permissions logic was built (confirmed: only reads of the existing `friendships` table for the header count; empty `supabase/` diff).

## Motion — DROP / SETTLE / reduced-motion — trace-verified

- `MarkCard.tsx` uses the `motion.ts` **DROP** (`withSequence`: fall to overshoot → settle to 0, hard offset shadow snapping in via `shadowMul` delay) — the old `FadeIn.duration(320)` is gone.
- **SETTLE** stagger exists: `settleDelay` per card on first populated paint, capped at `motion.settle.maxSteps`, driven by `PersonalWall`'s `settleIndex`.
- **Reduced-motion:** `useReducedMotionFlag()` (wrapping reanimated's `useReducedMotion`, which reads OS AccessibilityInfo) gates every primitive to fade/instant. Token-gated in one place (`motion.ts`).
- *Actual motion feel and the OS reduce-motion toggle behavior are device-only — see Founder checklist.*

## Regression — PASS

- `git diff --stat` of `src/lib/` and `supabase/` is **empty** — no change to the data layer, schema, RLS, or triggers.
- `sign-in.tsx` change is a **1-line cosmetic label** (removed a `// ` prefix); auth logic (`signInWithOtp`/`verifyOtp`/OAuth) untouched.
- Mark write/read/realtime contracts (`createMark`, `getWallMarks`, `subscribeToWall`) unchanged.
- `walls.tsx` deleted; no dangling `/walls` route references; `wall.tsx` is a thin `<Redirect href="/home" />`.
- `Icon.tsx` maps every key of the `IconName` union to a Feather glyph (Risk R6 mitigated; typecheck enforces `Record<IconName, …>` completeness).

---

## Findings (severity per Reviewer Playbook §4.1)

**No Production-risk or Two-Key-critical findings. No Functional-recoverable findings.** Two Cosmetic observations (non-blocking, do not affect the Pass):

1. **[Cosmetic] Onboarding section labels not retired.** `welcome.tsx:16` still renders `WELCOME TO` and `about.tsx:21` still renders `WHAT IS A WALL`. FP-001 §4 (VD-4) called for retiring these code-comment-style labels; the `// ` prefix aesthetic was removed from `sign-in.tsx` but the label text remains on Welcome/About. This is a **visual-direction (VD-4) partial**, **not** an Acceptance Criterion and **not** fabricated content. Cosmetic only; visual polish is a Founder visual-gate/device item.
2. **[Cosmetic / future-work note] Hidden FAB handler still points at `/create`.** `BottomDock.onLeaveMark` = `router.push("/create")` (self-target). This is **unreachable** this cycle (`SHOW_DOCK_FAB=false`) and is exactly what FP-001 §8A prescribes ("today it is `router.push('/create')`; this cycle it is hidden, not deleted"), so it is **not** a current contract violation. Note for the future slice: §8A requires repointing this to the eligible-recipient picker (not `/create`) before the FAB is un-hidden. Observation only.

---

## Routing

**PASS → hand back to the Founder Gate.** No defect to route to an implementation Role. The two Cosmetic items are logged for the Founder's visual/UX gate; neither blocks.

---

## FOUNDER DEVICE-TEST CHECKLIST (device-only — could not be exercised in this sandbox)

These require a real iOS/Android device or simulator with app fonts bundled. They are **not** failures of the implementation; they are the deliberate device-test boundary this cycle ends at.

1. **DROP feel** — a seeded/new Mark visibly falls from above, overshoots, and settles with the hard offset shadow snapping in on landing (not a fade).
2. **SETTLE feel** — on a populated wall's first paint, cards land in quick succession (stagger), not all at once.
3. **Reduced-motion OS toggle** — enable "Reduce Motion" in OS accessibility settings; confirm DROP/SETTLE degrade to fade/instant everywhere.
4. **Native share sheet (AC-4)** — the OS share sheet actually opens with the personalized `@handle` invite link; no fake "sent" confirmation appears.
5. **Font rendering** — once the real `.ttf` fonts are bundled, confirm type (Bricolage/Geist labels) renders as intended and layouts don't break vs. the system-font fallback used here.
6. **Android dual-edge shadow** — verify the tokenized `androidEdge` fallback renders the "pinned paper" shadow acceptably on Android (iOS uses the zero-blur offset shadow).
7. **Masonry balance on real content (Risk R2)** — test with real long / short / photo Marks across breakpoints; confirm 2-column balance and that DROP behaves on varied heights (not placeholder text).
8. **End-to-end seed → `/home?justCreated` DROP** — perform the full seed flow on-device and confirm the seed DROPs on the consolidated Home wall, then the surface re-centers on Invite (seed CTA gone, dock `+` absent).
9. **Green production build** — run `expo export` / a real build with a complete `node_modules` to confirm the app bundles cleanly (the sandbox blocker was an unrelated missing `@babel/runtime/regenerator` for `posthog-react-native`).

---

## Definition of Done (Playbook §23)

- [x] Reviewer APPROVE confirmed as entry (per task).
- [x] Test Depth classified (Full Regression).
- [x] Acceptance Criteria pass complete (AC-1…AC-8, all PASS, trace-verified).
- [x] Quality Bar honesty pass folded in (honest empty state, no fabrication, invite-dominant hierarchy) — deep experiential "feel" deferred to device (checklist).
- [x] Regression pass complete (data-layer/auth/routing untouched, confirmed by diff).
- [x] Every finding carries severity + confidence.
- [x] Device/environment matrix limitation stated honestly; device items routed to Founder.
- [ ] On-device runtime matrix — **not exercisable in sandbox** (Founder device test).
