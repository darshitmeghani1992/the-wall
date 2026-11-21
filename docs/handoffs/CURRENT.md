# CURRENT — Operational Handoff

## BETA-P0-04 · Account and identity definer source trace — 21 Nov 2026

ARCHITECT assigned BACKEND to trace six account and identity routines at draft candidate `cb27cc65b91e4c1249953020ba5c592fab4296bb`. The staging definer handoff records migrations, actor guards, callers and existing regression coverage, including the 0029 versus withheld 0031 reactivation behavior. Source evidence only. Independent review and hosted actor verification remain pending. Next BACKEND audit slice is the Wall and member routines. Candidate CI is tracked separately on #91. Core + Enhanced Beta remains NO-GO.

## BETA-P0-01 · Integrated regression candidate — 21 Nov 2026

ARCHITECT selected this internal draft to bring three independent test changes onto one reviewable revision. Base [#87](https://github.com/darshitmeghani1992/the-wall/pull/87) `7ec1e31507fabe93fd6279b9e2bc03e65506d200` retains the fixture-shape check and passed [CI #267](https://github.com/darshitmeghani1992/the-wall/actions/runs/44895508196) (4/4). The integrated SQL test matches [#88](https://github.com/darshitmeghani1992/the-wall/pull/88) `a40b33c26cb4ff5146819ba55912dcad4f0503b8` byte for byte. The integrated Mark edit/delete source contracts match [#89](https://github.com/darshitmeghani1992/the-wall/pull/89) `acc7fe56ee84c43b66a8d09c2bb9ee7461c4eeca` byte for byte. The independent drafts remain open.

**Verified locally.** Twelve targeted JWT mock and Mark source checks passed, and the DB runner passed shell syntax. The full disposable SQL run requires GitHub CI because PostgreSQL is unavailable locally. GitHub CI, independent Reviewer and independent behavioral QA must bind to the new candidate's exact head. Real staging JWT/OTP and device evidence require verified SMTP, authorized actors and an approved preview/device path.

**Next.** Verify exact candidate CI, route the 351-path source baseline and new regressions to independent Reviewer, then run independent QA on the same revision. Remaining BACKEND work can continue separately with the BETA-P0-04 definer callsite audit within existing contracts. Keep Enhanced Beta NO-GO pending release gates.

## 21 Nov 2026 · BACKEND three-JWT HTTP fixture-shape hardening

Branch `codex/beta-three-jwt-fixture-kind-20261121-run2` is based on #86 corrected commit `5e6c5de25489b4ddd365382788c5551523622ff1`. In `scripts/staging-three-jwt-readonly.mjs` an owner/member's positive result now must be a `shared`, `private` Wall with requested ID; tests reject Personal/public false fixtures even if the GET count looks right. Six read-only staging requests remain the contract; no actor sign-up or tokens supplied. The pre-existing JWT identity checks remain. `tests/staging-three-jwt-readonly.test.mjs` and the controlled preparation runbook updated. Check exact-head CI, obtain independent Reviewer/QA, and execute genuine hosted actor/OTP after Founder-approved setup. No beta GO, no irreversible action.


## 21 Nov 2026 · BACKEND suspended owner test handoff

Branch `codex/beta-suspended-owner-returning-tests-20261121-run2` is an isolated child of PR #85 immutable docs+application candidate (SHA `3e13b30cde449ac8023edaf01df6b1b35a8a734a`). Added negative `SELECT` and `INSERT RETURNING` for an existing Shared Wall owner with `profiles.account_status='suspended'`, using the disposable transaction in `supabase/tests/73_shared_wall_owner_returning.sql`; no migration or hosted write. Preserve and independently review BETA-P0-01 lineage audit. GitHub CI must run on **this branch's new head**; no local Postgres executable exists in this environment. Real JWT actors/OTP and Reviewer/QA remain open. Next: check exact CI; independent Reviewer check SQL denial assertions; QA verify unchanged head, then perform hosted actors when approved; keep all Founder launch gates.


## 21 Nov 2026 · BETA-P0-01 application lineage integrated (ROLE: ARCHITECT)

This new isolated draft follows #84 source head `f583ca520ad0dfa3b452dfc7ae85ece016597498` and incorporates the **byte-identical** #74 artifact `docs/handoffs/PR_LINEAGE_AUDIT_2026-11-21.md`. Fresh compare from #67 confirms #74's docs-only lineage and #84's test/harness lineage; #81 tooling remains a parallel, **excluded** draft (shared continuity docs reconciled here, not silently cherry-picked). Exact source equivalence rechecked for MarkDetailModal blob `23a4e1159e258ae19a8636c2927961f75b0fab84` and media URL policy blob `88b235eb5c818b110abcd798ec63af766c1414aa`. Audit confirms 351 main→#30 changed blob paths; **semantic** audit still OPEN. #84 prior CI 44892196400 green, but new head requires its own CI; no independent Reviewer or QA observed. No staging actors; pg_cron absent. NEVER call this beta GO or merge/deploy on this evidence.

**Next owner/task:** independent REVIEWER on exact new PR SHA for semantic source/security + cross-PR provenance, independent QA for unchanged candidate; BACKEND separate security test work while external verified SMTP/authorized actors block hosted three-JWT E2E. Continue queue BETA-P0-01/04 from BUILD_STATUS, hold all Founder gates.


## BETA-P0-04 · Moderation concurrency test ordering — 21 Nov 2026

**ROLE: BACKEND test implementation.** Branch `codex/beta-moderation-race-readiness-20261121` stacks on [#83](https://github.com/darshitmeghani1992/the-wall/pull/83) at `e2e85511fdada01e6f5a1c9eb05b8980d0fca871`. The Shared Wall test passed on disposable PostgreSQL 16. The same suite then failed in test 96 when two sessions raced to claim the final normal-removal quota slot. The harness now waits for the first session to hold its transaction open and verifies that the contender reached a lock wait in all six quota, deactivation and suspension scenarios. All six passed in a targeted PostgreSQL 16 run. GitHub CI and independent Reviewer/QA must bind to this PR's exact head.

**Next:** complete the exact-head database suite and independent handoff, then incorporate #74's audit notes. A file-level scan from #67 found that #81 and #83 intersect only in three continuity documents. Real staging JWT/OTP and device evidence remain pending. Enhanced Beta remains NO-GO.


## BETA-P0-04 · Shared Wall write regression integration — 21 Nov 2026

**ROLE: ARCHITECT integration → BACKEND test implementation.** Branch `codex/beta-shared-wall-regression-integration-20261121` preserves both draft parents, #82 at `a019b54b20bf67b3cf1885cb9d439529a3ed2b2b` and #75 at `a7e40b0228acda35c547b82ad252fe4e3d040e49`. Test commit `5e771ee55957e1a85dc422d425a70176a7a90e02` adds plain INSERT denials alongside INSERT RETURNING and a successful own-wall write by the active outsider. This checks the write guard independently of the SELECT policy. The tests use a disposable Postgres transaction. The staging JWT preflight stays on the same branch.

**Evidence and routing:** GitHub reports CI for the published PR head, including this handoff commit. Independent Reviewer should check both parents and the SQL assertions. Independent QA should verify the unchanged PR head, then run the authorized three-actor read-only HTTP smoke when staging actors and OTP are available. No hosted database, deployment, release flag or production change. Enhanced Beta remains NO-GO.

**Exact next engineering task:** BETA-P0-01, reconcile #74's file-level audit evidence with this integrated draft and check remaining sibling PRs for source overlap before proposing an immutable release candidate. Live staging actor testing remains gated separately.


## BACKEND staging JWT audit key and actor guard — 21 Nov 2026 (draft only)

**ARCHITECT sequencing → BACKEND implementation; BETA-P0-04.** New isolated branch `codex/staging-jwt-public-key-guard-20261121` descends from #77 head `3a79cdd2fb6e15fb1a6df5edefc4550b26d4eaf9` (CI 44886602983 success, no independent reviews). Read-only HTTP audit refuses service-role or secret API keys and JWTs without staging authenticated user role, subject, issuer, audience, expiry before network. Local claim decoding **does not verify signatures**, so existing server-side Auth identity check is mandatory. Added no-network hostile tests and legacy public anon-key positive test. No staging authorized three-actor fixture exists: **no real hosted JWT RLS test has run**. No Supabase write, production, deployment or feature activation. Next: new PR immutable-head CI and independent Reviewer/QA, then live authorized fixture. Enhanced Beta NO-GO.



## Three-actor authenticated HTTP negative harness PREPARED — 21 Nov 2026 (BACKEND only)

Current isolated branch `codex/staging-three-jwt-readonly-20261121` based on application PR #67 `ebdf28c196a3f50e4b5218dd6038d12277d12953`. New opt-in, read-only 3-JWT staging HTTP probe and mocked unit tests + `docs/handoffs/STAGING_3_JWT_HTTP_READONLY_PREP_2026-11-21.md`. **No real JWT/auth user; no hosted execution**; staging has zero Auth users, Wall fixtures and marks. Exact next action: verify immutable PR CI tests (Node `test:contracts`), genuine independent Reviewer/QA; only after verified SMTP and authorized actors exercise six actual GETs then expand to caller-negative writes in separately approved disposable context. Media/Secret/analytics OFF, deletion 0031 withheld; production and Apple/domain protected. First Enhanced Beta NO-GO.


## Integrated internal source — 21 Nov (PR #67)

**Current draft-only internal candidate:** [PR #67](https://github.com/darshitmeghani1992/the-wall/pull/67) combines [PR #64](https://github.com/darshitmeghani1992/the-wall/pull/64) staging audit/queue/handoff documentation (ancestor head `2c919ee1728fe48a157ab282eb8bcb7ce73a0cf7`) and source/test blobs from sibling BACKEND [PR #65](https://github.com/darshitmeghani1992/the-wall/pull/65) at head `d3396bfd72ac58c926245ed9b5905d7c67673e48`. Confirmed integrated worker blobs **exactly equal** #65's: source `88b235eb5c818b110abcd798ec63af766c1414aa`, tests `8473f47ca63d9096ad245ec7ec7512246df9f4b5`. Branch `codex/internal-beta-verified-security-candidate-20261121`; **live GitHub PR head/CI must be resolved fresh** because this handoff changes the SHA. This does not supersede #30's historical lineage or waive verification of older draft security diffs.

**Exact next actions:** check 4/4 CI for immutable PR #67 head, independent Reviewer source/security inspection, independent QA. Product/security decision on removed-Secret reveal [issue #66](https://github.com/darshitmeghani1992/the-wall/issues/66); all three live JWT actor flows, SMTP six-digit OTP, installed-device media/Secret/deletion runtime, nonproduction egress ACL, hosted 0031 gate remain open. Media/Secret OFF, Apple/domain held, no tester invitations/production or `main` merge. **NO-GO**.


## Active continuation — 21 Nov 2026 13:08 IST (ARCHITECT/BACKEND, source-only)

**Latest unmerged source head:** draft [PR #63](https://github.com/darshitmeghani1992/the-wall/pull/63), `codex/media-signed-token-shape-20261121` at `fdf1fbbcd342100b5a958eb7af95281650b973a2` (base PR #62 at `340b55431ca09d504351a52db4ef33c88904648b`; source diff only worker URL policy and regression tests). PR #63 [CI #229](https://github.com/darshitmeghani1992/the-wall/actions/runs/44881091871) **SUCCESS 4/4** on this exact SHA; previous [CI #228](https://github.com/darshitmeghani1992/the-wall/actions/runs/44881008244) failed and is superseded **for CI evidence only**, not as an independently reviewed source. PR #62 [CI #227](https://github.com/darshitmeghani1992/the-wall/actions/runs/44877580399) 4/4 green. Both PRs still draft and unmerged; PR #63 Reviewer and QA not submitted at inspection. **Do not self-certify**.

**This handoff/documentation-only branch:** `codex/architect-staging-security-triage-20261121` began at PR #63 exact head. Its docs changes require their own published SHA and fresh CI; no code/runtime/SDK/flags/infra modified by the docs branch. Ancestry check: PR #63 three commits ahead of PR #62, and 223 ahead of `main` at `5f1f7ff4c8b8afa8c8e606f41c768c7c7721b613`, zero behind. Retain #30 and #34–#61 as review lineage, not merged history.

**Verified staging read-only SQL and migration inventory:** `ewintxgdxdvschiqodkq` ACTIVE_HEALTHY. Migrations `0001`–`0030`, `0032`–`0034` applied; `0031` not applied. Catalog: 113 public SECURITY DEFINER routines, 59 executable by authenticated (33 direct + 26 trigger functions), zero by anon, 54 not executable by either, 0 without explicit `search_path`. All 33 direct include `auth.uid()` reference; **no behavioral authorization proof**. No staging Auth users, Walls, Marks, private bucket objects; `mark-media` bucket private; `pg_cron` absent. See `docs/handoffs/STAGING_DEFINER_CALLER_TRIAGE_2026-11-21.md` for SQL, categories, and limits. **Original `wfsfafmgvxevpzrurofz` untouched**.

**New sibling code slice (published after this documentation branch was created):** draft [PR #65](https://github.com/darshitmeghani1992/the-wall/pull/65) `codex/media-ipv6-transition-egress-20261121`, head `d3396bfd72ac58c926245ed9b5905d7c67673e48`; [CI #231](https://github.com/darshitmeghani1992/the-wall/actions/runs/44881521179) **4/4 SUCCESS**. Changes worker IPv6 transitional private-network URL checks and mocked DNS security tests only. PR #64 docs and PR #65 code are *parallel children of #63*, not an integrated candidate; later ARCHITECT reconciliation and exact-tree Reviewer/QA are required. The new [issue #66](https://github.com/darshitmeghani1992/the-wall/issues/66) tracks the unverified removed-Secret RPC source-level risk; do not activate Secret. Three actor-bound admin RPCs show expected-actor/auth.uid, admin role, lock and moderation audit source guards; legacy overloads cannot be executed by authenticated per catalog. These do not substitute for JWT HTTP tests.

**Exact next action:** independently trace and test high-risk exposed Admin RPCs and `reveal_secret` against migration contract and actor-specific permissions (ROLE: BACKEND) on a separate branch; do not modify this documentation branch with application code. Check documentation PR exact-head CI and request genuine Reviewer/QA. Continue file-level reconciliation for older PRs; don't merge or deploy before all gates. SMTP/six-digit OTP and three actual authorized JWT actors, worker runtime, Secret expiry scheduling, deletion 0031, and physical-device validation remain blockers. Media/Secret/analytics OFF, 0031 withheld, Apple/domain held. First beta including Enhanced Beta remains **NO-GO**.


## Active handoff — 21 November 2026 (ARCHITECT, first-beta execution)

- **Resume source:** PR #58 `codex/mark-pin-write-confirmation-2026-11` head `4cfd9f9d2a782fc1cd956d282953e227505773d3`; CI run #221 passed 4/4, independent review/behavioral QA not submitted. PR #30 is an ancestor, not a separate competing candidate: 26 commits from #30 to #58, 210 from `main` to #58. Do not merge or deploy based only on CI.
- **Active documentation branch:** `codex/architect-beta-execution-queue-20261121` is based on #58 and carries the current queue / decision / handoff only; verify its head and CI separately after publishing.
- **New isolated slices:** PR #59 on architect queue branch (initial head 92b6750; CI #222 pending) and PR #60 on frontend race-fence branch (head 4595c1e; CI #223 pending). These are parallel children of PR #58, not a single integrated candidate. Keep branches separate until Reviewer/QA-approved reconciliation.
- **Integrated internal candidate:** PR #61 `codex/internal-beta-candidate-20261121` combines #59 docs and #60 byte-identical Mark-detail race fix; fresh CI and independent Reviewer/QA are mandatory. Query live head SHA (a commit cannot include its own published SHA).
- **Priority and exact next task:** BETA-P0-01 reconcile older PR overlap and request genuine independent Reviewer/QA for immutable candidate; then BETA-P0-04 security caller-triage read-only work and P1 media/Secret runtime test preparation while external SMTP blocks real-user QA.
- **Staging:** `ewintxgdxdvschiqodkq`; original `wfsfafmgvxevpzrurofz` protected, no writes authorized by this handoff. Migrations 0001–0030 + 0032–0034; 0031 withheld; media/Secret switches OFF, pg_cron absent. Keep all incomplete first-beta features disabled in tester builds until independently proven.
- **Founder hold:** owned domain/DNS, Apple Developer/signing/TestFlight. OTP real delivery via verified sender is still a hard release gate; do not solicit secrets in chat.
- **Current source of truth:** `docs/BUILD_STATUS.md` top active execution queue; this handoff does not replace its detailed entries. If another run is writing to the candidate, work on an isolated branch.


> Restart state only. Product authority is `THE_WALL_MASTER_BUILD_SPEC_v1.1.md`; AIOS governance
> authority is `docs/aios/`. Detailed progress is in `docs/BUILD_STATUS.md`.

## Current continuation — 20 November 2026 (release sprint)

The section below supersedes the historical September operational snapshot for **current** work,
without modifying the locked product/AIOS authorities. GitHub live PRs remain the authority for
an exact source SHA, CI, independent Reviewer and QA certification. The latest release-sprint
source is the release-sprint continuation branch `codex/launch-restart-checkpoint-2026-11`.
**Resolve the current published PR head/tree/CI from GitHub before certifying.** Its verified
parent is draft PR #51, commit `3c04c543fce4e3be628e5562b1c5a2a93cbb1c74`, tree
`40ef0b5e01ecc1efe55f7f0fcf592a51e636c587` (parent CI **4/4 green**).
Latest continuation adds a default-OFF Secret composer pending confirmed one-hour expiry cron,
and explicit operational runbooks. Independent Reviewer/QA on the newest tree remain pending.
See `docs/handoffs/LAUNCH_SPRINT_CHECKPOINT_2026-11-20.md` for exact staging state,
proven invariants, build, rollout gates, and first next action. **Do not resume from old PR #22**
without first examining the current stacked release-sprint candidate.

**Next:** independent Reviewer then QA on unchanged tree; domain+verified OTP SMTP and Apple
Developer signing on 21 Nov; actual Android multiuser/device QA; protected media remains OFF until
worker runtime/isolated container controls pass; recoverable account deletion 0031 withheld;
Secret expiry cron prepared but not activated; Secret composer default OFF until verified. No merge or production deploy authorized.

## Historical corrective candidate — 2026-09-22

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
