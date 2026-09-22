# CURRENT — Operational Handoff

> Restart state only. Product authority is `THE_WALL_MASTER_BUILD_SPEC_v1.1.md`; AIOS governance
> authority is `docs/aios/`. Detailed progress is in `docs/BUILD_STATUS.md`.

## Corrective candidate — 2026-09-22

Draft PR `#22` has a corrective candidate under exact-tree certification. Source implementation remains about
80%; the prior third-party audit estimated 76% source + CI and 46% production readiness because
hosted/device/release evidence is absent. The last independent source-and-CI certification is 63%.

| Evidence | Exact value |
|---|---|
| Current exact candidate | Resolve the live PR `#22` head/tree from GitHub before acting; a commit cannot embed its own final SHA |
| Current CI and review | Resolve from live PR `#22`; keep its head unchanged throughout Reviewer → QA certification |
| Historical parent | `b1ee22ff70a3b0f9ad6ee27e462a2f8b5a9b58d4` (tree `0deab208e5e5b54f12b8312239a84ed32cd92bb8`), CI run `171` passed |
| Latest recorded review | Review `5275238121` blocked the first continuity correction because it still called the historical parent current |
| Certification | Requires CI green + independent Reviewer APPROVE + QA PASS on one unchanged PR head |
| Delivery state | Draft, unmerged, undeployed |

No hosted migration, production-data change, merge, deployment, or public release occurred. The
corrective slice addresses audited deletion, executable-test, Expo/dependency, icon, OTP, and CI
gaps. Review remediation makes recovery fail closed until its server status is known, protects
rollback from concurrent requests, continues deletion batches after a per-account failure, and
associates input labels with native controls. Universal-link/store-fallback work is blocked only on the public domain selection. Hosted
execution and physical-device validation remain later gates.

The published candidate reconciles the supporting Product/Architecture documents with the Master
Build Specification, removes excluded prototype features from the launch backlog, and removes the
unused Skia native dependency left by the excluded Doodle feature. Fresh independent verification
on 2026-09-22 passed TypeScript, lint, all 74 client/contract tests, Expo Doctor 17/17, both mobile
exports, and all 31 media-worker tests. The first published documentation correction then passed
CI, but independent review correctly blocked it because this handoff still labeled its historical
parent as current. This self-stable correction removes that stale label and the already-completed
publish instruction. GitHub is authoritative for the resulting exact commit/tree and CI; bind
fresh Reviewer and QA decisions to that unchanged live PR head.

## Published source correction — exact Mark sharing

This tree adds strict focused-Mark share links for received, non-Secret Marks. The share boundary
uses the existing durable deferred-destination contract, rejects malformed Mark/container IDs,
keeps Secret Marks unshareable, and never copies protected-media URLs. Contract tests round-trip
both Personal and Shared destinations through the existing parser. See
`docs/handoffs/FRONTEND_EXACT_MARK_SHARING_2026-09-22.md` for the implementation evidence and honest
device/domain boundary. Publication is complete; resolve the current head, CI, Reviewer, and QA
state from live draft PR `#22`, and do not reuse verdicts from an earlier head.

## Active source scope — moderation operations history pagination

This working tree adds Open, Closed, and Audit views to the existing protected moderation surface.
It reuses the current admin-only report/action-log policies, binds both reads to the initiating
account, and does not change schema, RPCs, dependencies, deployment, or production data. See
`docs/handoffs/FRONTEND_MODERATION_HISTORY_2026-09-22.md`. Determine publication, CI, Reviewer, and
QA state by comparing the exact Git tree with live draft PR `#22`; never carry verdicts across a
head change. The local continuation replaces the former 200-action ceiling with deterministic
50-row keyset pages, validates the cursor before constructing the PostgREST filter, suppresses
duplicates across page boundaries, isolates older-page failures from the open queue, and directly
tests all optional-history rejection combinations. It remains unpublished until the exact tree is
present on the draft PR.

## Source continuation — complete Alert history

The working tree extends actor-bound in-app Alerts from a silent newest-100 cap to deterministic
50-row keyset pages. Older-page failures preserve visible Alerts and remain retryable; optional
actor/Wall metadata failures no longer erase the primary recipient-owned rows; shared cursor
validation rejects malformed and injectable values; and delayed pages cannot cross account or
focus boundaries. Existing receipt, trigger, RLS, Anonymous/Secret, and routing contracts remain
unchanged. See `docs/product/PRD-ALT-002-alert-history-pagination.md`,
`docs/architecture/FP-ALT-002-alert-history-pagination.md`, and
`docs/handoffs/FRONTEND_ALERT_HISTORY_2026-09-22.md`. Resolve publication, CI, Reviewer, and QA
state only by comparing this exact tree with live draft PR `#22`.

## Certified draft checkpoint — 2026-09-15

The authorized draft integration branch `codex/integrated-mvp-resume` is now at a conservative
**63% production-ready MVP milestone** for source-and-CI evidence. Draft PR `#22` remains unmerged
and undeployed.

| Evidence | Exact value |
|---|---|
| Remote checkpoint commit | `d78eada458c2fbfff14106cb7e28055ee4d1e768` |
| Local equivalent commit | `8489c052bc3a5a14eb2ce42b752d5ab97632fb3d` |
| Exact tree | `ef8f8d759689d23dfed9a0e02806a413008d7722` |
| Development branch | `codex/integrated-mvp-resume` |
| Draft PR | `#22` |
| CI | Run `134` (`34940126150`) — green |
| Independent review | **APPROVE** for the exact tree |
| Independent QA | **PASS** for source + CI |
| Delivery state | Draft, unmerged, undeployed |

No hosted migration, production-data change, merge, deployment, or public release occurred.

## Latest completed slice

- Server-bound expected-user enforcement is present through migration `0027` and its regression
  suite, preventing stale clients from mutating after an account switch.
- Personal Wall privacy, writer policy, and Anonymous Marks settings have an explicit actor-bound
  save flow with unsaved-change protection.
- Approved writers can be searched, added, and removed without changing friendship/follow state;
  approvals persist when the policy changes.
- Blocked users can be listed and unblocked. Migration `0028` adds a narrow outbound-only,
  privacy-minimized read function with exact ACL, actor precedence, and deterministic 20+1 cursor
  pagination. It does not weaken profile RLS.
- CI loaded and replayed both migrations and passed the full PostgreSQL security suite.
- Independent review and QA approved exact tree `ef8f8d75...`; all 30 client/contract tests,
  TypeScript, lint, Expo config, and iOS/Android production exports passed.

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

**Current checkpoint, independently verified:** TypeScript passes; lint passes with zero errors and
nine pre-existing warnings; all 30 client/contract tests pass; Expo public configuration resolves;
and iOS and Android production exports complete. CI run `134` passed the complete PostgreSQL
security suite. Independent review approved and QA passed the exact tree.

**Not verified:** hosted Supabase, real hosted accounts, Storage/Edge/worker interoperability,
physical iOS/Android behavior, accessibility, performance, adverse networks, push notifications,
universal links/store fallback, EAS/TestFlight/Play builds, production operations, and release.

A source surface is not production-ready merely because it exists or passes CI. Protected media
remains gated until hosted processing, signed reads, cleanup, legacy reconciliation, and real-device
tests pass.

## Conservative 63% model

Implementation coverage records reviewed source breadth. Credited readiness applies an evidence
discount for untested hosted/device/release boundaries and is the number used for overall progress.

| Workstream | Weight | Implementation coverage | Credited readiness |
|---|---:|---:|---:|
| Product, UX contract and architecture | 10% | 100% | 10.0% |
| Foundation, auth and onboarding | 10% | 80% | 6.5% |
| Core backend and permission security | 20% | 92% | 16.0% |
| Core Wall and Mark client journeys | 15% | 70% | 9.0% |
| Friends, followers and Shared Walls | 15% | 85% | 10.5% |
| Protected media end to end | 10% | 75% | 5.0% |
| Alerts, settings, safety and deep links | 10% | 65% | 5.0% |
| Device QA, accessibility, performance and release | 10% | 10% | 1.0% |
| **Total** | **100%** |  | **63.0%** |

The implementation percentages alone would yield 75.65 points. The 63% claim is intentionally lower
because hosted, device, accessibility, performance, and release evidence is still missing.

## Remaining 37% — recommended order

1. Complete remaining Alerts destinations, reporting/moderation UI, recoverable account deletion,
   and follower/friend polish.
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

Keep `codex/integrated-mvp-resume`, draft PR `#22`, and all predecessor branches unmerged and
undeployed. Continue with remaining Alerts destinations, reporting/moderation, recoverable deletion,
and link/device edge cases through the normal Product → Architecture → implementation → Reviewer →
QA flow. Do not apply hosted migrations, merge, or deploy without a new Founder authorization.
