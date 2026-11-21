# The-Wall Build Status

## Integrated internal security candidate (after #64/#65) — 21 Nov 2026

**ROLE: ARCHITECT controlled draft reconciliation.** The previous paragraphs below record historical work on separate branches. New [PR #67](https://github.com/darshitmeghani1992/the-wall/pull/67), branch `codex/internal-beta-verified-security-candidate-20261121`, **combines** the latest [PR #64](https://github.com/darshitmeghani1992/the-wall/pull/64) canonical audit docs with **byte-identical** worker source and test blobs from [PR #65](https://github.com/darshitmeghani1992/the-wall/pull/65). Origin: PR #64 docs head `2c919ee1728fe48a157ab282eb8bcb7ce73a0cf7`; source `workers/media-processor/src/url-policy.ts` blob `88b235eb5c818b110abcd798ec63af766c1414aa`; test blob `8473f47ca63d9096ad245ec7ec7512246df9f4b5`. GitHub contents reads confirmed both source blobs exactly match #65. This is a **draft internal verification candidate only**; no main merge, hosted deploy, Secret/media activation, real tester access or production change. The merged files are not a release certification.

**Independent verification gates:** query live PR #67 head and its own four CI job conclusions on the **unchanged head**; do not inherit #65 CI #231 or #64 CI #230. Reviewers and QA must independently approve/pass the exact integrated candidate; verify staging HTTPS/JWT actor tests and hardware/egress controls separately. Next after CI: source-level review of Secret risk [#66](https://github.com/darshitmeghani1992/the-wall/issues/66) and remaining RLS/RPC caller testing; request genuine independent Reviewer and QA; preserve original production, hold Apple/domain. **Beta GO = NO.**


## 21 Nov 2026 continuation — verified CI and staging caller inventory

**ROLE: ARCHITECT integration + BACKEND read-only security triage.** This continuation is a **documentation-only, isolated draft descendant** of the existing [PR #63](https://github.com/darshitmeghani1992/the-wall/pull/63) source candidate. No earlier open draft has been merged/closed; do not mark any feature complete merely from this audit.

- **Published source candidate:** PR #62 head `340b55431ca09d504351a52db4ef33c88904648b`: [CI #227](https://github.com/darshitmeghani1992/the-wall/actions/runs/44877580399) 4/4 SUCCESS. PR #63 (stacked on #62) head `fdf1fbbcd342100b5a958eb7af95281650b973a2`: [CI #229](https://github.com/darshitmeghani1992/the-wall/actions/runs/44881091871) **4/4 SUCCESS**, including media processor, Edge contracts, Type-check/lint and DB security tests. Initial PR #63 head `2d3ef895cee786595c61c772086515ab1182a817` had failed media test [CI #228](https://github.com/darshitmeghani1992/the-wall/actions/runs/44881008244) and was corrected before #229. Never reuse #228 for certification. Independent Reviewer/QA for #63 still **not present** at inspection.
- **Topology check:** `main` baseline `5f1f7ff4c8b8afa8c8e606f41c768c7c7721b613` is **223 commits behind** PR #63 head with zero commits ahead of the candidate per live compare. PR #63 is exactly **3 commits ahead** of PR #62 and zero behind; changed files solely `workers/media-processor/src/url-policy.ts` and its unit test. This does **not** replace review/QA of #30 and stacked #34–#61 code.
- **Staging read-only audit (2026-11-21):** `ewintxgdxdvschiqodkq` ACTIVE_HEALTHY. Public SECURITY DEFINER functions **113**; `anon` executable **0**; `authenticated` executable **59** = **33 direct routines + 26 trigger-returning functions**. All 113 declare a `search_path`; all 33 direct functions contain an `auth.uid()` reference, **not proof** of authorization. 54 are not executable by either role. See [caller-by-caller triage](handoffs/STAGING_DEFINER_CALLER_TRIAGE_2026-11-21.md).
- **Staging persistence checks:** migration ledger `0001`–`0030`, `0032`–`0034`; `0031` absent. `pg_cron` absent; `mark-media` private bucket exists with zero objects; zero staging Auth users, Walls and Marks at query time. None of these claims substitutes for actual 3-JWT API security tests or device testing.
- **Next independent BACKEND slice implemented:** [PR #65](https://github.com/darshitmeghani1992/the-wall/pull/65) head `d3396bfd72ac58c926245ed9b5905d7c67673e48` (sibling to documentation [PR #64](https://github.com/darshitmeghani1992/the-wall/pull/64); both descend separately from #63). The C3 worker now blocks IPv4-compatible, NAT64, 6to4 and Teredo IPv6 transition prefixes that can reach reserved IPv4, with adversarial mocked DNS tests and public IPv6 allow-case. [CI #231](https://github.com/darshitmeghani1992/the-wall/actions/runs/44881521179) **4/4 SUCCESS** on exact #65 head, including media processor; independent Reviewer/QA and hosted egress controls still **NOT VERIFIED**. Do not mistake parallel branches for one integrated candidate.
- **Additional security triage:** live staging definer signatures for three actor-bound admin RPCs contain expected-actor `auth.uid()` match, admin check, row lock and action-log writes; legacy unbound overloads show `authenticated_exec=false`. This is catalog/source inspection, not JWT behavior proof. [Issue #66](https://github.com/darshitmeghani1992/the-wall/issues/66) tracks a source-level potential removed-Secret reveal loophole; product/security contract and runtime tests required **before** enabling Secret.
- **Next unblocked tasks:** ARCHITECT file-level reconcile PR #64 docs and #65 code for a future integrated internal candidate; BACKEND inspect other directly executable definer guards and prepare adversarial tests. Obtain genuine independent Reviewer/QA; QA awaits verified SMTP and authorized real actors for full hosted E2E. **NO-GO** persists. **Do not** enable media/Secret, apply 0031, create users, invite testers, merge, or touch original production.
- **Evidence freshness:** this documentation-only branch changes the tree; its own GitHub CI and independent review must be checked on its *published* immutable head. The ancestor's #229 CI is **not** the doc branch's exact-head CI.


## Active beta execution queue — 21 November 2026 (ARCHITECT checkpoint)

**Authority:** Founder instruction of 21 Nov: the **first private beta includes core + Enhanced Beta**. The text-first candidate of issue [#57](https://github.com/darshitmeghani1992/the-wall/issues/57) is an **internal verification milestone, not a permitted externally distributed final beta**. Approval of extra feature scope does not bypass the existing migration, security, merge, independent review, operational or launch gates. Avoid domain purchase/DNS, Apple enrollment/signing/TestFlight until Founder resumes them. SMTP six-digit OTP for real testers remains a release blocker.

**Verified live GitHub topology at this checkpoint:** `main` `5f1f7ff4c8b8afa8c8e606f41c768c7c7721b613` → PR [#30](https://github.com/darshitmeghani1992/the-wall/pull/30) `ea755876d600ca5e9b01ab0d117b5b01c5c8f41c` (184 commits ahead of main) → the linear release draft chain #34/#35/#36/#38/#40/#41/#42/#43/#44/#46/#47/#48/#49/#50/#51/#52/#53/#54/#55/#56 → PR [#58](https://github.com/darshitmeghani1992/the-wall/pull/58) head `4cfd9f9d2a782fc1cd956d282953e227505773d3` (26 ahead of #30; 210 ahead of main; no behind commits). GitHub Actions [run #221](https://github.com/darshitmeghani1992/the-wall/actions/runs/44875356602) **four jobs SUCCESS** for PR #58 head. PR #58 has **zero submitted reviews**. The CI success does not prove independent QA, hosted HTTP/JWT security, actual device flows, or deployment readiness. Source changes after this SHA invalidate that run as proof for the changed SHA.

**Staging:** isolated `ewintxgdxdvschiqodkq` only; original `wfsfafmgvxevpzrurofz` untouched. Last direct read-only checks: migration inventory 0001–0030, 0032–0034; 0031 not applied, `mark-media` bucket private, `secret_mark_rollout` disabled, pg_cron extension absent, sensitive direct-table access denied at SQL-grant level. These checks are *not* substituted for authenticated HTTP tests. No service runtime flags toggled.

**Execution slices after queue initialization:** draft [#59](https://github.com/darshitmeghani1992/the-wall/pull/59) initial checkpoint head `92b67504153e1b447e772069e43c4819e57aabdc`, [CI #222](https://github.com/darshitmeghani1992/the-wall/actions/runs/44877106745) in progress at observation; new FRONTEND [#60](https://github.com/darshitmeghani1992/the-wall/pull/60) commit `4595c1e4a1472815e76e8549c69ddc9515500fd3`, [CI #223](https://github.com/darshitmeghani1992/the-wall/actions/runs/44877228367) queued. Both separate branches from #58, not merged or deployed. This status section must be reconciled with live GitHub every run.

**Internal integrated verification candidate:** draft [#61](https://github.com/darshitmeghani1992/the-wall/pull/61) `codex/internal-beta-candidate-20261121` based on #59, incorporating byte-identical PR #60 MarkDetailModal implementation (blob `23a4e1159e258ae19a8636c2927961f75b0fab84`). Resolve live head/tree/CI before any certification; independent Reviewer/QA remain absent. This is **not** a completed Enhanced Beta nor a merge into main.

**Resumable queue (single source of truth; priority order; all outcomes require exact-SHA evidence):**

| ID | Role | Acceptance criteria | Dependencies | Status / evidence | Exact next action |
|---|---|---|---|---|---|
| BETA-P0-01 Integration baseline | ARCHITECT | Reconcile PR #30 + #34–#56 + #58 and other drafts by ancestor/diff, record overlap and one valid merge strategy without data/behavior regression | GitHub tree, CI, role approvals | **In progress**: Git ancestry verified above; `main` still not integrated; #58 CI 4/4 green, no independent review | Compare remaining older PRs at file/contract level; hand off immutable candidate to independent Reviewer and QA; do not merge before gates |
| BETA-P0-11 Mark mutation UI race | FRONTEND | Rapid taps trigger at most one edit/delete RPC; stale user/Mark completion never updates a new account or different Mark; errors remain visible and retryable | PR #58 exact-row confirmation; independent behavioral QA | **Implemented draft:** [#60](https://github.com/darshitmeghani1992/the-wall/pull/60) `4595c1e4a1472815e76e8549c69ddc9515500fd3`; [CI #223](https://github.com/darshitmeghani1992/the-wall/actions/runs/44877228367) queued at checkpoint; no Reviewer/QA | Check CI #223, then independently test slow/double edit/delete and account switch before merge |
| BETA-P0-02 Core social QA | QA (independent) | 3 distinct authenticated staging actors traverse OTP/session, onboard, private Personal/Shared Walls, invitation/remove, friend vs follow, writer permission, text Mark/pin/edit/delete, Alerts, Discover, block/report, logout and negative access | Verified SMTP, signed/preview build, approved test accounts, independent reviewer | **Blocked for real-tester login**: SMTP not verified; synthetic SQL smoke and CI only | Run existing non-Auth synthetic regression and safe API preflight; retain distinct live E2E QA requirement |
| BETA-P0-03 Beta auth | BACKEND | Six-digit `{{ .Token }}` OTP delivered/verified to authorized real accounts, rate limits, recovery, tested deep-link redirect; no keys logged | Approved verified sender/provider, staging Auth settings | **External blocked**: issue #45; no verified sender known | Maintain prepared template/tests; verify delivery when provider available |
| BETA-P0-04 Privacy / security | BACKEND | No unauthorized direct access to protected Mark/media/Secret tables; verify authenticated JWT API and Shared-Wall INSERT RETURNING, role transitions, function ACLs; independent security review | Staging snapshot and reviewer | **Partial**: SQL checks / hosted synthetic transactional smoke; 59 SECURITY DEFINER advisories untriaged | Read-only inventory and caller-by-caller triage; tests before any grants/migrations |
| BETA-P1-05 Photo/voice/video | BACKEND then FRONTEND | Secure 1–5 photos, 60s voice, 30s video; C2 gateway/C3 worker deployed with signed processing, quotas, expiry, object deletion, preview/playback on real devices | Independent security review, approved isolated worker host/config, physical QA | **Source-only/disabled**: PR #49 runtime; worker not hosted | Prepare worker dependency/deployment verification in isolated environment; leave every media kind OFF |
| BETA-P1-06 Secret Marks | BACKEND then QA | Recipient-only one-time reveal and one-hour server expiry, cron observed and ACL checked; fail closed under scheduler outage | pg_cron scheduling and reviewed activation | **Blocked runtime**: pg_cron absent, rollout OFF (0034) | Prepare scheduler verification & safe rollback tests; do not activate |
| BETA-P1-07 Account deletion | BACKEND then QA | Authorized request, recovery window, ownership handling, verified worker purge/rollback and retention/compliance review | Hosted 0031 approval, legal/privacy decision, service worker, independent Reviewer/QA | **Withheld**: 0031 absent in staging | Verify source/test paths and draft staged migration/purge plan; no hosted irreversible changes |
| BETA-P1-08 App UX and accessibility | FRONTEND | First-use and Walls coherent, scroll performance/mark placement, empty/loading/offline/retry, accessibility; real-device pass | Stable core candidate | **Partially source-tested** | Implement isolated reversible UI fixes and component regression tests, then simulator/device QA |
| BETA-P1-09 Release engineering | ARCHITECT / DEVOPS (approved roles) | Immutable SHA/tree, 4/4 CI, independent Reviewer APPROVE, QA PASS, tested staging build, rollback/feature-disable procedures, release notes | All above and channel credentials | **NO-GO** | Keep evidence ledger; prohibit tester invitation, production write and merge until gates |
| BETA-HOLD-10 Domain and Apple | Founder | Owned domain/DNS and Apple Developer enrollment/signing/TestFlight | Founder availability | **ON HOLD by explicit instruction** | Do not ask again during ordinary engineering cycles |

**Loop contract:** Select highest-priority unblocked slice → inspect source and role playbook → change only a dedicated draft branch → verify affected checks (local or GitHub exact SHA) → independent review and QA → mark deployment-ready only if every relevant gate passes → select next independent item if blocked. An unreviewed draft is not a finished feature. Preserve the last known-good release candidate while independent verification is pending. Release tracker: issue #57. This checkpoint is not a certification of completion.

---

> Restart anchor. On `Continue The-Wall build`: read
> `THE_WALL_MASTER_BUILD_SPEC_v1.1.md`, this file, `docs/DECISIONS.md`, and
> `docs/handoffs/CURRENT.md`; inspect Git; run the applicable checks; resume from
> **Next Actions**. Product authority remains the Master Build Spec. Governance authority remains
> `docs/aios/`.

_Last updated: 2026-09-22._

## Current release-sprint status — 20 November 2026

**Source:** Current release-sprint branch `codex/launch-restart-checkpoint-2026-11`;
resolve its exact published GitHub PR/SHA/tree and fresh CI. Verified parent: draft PR #51,
`3c04c543fce4e3be628e5562b1c5a2a93cbb1c74`, tree
`40ef0b5e01ecc1efe55f7f0fcf592a51e636c587`, parent CI 4/4 green.
Latest continuation adds a default-OFF Secret composer and scheduling runbooks.
**Certification:** Independent Reviewer APPROVE and independent QA PASS **not yet obtained**
for this tree. **Delivery:** All PRs still draft; **no production merge/deploy**.

**Hosted staging:** Separate Supabase `ewintxgdxdvschiqodkq`, migrations 0001–0030 plus
0032 service-only Secret expiry ACL and 0033 active owner Shared-Wall `INSERT RETURNING` RLS
fix. Public tables 34/34 have RLS. `mark-media` private and media kind switches all OFF;
Secret expiry cron NOT scheduled; Secret composer default OFF in next draft until scheduler is verified. `mark-media` authenticated read Edge Function deployed,
C2 worker/ops not deployed. Original `wfsfafmgvxevpzrurofz` with existing user data is untouched.

**Verified real hosted SQL:** Three temporary synthetic actors can create text Marks, retry
idempotently, create Secret Marks with isolated content, enforce private Personal/Shared Walls,
invite/accept/remove Shared members, and deny unrelated/blocked actors. Both suites executed
under single database transactions with ROLLBACK; final Auth/Profile/Wall/Mark/Storage counts all 0.
**Not verified:** SMTP OTP delivery, physical device login, multi-device E2E, processor hosting,
secret-expiry cron runtime, Apple signing, App Store and production security certification.

**Android:** Cloud staging Preview APK `a1037ffa-c214-471b-8949-7796cbaeba81` **FINISHED** with
artifact; physical installation/testing not completed. Its source predates migration 0033, which
is backend-only and now applied to staging. The same APK thus targets staging, subject to QA.

**External dependencies postponed until 21 Nov:** purchase/verify a domain, set custom SMTP
for general testers, apply `{{ .Token }}` email template, prove OTP; activate Apple Developer
Program and signing. Separate legal/Founder approval required for hosted 0031 deletion worker.

**Next actions and detailed evidence:**
`docs/handoffs/LAUNCH_SPRINT_CHECKPOINT_2026-11-20.md` and GitHub P0 issues #39, #45.
The prior September percentage values below describe a **historical** source/CI boundary and
must not be asserted as today's measured production readiness.

## Historical corrective candidate under exact-tree certification

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

The local continuation removes the action log's former newest-200 ceiling. It adds deterministic
50-row keyset pagination with validated cursors, duplicate-safe append, account/session fencing,
isolated pagination errors, and behavioral coverage for every closed/audit partial-failure
combination. It remains a client/service correction with no schema, migration, RPC, dependency,
hosted, deployment, or production-data change. This continuation is not published or certified
unless and until the live PR head/tree proves it.

## Complete Alert history source correction

The source in this tree removes the in-app Alerts list's former newest-100 ceiling. It adds
deterministic 50-row keyset pages, validated shared cursors, duplicate-safe append, isolated retry,
account/session fencing, and partial actor/Wall-enrichment fallback. Existing exact read receipts,
notification triggers, RLS, Anonymous/Secret privacy, and destination rules remain unchanged. This
is a client/service correction with no schema, migration, RPC, dependency, hosted, deployment, or
production-data change. See `docs/handoffs/FRONTEND_ALERT_HISTORY_2026-09-22.md`. Resolve its
publication, CI, Reviewer, and QA state only from the exact tree and live draft PR `#22`.

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
- Complete Alerts beyond the Shared-Wall journeys and the remaining hosted/device moderation
  operations validation.
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
