# CURRENT — Operational Handoff

> Restart state only. Product authority is `THE_WALL_MASTER_BUILD_SPEC_v1.1.md`; AIOS governance
> authority is `docs/aios/`. Detailed progress is in `docs/BUILD_STATUS.md`.

## Integration candidate — 2026-09-14

The authorized draft integration branch `codex/integrated-mvp-resume` combines the exact
`codex/protected-media-foundation` head `c0ec0eb` with the additive Settings, social-list,
Block/Report, and auth-safe Shared-Wall-link work from `codex/resume-mvp-sep8` at `b1e6302`.

The integration deliberately retains the newer protected-media, actor-bound account-routing,
capability-driven contribution, Alerts, and RPC-only Shared-Wall contracts. It excludes the older
profile-derived account gate, obsolete Notifications modal, and direct Shared-Wall membership
mutations. No schema or migration was added by the integration.

This candidate is **unmerged and undeployed**. The prior 60% checkpoint remains the last certified
production-readiness claim until an independent Reviewer approves this exact integration and QA
passes the same version. Do not publish a higher percentage from source breadth alone.

## Certified baseline — 2026-09-10

The-Wall is at a conservative **60% production-ready MVP milestone**.

| Evidence | Exact value |
|---|---|
| Remote milestone commit | `ac2d339` |
| Local equivalent commit | `b536e1d` |
| Exact tree | `08907e3aec30db9fa025b6cf38e867cccefd1667` |
| Development branch | `codex/protected-media-foundation` |
| Draft PR | `#19` |
| CI | Run `127` (`34454622762`) — green |
| Independent review | Backend **APPROVE**; Frontend **APPROVE** |
| Independent QA | **PASS** for source + CI |
| Delivery state | Draft, unmerged, undeployed |

No hosted migration, production-data change, merge, deployment, or public release occurred.

## What the checkpoint contains

- Founder-approved product/UX contract and architecture, including the protected-media design.
- Expo/React Native foundation, Supabase client, primary navigation, authentication groundwork,
  corrected account routing, retry-safe setup, once-only walkthrough, and deferred-route handling.
- Core database authorization for Personal/Shared Walls, friendships, follows, approved writers,
  blocking, reactions, Anonymous/Secret handling, moderation, and account lifecycle.
- Personal/Other Wall and Mark surfaces, Status, integrated composer, protected media display/write
  clients, Mark actions, reactions, and safety operations, with remaining device/polish work.
- Correct Discover people and relationship journey with privacy-safe counts, capability-driven
  contribution, and fail-closed inaccessible states.
- Protected-media source foundation: private canonical storage/read model, reservations, quotas,
  ordered five-photo support, operations/cleanup controls, trusted-worker foundation, and client
  reserve/upload/validate/create/cancel/retry behavior. Public attachment URLs are not the supported
  Mark-media path.
- Registered-user Shared Wall lifecycle: public search; Public/Private creation; Open Join ON/OFF;
  member-only posting; invite/accept/decline; roster privacy; revoke/remove/invite-back; member
  leave; atomic ownership transfer; strong-confirm deletion; and Shared-Wall Alert/deferred routes.
- A removed member cannot immediately bypass the owner through Open Join. Open Join remains
  available to other eligible users, and an owner may deliberately invite the removed user back.
- Owner self-membership is forbidden: the owner is represented only by `walls.owner_id`; transfer
  atomically makes the previous owner an accepted member.

## Verification boundary

**Certified baseline:** CI run `127` is green on exact tree `08907e3a...`; TypeScript, lint, and the complete
PostgreSQL security regression suite pass in CI. Independently, local QA passed 11 client contract
tests, Expo configuration validation, and both iOS and Android exports. Final independent Backend
and Frontend reviews approved the exact candidate. Independent QA passed the source-and-CI
checkpoint.

**Current integration candidate, author-side Verified:** TypeScript passes; lint passes with zero
errors and nine pre-existing warnings; all 11 client contract suites pass; the media-writer contract
passes; the isolated media-processor build and all 31 worker tests pass; Expo public configuration
resolves; and iOS and Android production exports complete. `git diff --check` passes and no merge
markers remain. The PostgreSQL security suite is pending the draft-PR CI environment because this
workspace has no local PostgreSQL client or Docker.

**Current integration candidate, independently unverified:** code-level Reviewer approval and QA
behavioral verification on the exact integration commit have not yet occurred. Parent approvals do
not compose across a merge.

**Not verified:** hosted Supabase, real hosted accounts, Storage/Edge/worker interoperability,
physical iOS/Android behavior, accessibility, performance, adverse networks, push notifications,
universal links/store fallback, EAS/TestFlight/Play builds, production operations, and release.

A source surface is not production-ready merely because it exists or passes CI. Protected media
remains gated until hosted processing, signed reads, cleanup, legacy reconciliation, and real-device
tests pass.

## Conservative 60% model

Implementation coverage records reviewed source breadth. Credited readiness applies an evidence
discount for untested hosted/device/release boundaries and is the number used for overall progress.

| Workstream | Weight | Implementation coverage | Credited readiness |
|---|---:|---:|---:|
| Product, UX contract and architecture | 10% | 100% | 10.0% |
| Foundation, auth and onboarding | 10% | 75% | 6.0% |
| Core backend and permission security | 20% | 90% | 15.0% |
| Core Wall and Mark client journeys | 15% | 70% | 9.0% |
| Friends, followers and Shared Walls | 15% | 80% | 10.0% |
| Protected media end to end | 10% | 75% | 5.0% |
| Alerts, settings, safety and deep links | 10% | 50% | 4.0% |
| Device QA, accessibility, performance and release | 10% | 10% | 1.0% |
| **Total** | **100%** |  | **60.0%** |

The implementation percentages alone would yield 71.5 points. The 60% claim is intentionally lower
because hosted, device, accessibility, performance, and release evidence is still missing.

## Remaining 40% — recommended order

1. Complete Settings, approved-writer management, blocked-user controls, reporting/moderation UI,
   recoverable account deletion, and remaining Alerts destinations.
2. Finish universal/deferred links, store fallback, install-intent restoration, and graceful stale
   destinations across all supported object types.
3. Complete remaining Wall/Mark empty/loading/offline states and visual/accessibility polish.
4. Deploy the protected-media services to non-production hosted infrastructure, reconcile legacy
   media, and verify Auth/RLS/Storage/worker/cleanup behavior with real accounts.
5. Run full physical-device, accessibility, performance, lifecycle, offline/error, and adversarial
   security/privacy testing; fix and repeat.
6. Prepare TestFlight/Play internal builds, store/privacy/operations material, and the Founder
   READY/NOT READY release report.

## Resume instruction

Keep `codex/integrated-mvp-resume`, draft PR `#19`, and all predecessor branches unmerged and
undeployed. Finish the integration gate in this order: commit the resolved candidate; independent
Reviewer on the exact hash; QA on that approved hash; push the authorized draft branch and require
green PostgreSQL CI. After that, continue approved-writer management, blocked-user controls,
remaining Alerts destinations, recoverable deletion, and link/device edge cases through the normal
Product → Architecture → implementation → Reviewer → QA flow. Stop only at a real Founder Gate.
