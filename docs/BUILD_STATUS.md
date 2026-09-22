# The-Wall Build Status

> Restart anchor. On `Continue The-Wall build`: read
> `THE_WALL_MASTER_BUILD_SPEC_v1.1.md`, this file, `docs/DECISIONS.md`, and
> `docs/handoffs/CURRENT.md`; inspect Git; run the applicable checks; resume from
> **Next Actions**. Product authority remains the Master Build Spec. Governance authority remains
> `docs/aios/`.

_Last updated: 2026-09-22._

## Corrective candidate under exact-tree certification

The source surface is still approximately **80% implemented**, but that is not a production-ready
percentage. A third-party audit of the prior candidate estimated approximately **76% source + CI**
and **46% production readiness** because hosted, device, accessibility, operations, and release
evidence is absent. The last independently certified checkpoint remains **63%** within its narrower
source-and-CI boundary. These figures measure different boundaries and must not be interchanged.

- Draft PR: `#22`; the candidate is published only to the unmerged draft branch
- **Current exact candidate:** resolve the live PR `#22` head, tree, CI run, and review state from
  GitHub before acting. GitHub is authoritative because a commit cannot embed its own final SHA.
- Historical parent evidence: head `b1ee22ff70a3b0f9ad6ee27e462a2f8b5a9b58d4`, tree
  `0deab208e5e5b54f12b8312239a84ed32cd92bb8`, CI run `171` (`35437580725`) passed all four jobs.
- The documentation correction after that parent was published and passed CI, but independent
  Reviewer review `5275238121` blocked it because the restart files still called the parent the
  latest candidate. This self-stable correction removes that ambiguity; its exact certification
  state must be read from the live PR.
- Certification rule: only the latest CI-green PR head with independent Reviewer approval and QA
  pass may become the next source-and-CI checkpoint; live evidence is tracked on draft PR `#22`
- Delivery state: **draft, unmerged, undeployed**

The corrective slice closes audited account-deletion gaps: Anonymous-authored Marks are purged;
expired requests cannot be restored; committed scheduling is not misreported when route refresh
fails; deadline copy includes local time-zone context; a bounded authenticated worker and guarded
rollback exist; privilege, search-path, late-owner, rollback, and two-session race tests were added.
Review remediation also makes recovery fail closed until status is authoritative, serializes rollback
against new requests, isolates worker failures per account, and associates visible input labels with
their native controls.
It also makes Edge tests executable instead of false-positive runners, expands CI to Edge/worker/
Expo/export checks, corrects Expo configuration, removes the critical npm advisory, replaces
placeholder glyph icons, and improves OTP recovery and account identity/help affordances.

No hosted migration, production-data change, merge, deployment, or public release occurred.

## Exact Mark sharing source correction

The source in this tree closes the remaining custom-scheme Mark-sharing gap: a received,
non-Secret Mark now shares a strict focused-Mark destination rather than only the enclosing Wall.
Personal and Shared destination builders reject malformed identifiers, protected media is referenced
only by Mark ID (never by a signed or legacy public media URL), and Secret Marks remain excluded.
Publication, CI, Reviewer, and QA state for this correction must be resolved from live draft PR
`#22`; any verdict is valid only for its exact unchanged head/tree.

## Moderation operations history source correction

The source in this tree completes the existing minimal moderation operations surface without adding
privilege: administrators can separate open and closed reports and inspect the existing admin-only
action log. Reads are bound to the initiating account, Anonymous-author identity remains protected,
successful actions reconcile from server truth, and failed actions keep their visible error. The
open queue also remains available when optional history loading fails. The slice adds no schema,
migration, RPC, dependency, deployment, or production-data change. Resolve its
publication and certification state from the exact Git tree and live draft PR `#22`.

## Last independently certified milestone

The project is at a conservative **63% production-ready MVP milestone**. This is a weighted
source-and-CI readiness estimate, not a count of files/screens and not a release-readiness claim.

- Remote milestone commit: `d78eada458c2fbfff14106cb7e28055ee4d1e768`
- Local equivalent commit: `8489c052bc3a5a14eb2ce42b752d5ab97632fb3d`
- Exact tree: `ef8f8d759689d23dfed9a0e02806a413008d7722`
- Branch: `codex/integrated-mvp-resume`
- Draft PR: `#22`
- CI run `134` (`34940126150`): **green**
- Independent implementation review: **APPROVE**
- Independent QA: **PASS** for the exact source-and-CI boundary
- State: **draft, unmerged, undeployed**

No hosted database, production data, public release, merge, or deployment changed at this
milestone.

## Completed and verified at the 63% checkpoint

### Foundation, activation, and navigation

- Expo/React Native application foundation, Supabase client, primary navigation, account routing,
  retry-safe onboarding, once-only walkthrough, and safe deferred-route restoration exist.
- Same-user token refresh preserves valid upload/navigation state; logout or a real account switch
  performs the full security reset.

### Core permissions and social relationships

- Database contracts cover Personal/Shared Wall access and contribution, friends, followers,
  approved writers, blocking, reactions, Anonymous/Secret handling, moderation, and account state.
- Discover supports real people search and relationship actions. Other-Wall contribution is driven
  by the server capability result rather than guessed from friendship.
- Personal Wall privacy, contribution policy, and Anonymous Marks settings now have an explicit,
  actor-bound save flow. Approved writers can be searched, added, and removed without changing
  friendship or follow state.
- Blocked users can be listed and unblocked through a privacy-minimized, outbound-only management
  contract. The database function returns only the identity fields needed for management and uses
  deterministic cursor pagination.

### Wall and Mark client

- Personal and Other Wall surfaces, Status, Wall switching, integrated composer, Mark detail,
  reactions, edit/delete/removal/report actions, and protected media presentation are present.
- Photo, Voice, and Video client flows exist; Voice and Video are no longer “unimplemented.” Their
  physical-device behavior remains unverified.

### Protected media

- Mark media uses the private protected-media architecture, not public attachment URLs.
- Database reservations, quotas, ordered one-to-five-photo model, worker lifecycle, private reader,
  cleanup/outbox controls, and client reserve/upload/validate/create/cancel/retry workflow exist.
- Source/CI security and contract evidence is green. Hosted Storage, worker interoperability, and
  real-device upload/playback remain deliberately disabled or unclaimed until their later gates.

### Registered-user Shared Wall lifecycle

- Users can search public Shared Walls and see real privacy, membership, and action states.
- Creation supports Public/Private Walls and Public Open Join ON/OFF, then opens the created Wall.
- Public open-join membership is actor-bound and idempotent; posting remains owner/member-only.
- Owners can invite registered users, view the management roster, revoke invitations, remove
  members, and invite removed people back.
- Invitees can accept or decline. Members can leave. Removed users cannot bypass the owner by
  immediately rejoining an open Wall.
- Owners cannot create self-membership or simply leave. Ownership transfer is atomic: the accepted
  target becomes owner and the previous owner becomes a member.
- Owners can delete a Shared Wall only through strong confirmation; stale destinations fail safely.
- Shared-Wall Alerts and deferred routes cover invites, accepted invites, Shared Marks, and
  ownership transfer with graceful unavailable fallbacks.
- Public/private, block, active-account, roster-privacy, exact-result, race, and owner-identity
  boundaries are backend-enforced and covered by the green regression suite.

## Verification boundary

**Verified** for exact tree `ef8f8d759689d23dfed9a0e02806a413008d7722`:

- CI run `134` passed TypeScript, lint, and the complete PostgreSQL security regression suite,
  including migrations `0027` and `0028` plus idempotent replay.
- Independent local QA passed all 30 client/contract tests, Expo configuration validation, and both
  iOS and Android exports.
- Independent review issued a final **APPROVE** verdict for the exact tree.
- Independent QA issued **PASS** for source and CI evidence.
- Shared-Wall lifecycle, server-bound expected-user enforcement, settings management, and their
  security/race cases passed the exact-tree verification path.

**Unverified and not included as completed production behavior:**

- Hosted Supabase migrations, Auth/RLS/Storage behavior, Edge Functions, worker dispatch/processing,
  signed media delivery, deletion jobs, and legacy-media reconciliation.
- Real hosted accounts and multi-user staging journeys.
- Physical iOS/Android layout, camera/microphone permissions, uploads, playback, background/resume,
  and adverse-network behavior.
- VoiceOver, TalkBack, large text, switch control, contrast, and reduced-motion system verification.
- Measured startup/render/upload performance and representative low-memory/poor-network behavior.
- Push notifications, universal HTTPS/App Links, store fallback, and install-to-intent restoration.
- EAS/TestFlight/Play builds, store review material, production operations, and public release.

## Conservative progress model

“Implementation coverage” describes how much of each workstream now exists in reviewed source.
“Credited readiness” deliberately discounts that coverage when hosted, device, operational, or
release evidence is still absent. The credited points—not raw implementation arithmetic—form the
conservative 63% milestone.

| Workstream | Portfolio weight | Implementation coverage | Credited readiness |
|---|---:|---:|---:|
| Product, UX contract and architecture | 10% | 100% | 10.0% |
| Foundation, auth and onboarding | 10% | 80% | 6.5% |
| Core backend and permission security | 20% | 92% | 16.0% |
| Core Wall and Mark client journeys | 15% | 70% | 9.0% |
| Friends, followers and Shared Walls | 15% | 85% | 10.5% |
| Protected media end to end | 10% | 75% | 5.0% |
| Alerts, settings, safety and deep links | 10% | 65% | 5.0% |
| Device QA, accessibility, performance and release | 10% | 10% | 1.0% |
| **Total production-ready MVP** | **100%** |  | **63.0%** |

The un-discounted coverage percentages would produce 75.65 points under simple multiplication.
Publishing that as overall progress would overstate readiness because major hosted/device/release
boundaries have not been exercised. The evidence discount keeps the claim honest.

## Remaining 37%

- Complete the remaining visual/device-only follower, Status, Wall-switcher, and Wall/Mark polish
  after physical-device evidence is available.
- Complete Alerts beyond the Shared-Wall journeys and finish moderation operations UI.
- Finish universal links, store fallback, sharing/install restoration, and missing/deleted
  destination handling across every supported link type.
- Deploy and validate the complete protected-media stack in non-production hosted infrastructure;
  reconcile legacy media and perform the separately gated cutover only after adversarial evidence.
- Validate migrations, RLS, Auth, Realtime, Alerts, and all three-user acceptance journeys using
  real hosted accounts.
- Run physical iOS/Android, accessibility, performance, lifecycle, offline, hostile-network, and
  security/privacy testing; fix findings and repeat.
- Produce TestFlight and Play internal builds, finish store/privacy/operational material, and prepare
  the Founder READY/NOT READY release report.

## Known risks and blockers

- Reviewed source and green CI do not prove hosted Supabase/Storage/worker interoperability.
- Protected media must remain production-disabled until hosted processing, cleanup, signed reads,
  legacy reconciliation, and device tests pass.
- Shared-Wall usability and accessibility have not been observed on physical devices.
- Push, universal links, store fallback, and release operations remain open.
- Public release remains a Founder Gate. Merge, hosted migration, paid infrastructure, production
  data changes, and deployment are outside this milestone.

## Next Actions

1. Keep the live draft PR head unchanged while exact-tree CI, independent Reviewer certification,
   and then QA run in that order; restart certification if the head changes.
2. Select the public domain, then complete universal HTTPS links, store fallback, and
   install-intent restoration.
3. Stand up a non-production hosted Supabase/worker environment and execute full multi-user tests.
4. Run physical-device, accessibility, performance, lifecycle, and adversarial QA.
5. Prepare internal iOS/Android builds and the plain-language Founder READY/NOT READY report.

## Founder decision required

None for continued local/draft development. Founder approval is required before merge, hosted or
production changes, paid infrastructure, destructive data operations, or public release.
