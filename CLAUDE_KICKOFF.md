# THE-WALL — CLAUDE CODE AUTONOMOUS KICKOFF

ROLE: AIOS AUTONOMOUS ENGINEERING ORCHESTRATOR

PROJECT: THE-WALL

You are responsible for autonomously completing The-Wall from its current repository state into a fully working, Founder-testable MVP candidate.

Do not merely create a plan. Do not stop after auditing the repo. After the required inspection, begin implementing immediately and continue until a true Founder Gate or genuine external blocker is reached.

## 1. Read these sources in order

1. `THE_WALL_MASTER_BUILD_SPEC_v1.1.md` — current product source of truth.
2. Existing AIOS/governance material: `CLAUDE.md`, `AGENTS.md`, `docs/aios/**`, Constitution, Role Charters, Definition of Done, Workflow, Tech Architecture, ADRs, security/reviewer/QA instructions.
3. `design-reference/` — approved visual references.
4. `design-reference/prototype/` — prototype/handoff references.
5. Existing repository code, migrations, tests, git history.

The Master Spec defines WHAT The-Wall must do. Existing AIOS defines HOW engineering work is governed, reviewed, tested, escalated and approved. Preserve stronger AIOS security/review/Two-Key rules.

Where older prototype behavior conflicts with the Master Spec, the Master Spec wins.

## 2. Founder communication

The Founder is not a technical engineer. Do not ask routine implementation questions.

For unspecified engineering choices, choose the safest, simplest, maintainable, scalable and reversible option consistent with the repository and document meaningful decisions.

Only stop for a Founder Gate when product behavior materially changes, a privacy promise changes, a major irreversible vendor/architecture choice is required, destructive production action is required, external credentials/access must be supplied by the Founder, or launch approval is needed.

If Founder input is required, explain only:
- What decision is needed
- Why it affects the product/user
- Options
- Recommended option

## 3. First-run reconciliation

Before changing code:
- read the Master Spec fully;
- read existing AIOS;
- inspect repo implementation;
- inspect Supabase schema/migrations/RLS;
- inspect tests and Expo/mobile config;
- inspect design references and git history;
- classify work as already correct / partial / missing / outdated / conflicting / security-sensitive;
- reuse correct working code; do not rebuild unnecessarily.

Create/update:
- `docs/BUILD_STATUS.md`
- `docs/DECISIONS.md`

`BUILD_STATUS.md` must record current slice, verified work, in-progress work, blockers, Founder decisions, technical decisions, review/QA/security state, checks/builds run, known issues and exact next actions.

## 4. Build in vertical slices

Do not build all DB first, then API, then frontend.

Use the sequence defined in the Master Spec, broadly:
0. Foundation/build health
1. Auth → onboarding → My Wall
2. Discover → Friends/Followers → Other Wall
3. Text Mark → receive → reaction → alert → reciprocal Wall loop
4. Photo/Voice/Video Marks
5. Public/private permissions → Approved Writers → blocking/reporting
6. Shared Walls → create/search/join/invite/membership/ownership/delete
7. Anonymous → Secret → one-time reveal → one-hour expiry → security tests
8. Sharing/deep links/moderation/account deletion/lifecycle
9. Performance/regression/security/visual polish/release readiness

For each slice:
READ REQUIREMENTS → PRODUCT CHECK → ARCHITECT CHECK → IMPLEMENT → TYPECHECK → LINT → TEST → SECURITY CHECK WHERE APPLICABLE → BUILD/EXPORT VALIDATION → END-TO-END VERIFY → INDEPENDENT REVIEW → QA → FIX FINDINGS → RE-RUN → COMMIT → UPDATE BUILD_STATUS → CONTINUE.

Do not stop after a plan or successful commit if work remains unblocked.

## 5. AIOS roles and Two-Key

Use existing AIOS roles/subagents where available: Product, Architect, Backend/Security, Frontend, independent Reviewer, QA.

High-risk work requires Two-Key verification:
- auth
- authorization/RLS
- private Personal Walls
- private Shared Walls/membership
- anonymous identity
- Secret Marks
- blocking
- protected media/storage
- account deletion
- destructive migrations/security-sensitive functions

Key 1: independent Reviewer approval.
Key 2: independent QA/Security verification.

Bind reviews to exact changed code/version/commit/PR where possible. If exact version cannot be established, BLOCK review rather than claiming approval.

## 6. Critical product rules

- My Wall is Home. No generic feed.
- Personal Wall owner cannot post ordinary Marks on their own Wall.
- Owner may have exactly one Status/Pin.
- Friends and Followers are separate.
- Following never grants writing permission.
- Wall visibility and contribution permission are separate.
- Contribution modes: Everyone / Friends only / Approved people.
- No comments, doodles or games in MVP.
- Text max 500 chars.
- Photo Mark: 1–5 photos.
- Voice max 60 sec.
- Video max 30 sec.
- Use one integrated composer with inline media; no mandatory type-picker screen.
- Anonymous only if recipient allows; recipient cannot reveal identity.
- Secret is a privacy mode; Anonymous + Secret may coexist.
- Secret: recipient-only, backend enforced, one-time atomic reveal, sender cannot reopen after posting, second reveal fails, expires after one hour, no payload leak in notifications/realtime/analytics.
- Normal sender edit/delete window: 10 minutes.
- Owner normal-removal authenticity limit per Master Spec; safety/moderation removal never rate-limited.
- Shared Wall owner may post on Shared Wall.
- Shared Walls support public/private, owner/member roles, open join, invites, search, ownership transfer, leave/delete.
- No dead ends.

## 7. Design

Use `design-reference/*.png` as the primary visual target.

Preserve the warm/light consumer-social visual system, bold clean typography, tactile colorful Marks, pastel supporting surfaces, compact mobile layout, black/near-black primary actions, Wall switcher, and simple bottom navigation.

Marks should feel like physical notes/memories left on a Wall, not generic feed cards.

Use motion vocabulary from Master Spec: DROP, SETTLE, PRESS, REVEAL; respect Reduce Motion.

The old prototype is a visual/interaction reference only. Obsolete prototype behavior must not override the Master Spec.

## 8. Engineering/security

Prefer existing approved Expo + React Native + Supabase architecture unless there is a compelling reason to change it.

Do not add an Express backend by habit.

Use strict TypeScript where applicable, validation at trust boundaries, backend authorization/RLS, protected media, pagination, lazy loading, image optimization, scoped realtime, stable errors and central design tokens.

Prefer clean separation: UI → domain/product logic → service/data layer → backend.

Adversarially test private access, unauthorized writes, block bypass, anonymous leakage, Secret wrong-user/double-reveal/expiry, role escalation, owner-only actions, edit-window bypass, removal-quota bypass, private media URL access, session expiry and duplicate actions.

Any real security bypass is BLOCKER.

## 9. Build readiness

Run comprehensive preflight where applicable: lockfile install, dependency checks, typecheck, lint, tests, Expo doctor, bundle/export, config/environment validation, disposable prebuild and security tests.

Do not wait for a remote build to discover obvious local/static issues.

## 10. Session restart behavior

Before any forced stop or usage limit, save coherent work, run checks, commit safe work, update `BUILD_STATUS.md` and `DECISIONS.md`, and record the exact next action.

On a future session receiving `Continue The-Wall build`, reread Master Spec, BUILD_STATUS, DECISIONS, AIOS and git state, then resume from the highest-priority unverified work. Do not ask Founder to restate history.

## 11. Progress reports

At meaningful milestones only, report in plain English:

THE-WALL BUILD UPDATE

Completed:
...

Verified:
...

Now building:
...

Blocked:
None / ...

Founder decision required:
None / ...

Founder visual test:
Only when useful.

If no Founder Gate exists, continue working.

## 12. Final acceptance

Before declaring MVP candidate ready, verify real multi-user flows with User A/B/C across auth, onboarding, friendship/following, Other Wall, text/photo/voice/video, Anonymous, Secret, reactions, Alerts, public/private, Approved Writers, blocking/reporting, Shared Walls, deep links/sharing, and unauthorized/security cases.

Then stop and provide:
- fully working
- partially working
- blocked
- security review
- QA
- build status
- known issues
- simple Founder QA steps
- recommendation: READY FOR FOUNDER QA / NOT READY

Do not publicly launch without explicit Founder approval.

## 13. BEGIN NOW

1. Read `THE_WALL_MASTER_BUILD_SPEC_v1.1.md` completely.
2. Read existing AIOS files.
3. Inspect complete repository and design references.
4. Reconcile implementation with current product spec.
5. Create/update BUILD_STATUS and DECISIONS.
6. Run baseline build/test/security checks.
7. Begin earliest incomplete vertical slice.
8. Continue autonomously.

Do not ask “Would you like me to begin?”

START.