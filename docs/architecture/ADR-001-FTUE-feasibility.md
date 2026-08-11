# ADR-001: FTUE & Personal Wall — Pre-Approval Feasibility Estimate

Status: Proposed (advisory — NOT a Build-Ready Feature Plan)
Date: 2026-08-10
Author: Architect Role
Governs under: Architect Charter v2.1 / Playbook v1.1 (§7 Complexity Estimate, §9 Sequencing)
Input: docs/product/PRD-001-FTUE-and-Personal-Wall.md (Spec-Ready, not Build-Ready)

> Scope of this note: a pre-approval **Complexity Estimate + sequencing + risk read** for the PRD §10
> in-scope slice only. It does not decide product scope, does not hand off to Backend/Frontend, and
> introduces no schema/config/code change. Product's §12 Founder gates remain open; this note informs
> them through a technical-feasibility lens, it does not resolve them.

---

## 1. Headline finding

The in-scope slice (PRD §10) is **overwhelmingly a rewiring of pieces that already exist and work**, not
new capability. The data model, auth gate, marks lib, RLS, realtime, invite share, and the self-target
write path are all already shipped and functional. Verified against the repo:

- **Seed self-Mark already works end-to-end with zero backend change.** `create.tsx` → `write/[type].tsx`
  → `createMark` (`src/lib/marks.ts:21`) targets the author's own Personal Wall (`getPersonalWall`,
  `src/lib/profiles.ts:55`). RLS `can_contribute` (`0001_init.sql:160`) returns true because
  `w.owner_id = uid`, and `marks_set_defaults` (`:199`) forces the owner's own marks to `active`. On
  submit the writer already routes to `/wall?justCreated=<id>` and the realtime `subscribeToWall`
  (`marks.ts:104`) drops it in. **Nothing new is required for the seed gesture except the empty-state CTA
  and "seed your wall" framing copy.** (Verified.)
- **Invite already works end-to-end.** `InviteCrew` (`src/components/InviteCrew.tsx:11`) emits
  `Share.share` with `https://thewall.app/@<handle>`. It is already rendered on the empty wall
  (`wall.tsx:159-161`) and the walls hub (`walls.tsx:86-89`). The only work is **elevation/surfacing**,
  not building. (Verified.)
- **The honest empty state largely exists.** `wall.tsx` already renders `InviteCrew` at
  `marks.length === 0` and a `✦ LEAVE A MARK` → `/create` action at the bottom (`:177`). Both required
  actions exist; they need to be **co-presented** as the two-action empty state (AC-3). (Verified.)

What is genuinely new: **the first-landing route change and its IA coupling** (below), and the honest
copy/framing. There is **no new schema, no new endpoint, no RLS change, and no new dependency** in the
in-scope slice.

---

## 2. Per-item feasibility & size

| # | In-scope item (PRD §10) | Feasibility vs. codebase | Size | Technical risk |
|---|---|---|---|---|
| a | First landing → user's real wall | Gate at `index.tsx:30` routes to `/home`. Change is trivial; **but `/wall` is a standalone route, not a tab** (tabs = home/walls/discover/profile, `(tabs)/_layout.tsx`). Landing on the real wall forces an IA choice. | **S** (change) / **M** (IA decision) | Nav coupling — see §3. Routing to `/wall` drops the user outside the BottomDock. |
| b | Remove all fake Home data | Pure delete of hardcoded content in `home.tsx:36,40-52,59-64`. | **S** | None on its own; **coupled to (a)**: what does the `home` tab become? |
| c | Streamline onboarding (defer Interests) | One nav edge: `about.tsx:55` pushes `/interests`; repoint to `/sign-in`. `onboardingDraft` goes unused; `createProfile` still passes `interests: []`, and the `interests` column defaults to `'{}'` (`0001_init.sql:41`). **Profile write is untouched.** | **S** | Near-zero. Reversible. Founder-gated (user-facing). |
| d | Honest empty state, two actions | Pieces exist in `wall.tsx` (InviteCrew + LEAVE A MARK). Co-present + honest copy. | **S** | None. |
| e | Elevate invite to first-class | `InviteCrew` works; resurface it as the first-run headline. | **S** | None. |
| f | Seed first-Mark (self-target) | Works end-to-end today (see §1). CTA + framing only. | **S** | None technical. Product/UX framing risk only ("seed" not "post"), PRD §5 already flags. |

**Overall slice:** Small, single-Role (Frontend), realistically **1–2 agent sessions**. The only item
carrying Medium weight is the IA decision behind (a)/(b), and that is a *decision*, not build volume.

---

## 3. The one hidden coupling: "land on the real wall" vs. the tab structure

This is the item that looks like a one-line reroute and is not. `app/wall.tsx` is a **standalone route
outside the `(tabs)` group**. The four tabs are `home`, `walls`, `discover`, `profile`
(`(tabs)/_layout.tsx`), with `home` being the fabricated surface. So "route first landing to the real
wall" collides with navigation structure, and there are three shapes, each with a different blast radius:

- **Option A — route the gate to `/wall` directly.** Smallest change (`index.tsx:30`). Cost: the user
  lands on the hero wall **without the BottomDock**; there is no persistent bottom nav on the primary
  surface. Poorest IA.
- **Option B — route to the `walls` hub tab.** Keeps the dock. Cost: the hub is the PRD's "third
  competing surface" (§3 problem 3) and is not the hero; doesn't satisfy "this is my wall" cleanly.
- **Option C — make `home` the real wall.** Fold the `wall.tsx` hero content into the `home` tab so the
  first tab *is* the user's wall. Cost: more work (merge two surfaces, reconcile `justCreated` param and
  the standalone `/wall` route), but it's the actual consolidation the PRD §9/§12.4 asks for and the only
  option that both keeps the dock and lands the honest hero.

**This is the technical substance of Founder gate #4.** The fake-data delete (item b) is trivial; the
"consolidate surfaces" half is a real, if small, navigation restructuring. It must be decided **before**
build, or the implementer will make a silent IA call. Architect recommendation (for the Founder's IA
decision, not a substitute for it): **Option C** — it is the only one that satisfies AC-2 ("identifiable
as *their* wall") while preserving navigation, and the extra effort is bounded (one surface merge, no
data change). All three options are two-way doors (UI-only, reversible).

---

## 4. Technical read on the 5 Founder gates (PRD §12) — feasibility lens only

1. **Deep-link invite landing (invited user leaves a Mark on the *inviter's* wall).** **Not additive, not
   trivial — this is a genuine feature slice with an authorization implication.** Three things are missing:
   (i) `wall.tsx` is hardcoded to `getPersonalWall(session.user.id)` — the *own* wall; there is no
   view-an-arbitrary-wall-by-handle path; (ii) deep-link resolution `@handle → wall` does not exist;
   (iii) **RLS would block the stranger's Mark**: the default `contribution_policy` is `'friends'`
   (`0001_init.sql:51,179`), so `can_contribute` fails for a non-friend inviter's wall — the invited user
   could *view* the public wall but **not contribute** without a permission model change (auto-friend on
   invite, or an invite-token contribution grant). That change touches **authorization architecture →
   High-Risk / Two-Key / Founder-gated** on its own. Technical verdict: **agree with Product's "defer" —
   this is its own future feature, not part of the honest-FTUE slice.**
2. **Defer Interests.** Technically the safest gate. Touches **one navigation edge**; the profile write is
   untouched (`interests` defaults to `'{}'`). Fully reversible. No data, no schema, no risk. Feasibility:
   trivial. (Decision remains Founder's — it is user-facing.)
3. **Seed self-Mark.** **Already fully supported by shipped code and RLS** (see §1). Zero technical risk or
   new work beyond CTA + framing copy. This gate is a pure product/UX endorsement, not a build question.
4. **Wall-surface consolidation.** **Has the hidden coupling in §3.** Not free: the delete is trivial, the
   "land on real wall + collapse redundancy" half is a bounded navigation restructuring that needs an IA
   decision before build. This is the one place a "trivial" item hides real work.
5. **Regulated-domain flag (Constitution §23).** Surfaced, not resolved (Charter §4, §7). This slice builds
   none of it, but note the schema already carries `reports` (`0001_init.sql:125`) and `anonymous` marks —
   i.e. the age-sensitive/anonymity/moderation surface is latent in the data model. Age-gating, anonymity
   policy, and a moderation surface are **age-sensitive + safety** concerns that must be addressed before
   those features harden. **Not a blocker for this cycle; routed to Founder/Product, not decided here.**

---

## 5. Roles required (stated, not invoked)

- **Frontend — ~95% of the slice.** Every in-scope item is UI/navigation/copy: gate reroute, delete fake
  data, empty-state co-presentation, invite elevation, seed CTA framing, onboarding edge repoint.
- **Backend — ~0% for the honest-FTUE slice.** No schema, no endpoint, no RLS change. Backend is only
  pulled in **if Founder gate #1 (deep-link invite) is greenlit**, which would require an RLS/permission
  change and would then trigger **Architect High-Risk / Two-Key** review before any implementation.
- **Architect — the IA micro-decision (§3) + this estimate.** No production code.

---

## 6. Recommended build sequence

1. **Founder resolves PRD §12 gates** — blocking. Priority order for *this slice*: **#4 (IA direction),
   #2 (Interests defer), #3 (seed endorsement)**. #1 stays deferred unless explicitly pulled in (and if so,
   re-enters as its own High-Risk slice, not this one).
2. **Architect + Founder settle the §3 IA choice** (A/B/C) — the one decision that must precede build.
3. **Frontend, largely parallel (single surface, one-ish session):** delete fake Home data · co-present the
   two-action empty state · elevate invite · seed-Mark CTA + "seed your wall" framing. The onboarding
   Interests-defer is **independent and can run in parallel**.
4. **Reviewer** (independent, re-executes) → **QA** against PRD §11 AC-1…AC-7. QA only after Reviewer
   APPROVE.

No migration, no rollback plan needed (UI-only, all two-way-door/reversible).

---

## 7. Mis-scoping flags

- **"Route to real wall" + "consolidate surfaces" is under-specified as trivial** (PRD §10 line 161 /
  §12.4). It hides a small but real navigation restructuring (§3). Not too big for MVP — but not the
  one-line reroute it reads as. Needs an explicit IA decision before build, else a silent implementer call.
- **Deep-link invite (gate #1) is correctly out of scope.** If pulled in, it is **not** additive: it drags
  in arbitrary-wall viewing + deep-link handling + an **authorization/RLS change** (contribution_policy),
  making it a High-Risk, Two-Key, Founder-gated slice of its own. Agree with defer.
- Everything else in §10 is honestly sized as Small and is mostly re-presentation of working code.

---

## 8. Build-readiness posture

**NOT READY to implement — by design, pending Founder input.** This is a pre-approval estimate; PRD is
Spec-Ready, not Build-Ready. Blockers, each routed to its normal tier:
- Founder gates §12 #2, #3, #4 unresolved (product/user-facing → Founder).
- IA direction (§3) undecided (Architect proposes Option C; Founder confirms — user-facing).

Once #4/IA and #2/#3 clear, this slice is trivially build-ready as a Small, Frontend-only, reversible
change with no backend and no schema. A full Build-Ready Feature Plan would be produced then, not now.

**Confidence:** Feasibility and "already works" claims — **Verified** (read against repo files cited).
User-demand assumptions inherited from the PRD — **Inferred** (zero users, Founder Mode).
