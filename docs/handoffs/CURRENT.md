## BETA-P0-121 · Integrate reviewed-source Poll account purge + voice lifecycle (held iOS Enhanced candidate) — 23 Nov 2026 IST

**ARCHITECT integration sequencing → FRONTEND implementation; BACKEND code carried unchanged from separately owned #249.** New isolated combined candidate from exact #249 `8b1446ecb23f9da4b6fa88ea1f4792bdaf825927` (which already incorporates #247 `092ef1b0528f37cac52142e97f5e1164498cd7de`). Brought only the **source and source-regression test** from sibling #250 `67197a465db29020396fbf10128a65a7ee8c5b30` into the child: `src/lib/recording.ts` voice-capture start lease/lifetime checks and `tests/frontend-voice-mic-start-lease.test.mjs`. The backend/purge files and SQL were not altered. Earlier parent #249 [CI 45198978198](https://github.com/darshitmeghani1992/the-wall/actions/runs/45198978198) and sibling #250 [CI 45199550664](https://github.com/darshitmeghani1992/the-wall/actions/runs/45199550664) are **Verified 4/4 on their own exact heads**, not evidence of combined code. This child must pass its own exact-head checks.

**Why release-critical:** the integrated first iOS cohort requires both deletion of open/closed Poll ballots and safe actual voice capture. The guarded microphone start prevents late permission/prepare/start from attaching or recording after composer reset/unmount. This avoids treating two separately tested siblings as one deployable candidate. Poll account deletion is drafted only, irreversibility and hosted authorizations unchanged.

**Ready A — FRONTEND/QA:** run and pin combined-source CI; independent Reviewer and installed iPhone QA for 60-second voice, cancelled permission, backgrounding, account transitions; inspect native unsigned iOS smoke for exact combined candidate. Do not self-certify independent QA.
**Ready B — BACKEND/Reviewer:** on this immutable integrated head, inspect 0038 atomic Poll purge dependency on 0031/0035–0037 and its SQL/worker regressions; obtain independent Reviewer/QA before any host apply. Draft/preview only; no production/staging writes.
**Ready C — RELEASE/DEVOPS:** verify approved Apple Developer Program enrollment and signing, six-digit staging OTP on three separate authenticated actors, C2/C3 protected media worker & playback, Secret cron, release environment, signed TestFlight review. All require their existing Founder/Reviewer/QA gates, otherwise hold. **Open Enhanced iPhone Beta remains NO-GO.** Poll/media/Secret/optional analytics OFF; original production untouched. No merge, deploy, migration, feature activation or invitations.

## BETA-P0-121 · Private Poll account deletion source slice (23 Nov 2026 IST)

**Draft #249** [view](https://github.com/darshitmeghani1992/the-wall/pull/249), isolated child of #247 exact source base `c21a68e67b69c0e1a4548501884701f1749ff5f2`. ARCHITECT sequenced; BACKEND implemented atomic unhosted migration 0038 (0031 readiness + Poll authored parents + all open/closed ballots + actor receipts in one transaction) and switched held deletion worker to the new service-only wrapper. Disposable SQL #87 asserts early/late, idempotence, preserved unrelated closed count and pre-/post-Auth cascades; Edge mock validates exact RPC path. Source head `ccb483ba18ca069794326a62140dc72952bca3c5`, CI [45197677904](https://github.com/darshitmeghani1992/the-wall/actions/runs/45197677904) queued at checkpoint, **no pass implied**. No independent Reviewer/QA, hosting, worker deployment, deletion, staging writes, Apple signing, tester invite or release. Poll/media/Secret OFF. Public iOS beta NO-GO.

**Exact next:** verify #249 **current SHA and all four CI jobs**, repair source/test on new SHA if red. Independent Reviewer must assess service-only permissions, 0031 atomicity, Poll FK/deferred triggers and worker version compatibility; QA must test actual account lifecycle/recovery under three distinct authenticated users after approved staging apply, including closed-poll tally and installed iPhone. In parallel (different branches/owners), prepare real iPhone/EAS route and SMTP/hosted media C2/C3 gate evidence; do not touch protected original project `wfsfafmgvxevpzrurofz`.

## BETA-P0-116 · Standard Poll reporting and audited moderation removal — 23 Nov 2026 IST

**Roles:** ARCHITECT sequencing → BACKEND protected schema/RPC; FRONTEND report/admin data layer. Draft [PR #247](https://github.com/darshitmeghani1992/the-wall/pull/247), isolated child of [#246](https://github.com/darshitmeghani1992/the-wall/pull/246) exact `6f6adf24959b332d9a8a5cce3021481782b3e516`. Polls reside in private `mark_polls`, not legacy `marks`, so the existing report target FK and admin-remove-Mark cannot handle them. Draft held migration `0037_standard_poll_moderation.sql` introduces an exclusive `reported_poll_id` target, active/view-authorized Poll reporter RLS, dedicated actor-bound `admin_remove_poll`, audited idempotent soft removal and independent `target_poll_id` receipt. Client report and admin data layers now carry Poll IDs without pretending they are legacy Marks. Disposable test `85_standard_poll_moderation.sql` checks privilege boundaries and audit behavior; runner loads 0037 only in throwaway Postgres. Hosted rollout remains forbidden until independent Reviewer/QA and explicit Founder gate.

**Further implementation:** Added `app/report-poll/[id].tsx` with session/route guards, `FocusedPollCard` report action, moderator queue Poll remove/resolve, and `tests/frontend-poll-moderation-flow.test.mjs` proving ordering, denial and stale-session continuation. SQL test now includes a private Wall owner report and unrelated actor denial. Earlier source CI identified a malformed SQL delimiter, fixed in `8d5e0f5f60963e804605e03071b7857c112e9f71`; verify subsequent exact-head PostgreSQL/TypeScript CI before claiming success. This is source-only, no hosted apply.\n\n**Checkpoint:** source/test head `9e0d060fbd3d2fc53c10e17d5c18ad6b9dd53459`, initial CI [45195621087](https://github.com/darshitmeghani1992/the-wall/actions/runs/45195621087) queued; final doc-head CI must be independently rechecked. No runtime or device claim. Poll report form, Poll card report action and moderator Poll removal affordance are now drafted in this PR alongside actor-fenced flow regression tests. They require native QA and independent security review; blocked reporter, account purge and live race tests remain pending. NO-GO remains for public iPhone Enhanced Beta.

**Next ready A:** BACKEND — on this held branch, verify 0037 through actual CI PostgreSQL suite; fix any failing assertions, obtain independent security review. Run no hosted writes.
**Next ready B:** FRONTEND/QA — verify the new actor-fenced Poll report form, report button and moderation-screen Poll action on an iOS simulator, including blocked/unavailable/account-switch and failed-report cases. UI implementation exists in this draft, but native behavioral verification and independent review are still pending.
**External gates:** real six-digit SMTP, 3 hosted JWT actors, C2/C3 hosted playback, Secret expiry, 0031 deletion worker, Apple signing/iPhone/TestFlight and independent release verdict. Media/Poll/Secret OFF; staging only; original production protected; no merge/deploy/invite.

### BETA-P0-120 verified CI & read-only staging addendum — 23 Nov 2026

- [Draft #244](https://github.com/darshitmeghani1992/the-wall/pull/244) exact docs-head `18e0173ac770d8aca51844eb38c5c0df1189838f` [CI 45191028596](https://github.com/darshitmeghani1992/the-wall/actions/runs/45191028596) **4/4 successful**.
- [Draft #245](https://github.com/darshitmeghani1992/the-wall/pull/245) exact corrected docs+sharing-contract head `d0c1c3ed5934831164e80b493bbb57e5d37c969b` [CI 45191610124](https://github.com/darshitmeghani1992/the-wall/actions/runs/45191610124) **4/4 successful**. Initial red contract CI was traced to its source-shape fixture counting only three share destinations; fourth held Mark UI path now has an explicit check rather than dropped validation.
- [Draft #246](https://github.com/darshitmeghani1992/the-wall/pull/246) exact prior docs-head `13b1437e426618947bc8598c429e9b2f0c02c581`, tree `638078af4f7ecbf6bb0c7385a6113b46ebd5ea63`, [CI 45192274434](https://github.com/darshitmeghani1992/the-wall/actions/runs/45192274434) **4/4 successful**. A later docs-only checkpoint SHA must have its own exact-head checks verified; do not extrapolate.
- **Read-only authorized staging SQL (23 Nov, staging `ewintxgdxdvschiqodkq` only):** 35 of 35 public tables have RLS enabled; 0 auth users, 0 Walls, 0 Marks; 0 deployed named Poll v2 RPC functions among `list_wall_marks_v2`, `get_wall_mark_item_v2`, `replace_poll_ballot`, `close_poll_mark`. Staging Edge function list shows `mark-media` v1 ACTIVE with JWT verification, **not proof of hosted C2/C3 media worker**. No hosted changes made.
- **Release gates:** Poll/mixed-media/Secret/analytics rollout OFF; no independent Reviewer or behavioral QA, authenticated staging three-actor tests, real SMTP OTP, actual media playback, Secret scheduler, account purge, signed iPhone distribution or public release approval. Public Enhanced iOS beta remains **NO-GO**. No original production access or writes.

## BETA-P0-120 · Held standard Polls have reviewable chronology on all three Wall screens — 23 Nov 2026 IST

**Roles:** ARCHITECT integration sequencing; FRONTEND implementation; independent Reviewer and QA **NOT certified**. [Draft #246](https://github.com/darshitmeghani1992/the-wall/pull/246), base [#245](https://github.com/darshitmeghani1992/the-wall/pull/245) exact head `d0c1c3ed5934831164e80b493bbb57e5d37c969b`, adds the other-person Wall screen integration (source `223a0f27cb99a74750de5841e88e63ba662097c4`). Parent [#244](https://github.com/darshitmeghani1992/the-wall/pull/244) adds Shared Wall; #245 adds Personal Wall. All three now contain a gated **OFF** `isMixedPollHistoryEnabled` path for actor-bound strict typed mixed Mark/Poll reads, private viewer/capability/blocked safeguards, author/media-preserving Mark masonry, full-width Poll voting/results cards, kind-specific pagination, scoped ordinary Mark Realtime arrivals, linked-item deduplication, and edit refresh. The legacy app behavior stays active while flag OFF. Source screens and approved backend drafts are not published or hosted.

**Checks:** Following the source-only #245 CI test failure (the existing personal deep-link source test expected 3 Mark render paths but new held mixed timeline correctly adds a 4th), its contract test fixture was updated to assert **all four retain the exact Personal Wall share destination**. Corrected SHA `d0c1c3ed5934831164e80b493bbb57e5d37c969b` [CI 45191610124](https://github.com/darshitmeghani1992/the-wall/actions/runs/45191610124) **4/4 PASS**, including TypeScript/lint/contract, DB security, Edge and media jobs. [#244 final-head CI 45191028596](https://github.com/darshitmeghani1992/the-wall/actions/runs/45191028596) at last observation TypeScript/lint, Edge, DB security succeeded; media job was running. [#246 source CI 45192100610](https://github.com/darshitmeghani1992/the-wall/actions/runs/45192100610) was pending; do not infer success. Exact #246 later docs-head requires separate CI verification.

**Verified earlier native milestone only:** [iOS 26 unsigned simulator run 45176572995](https://github.com/darshitmeghani1992/the-wall/actions/runs/45176572995) passed Welcome→email→empty input native assertion against earlier #238 app SHA `3ce1985eceda9e011e1bdd2a811a81b8061f43bc`. This says nothing about signed iPhone, the three new screen changes, authenticated users, Polls, media or TestFlight. No independent Reviewer or behavioral QA can be self-certified.

**Ready 1 — independent REVIEWER + QA, pinned to #246 final exact SHA:** audit three-screen scope/branch ancestry, backend Poll SQL 0035/0036 and client parsers, check blocked/unrelated actor privacy, filter/cursor correctness, actor switches, media playback and Poll vote/close/author behavior, with actual tester JWT and installed-device evidence when access exists. Hold flags OFF until then.
**Ready 2 — BACKEND separate owner, isolated branch from #243/#246 verified source:** finish standard Poll report/moderation and open/closed ballot deletion integration using disposable Postgres, then route to independent Reviewer; migration 0031 and hosted schema/write operations remain on Founder gates.
**Ready 3 — DEVOPS/QA separate owner:** prepare signed iPhone release, real six-digit OTP staging sender and three-authorized-user QA, hosted protected worker C2/C3, Secret expiry, physical installed playback, and explicit TestFlight approval with no production deployment before authorization. Full public Enhanced iOS Beta **NO-GO**.

**Environment:** STAGING only `ewintxgdxdvschiqodkq`; protected original `wfsfafmgvxevpzrurofz` untouched. No staging writes, migrations, merged code, feature switches, hosted media, TestFlight activation, tester invitations or spend.

## BETA-P0-119 · Held mixed Poll/Mark history wired to Personal Wall — 23 Nov 2026 IST

**Role:** ARCHITECT sequencing → FRONTEND implementation. Stacked [draft PR #245](https://github.com/darshitmeghani1992/the-wall/pull/245) is an exact child of [#244](https://github.com/darshitmeghani1992/the-wall/pull/244) at `18e0173ac770d8aca51844eb38c5c0df1189838f`. Only `app/(tabs)/home.tsx` is changed in source commit `c040d0f883f636e6adf147908d69bc5677951171`; Shared Wall source from #244, private SQL drafts #241/#243, and older PR histories are inherited unchanged. Personal Wall now has a guarded **OFF** mixed-history branch: strict actor-bound typed 20-item mixed timeline, Poll cards full width on **All** filter, ordinary text/photo filter unchanged, existing Mark media/author/reactions/edits, kind-bearing page cursor, deferred exact focus and session/page generation guards, ordinary Mark live arrivals and duplicate linked-Poll suppression. A refused private mixed read fails closed without silently falling back to legacy history. While the rollout gate remains OFF, the existing Personal Wall uses unchanged legacy data and controls.

**CI:** [#245 source run 45191336371](https://github.com/darshitmeghani1992/the-wall/actions/runs/45191336371) was queued when checked; **not certified**. Final docs-head SHA needs its own exact GitHub checks. Parent [#244 exact run 45191028596](https://github.com/darshitmeghani1992/the-wall/actions/runs/45191028596) had typecheck/lint and Edge success, database/media pending at that check. Independent Reviewer/QA and native iPhone mixed-history behavior **not** verified. The separate already successful unsigned #239 simulator smoke tests only the earlier #238 sign-in entry/empty email, NOT Polls or media.

**Next Ready A — ARCHITECT + FRONTEND, branch from #245 final immutable head:** independently compare #245 diff/CI; integrate remaining public/other-user Wall mixed chronology only after confirming it cannot intersect ongoing branches. Preserve account/wall privacy, disabled rollout, typed pagination, no duplicate linked Polls. No direct public read of private Poll tables.
**Next Ready B — BACKEND, isolated parent from #243 or latest reviewed source:** implement/review standard Poll report/moderation plus open/closed ballot purge under existing approved database/irreversible gates; run disposable SQL before any hosting.
**Next Ready C — DEVOPS/QA:** verify actual signed installed iPhone Enhanced Beta after Apple enrollment/authorized signing and verified six-digit staging OTP sender, plus real three-user JWT, protected photo/voice/video, Secret scheduler and deletion. Public iOS beta remains **NO-GO**. No production access, hosted writes, migrations, merges, feature flags, TestFlight or invitations.

## BETA-P0-118 · Held mixed Poll/Mark timeline wired to Shared Wall — 23 Nov 2026 IST

**Role:** ARCHITECT integration owner; FRONTEND implementation. Separate [draft PR #244](https://github.com/darshitmeghani1992/the-wall/pull/244), exact child of combined [#243](https://github.com/darshitmeghani1992/the-wall/pull/243) source head `d6906da34fc7c2da4bffa916089fdb4ca4be59d2`. Source patch `249aeb660d8e4af88e338519af890d3edec1a548` changes only `app/shared/[id].tsx`: behind unchanged **OFF** `isMixedPollHistoryEnabled`, Shared Walls can consume authenticated actor-bound, strict kind-bearing v2 history and 20-item cursors with author/media hydration, display Poll cards between legacy Mark masonry, maintain scoped live ordinary Mark updates, load older mixed pages, preserve editing, and avoid duplicate linked-Poll display. Denied v2 reads fail closed, never substitute legacy data; existing displayed Shared Wall behavior is unchanged while flag OFF.

**Native iOS milestone verified:** earlier exact workflow [#239 run 45176572995](https://github.com/darshitmeghani1992/the-wall/actions/runs/45176572995) completed **SUCCESS** against its pinned [#238](https://github.com/darshitmeghani1992/the-wall/pull/238) app SHA `3ce1985eceda9e011e1bdd2a811a81b8061f43bc`: unsigned disposable iOS 26 simulator built/launched, and XCTest `testWelcomeToEmailSignInAndRejectEmptyInput` **passed** (log: 13:18:38 UTC). This verifies only signed-out Welcome→email screen→empty-input denial, NOT OTP, signed installation, authenticated users, media playback or Poll device acceptance.

**Checks & gates:** #244 source CI [45190801487](https://github.com/darshitmeghani1992/the-wall/actions/runs/45190801487) started; Edge contracts passed and other jobs were running at checkpoint. Post-documentation exact-head CI must be checked anew. [#240 CI 45179197238](https://github.com/darshitmeghani1992/the-wall/actions/runs/45179197238) independently **4/4 PASS**. No Reviewer or behavioral QA on #244; backend Poll migrations 0035/0036 and rollout remain unhosted/disabled. No protected production access, staging writes, migration, merge, signing, deployment, activation or tester invitations.

**Ready 1 — FRONTEND/integration owner:** after confirming exact #244 final CI and independent review, integrate the same held mixed-history service into Personal Wall `app/(tabs)/home.tsx`, from immutable #244 head on a **new branch** and preserve account/focus/arrivals/filters; separately test source and iOS simulator. Do not overwrite #244 branch.
**Ready 2 — BACKEND separate owner:** from reviewed #243 SQL parent (or exact subsequent integration), implement the explicitly approved Poll moderation/report and account deletion ballot cleanup with isolated migration/tests and security Reviewer gate; no hosted schema writes or migration 0031 application. Continue C2/C3 hosted media preparation independently, pending isolated worker hosting authorization.
**Ready 3 — DEVOPS/QA separate owner:** prepare a signed iPhone candidate once Founder-owned Apple access and approved staging OTP/SMTP sender exist; real iPhone photo/voice/video, three actors, Poll results/closure, Secret expiry and deletion are mandatory; public iOS Enhanced Beta **NO-GO**.

## BETA-P0-116 · Preserve photo/voice/video Mark metadata for mixed Poll history — 23 Nov 2026 IST

**Roles:** ARCHITECT integration; BACKEND implementation. Draft [#241](https://github.com/darshitmeghani1992/the-wall/pull/241) is an isolated child of [#240](https://github.com/darshitmeghani1992/the-wall/pull/240) at exact base `6ea31fc52467359ad0bca51500c38844061c2a05`. The unhosted 0035 `poll_mark_envelope_v2` originally omitted ordinary Mark `media_url` and `payload`. These fields are already selectable by the same authorized viewers via the existing RLS-bound legacy Mark history; omitting them would regress photo/voice/video display and duration when the approved mixed Poll history becomes usable. Preserved both in the v2 ordinary Mark JSON projection without introducing private playback tokens or client direct access. No Poll table publication, raw RLS, DB grants, generic Mark authoring or feature flags changed.

**Verified scope:** only `supabase/migrations/0035_standard_poll_create_read.sql` and `supabase/tests/82_standard_poll_create_read.sql` source/test paths before this checkpoint. Disposable SQL test constructs a synthetic voice Mark projection in memory from a visible text fixture, asserting `media_url`, duration metadata and no moderation-internal field; no synthetic URL is persisted. Initial [CI 45186351234](https://github.com/darshitmeghani1992/the-wall/actions/runs/45186351234) failed on a test-only SQL terminator typo; corrected in `df9765176fb90cda0da13da8e0224bf581496537`. [CI 45186598901](https://github.com/darshitmeghani1992/the-wall/actions/runs/45186598901) then exposed that the disposable synthetic-projection test was executed as an authenticated caller against the correctly **revoked** internal helper. Moved only the test invocation to its privileged fixture role, never granting clients access; final source/test commit `e65ea506c3ca116a9c1ce4f11534e7c7d9f5d5e5`. [CI 45186936411](https://github.com/darshitmeghani1992/the-wall/actions/runs/45186936411) **Verified 4/4 PASS on this exact source commit**: TypeScript/lint, Edge contracts, media processor and disposable PostgreSQL security including Poll 82. The later documentation-head SHA requires its own exact CI; no independent Reviewer or installed-device QA approval. Existing [#240 final CI 45179197238](https://github.com/darshitmeghani1992/the-wall/actions/runs/45179197238) passed 4/4. [Unsigned iOS simulator 45176572995](https://github.com/darshitmeghani1992/the-wall/actions/runs/45176572995) separately completed success on older #238 source, native Welcome/email safety only, not physical iPhone, OTP or media playback.

**Ready 1 (FRONTEND on separate isolated child/owner):** implement actor-bound `list_wall_marks_v2` mixed chronology and typed cursor, display ordinary/standard Poll cards without breaking existing media/author hydration; preserve default OFF. Start from #241 reviewed exact head, `src/lib/marks.ts`, `src/lib/poll-focused-reader.ts`, `app/(tabs)/home.tsx`, `app/person/[id].tsx` and `app/shared/[id].tsx`. Validate same-key Mark/Poll pair, pagination and account switch.
**Ready 2 (BACKEND independent):** prepare Poll-specific moderation/report/removal and recoverable-account-purge integration against isolated 0035/0036 and held 0031; require approved actor-bound authorization and independent SQL/Reviewer checks. Avoid editing #241's files and do not apply hosted migrations.
**Ready 3 (DEVOPS/QA):** verify updated CI/independent review; run authorized signed iPhone/full Enhanced Beta acceptance after OTP SMTP, hosted C2/C3 and Apple access unblocks. Exact candidate, device, and rollback evidence required.

**Status:** public iPhone Enhanced Beta **NO-GO**. Poll, media, Secret and optional analytics remain OFF. Staging only `ewintxgdxdvschiqodkq`, original production `wfsfafmgvxevpzrurofz` untouched; no hosted writes, migrations, deployment, merges, or tester invitations. Real three-user authentication, hosted signed media playback, Secret expiry, deletion, independent security review/device QA and explicit release authorization still block GO.

## BETA-P0-115 · Fail closed on incomplete iOS voice stop — 23 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Draft [#240](https://github.com/darshitmeghani1992/the-wall/pull/240) is an isolated child of integrated voice/Poll [#238](https://github.com/darshitmeghani1992/the-wall/pull/238), base `3ce1985eceda9e011e1bdd2a811a81b8061f43bc`, with only `src/lib/voice-recording-result.ts` and its test changed before documentation. A native `stopAndUnloadAsync()` rejection previously fell through to `getURI()` and could attach an incomplete/unfinalized M4A clip. Now native stop failure returns without attaching or reading URI. Regression asserts no URI access or clip callback when the native stop rejects; successful manual/time-cap behavior remains as before.

**Evidence:** initial source/test commit `348324943bce97d9020f34fe9758e2a8c4085227`, CI run [45179052896](https://github.com/darshitmeghani1992/the-wall/actions/runs/45179052896) pending at checkpoint (Edge completed successfully; others in progress). Final doc-head CI must be rechecked. No device capture or hosted media playback claimed. Independent Reviewer and iOS QA must test manual and 60-second stop, failure, reset, unmount, and microphone recovery. The separate unsigned iOS simulator run [45176572995](https://github.com/darshitmeghani1992/the-wall/actions/runs/45176572995) remained in progress while checked, still building the app.

**Blocks:** Staging-only `ewintxgdxdvschiqodkq`, original production untouched. No hosted writes, schema, signing, merges or deployment. Real OTP/three JWT actors, media C2/C3 hosted processing/playback, standard Poll security and UI QA, Secret expiry, deletion, independent Reviewer/QA, Apple signed physical iPhone/TestFlight and release authorization remain mandatory. Media/Poll/Secret disabled; public iPhone Enhanced Beta **NO-GO**.

**Ready next 1:** Independently review unchanged #240 and run native mic failure/manual/time-cap test on the eventual authorized signed iPhone; verify exact final-head GitHub CI first.
**Ready next 2:** On separate owner branch, investigate missing Poll/results/native integration from #238 and finish a scoped implementation without editing #240 or the #239 workflow branch; use #57 ready queue and exact parent SHA.

## BETA-P0-114 · Private Poll typed focus and 60-second voice handoff integration — 23 Nov 2026 IST

**Roles:** ARCHITECT integration; FRONTEND implementation. Independent Reviewer and behavioral QA not certified. [Draft #238](https://github.com/darshitmeghani1992/the-wall/pull/238) is a separate child of private Poll [#237](https://github.com/darshitmeghani1992/the-wall/pull/237) base `9cdc6a0e17039c39e24d77d86cc626c53e672faf`. The five voice source/test paths from [#236](https://github.com/darshitmeghani1992/the-wall/pull/236) `bcc1abcb932dd8f0da3e535feaac5432ebfbe1fd` were copied unchanged. #236 and #237 independently descend from #235 `f63617f414a64fc42840ac1f01edabe105559a50`; their path changes have no overlap. Three additional FRONTEND files bind held focused Poll reads to the **typed** `get_wall_mark_item_v2` (explicit `p_kind: "poll"`) and test wrong-kind denial. The entire 0035/0036 backend draft remains byte-identical to #237. All Poll gates stay OFF; previous Mark reads and publications are unchanged.

**Source-only checkpoint before docs updates:** head `d642d31e8c3a1f3594302ba30881469e1201a5b0`, 8 commits ahead and 0 behind #237; exactly 8 paths (five carried voice paths, three typed focus paths). GitHub comparator verified no other changes. [CI for source head](https://github.com/darshitmeghani1992/the-wall/actions/runs/45176133233) started and must be confirmed; #237 [CI 45173167886](https://github.com/darshitmeghani1992/the-wall/actions/runs/45173167886) 4/4 success and #236 [CI 45172355118](https://github.com/darshitmeghani1992/the-wall/actions/runs/45172355118) success are predecessor-only evidence. No local code runner or iPhone hardware available here; real end-to-end behavior is not claimed.

**Separate iOS finding:** [run 45169790622](https://github.com/darshitmeghani1992/the-wall/actions/runs/45169790622) completed FAILURE only in native UI test step 7. Xcode signed-off build and Welcome simulator launch passed. Temporary UI-test target generated an empty product path `-Runner.app/PlugIns/.xctest`, causing duplicate Xcode output in `WallStartupUITests`; the run did not execute its planned sign-in tap assertions. Fix PRODUCT_NAME/target build settings in a *separate* disposable workflow draft and rerun against exact integration commit, without signing or credentials. This is a harness failure, not evidence that the app flow failed.

**Two prioritized independent resume tasks:**
1. **ARCHITECT integration / independent REVIEWER + QA:** verify final #238 head and four exact CI jobs, ensure original #236 voice blobs still match and 0035/0036 source remains exact #237; review typed RPC and private table policies, run `npm ci && npm run typecheck && npm run lint && npm run test:contracts`, then physical iPhone recording/focus when authorized. Begin with `git fetch origin && git checkout --detach origin/codex/integrate-private-poll-voice-typed-read-20261123-auto18`. Do not merge or certify without independent decisions.
2. **DEVOPS / QA on separate branch:** clone isolated [#218 workflow](https://github.com/darshitmeghani1992/the-wall/pull/218) at `bcfcc33ca7e8882cf96eb2bfe68ef512d4c2ffad`; fix temporary UI-test PRODUCT_NAME, pin exact #238 source head, rerun unsigned iOS 26 launch/tap test, record job URL and actual assertions. Founder Apple enrollment/signing is still HELD.
3. **BACKEND on separate branch from #237 `9cdc6a0`:** implement Poll moderation/report, private-parent account purge prepare/finalize and typed mixed-history wiring with disposable SQL; separate independent security review and hosted approvals. Media hosting, verified SMTP six-digit OTP, three real actors, Secret cron and release backend remain independently blocked.

**Release:** first real iPhone tester cohort must receive full Enhanced Beta, including photo/voice/video and standard Polls; internal text-only checks are not a release. **NO-GO** pending hosted OTP/media/Secret/deletion, authenticated actor tests, independent Reviewer/QA, installed signed iPhone/eligible TestFlight and approved release environment. No production access, hosted staging writes, migrations, merges, feature enablement, Apple signing or tester invitations in this checkpoint.

---

## 23 Nov 2026 · Poll integration handoff (source-only, draft)

ARCHITECT integration has merged #232's three exact reviewed Poll feedback blobs onto #231's unchanged #230 ancestor, preserving the rest of #231 and the historical stacked PRs. Source merge SHA `3cac41462927bcd62e8d97664820038f232285ff`; tree `ba9878f07274fa24a9672341573881e0236eedae`; branch `codex/integrate-poll-feedback-20261123-1658ist`. All Poll create/reader/vote/close gates OFF. Confirm full CI and independent review on the final docs-head before treating it as an integration candidate; no hosted or device claim. Canonical ready queue and two independent next actions: `docs/BUILD_STATUS.md` BETA-P0-113; tracker #57. Apple signing, physical iPhone, OTP and hosted media/Secret/deletion/Realtime remain protected and incomplete. Public Enhanced Beta NO-GO.

---

## Current · 23 November 2026 · Poll ballot/closure draft (#224, BETA-P0-112)

**ARCHITECT → BACKEND on isolated child** of combined Poll Backend/Frontend source [#223](https://github.com/darshitmeghani1992/the-wall/pull/223), immutable parent `b12e0744a98791c5dffbf2575c6c33884f3e763d`, tree `35eb8773988cb07c3cfb320195ab50c6a7ff05c5`, [all four CI jobs green](https://github.com/darshitmeghani1992/the-wall/actions/runs/45158637951). Separate [draft #224](https://github.com/darshitmeghani1992/the-wall/pull/224) includes additive 0036 private ballot/choice/receipt tables, typed replace/close RPCs, live aggregate-only results, FK purge accounting and a new default-OFF voting gate; rollback-isolated SQL regression #83 and runner update. Initial source CI [45159402627](https://github.com/darshitmeghani1992/the-wall/actions/runs/45159402627) must be confirmed, followed by final docs-head run, independent security review, real actor authorization and installed iPhone QA. No backend schema/role changes hosted; public beta is NO-GO.

**Immediate task:** inspect exact #224 PostgreSQL CI and fix migration/test defects if any; perform independent Reviewer/QA handoff (do not self-certify), advance guarded Poll v2 reader+ballot+close client/UI in a separate nonoverlapping FRONTEND branch; continue eligible iOS simulator/startup prep #218, but do not sign/TestFlight or host migrations without gates. Founder-held verified sender/Apple enrollment, public release environment approval, media worker, Secret scheduler/account deletion, three staging actors and iOS installed-device evidence remain blockers. Detailed queue in `docs/BUILD_STATUS.md` top BETA-P0-112; release tracker #57. Staging and protected original unchanged.

---

## Current · 23 November 2026 · Poll integrated source (#223, BETA-P0-111)

**ARCHITECT integration ownership only.** Draft [#223](https://github.com/darshitmeghani1992/the-wall/pull/223), child of Backend #220 with a true second parent Frontend #221. Exact source merge `b73c417b6cf9d2a7ca508e9a0fa0f62b76d99abb`, source tree `762fd005445de897ebe493c21dbc13f757ffac0b`. Both parents' reviewed files are preserved byte-for-byte; #220 and #221 exact CI each 4/4 passed, but #223 has fresh independent exact-head CI [45158356217](https://github.com/darshitmeghani1992/the-wall/actions/runs/45158356217) to verify. No Reviewer APPROVE or physical iPhone QA PASS. The oldest release-stack PRs remain unmerged. Do not inherit CI between trees. Source flag and SQL poll creation gate both OFF; standard create/read only, no ballots/closure/tally or public activation.

**Next unblocked engineering:** BACKEND implement actor-bound vote replacement, author close and account-deletion tally cascade on an isolated child; FRONTEND build versioned Poll Wall reads/accessible voting & closure without colliding with Backend branch. Independently inspect #223 exact commit and stage CI; track full iOS-first public Enhanced Beta on issue #57. The parallel alternative draft #222 overlaps the #221 create contract, preserve as historical source evidence but do not stack its duplicate adapter. Founder-held six-digit verified OTP sender, Apple Program/TestFlight signing, authorized staging media worker and public backend, Secret one-hour scheduler, migration 0031 deletion, three users and installed-device/Reviewer/QA are still release gates. Staging/protected original unchanged; no hosted writes, main merge or invitations.

---

## Current · BETA-P0-109 — account deletion worker staging fence (23 Nov 2026)

ARCHITECT→BACKEND source-only [draft #210](https://github.com/darshitmeghani1992/the-wall/pull/210), child of [draft #209](https://github.com/darshitmeghani1992/the-wall/pull/209), source commit `edb1a74999927c4f568ecf5e1d19484dd5828ffe`, tree `5d4217084e76ea0a2ebd4c602d89154a7829ea65`. Prepared deletion worker formerly accepted any HTTPS Supabase root; new exact staging guard rejects original production and all unapproved origins before privilege-bearing adapter operations. Negative Edge test and current positive adapter fixture updated. No hosted deployment, migration #0031, deletion, flags or service credentials touched. CI/reviewer/device verification needed on final docs-head; separate public release binding requires approval. #208 integrated source CI 4/4 success, #209 docs-only CI 4/4 success; no independent Reviewer or QA. Media/Secret/deletion OFF; no OTP users/hosted worker/Secret scheduler. Next: inspect #210 CI and route independent review + QA, maintain full #57 release blockers. Canonical queue BETA-P0-109, release handoff `docs/handoffs/OPEN_BETA_RELEASE_CANDIDATE.md`. **Enhanced/public beta NO-GO.**

---

## Current · BETA-P0-108 — integrated release handoff (23 Nov 2026)

ARCHITECT compared #201→#206→#207→#208 exact ancestry; #206 integrates BACKEND media download integrity and FRONTEND composer retry, then #207/#208 add Discover/search and friend-request Alert fixes. Last source-only candidate #208 `dde8b90e08efbe04906d6f9d032f35aff4cf2332` tree `0fc5ff3fda88ef600859b60ce2f08d217196c3d9`. CI #206 `45145542787` and #207 `45147463741` 4/4 passed; #208 `45148328186` media job still running at capture (do not imply all passed). No signed installed build on #208, independent Reviewer or device QA. Separate #203 disposable ARM64 proof, not a merge artifact. **Next:** resolve #208 exact CI; hand to independent Reviewer then QA, and prepare new approved staging-only pinned builds. Existing OTP/domain, hosting, Secret scheduler, deletion and release authorizations block public beta. No hosted writes, migrations, branches belonging to other runs, merges, production access, or invitations. Full runbook and acceptance matrix at `docs/handoffs/OPEN_BETA_RELEASE_CANDIDATE.md`. **Enhanced/open beta NO-GO.**

---

## Current · BETA-P0-107 — media stream integrity (23 Nov 2026)

ARCHITECT → BACKEND isolated draft child of #201 `7f7ca5a46fda09b7a50539b5ad556071ff2b6559`. Prevent silent source truncation: strict optional Content-Length validation and all-bytes FileHandle writes prior to FFmpeg. Two new worker tests cover short writes and premature HTTP body completion with safe failure callback. Check new draft exact SHA/tree, CI four jobs, independent Reviewer/QA. No hosted worker, flags, migrations or changes to original production. Real OTP/three-user actors, media signed playback, Secret cron, 0031 account deletion, installed iOS/Android and authorization still block release. Resume via `docs/BUILD_STATUS.md` BETA-P0-107.

---

## Current — BETA-P0-106 · 23 Nov 2026 · C3 staging-only worker origin

**ARCHITECT → BACKEND:** [draft #198](https://github.com/darshitmeghani1992/the-wall/pull/198) builds on untouched #197 exact `38e5c474f2d7402f51d44d57f779445269a36a02`. C3 worker entrypoint now refuses every Supabase project except approved staging prior to keys, network, gateway or listener. Source regression rejects original production, other origin, HTTP, path and hostname spoof; valid staging still needs a real key. **Check final docs-head SHA/tree and all four CI jobs, then independent Reviewer and behavioral QA.** Separate #195 ARM64 Docker smoke [45129237153](https://github.com/darshitmeghani1992/the-wall/actions/runs/45129237153) PASSED 43/43 tests and fail-closed runtime; disposable test pins not approved hosting artifacts.

Fresh read-only staging: 35/35 RLS public tables, zero Auth users/Walls/Marks, private media, no Secret cron. OTP six-digit delivery, three genuine JWT actors + SQL/INSERT RETURNING, hosted C2/C3 media playback/cleanup, Secret, deletion 0031, installed iOS/Android, reviewers, rollback and release environment still block Enhanced/open beta. Media/Secret/analytics/deletion OFF. Historical production untouched; no hosted writes, merges, deployment or invitations. **Next:** request independent review on unchanged candidate and coordinate approved staging worker host/runtime security+SMTP sender; keep working on release-critical independent source slices. Canonical queue `docs/BUILD_STATUS.md` BETA-P0-106.

**CI follow-up:** [45132119181](https://github.com/darshitmeghani1992/the-wall/actions/runs/45132119181) failed one of 44 media tests: old invalid-port negative fixture did not provide new required staging origin. Corrected only fixture setup in `f9f49f284d6bd77c92bc264180c9bc50cdae4ef1`; genuine port rejection and origin denial both remain. Check new exact-head CI; do not treat #195 sibling proof as merged.


---

## Current — BETA-P0-105 · 23 Nov 2026

**ARCHITECT → BACKEND:** [draft #192](https://github.com/darshitmeghani1992/the-wall/pull/192), isolated child of #191 at `53db2c01a732b5a2317e1a04040472068719641d`. Backend source/test commit `308055740bec091ebe3018b83d39d8d785ba95a9` (tree `63e3a7e88386cbb29e01133c01ac74c33dab083f`) binds the 3-JWT private Shared Wall test to `walls.owner_id=TW_OWNER_ID` and the member's exact `wall_members.status=accepted` row, preventing false test-fixture PASS. Total 12 GETs; no sensitive bodies or credentials logged, no writes. Scoped mock positives/negatives added; [initial CI 45118457174](https://github.com/darshitmeghani1992/the-wall/actions/runs/45118457174) had 2/315 contract failures from stale anonymous negative GET counts; no authorization assertion failed. Corrected in test-only `16e591938c90b2f0a4aa707d19341c881d28ffac` / tree `ccfa68e56d055fdc9102fc0b21da0254588cef51`. One remaining malformed-anon negative mock count was found in [retry 45118666484](https://github.com/darshitmeghani1992/the-wall/actions/runs/45118666484) (314/315 passed), fixed in test-only `9de177664fae423f6de3a6b92fed210dd01b2686`, tree `ac8abde488640c66e009a214b1ccecd19fde93d6`. Recheck corrected [source CI 45118818646](https://github.com/darshitmeghani1992/the-wall/actions/runs/45118818646) and final docs-head four-job CI; never claim an unrun PASS. **Final docs-head SHA/tree/CI still requires fresh verification**. Parent #191 final-head CI 4/4 passed. Fresh staging SQL read-only: 35/35 RLS, no Auth users/Walls/Marks, authenticated SELECT on wall_members with one SELECT policy, mark-media private. No real actor/OTP setup or three-JWT runtime QA yet. Independent Reviewer and QA absent. **Enhanced Beta NO-GO**: SMTP six-digit delivery, actual three-user JWT/SQL incl Shared Wall INSERT RETURNING, C2/C3 actual playback/cleanup, Secret one-hour cron, deletion 0031, independent code/behavioral/device/rollback remain. Media/Secret/analytics OFF. #177 Founder/Product and #186 security gates open, domain/DNS and Apple/TestFlight held. No production reads, hosted writes, migration, merge, deployment or tester invite. **Canonical queue:** `docs/BUILD_STATUS.md` BETA-P0-105. **Next:** verify exact #192 CI SHA and all four jobs; request independent Reviewer/QA; after approved actors and real fixture exist run `node scripts/staging-three-jwt-readonly.mjs --staging --read-only` in authorized secure environment, never with secrets in chat.

---

## Current — BETA-P0-104 · 23 Nov 2026

**ARCHITECT → BACKEND** isolated source-only private text Mark security-audit addition; child branch `codex/beta-three-jwt-private-text-mark-20261123-auto11b` of [draft #190](https://github.com/darshitmeghani1992/the-wall/pull/190) immutable `42bc56cbd186c806a2c60197a1fa4fc5cfa35b1c`. Source/test commit `8782eb60b7050410047ad46d62333e4f029e7c6f`, **final documentation-head SHA/tree and CI pending**. Three genuinely verified staging JWT actors must now exercise one real active non-Secret text Mark on the same private Shared Wall (owner/member allow, outsider deny), plus anonymous HTTP 200 empty RLS responses for both Wall and Mark. Requires `TW_PRIVATE_TEXT_MARK_ID`; avoids fetching text/author/media. 11 read-only GETs; no real JWT run yet. Mock negative tests expanded. Fresh staged SELECT-only 35/35 RLS tables, 0 Auth users/Walls/Marks, mark-media private, cron absent. Independent Reviewer/QA, real six-digit SMTP, actor fixtures, media C2/C3, Secret expiry, 0031 deletion and installed-device QA still block **Enhanced Beta NO-GO**. No production access, hosted writes, merges, deployments, Apple/domain or testers; high-risk features OFF. Canonical queue: `docs/BUILD_STATUS.md` BETA-P0-104. **Next:** verify unchanged final source/docs head four-job CI and independent review; then continue separate unblocked privacy/actor checks.

---

## Current — BETA-P0-103 · 23 Nov 2026

**ARCHITECT → BACKEND** isolated [draft #190](https://github.com/darshitmeghani1992/the-wall/pull/190) child of #189 exact `afda676f90f3503c538edb7e41a19435078d7858` (parent [CI 45101499193](https://github.com/darshitmeghani1992/the-wall/actions/runs/45101499193) success). Source `3b6859a715d889b7ae0834b9904e8b3c4c3e5737` expands public-key, GET-only, zero-row staging preflight from 2/8 to 8/8 private server tables, rejects HTTP 200/404 for missing privilege isolation, and adds fake-network regression matrix. No hosted probe with real credentials, no actual three-user HTTP/SQL proof. Resolve **final docs-head SHA/tree and CI** on #190; independent Reviewer and behavioral QA pending. The checked-in service grants for anonymous author table are narrower than current hosted service_role defaults; no grants changed, see #186 for separate `mark_secrets` issue. RLS 35/35 public tables on latest hosted read, zero Auth users/Walls/Marks, private mark-media and no Secret cron. **Enhanced Beta NO-GO**: six-digit SMTP OTP, 3-actor JWT HTTP+SQL, media C2/C3 playback, Secret expiry, deletion 0031, Reviewer/QA/device remain blocked. Media/Secret/analytics OFF, Founder-held domain/Apple, production untouched. Canonical task queue `docs/BUILD_STATUS.md`. Next: verify #190 exact-head full CI, independent review, separate real staging smoke after authorized public key available; continue unblocked source-only security analysis.

---

## BETA-P0-102 · Current handoff · 23 Nov 2026

**ARCHITECT → BACKEND**, draft [#189](https://github.com/darshitmeghani1992/the-wall/pull/189) from #188 `ae8626a9e1737d61a00acbd57b35f874e48f20fe`. New test 81 source `a26018191b5605b8f945657540de41b4d4d60482` checks service SELECT for three identity/notification/Secret tables, service CRUD for three media worker tables and no direct service CRUD for two definer-only tables. Initial docs-head [CI 45101321241](https://github.com/darshitmeghani1992/the-wall/actions/runs/45101321241) failed because migration 0002 grants `anonymous_mark_authors` service_role SELECT only; corrected source contract without altering permissions. Exact final-docs-head CI still required. Read-only staging has 35/35 public RLS, zero Auth users/Walls/Marks, private mark-media, no cron. `mark_secrets` ancillary ACL issue #186, blocked leave #177, all major release gates outstanding. **Enhanced Beta NO-GO**; media/Secret/analytics OFF, original production untouched, no hosted writes, migrations, merges, deployments or invitations. Next: verify SEC-001/test 81 and four CI jobs, record SHA/tree; route independent Reviewer/QA and next unblocked source audit.

### Archived historical operational handoff (not release status)

## CURRENT · BETA-P0-101 · Seven-table ancillary ACL regression — 23 Nov 2026

**ARCHITECT → BACKEND:** isolated [draft #188](https://github.com/darshitmeghani1992/the-wall/pull/188) from approved stack's unchanged parent #187 `425fe3f68e683bd44cf3abfa769940782266c3e2` ([parent CI 45090124735](https://github.com/darshitmeghani1992/the-wall/actions/runs/45090124735) success). Backend source commit `b767f80a416ad8f9d53a30bdc8e06413786c915d`, follow-up source `8b6971a7d38223dad624874e3eb332cdfc286e2`, test-only `supabase/tests/81_private_server_table_acl.sql`: blocks new TRUNCATE/REFERENCES (including column grants)/TRIGGER grants to anon or authenticated on seven protected server-only tables. Explicit `mark_secrets` exception remains pending security/schema gate [#186](https://github.com/darshitmeghani1992/the-wall/issues/186); existing eight-table CRUD/column/no-policy/RLS checks retained. Staging SELECT-only confirms actual seven-table negative ACLs and the known eighth-table excess grant; zero users/Walls/Marks, 35/35 RLS, mark-media private, Secret OFF and no cron. No hosted writes, production access or security change.

**Next exact task:** inspect final documentation-head SHA/tree and PR #188 CI: all four jobs, SEC-001 test 81, Expo/Edge/media checks; route independent Reviewer → QA. No independent validation claimed by source author. Real OTP, real three-user HTTP/JWT and SQL, C2/C3 playback, Secret expiry, 0031 deletion/purge, installed device QA, issue #177 Founder decision all block Enhanced Beta. Media/Secret/analytics OFF; domain and Apple held. No merge, deploy or invitations. **NO-GO**.

---

## 23 Nov 2026 · BETA-P0-100 current checkpoint
**ARCHITECT → BACKEND** isolated child of [draft #185](https://github.com/darshitmeghani1992/the-wall/pull/185) at parent `2a7e6c82ccac095ae715a226d4289ec54f7773e3` ([CI 45084469929](https://github.com/darshitmeghani1992/the-wall/actions/runs/45084469929) 4/4 success). Source `b05e26e25b77811544caf47916841d9586cc0111` extends SQL test 81 for column-level client SELECT/INSERT/UPDATE grants on eight RLS-only protected tables; unchanged grants/schema/client/runtime. Staging SELECT-only confirmed no such column CRUD grants. **New catalog concern:** `mark_secrets` still gives authenticated TRUNCATE/REFERENCES/TRIGGER/MAINTAIN (`Dxtm`), [issue #186](https://github.com/darshitmeghani1992/the-wall/issues/186) filed for gated review, no PostgREST exploit proven and no DDL applied. Child draft and final-head CI/Reviewer/QA to verify; no self-certification. Production untouched, original stack unmerged; zero staging real actors, Secret cron absent, media/Secret/analytics OFF. Enhanced Beta **NO-GO**; OTP, 3-JWT, C2/C3 media, Secret expiry, deletion, device and independent approval pending. Next: inspect exact child CI and issue #186 scope, continue separate caller audit. Canonical queue: `docs/BUILD_STATUS.md`.

---

## 23 Nov 2026 · BETA-P0-99 latest
**ARCHITECT → BACKEND** isolated [draft #185](https://github.com/darshitmeghani1992/the-wall/pull/185) adds source-only SQL test 81 guarding eight private identity, Secret, media and removed-member tables against direct anon/authenticated CRUD and permissive RLS policy. Parent #184 final SHA `600d6de902e86aba161b1db1c2db3e10ae28cad2` ([CI 45084198350](https://github.com/darshitmeghani1992/the-wall/actions/runs/45084198350) **4/4 verified success**). New source `0e91bc8423adfd641c89271aa6d45a4d9a976351`, tree `1702af73b1551531f9ef7d691c1c35f0e8664efe`; new checks pending. Staging SELECT confirms all eight tables default-deny and RLS 35/35; Auth 0/0/0, no pg_cron; Edge mark-media exists but playback/cleanup unverified. Release still **NO-GO**, SMTP OTP, genuine 3-JWT, private media, Secret scheduler, deletion, independent Reviewer/device QA pending. No original production read or hosted write/merge/deploy/testers; media/Secret/analytics OFF; #177 PRODUCT/Founder pending. Next: verify #185 exact source/final-head CI then independent review and next separate caller audit. See canonical `docs/BUILD_STATUS.md`.

---

## 23 Nov 2026 · BETA-P0-98 current checkpoint
**ARCHITECT → BACKEND** prepared isolated [draft #184](https://github.com/darshitmeghani1992/the-wall/pull/184) for 13 sensitive trigger bindings and the Anonymous Mark attribution-before-notification ordering; source `76ec1e8de4779f714cf110624352cb2e8c4765cb`, tree `443c53c44555ecc930a9b425492bf7df426dd96d`. Parent #183 `df25d4f84cd7af79d33f07b0cc5cd9256331f1e1` final-head CI [45078622877](https://github.com/darshitmeghani1992/the-wall/actions/runs/45078622877) completed success. New source/final-doc CI **must be confirmed**, not assumed. Independent Reviewer/QA absent; draft only. Staging SELECT: 34 enabled-linked SECURITY DEFINER trigger routines, 0 users/Walls/Marks, RLS 35/35, no pg_cron. No database/code behavior changes. **Enhanced Beta NO-GO** (OTP, genuine 3-JWT security, media, Secret scheduler, deletion, installed device, Reviewer/QA). Media/Secret/analytics OFF; original production untouched; no hosted writes, migration/merge/deploy/testers. Issue #177 PRODUCT/Founder blocked. Next: verify #184 source/final-head checks, route independent review/QA, continue caller audit on isolated follow-up. Canonical queue: `docs/BUILD_STATUS.md`.

---

## CURRENT · BETA-P0-97 · Full definer search-path schema trust — 23 Nov 2026

**ARCHITECT → BACKEND:** isolated child [draft #183](https://github.com/darshitmeghani1992/the-wall/pull/183) of #182 exact `573e3c7446c1de89b1dc3161c861a51a5d68d793`, parent [CI 45073523919](https://github.com/darshitmeghani1992/the-wall/actions/runs/45073523919) 4/4 success. New test 78 plus SEC-001 registration commit `e4bb2e940d93bec8a5619700a25359f2cf65b892` validates ownership and all explicit trusted schemas for every `public` SECURITY DEFINER. [Source CI 45078401101](https://github.com/darshitmeghani1992/the-wall/actions/runs/45078401101) **Verified 4/4 success** (including SQL test 78); documentation-head CI must be rechecked on final unchanged SHA, independent Reviewer/QA absent. Separate staging catalog audit: 34 trigger-returning public definer routines, 26 authenticated-executable, none anon-executable/orphaned/non-postgres-owned; trigger body semantics remain unverified, see staging triage handoff. Read-only staging (approved project only): 113 public definer routines, all owner postgres, four known trusted search-path variants, no anon/auth CREATE in referenced schemas; no real hostile JWT runtime proof. No migrations/grants/production/hosted writes/merges/deployments.

**Enhanced Beta NO-GO:** real SMTP OTP, genuine 3 distinct authenticated actors incl HTTP negative and Shared Wall INSERT RETURNING, C2/C3 playback, Secret one-hour scheduler, account deletion 0031/purge, Reviewer approval and installed-device QA still missing. Media/Secret/analytics OFF. #177 Founder/Product gate open. Canonical queue/next exact action: `docs/BUILD_STATUS.md` BETA-P0-97. Do not treat checkmarks or catalog tests as behavioral certification.

---

## CURRENT · BETA-P0-96 · Trusted definer-schema CREATE ACL guard — 23 Nov 2026

**ARCHITECT → BACKEND:** child [draft #182](https://github.com/darshitmeghani1992/the-wall/pull/182), base #181 immutable `a4481193855da532cf73099297f344b1e28ff27e`, [parent 4/4 final CI SUCCESS 45073273618](https://github.com/darshitmeghani1992/the-wall/actions/runs/45073273618). Source `55e257cab3ff9b025f22fee24c34eb306ed98185`, tree `eb36de50d2accff6e5bd56670cab4648393b7204`: disposable SQL 77 asserts no anon/auth/PUBLIC CREATE on public/auth/storage schemas; registered in SEC-001 runner. Staging SQL confirms observed 3-schema ACL. CI of new source and final documentation head to verify. Catalog-only, not a real authenticated exploit test, pg_temp proof, Reviewer signoff or device QA.

#181 final-head CI now Verified 4/4; neither draft is review/QA-approved or merge-ready. Original production untouched, no hosted writes/migrations/merges/deployments/tester invitations/held domain or Apple. Fresh staging 0 users/Walls/Marks, RLS 35/35, private media, no pg_cron. OTP, 3-actor JWT HTTP, C2/C3 playback, Secret cron, 0031 deletion, Reviewer/device QA open, #177 Founder/Product open. High-risk flags OFF; **Enhanced Beta NO-GO**. Canonical next task `docs/BUILD_STATUS.md`.

---

## CURRENT · BETA-P0-95 · Alert destination UUID safety — 23 Nov 2026

**ARCHITECT → FRONTEND:** isolated [draft #181](https://github.com/darshitmeghani1992/the-wall/pull/181) from #180 final exact `89a72b5d5918f7d05a5f303f2e48658681c6a972` (CI 45067509529 4/4). Source/test `ca46dbbdb3b07ca0b6f9552d799ff405867a1703`: canonical UUID guards for Alert actor/Wall/owner/focused Mark route parameters; malformed IDs no longer compose arbitrary nested paths or query strings, fall back to Discover/Alerts or omit bad Mark focus. Ten new pure route assertions. [Source CI 45073187558](https://github.com/darshitmeghani1992/the-wall/actions/runs/45073187558) triggered; inspect final result and **repeat exact documentation-head CI**. No independent Reviewer or installed-device QA, so no merge/deploy readiness.

Fresh staging SELECT-only (`ewintxgdxdvschiqodkq`): 0 Auth users, 0 Walls, 0 Marks, public RLS 35/35, private mark-media, pg_cron absent. 3-JWT HTTP/SQL, six-digit SMTP, C2/C3 playback, Secret expiry, deletion 0031/worker, Reviewer/QA still open; #177 Founder/Product gate open. Original production untouched. No hosted writes/merges/deployments/Apple/domain/tester invites. Media/Secret/analytics OFF. **Enhanced Beta NO-GO.** Resume at `docs/BUILD_STATUS.md` BETA-P0-95.

---

## CURRENT · BETA-P0-94 · Global SECURITY DEFINER anonymous-surface regression — 23 Nov 2026

**ARCHITECT → BACKEND:** new isolated [draft #180](https://github.com/darshitmeghani1992/the-wall/pull/180) child of #179 exact `f76a7d6b04beef3df6b87c6683d1e6971bfd1129` ([parent exact-head CI 45067236742 4/4 passed](https://github.com/darshitmeghani1992/the-wall/actions/runs/45067236742)). Adds `76_definer_anonymous_catalog_guard.sql` and runner registration. Fails disposable PostgreSQL if future public SECURITY DEFINER gains anon EXECUTE or lacks explicit `search_path`, checking non-vacuous 20+ authenticated direct functions. Source `d0e6910c5a384f1c9acda8bfc4db783605944034`, tree `1e22185c1abe8d5a81ef0456257a7b11eab35dd9`; inspect source and final documentation-head 4-job CI, independently review. Not runtime authorization proof; no Reviewer or device QA.

Fresh staging `ewintxgdxdvschiqodkq` read-only 0 Auth users/Walls/Marks, 35/35 public tables RLS, private mark-media, absent cron. Six-digit SMTP OTP, real three-JWT HTTP + SQL including Shared Wall INSERT RETURNING, C2/C3 playback, Secret expiry, 0031 deletion/purge, independent Reviewer/installed-device QA outstanding. #177 Founder/Product gate remains. Original production untouched, no hosted writes/merges/deployments/held Apple/domain operations, high-risk features OFF. **Enhanced Beta NO-GO**. Next: full exact-head CI, independent handoff, then further trigger/definer caller audit. Canonical queue `docs/BUILD_STATUS.md`.

---

## CURRENT · BETA-P0-93 · Removed roster owner-transfer regression — 23 Nov 2026

**ARCHITECT → BACKEND** [draft #179](https://github.com/darshitmeghani1992/the-wall/pull/179) isolated child of #178 `468b1331e1d889fb309addf4f2adced296dbf8da`, original stack intact. In disposable test 75, O removes G then transfers ownership to accepted B; B now sees removal history, O retains private Wall access as an accepted member but loses removed-member roster visibility. First source SHA `3ca59c75ec2947d78cb3864ad55e1aa278db91d3` failed DB [CI 45066822867](https://github.com/darshitmeghani1992/the-wall/actions/runs/45066822867) because fixture INSERT constraints were not flushed before transfer; no assertions weakened. Fixed source `d5ae118061f43e6d176a03df58447bd92811f315`, tree `f6808569c7c7ef2cbb71ac859fba0fd413307bc1`, passed [CI 45066983465 **4/4**](https://github.com/darshitmeghani1992/the-wall/actions/runs/45066983465). Final documentation-head SHA/CI must be rechecked. No independent Reviewer or QA.

Seven further authenticated-callable Shared Wall SECURITY DEFINER RPCs source/catalog traced read-only in staging (see `docs/handoffs/STAGING_DEFINER_CALLER_TRIAGE_2026-11-21.md`); **not** a JWT denial test or security certification. Staging `ewintxgdxdvschiqodkq` ACTIVE_HEALTHY, RLS 35/35 public tables, zero Auth users/Walls/Marks, private mark-media, absent pg_cron. OTP, 3-JWT real actor tests, C2/C3 media, Secret cron, 0031 deletion, independent QA/device remain missing. Original production untouched, no hosted write/merge/migration/deploy/tester invite/Apple/domain. High-risk features OFF; Enhanced Beta **NO-GO**. #177 blocked-owner leave/removal awaits Product/Founder. Next: final-head 4-job CI, independent Reviewer/QA, next unblocked routine audit. Canonical queue `docs/BUILD_STATUS.md`.

---


## CURRENT · BETA-P0-92 · Removed Shared Wall member roster is owner-only — 23 Nov 2026

**ROLE: ARCHITECT** access-boundary sequencing → **ROLE: BACKEND** disposable SQL test implementation. Isolated child [draft #178](https://github.com/darshitmeghani1992/the-wall/pull/178) of draft #176 immutable `8ec4773fdb34e040737582075fbd143d920a71d1` ([4/4 parent CI](https://github.com/darshitmeghani1992/the-wall/actions/runs/45056480451)); original stacked PR ancestry retained; no other branch changed. Source/test-only `supabase/tests/75_shared_wall_removed_roster_privacy.sql` plus registration in `run_tests.sh`: private third-party Shared Wall with O owner, B accepted, F pending, G accepted → O removes G through existing RPC → O sees exactly G and a timestamp while B/F/G/unrelated A/owner-blocked C see **no removed-member rows**. B's ordinary private Wall view remains permitted, so the denial specifically covers sensitive removal history. Every fixture is disposable and ROLLBACK-protected. No authorization, API, schema, migration, permission or user-facing behavior changed.

**Immutable source checkpoint:** `437736b0fba23746523b1e22fdd22d1b042788e9`, Git tree `806aaaaf21e9bfd219fad8210b648dca6e9e0ce1`. Source [CI run 45062063593](https://github.com/darshitmeghani1992/the-wall/actions/runs/45062063593) initiated; check all four job conclusions and logs, and **recheck exact documentation-head SHA after these checkpoint updates**. No local Postgres/native tool run is claimed. Independent Reviewer/behavioral QA: **not obtained**; no draft is merge/deploy-ready.

**Fresh read-only staging SQL, approved `ewintxgdxdvschiqodkq`:** Auth users=0, Walls=0, Marks=0; public base tables protected by RLS **35/35**; `mark-media` bucket private, `pg_cron` absent. Thus genuine hosted three-actor JWT HTTP + SQL including shared-wall INSERT RETURNING and OTP delivery still blocked. No original production access, hosted mutations, feature activation, staging migration, merge, deployment or tester invitations. Secret, private media and analytics OFF; deletion 0031 and held Apple/domain operations untouched. **Enhanced Beta NO-GO**.

**Next action:** inspect CI [45062063593](https://github.com/darshitmeghani1992/the-wall/actions/runs/45062063593) DB job for new SQL test failures; if failed, fix only isolated test/runner without changing assertions. Verify all 4 jobs for final head; route to independent Reviewer and QA, then continue a different unblocked task (remaining SECURITY DEFINER caller audit) while issue #177 awaits Product/Founder. Update release tracker #57. No product/security decision made, so `docs/DECISIONS.md` unchanged.

---

## 23 Nov 2026 — BACKEND blocked accepted Shared peers contract test (isolated #176)

**Verified after first CI test failure:** Initial run [45056072702](https://github.com/darshitmeghani1992/the-wall/actions/runs/45056072702) caught malformed dollar delimiters in new SQL `DO` blocks; corrected all five without changing expected behavior. Corrected source commit `77e0d6d02f8d1073ebf6e4852d6456eaa4ebc310`, tree `f216c14008ce4e25085a79b98fe653664675f929` passed all four jobs at [45056213096](https://github.com/darshitmeghani1992/the-wall/actions/runs/45056213096). Independently verified *read-only* staging functions `leave_shared_wall` and `remove_shared_wall_member` reject blocked owner/member pairs even after accepted membership is retained; [issue #177](https://github.com/darshitmeghani1992/the-wall/issues/177) requests PRODUCT/Founder clarification; no migration authorized. Real three-actor JWT, independent Reviewer/device QA pending. Recheck final documentation-head SHA/CI after this note; canonical queue `docs/BUILD_STATUS.md`. **NO-GO.**

**ARCHITECT → BACKEND.** New draft [#176](https://github.com/darshitmeghani1992/the-wall/pull/176) branched from #175 immutable `d064901b0c4d3324687436e7e6352eb588ba646e` (4/4 parent CI complete success); source commit `3bf97bd36337b25a637308e70756e93796dd4a8c`, tree `5927eb9949c11ddb8728e4ab42af7572be24df9c`. Added new disposable PostgreSQL §51 blocked-pair assertions inside existing `supabase/tests/21_blocking_full_boundary.sql`: two blocked accepted peers B/G, neither owns O's private Shared Wall; retain membership/view/contribution but hide blocked co-member/profile and deny reactions by one to the other's Mark, with reaction cleanup. Source [CI 45056072702](https://github.com/darshitmeghani1992/the-wall/actions/runs/45056072702) triggered; **not yet certified at this checkpoint**. Final documentation-head CI, independent Reviewer and behavioral QA remain required. **Use `docs/BUILD_STATUS.md` for canonical queue, not this handoff**.

Staging `ewintxgdxdvschiqodkq` SELECT-only: Auth users/Walls/Marks=0, public RLS=35/35, no pg_cron; genuine three-actor JWT HTTP/SQL and verified six-digit SMTP OTP impossible to certify yet. Secret/media/analytics remain OFF, 0031/deletion withheld; original production untouched, no writes/merges/deploys/invites/Apple/domain. **Enhanced Beta NO-GO**. Next: inspect #176 exact-head CI and independent review; continue other unblocked security audits without altering parent PRs.

## 22 Nov 2026 — BACKEND four-function Shared Wall caller audit (read-only)

**ARCHITECT → BACKEND.** Isolated child `codex/beta-wall-definer-actor-trace-20261122-auto18` from #174 exact `70d187f545470e4c0efae517f2e8610a9a571968`, tree `239d1635ac09de4abf9a504e04ac0851a87a2680` ([4/4 CI passed](https://github.com/darshitmeghani1992/the-wall/actions/runs/45050794955), independent Reviewer/QA absent). Completed source/catalog static caller trace for `get_wall_capabilities`, `get_my_pending_shared_wall_invite`, `invite_shared_wall_member`, `join_shared_wall` against checked-in migration 0026 and staging `ewintxgdxdvschiqodkq`. Authenticated-only published EXECUTE; `auth.uid()`/active account and owner, block, tombstone, public/open join guards observed. No security certification; 3 real JWT/SQL actors unavailable. Read `docs/handoffs/STAGING_DEFINER_CALLER_TRIAGE_2026-11-21.md` for exact provisional findings, follow `docs/BUILD_STATUS.md` for next task. Remaining 29 direct routine traces (some already documented in prior section) and trigger semantics require independent verification; do not double-count past traces.

Staging read-only 35/35 public RLS, Auth/Walls/Marks=0, private mark-media, no pg_cron. Original production untouched. No schema/hosted change, migration, merge, deployment, held DNS/Apple or tester actions. Media/Secret/analytics OFF; deletion unavailable. **Enhanced Beta NO-GO.**

## 22 Nov 2026 — FRONTEND isolated child: recover failed Auth startup without crossing identity

**ARCHITECT → FRONTEND.** Child branch `codex/beta-auth-bootstrap-failure-recovery-20261122-auto18` starts at #173 exact `e01e935f626420a27ff28cf496bbae66c81942e1` ([CI 45044302652](https://github.com/darshitmeghani1992/the-wall/actions/runs/45044302652) 4/4 success; Reviewer/QA none). `auth.getSession` rejection and deferred intent reconciliation rejection could leave the loading splash stuck. FRONTEND now throws returned session errors, fences bootstrap *before* deferred reconciliation, and catches current bootstrap/event failures into a fail-closed welcome/re-auth route; superseded identity failures cannot overwrite a newer session. Source `5b0a325bf869229fa193fc1a7137ed6f8ec387df` plus failed-subject invalidation `656e16e73fb051789c422685beddbc20a7ce2efa` (prevents subsequent same-subject token refresh bypass). Node regression initial `9f80e84bb194385d1d4bf31d435d4aed0881b9be` plus no-revival check `96b95706e2abe3606945eb97723d375a6932b81b`. These are code/test preparation only, not a runtime simulator/device verdict. **Next:** draft PR, immutable final SHA/tree, four CI jobs, independent Reviewer, actual offline/secure-store/bootstrap/actor-switch QA; follow canonical `docs/BUILD_STATUS.md`.

Fresh read-only staging `ewintxgdxdvschiqodkq`: public RLS 35/35, Auth 0, Walls/Marks 0, mark-media private, pg_cron absent. Original production unqueried; no writes, migrations, merges, deployments, signing, domain/Apple or invites. Media/Secret/analytics OFF, deletion withheld. **Enhanced Beta NO-GO.**

## 22 Nov 2026 — active FRONTEND draft #173: authoritative zero-count reaction reconciliation

**ARCHITECT → FRONTEND.** [Draft #173](https://github.com/darshitmeghani1992/the-wall/pull/173) branches from #172 exact `ccbdf9f77e535e7d92cbab37f05faa7022428581`, tree `02313d8c8c12787be2fd848959a8c856a863cda8`; [CI 45039952426](https://github.com/darshitmeghani1992/the-wall/actions/runs/45039952426) all 4 success, independent Reviewer/device QA absent. A successful zero-row reaction batch omitted Mark IDs and preserved stale previous counts. FRONTEND now fills missing requested IDs with empty summaries before applying only read/session/lease-safe entries, with direct pure unit tests. Source `dd4f302d66b29cb668d3064d49c0374a17f656b5`, tree `d7266c763650a36bf6bc6fd8f5888abb3b52a17d`; exact final documentation SHA/CI to be rechecked. No test runtime performed locally in this branch; no device/offline behavioral QA.

Read-only staging approved project `ewintxgdxdvschiqodkq` ACTIVE_HEALTHY, 35/35 public RLS, 0 Auth users, Walls or Marks, no cron; original `wfsfafmgvxevpzrurofz` untouched. No hosted write, migration, merge, deployment, credentials, domain/Apple action or invites. Media/Secret/analytics OFF; deletion unavailable. **Enhanced Beta NO-GO.** Next: check final #173 CI + tree and independent Review/QA, then move to unblocked queued code work. Canonical queue `docs/BUILD_STATUS.md`.

## 22 Nov 2026 — active FRONTEND child #172: foreground offline reaction recovery

**ARCHITECT → FRONTEND.** [Draft #172](https://github.com/darshitmeghani1992/the-wall/pull/172) child of [#171](https://github.com/darshitmeghani1992/the-wall/pull/171) immutable `18069e927dcc2fbba26b94948a41b482c9fd4b1c`, tree `babd5ea297f06e60937f68950b0ef9e30dde7036`; all four parent [CI 45039634805](https://github.com/darshitmeghani1992/the-wall/actions/runs/45039634805) completed success, independent Reviewer/QA absent. Offline failed reaction-summary claims otherwise wait for changed props to retry, leaving stale counts after foreground resume. FRONTEND adds AppState transition subscription, per-foreground batch generation and stale-request invalidation, preserving in-flight mutation lease. Source `9837757168bf44b95a5651604ecfef90f70ae6fd`, source contract/tracker test `c609aa763364e7cd34edc189b4262c6cb7cd65cb`. **No real background/offline device QA or actor HTTP/SQL proof.** This retries on foreground, not all network reconnect events.

Last staging metadata SELECT-only: `ewintxgdxdvschiqodkq` ACTIVE_HEALTHY, 35/35 RLS public tables, 0 Auth users/Walls/Marks, private mark-media, no pg_cron. No original production access or hosted writes, schema, merges, deployment, Apple/domain, signing or invites. Media/Secret/analytics OFF, deletion unavailable. **Enhanced Beta NO-GO** pending SMTP/three JWT actor tests, media C2/C3, Secret cron, 0031 deletion/purge, independent Reviewer + device/accessibility/rollback QA. Canonical queue `docs/BUILD_STATUS.md`. **Next:** inspect exact final #172 head/tree and 4-job CI; independent review, real foreground/offline device QA and unblocked follow-up.

## 22 Nov 2026 — active FRONTEND child draft #171: fence stale reaction fetch/optimistic races

**ARCHITECT → FRONTEND.** [Draft #171](https://github.com/darshitmeghani1992/the-wall/pull/171) branches from exact [#170](https://github.com/darshitmeghani1992/the-wall/pull/170) HEAD `fcbd4332d26d6105bf5dbe2064c68658f708dd62`; parent [CI 45034121462](https://github.com/darshitmeghani1992/the-wall/actions/runs/45034121462) **4/4 completed success**, but independent Reviewer/QA absent. Fresh race analysis: an old summary load/realtime read could overwrite a newer optimistic reaction after the tap, while A→B→A session replay defeated identity-equality checks. FRONTEND implemented per-Mark read epochs and session epoch, applies reads only for matching epoch with no active mutation lease, and resyncs after lease release; keeps immediate rollback of failures including offline. Source `05d70ebe8bfb0559b34cd3666a1c177d9826f52d`, tests `88fd88c6cc36d18cd17814491364e936af14fc0d`. Source tests are structural only. **Exact final docs SHA and 4-job CI, independent Reviewer and real actor/offline/device QA still required.**

Read-only staging `ewintxgdxdvschiqodkq` ACTIVE_HEALTHY; public tables RLS 35/35, Auth users 0, Walls 0, Marks 0, mark-media private, `pg_cron` absent. No actual 3-user/SMTP test possible; held domain and Apple tasks unchanged. No production access, hosted writes/migrations, main merge, deployment, signing, invites or high-risk feature activation. Media/Secret/analytics OFF; deletion unavailable. **Enhanced Beta NO-GO.** Canonical queue remains `docs/BUILD_STATUS.md`. **Next:** check final PR #171 SHA/tree/4 CI, request independent Reviewer + QA, continue separate unblocked work.

## 22 Nov 2026 — active FRONTEND child draft #170: initiating-actor reaction writes and honest removal

**ARCHITECT → FRONTEND.** Child [draft #170](https://github.com/darshitmeghani1992/the-wall/pull/170) from #169 exact `436032ffb8a8ef4c833c3c257a3604251a056ebb` (4/4 ancestor CI, zero reviews). `src/lib/reactions.ts` now checks server-resolved Auth against the expected actor on reaction add/remove, surfaces auth errors, and rejects silent logout/zero-row deletes; `src/hooks/useWallReactions.ts` forwards initiating actor and stops optimism after switch. The same PR also adds per-Mark single-flight leases and immediate rollback to pre-tap reaction state when the network write fails (even if offline refetch fails); the rejected read no longer generates an unhandled promise. Structural tests `tests/frontend-reaction-actor-bound.test.mjs` are not genuine actor/device runtime results. Initial source/test `85b8c00b9ca4821a61047554481b10f55a5e7528`, source follow-up `661dd4a1ecfc67f4fb306086395a4100e31ebd2b`, tests `4dafbd1f5a83fe2f92a1626bdb660f0c9ed28d58`, [source follow-up CI 45033909503](https://github.com/darshitmeghani1992/the-wall/actions/runs/45033909503) running; earlier [docs-head CI 45033737283](https://github.com/darshitmeghani1992/the-wall/actions/runs/45033737283) was 4/4 passed **before** follow-up source changed; verify exact final commit, tree, 4 CI jobs and independent Reviewer/QA before integration.

**Regression correction:** Initial post-lease [CI 45033909503](https://github.com/darshitmeghani1992/the-wall/actions/runs/45033909503) failed its client/contract job due to outdated exact-line regex for the newly strengthened guard; corrected in test-only commit `b88b3976d166fe2e2569c887af73f7d6f935f79d`. [Retry source CI 45033989955](https://github.com/darshitmeghani1992/the-wall/actions/runs/45033989955) still requires completed 4/4, and latest documentation-head revalidation is separately required. Source changes invalidate earlier CI evidence. No independent Reviewer or QA.

Read-only **staging** `ewintxgdxdvschiqodkq`: 35/35 public RLS, zero Auth users, no `pg_cron`; therefore hosted three-user interaction tests still blocked. **Next command:** `GET /repos/darshitmeghani1992/the-wall/commits/<FINAL_HEAD_SHA>/check-runs`; inspect failures, seek separate Reviewer and independent behavior/device QA, then tackle next unblocked queue task. No original production access, hosted mutations, schema, merges, EAS, signings, invitations, domain or Apple actions. Media/Secret/optional analytics OFF; deletion unavailable. **Enhanced Beta NO-GO.** Canonical queue `docs/BUILD_STATUS.md`.

## 22 Nov 2026 — active BACKEND child: reject unsafe EAS feature flags

**ARCHITECT → BACKEND.** [Draft #169](https://github.com/darshitmeghani1992/the-wall/pull/169) is an isolated branch `codex/beta-eas-high-risk-flags-blocked-20261122-run11` (source/test/docs `cbcc27e9ca08d1fbf34a513cca5ceb7d6395426a`, tree `112b987109cd08920947c1cd1604054be8a76342`, [source CI 45028360807](https://github.com/darshitmeghani1992/the-wall/actions/runs/45028360807) running) from #168 exact `857f968ede81cf5858f12d7b0be9c153d3c99a62`. The EAS pre-install staging-only guard now rejects three unverified feature flags when `true`; adds real Node process regression tests. Parent #168 source helpers hard-freeze UI capabilities OFF. **Check this new branch final SHA, CI and independent Reviewer/QA**; prior CI does not certify altered source. No EAS build/signing, hosted writes, migrations, merge, deployment, tester invites, production queries, domain or Apple actions. Staging aggregate read-only remains 35/35 RLS, 0 Auth users, 0 Secret payloads, no pg_cron. Media/Secret/analytics OFF; deletion unavailable; **Enhanced Beta NO-GO**. Canonical queue `docs/BUILD_STATUS.md`.

## 22 Nov 2026 — FRONTEND isolated child: private-beta media/Secret/deletion flag freeze

**ARCHITECT → FRONTEND.** Branch `codex/beta-high-risk-creator-flags-frozen-20261122-run11` is an isolated child of #167 exact `e402602df9306af4c8778e69b57097183295e1c3` (4/4 prior CI passed). Make media, Secret and account-deletion client enablement helpers return OFF even when inherited `EXPO_PUBLIC_*` variable is `true`; update tests to assert the unsafe opt-in does not work. These features were not certified for hosted runtime; source holds do not replace independent server RLS/security, worker or device QA. **Verify this branch final SHA, tree, four CI checks, independent Reviewer/QA and actual preview behavior separately**; no self-certification. Original production untouched; staging read-only only; no hosted writes, migration, merge, deployment or tester invitations. Held SMTP/domain/Apple remain held; media/Secret/optional analytics OFF; Enhanced Beta **NO-GO**. Canonical queue `docs/BUILD_STATUS.md`.

## 22 Nov 2026 — active FRONTEND child draft #167: no redirected Auth settings probes

**ARCHITECT → FRONTEND.** [Draft #167](https://github.com/darshitmeghani1992/the-wall/pull/167), isolated branch `codex/beta-oauth-settings-redirect-gate-20261122-auto16` from #166 exact `7f806f4a59d600605b4ad098d2f2876c495f96b6`. Added `GET` + `redirect: error` to OAuth-provider Auth settings probe so credential-bearing fetch cannot follow to another host or report untrusted enabled provider state; updated mocked request contract/redirect error test. Code/test `b2a97aa5366e17ef5291766ce30bf5695509c855`, analytics comment/test repair `592b8190007d5ff619dcab0f52df6add27b344b0` ([source CI 45023662954](https://github.com/darshitmeghani1992/the-wall/actions/runs/45023662954)). **#166 test repair:** a static test on its first doc head matched an explanatory comment; same comment-only repair on #166 `791571218ecb2a165b54ef8bbe9f5bed15ff7d3c` ([CI 45023656698](https://github.com/darshitmeghani1992/the-wall/actions/runs/45023656698)). Check exact latest HEAD and final docs SHA; do not certify until all checks passed. No independent Reviewer, native OAuth, privacy or device QA. **Enhanced Beta NO-GO**, staging only; no hosted writes/main merges/deployments/testers/held Apple/domain; media/Secret/analytics OFF. Next: exact CI + Reviewer, next unblocked independent beta task. Canonical queue `docs/BUILD_STATUS.md`.

## 22 Nov 2026 — active FRONTEND draft #166: privacy-hold analytics is truly inert

**ARCHITECT → FRONTEND.** Isolated child of #165 exact `2f258aa54df01ecc5e60d65a52432adc17e897ec` (4/4 CI green, no independent review); branch `codex/beta-analytics-hard-disable-20261122-auto16`, [draft #166](https://github.com/darshitmeghani1992/the-wall/pull/166). Removed client-side PostHog initialization keyed on `EXPO_PUBLIC_POSTHOG_KEY`; typed `track` and `identify` are strict no-ops so an inherited EAS key cannot activate optional analytics without a reviewed new code change. Added contract test. Source/test commit `88b90c1448e2856589fb8193d9da6790d86a920f`, [initial CI 45023457108](https://github.com/darshitmeghani1992/the-wall/actions/runs/45023457108) queued at observation. Verify **final docs HEAD** checks, Reviewer, native device/bundle/network privacy QA. **Enhanced Beta NO-GO**: OTP SMTP/3-JWT hosted actors/Secret/media/deletion/device gates still blocked. No staging writes, prod, schema, deploy, merge, invitation, purchases or feature activation. Next: exact-head CI; then independent review and unblocked separate task. Canonical queue: `docs/BUILD_STATUS.md`.

## 22 Nov 2026 — active BACKEND child draft #165: authenticated anon RLS policy evidence

**ARCHITECT → BACKEND.** Draft [#165](https://github.com/darshitmeghani1992/the-wall/pull/165) on isolated `codex/beta-anon-http-rls-evidence-failclosed-20261122-auto15` from #164 exact `ed9e130a8677d088977a9d0e8338a512119cb361` (4/4 CI green). Seven-GET three-actor HTTP audit previously passed anonymous 401/403 as private-Wall visibility denial even if the request failed at the gateway before RLS. Now the anonymous check requires HTTP 200 JSON `[]` to prove the existing `walls` SELECT RLS filter was exercised; 401/403, 3xx/5xx, malformed and nonempty responses fail. Contract test updated. Source/test SHA `2b1febcc2160d55aed51e29235302a9c61dc6d29`, [source CI 45018122873](https://github.com/darshitmeghani1992/the-wall/actions/runs/45018122873) started; verify **final documentation commit** exact-head CI separately. No independent Reviewer, hosted 3-JWT fixture, read-only live HTTP, SQL or native QA in this slice. Decision D-32 records intentional table-grant alternative as review condition.

**Fresh hosted metadata (read-only, 22 Nov):** Project ACTIVE_HEALTHY; `public.walls` RLS true; anon and authenticated table SELECT grants true; exactly one canonical `walls view` policy for `authenticated` (none for anon), 0 Auth users, 0 Walls. Consequently anon 200 `[]` is the expected PostgREST/RLS default-deny result. This confirms the proposed HTTP evidence condition is compatible with current grants, **not** that the 3-JWT harness ran or that a private fixture exists.

Staging `ewintxgdxdvschiqodkq` only; previous aggregate read-only evidence showed 35 public RLS tables, 0 Auth users, private mark-media, no Secret cron or deployed account deletion. No re-probe in this slice; no hosted writes, production access, migrations, merges, deployment, tester invitations, Apple/domain steps or secret changes. Media/Secret/optional analytics OFF. **Enhanced Beta NO-GO.**

**Next exact command:** GitHub `GET /repos/darshitmeghani1992/the-wall/commits/<FINAL_PR_165_SHA>/check-runs`. Repair any failure on an isolated child; require independent Reviewer & genuine staging 3-JWT/SQL/device QA before certifying; continue another unblocked task under `docs/BUILD_STATUS.md`.

## 22 Nov 2026 — active child draft #164 anonymous publishable-key RLS header correctness

**ROLE: ARCHITECT → BACKEND.** Draft [#164](https://github.com/darshitmeghani1992/the-wall/pull/164), isolated branch `codex/beta-anon-publishable-header-gate-20261122-auto14` from exact #163 head `a9035192c1f939fda6392bcb538a0f7983ccac52` (4/4 green). Previously the anonymous private-Wall GET and read-only staging preflight supplied modern `sb_publishable_*` as `Authorization: Bearer`; Supabase publishable keys are not JWTs, risking false invalid-JWT 401 interpreted as access-control protection. Modern anonymous GETs now use only the `apikey` header, legacy anon JWTs continue to use Bearer, real owner/member/outsider JWTs remain intact. Updated tests in both suites; source/test SHA `38f1581980b1934c47f45d6f4b702902963eb32e`. Exact final docs-head CI pending; independent Reviewer/QA and actual HTTP/SQL not done. [CI initial source run 45013116286](https://github.com/darshitmeghani1992/the-wall/actions/runs/45013116286).

Staging aggregate SELECT only: 35/35 public RLS, 0 Auth users, 0 Secret payloads, no pg_cron, private mark-media bucket. No hosted writes, migrations, production access, merge, deploy, invites or held domain/Apple action; media/Secret/analytics OFF. **Enhanced Beta NO-GO** pending SMTP/three JWTs/Shared Wall INSERT RETURNING, protected media, Secret cron, deletion, independent Reviewer/device and rollback. **Next:** check draft #164 final commit CI/review, then next independent queue item.

**#163 test repair:** Initial exact-docs SHA `da5f75b6ae71f00bfb0b9eb7229bd9bf4e0585ab` had one Type-check & lint/client contract test failure (292/293 passed); `b9809ad9eeded99d9cebf4ea6cdf14a547837546` explicitly reports malformed JSON objects separately from nonempty private-Wall rows, preserving both hard failures. Final new documentation-head CI remains pending; no independent Reviewer/QA or live HTTP executed.

## 22 Nov 2026 — active draft #163 anonymous HTTP private-Wall denial preparation

**ARCHITECT → BACKEND.** Isolated child of #162 exact `cbf3438124cf115228d56abad1f2d5110947a14e`, branch `codex/beta-anon-private-wall-http-denial-20261122-auto13`, draft [#163](https://github.com/darshitmeghani1992/the-wall/pull/163), source/test SHA `1e7e83a38a556e8c5590bff6316cbdeefd990a95`; [CI run 45008398307](https://github.com/darshitmeghani1992/the-wall/actions/runs/45008398307) queued/in progress at initial checkpoint. Opt-in 3-JWT read-only harness now includes a seventh GET with public anon/publishable key against the same private Shared Wall, requiring empty filtered result or HTTP denial; tests reject leaks, malformed responses, redirection and bad status. Does not fetch data for actual actors: staging has 0 Auth users/Walls. No real HTTP/JWT/SQL QA or independent Reviewer/QA performed. Fresh staging read-only: 35/35 public RLS, 0 Auth users, 0 secret payload, no pg_cron, Secret rollout OFF. Original production untouched; no hosted writes, migrations, merge, deployment, invites, SMTP/provider or held Apple/domain activity. Media/Secret/analytics OFF, **Enhanced Beta NO-GO**. **Next:** exact final SHA CI #163, independent Reviewer/QA when actor fixtures available, then next unblocked task in BUILD_STATUS.

## 22 Nov 2026 — active child draft #162 Secret rollout switch lock and singleton guard

**ARCHITECT → BACKEND (PREP ONLY).** New isolated child [draft #162](https://github.com/darshitmeghani1992/the-wall/pull/162) from #161 exact `1e1a84dadb5a220b6f2474640da1bd93cf6375b4` ([4/4 CI passed](https://github.com/darshitmeghani1992/the-wall/actions/runs/45003957716), independent Reviewer/QA pending), branch `codex/beta-secret-rollout-lock-exact-row-20261122-auto13`. Stage-1 and stage-2 operator rollback SQL now require a real disabled `secret_mark_rollout` singleton and stage-2 locks its table against concurrent re-enable before expiry job shutdown. Source/test commit `5108a7e4ffd5f5746be3821085eddd75164ad373`; first [CI run 45008189530](https://github.com/darshitmeghani1992/the-wall/actions/runs/45008189530) queued at handoff. Exact final-docs-head CI must be rechecked. No operator SQL executed; source tests **not** disposable cron/DB QA. Staging read-only: ACTIVE_HEALTHY, 35/35 public tables with RLS, 0 Auth users, 0 secret payloads, no pg_cron, rollout singleton disabled. Original production untouched, no hosted writes/migrations/merges/deployments/invitations or held domain/Apple work. Media/Secret/analytics OFF, **Enhanced Beta NO-GO** (real OTP, three hosted JWT actors, C2/C3, Secret scheduler, deletion 0031, independent Reviewer/device QA/rollback). Next: check #162 final SHA CI; independent SQL race review/QA; continue next unblocked queue item.

## 22 Nov 2026 — active child draft #161 Secret expiry unschedule safety

**ARCHITECT → BACKEND.** Isolated child of #160 exact `be082beb570f3452ed4aa0be3be0e691cb7e7e06` ([4/4 CI passed](https://github.com/darshitmeghani1992/the-wall/actions/runs/45003663431); independent Reviewer/QA pending). Branch `codex/beta-secret-expiry-unschedule-retention-gate-20261122-auto12`, source/test `b93837774f9705dedea01a1d53192aaa1b92fd78`, [draft #161](https://github.com/darshitmeghani1992/the-wall/pull/161). Future operator runbook now commits Secret creation OFF before attempting cron shutdown, and refuses unschedule with any secret payload backlog or unsafe cron config, using transactional write locks to prevent creation races. Source-only guard tests added. **NOT RUN on staging or disposable PostgreSQL**, no permission to apply; exact final CI, independent security Reviewer, DB/cron concurrency QA and release approval remain pending.

Fresh staging read-only: ACTIVE_HEALTHY, 35/35 public RLS, 0 Auth users, 0 mark_secrets, Secret creation OFF, no pg_cron. Original production untouched; no hosted SQL writes/migrations, merge, deploy, invitations, domain/Apple operations. Media/Secret/analytics OFF. **Enhanced Beta NO-GO** pending real OTP, three genuine actor JWT/SQL/HTTP, C2/C3, Secret one-hour cleanup, deletion 0031, independent device/rollback. Next: verify PR #161 exact CI then independent review, continue unblocked work from BUILD_STATUS.

## 22 Nov 2026 — new child draft PR #160, no-follow staging preflight

**ARCHITECT → BACKEND.** New isolated branch `codex/beta-preflight-redirect-denial-20261122-auto12` from #159 exact `83fc9c16533b98d187a2bdff2885b1adf322b18f`, with source/test `001bcd10e7769e2746ca47629bb85d640759b8ef` and [draft PR #160](https://github.com/darshitmeghani1992/the-wall/pull/160). Staging preflight now disables following HTTP 3xx when attaching `apikey` and Authorization to requests, matching 3-JWT harness policy. New tests assert `redirect:'error'` on every probe and failure for 302/redirect exceptions. #159 [4/4 CI passed](https://github.com/darshitmeghani1992/the-wall/actions/runs/44999408279) but independent Reviewer and behavioral QA pending. #160 exact final-head CI pending.

Fresh staging **read-only aggregate SELECT only**: ACTIVE_HEALTHY, 35/35 public tables with RLS, 0 Auth users, 0 pg_cron, no deletion RPC. Original production never accessed, no hosted writes, migrations, deploy, merge or invitations. Media/Secret/optional analytics OFF; Apple/domain holds. Enhanced Beta **NO-GO** (verified OTP, three hosted JWT actors, RLS/Shared Wall INSERT RETURNING, media C2/C3, Secret cleanup, deletion 0031, device/rollback and independent Reviewer/QA). **Next:** verify PR #160 exact final SHA's four jobs, fix failures on isolated child, independent Reviewer and QA, then next unblocked task from BUILD_STATUS.

## 22 Nov 2026 — active PR #159 EAS/preflight opaque-key refusal

**ARCHITECT → BACKEND.** Child of #158 immutable `7ddfb47bff1d8ae481bf75433dd31afc5798aaf6`, branch `codex/beta-eas-opaque-key-rejection-20261122-auto11`. EAS and read-only preflight used to accept arbitrary opaque public API keys even though Expo runtime rejects them. Updated shared Node `scripts/staging-preflight.mjs`: only modern `sb_publishable_*` or legacy JWT-shaped public key can pass initial format checks; pre-HTTP legacy role/ref audit remains required. EAS and preflight fixtures now mirror accepted formats, new negative tests enforce zero network/no secret logs. Code/test commit `7bbcf2ea1e39af2d9a8b9f6b8d5e8d69a563f2ac`; final-head CI, independent Reviewer/QA pending.

Fresh staging aggregate SELECT only: ACTIVE_HEALTHY 35/35 public RLS, 0 Auth users, 0 pg_cron, 0 deletion RPC, 1 private mark-media bucket. Original production untouched, no secrets, hosted writes, migrations, merge, deploy or invitations. Media/Secret/analytics OFF; domain/Apple held. **Enhanced Beta NO-GO** until genuine SMTP OTP, 3 distinct staging authenticated actors/RLS and negative HTTP, media C2/C3 playback, Secret expiry, deletion 0031, device/rollback and independent Reviewer/QA. Next: check exact final PR #159 SHA tree and CI, fix failures on independent branch and continue unblocked work.

## 22 Nov 2026 — active draft #158 Expo runtime legacy key privilege/ref boundary

**ARCHITECT → FRONTEND.** Previous [#157](https://github.com/darshitmeghani1992/the-wall/pull/157) immutable `b6b36c3c22299d124dbe96cc01a28ac6c7e90cdf` [4/4 CI PASS](https://github.com/darshitmeghani1992/the-wall/actions/runs/44994923741), independent review/QA unsigned. Child [#158](https://github.com/darshitmeghani1992/the-wall/pull/158) on `codex/beta-runtime-legacy-public-key-fence-20261122-auto11` rejects local Expo/Metro runtime legacy `service_role`, foreign/original-production JWT, malformed or unknown keys before selecting Supabase; accepts staging `sb_publishable_*` and correctly scoped legacy anon public JWT. Pure bounded decoder without Buffer/atob; fake-key regression tests. Source/test `0608cb6a8abf218761217ffffb2acb11da78b7ed`, [CI run 44999184212](https://github.com/darshitmeghani1992/the-wall/actions/runs/44999184212) initially running. Need exact final head/tree/CI, independent Reviewer and installed iOS/Android QA. Signature and RLS remain unverified live.

Staging-only `ewintxgdxdvschiqodkq`; no original production access, hosted writes, migrations, merges, deployments, tester invitations, Apple/domain steps or credentials. Last hosted evidence remains 35/35 public RLS, 0 Auth users, 0 Secret scheduler, deletion RPC absent — **not freshly re-probed this slice**. Media/Secret/analytics OFF. **Enhanced Beta NO-GO** pending real OTP and three actors, private media, Secret expiry, deletion and independent QA. Next command: inspect `GET /repos/darshitmeghani1992/the-wall/commits/<final-sha>/check-runs`, inspect failed job and repair on isolated child; then choose next unblocked work.

## 22 Nov 2026 — active PR #157 staging three-JWT public-key project gate

**ARCHITECT → BACKEND.** New isolated child `codex/beta-staging-jwt-anon-ref-gate-20261122-auto10` of #156 exact `9f65c8f0942f08e85592063179283707c768c96c`. Parent [#156 CI 44994769159](https://github.com/darshitmeghani1992/the-wall/actions/runs/44994769159) **4/4 green** (not independent QA or a deployed artifact). Draft [#157](https://github.com/darshitmeghani1992/the-wall/pull/157) prevents legacy anon JWTs from a missing/wrong project `ref` from entering three-actor staging HTTP audit. Reuses existing EAS check and adds zero-network regression. Code/test SHA `3d649585edcaa02ffe8ab6e7f4e9c743d59b56d2`; first [CI](https://github.com/darshitmeghani1992/the-wall/actions/runs/44994894348) queued. No actual authenticated HTTP probes because staging has 0 test accounts, no private Wall fixture. Exact final tree/CI and independent Reviewer/QA pending.

Approved staging read-only remains ACTIVE_HEALTHY; public RLS 35/35, Auth 0, pg_cron 0, deletion RPC absent. No production access, hosted writes/migrations, merge, deployment, invites, Apple/domain actions; media/Secret/analytics OFF. **Enhanced Beta NO-GO** pending SMTP/real JWT three actors, security and Shared Wall INSERT RETURNING, media C2/C3, Secret scheduler, deletion 0031, independent QA/Review, installed-device and rollback. Next: verify #157 final CI; if blocked, independent unblocked engineering task from BUILD_STATUS.


## 22 Nov 2026 — active draft #156 runtime staging-only Expo client fence

**ARCHITECT → FRONTEND.** Child of PR #155 exact `b36fb9e4c40829864cb0ed67658868c91690e2a8` on isolated branch `codex/beta-runtime-staging-client-fence-20261122-auto10`. #155 all four CI checks passed [run 44990137971](https://github.com/darshitmeghani1992/the-wall/actions/runs/44990137971) but Reviewer and QA remain unsigned. New `src/lib/config.ts` staging-only runtime guard prevents alternate Expo/Metro builds from selecting original production Supabase even without EAS hook; new source-independent direct unit tests and client wiring assertion. **This is not proof of device behavior, deployed auth or secure legacy key semantics; EAS controls retain that responsibility.** Draft [#156](https://github.com/darshitmeghani1992/the-wall/pull/156) code/test SHA `e5889947889b0c21ff0b69e6cd1f7eee02962984`; [source CI](https://github.com/darshitmeghani1992/the-wall/actions/runs/44994715879) initially in progress. Verify final docs commit SHA/tree and completed exact CI.

Approved staging read-only 22 Nov: ACTIVE_HEALTHY, public RLS 35/35, Auth users 0, pg_cron 0, deletion RPC absent. No original production project query, hosted writes, migrations, merge, deploy, credentials or invitations. Media/Secret/analytics OFF, domain and Apple gates held. **Enhanced Beta NO-GO:** genuine six-digit OTP, three actual JWT actors, security and Shared Wall mutation tests, private media C2/C3, Secret cleanup, deletion 0031, independent Reviewer/QA/installed-device/rollback. Next: complete #156 CI, independent review/QA, continue separate unblocked task.

## 22 Nov 2026 — release-tooling CI repair and privileged-key fail-closed guard (PRs #154–#155)

**ARCHITECT → BACKEND.** PR #153 exact-head `bc3d0aed1e649e97f24da70485415c7fb84bbada` failed two stale EAS client-contract tests (generic accepted URLs and mock legacy ref); full CI [44985965948](https://github.com/darshitmeghani1992/the-wall/actions/runs/44985965948): DB/Edge/media pass, type/lint pass, client tests fail, Expo/prebuild/exports skipped. [#154](https://github.com/darshitmeghani1992/the-wall/pull/154) child `codex/beta-eas-approved-origin-test-repair-20261122-run9` source commit `847828352bcc7eed36f612e91435a51013f814bb` repaired fixtures while keeping hard staging-only guard; [CI](https://github.com/darshitmeghani1992/the-wall/actions/runs/44989996724) first 2/4 passed, others pending.

[#155](https://github.com/darshitmeghani1992/the-wall/pull/155) child `codex/beta-reject-secret-client-keys-20261122-run9`, source+test SHA `7594f0ef6e8b683820ddc5cc126b9ad4019b9509`, adds explicit pre-network/bundle rejection of `sb_secret_*` and preflight validation of legacy JWT `anon`/project ref, with mock no-network tests. Exact final documentation SHA/CI must be rechecked; **not Reviewer/QA-certified**. D-23 records security choice. Fresh staging read-only: ACTIVE_HEALTHY, 35/35 public RLS, 0 Auth users, no pg_cron, no deletion RPC; no production touch.

**Enhanced Beta NO-GO:** SMTP/six-digit OTP, 3-JWT actors, positive+negative RLS/security and Shared Wall INSERT RETURNING, C2/C3 media, Secret expiry, deletion 0031, independent Reviewer and native QA/rollback all outstanding. No merges, hosted writes/deployments, migrations, tester invites, Apple/domain or credential changes. Next check PR #155 final SHA/tree/CI, inspect any failure logs, follow up on independent reviews and work next separate unblocked canonical queue item.

## 22 Nov 2026 — PR #153 staging-only EAS/smoke preflight enforcement

**ROLE: ARCHITECT → BACKEND tooling.** Isolated child of #152 exact `4671d77c9811481a96069d89725e7d5df10dc352` on branch `codex/beta-staging-only-eas-guard-20261122-auto9`. Explicit approved-staging-only guard now rejects wrong Supabase origin **before smoke GET** and **before EAS package install**, including original production `wfsfafmgvxevpzrurofz`. Mock regression proves 0 network calls for production URL; preserves generic client-key validation. Draft [#153](https://github.com/darshitmeghani1992/the-wall/pull/153), code/test SHA `ff125bedd4e3a9c125919b5c779c6d3fc9614c4a`, [initial CI](https://github.com/darshitmeghani1992/the-wall/actions/runs/44985875237) pending; independently verify final docs head. No hosted write, original-production access, merge, deployment, migration, invitations, domain/Apple or credential changes.

**Current gate:** Enhanced Beta **NO-GO** despite PR #151 confirmed 4/4 CI, #152 and #153 pending exact-head CI/independent Reviewer and QA. Read-only staging `ewintxgdxdvschiqodkq` healthy, 35 public RLS tables, 0 users, no pg_cron or account deletion RPC. OTP SMTP, authenticated 3 JWT actors, private media, Secret expiry, deletion 0031/worker, installed device QA and rollback remain blocked. Next: poll exact latest #153 CI SHA and inspect any failed steps; continue unblocked P0 fixes without touching worker-owned branches.

## 22 Nov 2026 — PR #152 callback result/session and provider-error classifications

**ROLE: ARCHITECT → FRONTEND.** Child of exact #151 `11ef2f39c07307b8a46a320abbb932c8bd3b152a` on isolated `codex/beta-auth-callback-session-outcome-20261122-auto9`. New pure callback contract rejects `error`, `error_code`, `error_description`, duplicate/blank/invalid `code` before existing-session fallback; code exchange now requires actual returned session. Node behavioral helper tests and frontend wiring assertions updated. Draft [#152](https://github.com/darshitmeghani1992/the-wall/pull/152), source/test SHA `3176035d6ae10901e3ed46a367f36759240149dd`; [CI](https://github.com/darshitmeghani1992/the-wall/actions/runs/44985699179) still pending at last observation (Edge passed, other jobs running). Independent reviewer + real-device QA missing.

**Staging READ ONLY:** `ewintxgdxdvschiqodkq` ACTIVE_HEALTHY; 35/35 public table RLS, 0 Auth users, 0 profiles/Walls/Marks, private media, no pg_cron, no deletion RPC. 113 public SECURITY DEFINER routines, 0 anon executable, 59 authenticated executable; grants are not functional security certification. `0031` absent. Original production untouched; no hosted write, migration, merge, deployment, provider activation, credentials, domain/Apple action, invitation. **Enhanced Beta NO-GO.** Next: exact final SHA/tree/CI; independent Reviewer + QA real OTP, 3 JWT actors, media/Secret/deletion and native rollback; continue unblocked work.

## 22 Nov 2026 — PR #151 Native OAuth fail-closed continuation

**ARCHITECT → FRONTEND.** Source fix `src/lib/auth.tsx` throws on missing provider URL, canceled browser, provider rejection, wrong native callback, absent code, returned error or missing exchanged session; prevents sign-in UI navigating to root without real new authentication. [Draft #151](https://github.com/darshitmeghani1992/the-wall/pull/151), code/test SHA `53d893ff270713491961d402f643941785a94f87`, on isolated `codex/beta-oauth-browser-cancel-failclosed-20261122-auto9` from #150 exact `dc5476e8d96fae4bc7da3d24ba565dd314fd601b`. Exact final-head CI/Reviewer/device QA pending. Providers OFF in staging. No backend config/write, production, migrations, release or invitations. **Enhanced Beta NO-GO**; OTP SMTP, three real JWT actors, media/Secret/deletion and rollback remain blockers. Next: check final CI and independent Reviewer/QA; continue next unblocked separate task.

## 22 Nov 2026 — PR #150 reviewed ancestry/file overlap (ARCHITECT evidence)

New [draft #150](https://github.com/darshitmeghani1992/the-wall/pull/150) on isolated `codex/beta-lineage-filelevel-audit-20261122-auto9` from #149 `00f3afc918e43f46b0af316ac9cb8469ca0a7632`. `docs/handoffs/BETA_LINEAGE_FILE_LEVEL_AUDIT_2026-11-22.md` records GitHub per-range file comparisons, explicit #30–#59 dependencies and #59–#149 descendant, file-level hotspots and non-merging plan. Does not equate inherited source with QA. Next: exact-head CI, independent Reviewer and QA, source patch-by-patch inspection, then separate unblocked coding task. 3 real JWT actors, OTP SMTP, protected media/Secret/deletion and device release evidence remain blocked. **Enhanced Beta NO-GO.** No original production access, hosted writes, migrations, merge, deployment or invitations.

## 22 Nov 2026 — PR #149 auth callback rejection and retry (current code slice)

**ARCHITECT → FRONTEND.** On isolated `codex/beta-auth-callback-retry-20261122-auto9` child of PR #148 exact `747ca1e50194a6373645abdca990912226211b97`, reject provider-declined OAuth *before* falling back to an existing session; clear old callback error on new parameters; add accessible retry button to sign-in. Added frontend contract test. Source/test SHA `5ea956cf27b960e6ff5b5c4241fb02f8b9d5edfc`; [PR #149](https://github.com/darshitmeghani1992/the-wall/pull/149). Parent #148 exact commit CI 4/4 passed; #149 exact final-head CI, independent Reviewer and device behavioral QA unverified. Read-only staging preflight remains 0 authenticated users, no Secret cron/deletion RPC. No production/hosted writes/merges/deployments/invitations; Apple/domain on hold, media/Secret/analytics OFF. **Enhanced Beta NO-GO.** Next: check #149 final SHA CI, Reviewer+QA, then next independent unblocked task.

## 22 Nov 2026 — active slice PR #148 (auth callback result/session)

ROLE: ARCHITECT → FRONTEND. New independent child branch `codex/beta-auth-callback-error-check-20261122` from #147 exact `ebe59ab34fcac7b7bd64981ce0c00ed60e9432b2`; fixes fail-open callback navigation on returned Supabase exchange errors and missing session; blocks unmounted late navigation. Source regression tests added. CI pending for final documentation head. Independent Reviewer and behavioral device QA pending. Staging only; no production, hosted writes, migration, merges, deployments or invitations. **Enhanced Beta NO-GO** (OTP deliverability / 3 actors / media / Secret / deletion / device gates). Source of truth `docs/BUILD_STATUS.md` and issue #57.

# CURRENT — Operational Handoff

## CURRENT BETA-P0-63 · OTP challenge bound to the sent email — 22 Nov 2026

**ARCHITECT → FRONTEND:** Child of #146 exact `f05cd07d1518bff36b68ed0a3ec248f630fd87ec` on `codex/beta-otp-challenge-email-snapshot-20261122-auto8`. Stores an immutable `sentEmail` only after successful send; displays/verifies/resends the same challenge even if draft input changes; email edit disabled while busy, code cleared on resend, and synchronous ref prevents overlapping OTP/OAuth operations. New source regression; exact CI, independent Reviewer, real native/email delivery QA still required. SMTP/six-digit genuine tester setup remains Founder-gated; no actual OTP sent. STAGING ONLY, no original production, hosted writes, domain/DNS/Apple, migration, deploy, merge or invitations. **Enhanced Beta NO-GO.**

**Next:** Verify #146/#147 final-head CI, independent device/email tests once Auth setup is approved; other media/Secret/deletion/rollback gates unchanged.


## CURRENT BETA-P0-62 · Walkthrough post-refresh continuation revision — 22 Nov 2026

**ARCHITECT → FRONTEND:** Child of #145 `99a3646e59ff023402861531d405f90532a5abbe` on `codex/beta-walkthrough-refresh-identity-lease-20261122-auto8`. Walkthrough final navigation after Auth route refresh now requires a monotonic current actor+replay revision, preventing old A→B→A and replay callbacks while preserving same-actor first-use→ready navigation and deferred Discover. Earlier awaited draft/write boundaries retain the focus fence. New executable ABA/source test and prior contract updates; exact CI, independent Reviewer and native QA pending. Staging only; no production/hosted writes or protected activations. **Enhanced Beta NO-GO.**

**Next:** Check #145/#146 immutable CI, independently review/device-test actor ABA and normal walkthrough, then next unblocked task. SMTP OTP, actual JWT actors, media/Secret/deletion and rollback gates unchanged.


## CURRENT BETA-P0-61 · Account deletion confirmation actor isolation — 22 Nov 2026

**ARCHITECT → FRONTEND:** Isolated child of #144 exact `a3b777c7c5c1373ef483b42b228f20fa576f4eb2` on `codex/beta-delete-account-actor-confirmation-20261122-auto8`. Keyed deletion editor resets typed confirmation on actor switch; live actor/revision plus focus fence prevents late scheduling and stale native ownership dialog navigation, including A→B→A. New regression test; immutable CI and independent Reviewer/device QA mandatory. Deletion 0031/purge remain OFF and gated. No hosted writes, production access, merges, deployment, domain/Apple work, or tester invitations. **Enhanced Beta NO-GO.**

**Next:** Verify final SHA CI, request separate Reviewer/QA, continue independent unblocked beta engineering. SMTP OTP/three JWT, private media, Secret expiry, deletion and device/rollback gates remain open.


## CURRENT BETA-P0-60 · Onboarding intermediate async guard — 22 Nov 2026

**ARCHITECT → FRONTEND:** Isolated descendant of #143 `a4566db820f53438bf0fcb0b20c565d5bfa6ab58`, branch `codex/beta-onboarding-post-await-guards-20261122-auto7`. Added missing actor checks between async draft read and write in Find People, and between draft read/clear and Auth route refresh in Walkthrough. Preserves deferred destination navigation on successful `walkthrough→ready`. New source/race test; exact CI, Reviewer and independent native QA required. Enhanced Beta **NO-GO**; no hosted/prod changes, merges, deployments or held external actions.

**Next:** Inspect exact SHA CI, native A→B draft and normal completion tests, then next unblocked beta slice; OTP/three JWT/media/Secret/deletion gates unchanged.


## CURRENT BETA-P0-59 · Walkthrough session/replay isolation — 22 Nov 2026

**ARCHITECT → FRONTEND:** Child of #142 `7dd545934ab231810acd5fec0ade9f7c4a154e43` on `codex/beta-walkthrough-actor-replay-scope-20261122-auto7`. Tour step, busy/finish lease, replay mode remount per actor/replay, preserving the in-flight walkthrough-to-ready redirect, with live actor guards before late navigation. New source and account-route test. Native QA, Reviewer and exact SHA CI required. No backend/hosted/main/prod/deploy/feature flag change; **Enhanced Beta NO-GO**. Media/Secret/analytics OFF; domain/Apple held.

**Next:** Verify own CI and independent behavioral QA for account changes during tour, then next nonoverlapping task; retain real OTP/JWT, media, Secret, deletion and native/rollback blockers.


## CURRENT BETA-P0-58 · Find People onboarding account scope — 22 Nov 2026

**ARCHITECT → FRONTEND:** Isolated child of PR #141 `fd3df87179d5bdb0e50e9d6a3eeae6c202efa71d` on `codex/beta-find-people-onboarding-actor-20261122-auto7`. Find People route remounts for current user/account-route and only uses matching user's handle for invitation sharing, preventing previous-account links while the Auth profile catches up. Async progress fence checks live actor before UI continuation; fallback generic share retained. Added source/route lease test; exact CI, independent Reviewer and native QA pending. Staging only, media/Secret OFF, beta **NO-GO**. No hosted mutation/merge/deploy/held domain or Apple change.

**Next:** Confirm exact SHA CI, collect independent review+device scenarios, then continue unblocked tasks. OTP, three JWT actors, media, Secret, deletion and rollback remain launch gates.


## CURRENT BETA-P0-57 · Discover actor state and native Unfriend guard — 22 Nov 2026

**ARCHITECT → FRONTEND:** Isolated child of PR #140 `f8ae7c2447d14c6b4cb68b0020b72265bd266e38` on `codex/beta-discover-actor-native-confirm-20261122-auto7`. Discover now remounts private relationship/search state synchronously when account changes; stale Unfriend native dialog callback checks the original focus token and current actor (updated in parent render). Existing authenticated mutation contract unchanged; source/lease regression test added. Exact CI, independent Reviewer and device QA pending; beta remains **NO-GO**. No production, hosted mutation, merge, deployment or held external action.

**Next:** Verify own CI and unchanged SHA, obtain separate Reviewer/QA for native alert and actor transitions, then select next unblocked task. OTP/three JWT actors, media, Secret, deletion and device/rollback gates unresolved.


## CURRENT BETA-P0-56 · Shared Wall delayed Leave Alert scoping — 22 Nov 2026

**ARCHITECT → FRONTEND:** New isolated child of PR #139 immutable `251f2de4684469ab4ef2c76b0c80ff160d0d68a8`, branch `codex/beta-shared-leave-dialog-scope-20261122-automation6`, source commit `ed7dd5303535c81f1db8f0261781722ebc0c702f` / tree `39ab98e919306eab78c4f80b39277d32ae4de76e`. Native Leave confirmation now carries a focus token plus exact Wall guard to reject a stale destructive callback after A→B, route X→Y or blur; backend membership authority unchanged. New source/lease regression test; final CI, independent Reviewer and behavioral device QA pending. **NO-GO.** No hosted mutation, branch merge, deployment, original production access or held external setup.

**Next:** Verify current SHA CI and independent native QA, then continue unblocked tasks from `docs/BUILD_STATUS.md`. Real OTP/3 JWT actors, private media, Secret hourly expiry, 0031 deletion and rollback/Founder GO remain unresolved.

## CURRENT BETA-P0-55 · Shared Wall create draft actor isolation — 22 Nov 2026

**ARCHITECT → FRONTEND:** Isolated child of #138 exact `d36dcab24f1744eeb38b1e1a69330074bc0cc047`, new branch `codex/beta-shared-create-actor-draft-20261122-automation6`, source `2e4c242f02e8caa48c4bd5ba9c01708b5b63ec72` / tree `c60d1723a68dcaa9f10db8c65eadc7f40ebd1ede`. Create Shared Wall title/visibility/Anonymous/Open Join drafts now live inside a session-keyed editor, instead of leaking A's local form state during B's new sign-in. Existing create mutation fence retained, no backend or protected infrastructure changes. New contract test `tests/frontend-shared-create-actor-draft.test.mjs`, exact final CI pending, independent REVIEWER/behavioral QA not yet done. Enhanced Beta **NO-GO**; staging-only, no deploy/merge.

**Next:** Verify CI for current head and PRs #137/#138, obtain distinct Reviewer and native QA for A→B and new Wall creation, return to remaining unblocked queue items. Six-digit SMTP OTP, 3 real JWT actors, private media C2/C3, one-hour Secret cleanup, 0031 deletion and device/rollback still blocked. Keep media/Secret/analytics OFF, original production protected.

## CURRENT BETA-P0-54 · Shared Wall member roster and native confirmation fencing — 22 Nov 2026

**ARCHITECT → FRONTEND:** Fresh isolated child of PR #137 exact `ef774e7f447234ae2644a2977e873a956ea644d5`, branch `codex/beta-shared-members-actor-confirm-20261122-automation6`, source `e07d3fcf9d858ece468d6e5999acf43f1c9c8ed5`/tree `1186c1a199fc795d8046da27efd3cbe65a58d5e5`. Member roster, invite search and membership actions now belong to a React-keyed actor+Wall editor; old native removal/transfer confirmation callbacks check a mutation focus token before performing protected actions. Node contract/source test added. CI/independent Reviewer/QA on final doc-inclusive SHA pending. No merge/deploy/hosted writes; **Enhanced Beta NO-GO**. Media/Secret/analytics remain OFF, original production protected.

**Next:** Verify latest exact SHA's CI jobs, independent Reviewer and device QA for A→B and Wall X→Y with delayed native confirmation, pending actions and error/retry. Preserve user-authenticated staging QA, SMTP, media C2/C3, one-hour Secret scheduler, migration 0031/deletion, native/rollback and Founder gates. Continue another separate unblocked implementation slice.

## CURRENT BETA-P0-53 · Shared Wall settings session/Wall scoped editor — 22 Nov 2026

**ARCHITECT → FRONTEND:** Stacked isolated child of #136 immutable source `7d63536bf0891ee6068772496309af5465123984`, branch `codex/beta-shared-settings-actor-scope-20261122-automation6`; source implementation commit `4b383045111fdba1e93b650639fd968657424ac5` and tree `97fea4334281aa25922b231467c69e6f675e851b`. Shared Wall Settings now keys the editor to the authenticated actor and destination Wall, preventing old privacy/name/anonymous choices or delete confirmations from appearing across A→B and Wall X→Y before focus resets. Reads and mutations use separate focus fences; obsolete save/delete work cannot clear a newer session's mutation lock, and delete requires live confirmation of the exact loaded Wall name. New contract test `tests/frontend-shared-settings-session-isolation.test.mjs`; GitHub CI for final doc head pending. Independent REVIEWER and device QA not run. **NO-GO**; staging only, no hosted writes, merges, release, 0031, domain or Apple actions.

**Next:** Verify final SHA's full CI, independent Reviewer and device QA of identity+Wall transitions, slow saves/deletions, retry and confirmation. Then select next unrelated unblocked queue item from `docs/BUILD_STATUS.md`. OTP, three JWT actors, C2/C3 media, Secret scheduler, deletion and native/rollback remain gates.

## CURRENT BETA-P0-52 · Home profile/Wall account isolation — 22 Nov 2026

**ARCHITECT → FRONTEND:** Isolated descendant of PR #135 exact source `917387f1a1b2cbc07aa0a14b82a547ef84a219a9`, branch `codex/beta-home-profile-actor-display-20261122-run16`. My Wall no longer shows old cached profile identity (handle, avatar, display name) in header, sharing, linked Mark or empty state when authenticated actor changes. Account-specific sharing waits for a matching profile; a mismatched old owner's personal Wall is hidden synchronously before cleanup effects. New `tests/frontend-home-actor-profile.test.mjs` tests source wiring and actor/Wall mismatch matrix. Exact SHA CI and independent Reviewer + actual device QA still required; no self-certification.

**Safety:** Staging `ewintxgdxdvschiqodkq` only; original production untouched; no hosted mutations, merge, migration, release or tester invite. Domain/DNS and Apple held; media/Secret/analytics OFF. Enhanced Beta **NO-GO** pending real OTP, 3 JWT actors, media, Secret, deletion and native/rollback gates. **Next:** capture CI for unchanged head and continue another unblocked task.


## CURRENT BETA-P0-51 · Onboarding account and route scoped editor — 22 Nov 2026

**ARCHITECT → FRONTEND:** New stacked child of #134 SHA `45625552f065dc0f281004367b95789e08be0625` on `codex/beta-onboarding-actor-state-isolation-20261122-run15`. Previously, profile setup could show prior actor's draft/step/Avatar and cached profile handle/bio until effect cleanup on account transition. The profile setup editor now remounts on authenticated actor/account-route identity change, and `existingProfile` is only accepted if its ID matches the active authenticated subject. Per-actor draft persistence and server authority unchanged; source test added.

**Gates:** Exact new head CI, independent Reviewer and distinct QA on account switches before effect, delayed local draft load, missing_profile→onboarding, existing avatar, completion and device/offline retries. Staging-only `ewintxgdxdvschiqodkq`; original production untouched. No hosted writes, migration 0031, merge, deploy, tester invitations, domain/DNS or Apple action. Enhanced Beta NO-GO while SMTP OTP, three actual JWT identities, protected C2/C3 media, Secret scheduler, deletion, native/rollback/independent gates remain outstanding; media/Secret/analytics OFF.

**Next:** Check exact candidate SHA/CI, obtain independent verification and continue another unblocked scoped feature.

## CURRENT BETA-P0-50 · Composer sender preview actor guard — 22 Nov 2026

**ARCHITECT → FRONTEND:** Child of #133 immutable `fd6fee01505abe324354bc9818613f990af61240` on new branch `codex/beta-composer-author-preview-scope-20261122-run15`. Mark composer preview/author choice had read cached `profile` irrespective of current authenticated actor, potentially showing the previous account's handle, display name and avatar immediately after account switch. Both surfaces now derive a matching `actorProfile` and otherwise use existing neutral placeholders. No backend/API/flags or other UI design change; contract test added.

**Gates:** Own commit exact-head CI, independent Reviewer and native QA of A→B/B→A before profile load, no-profile error, anonymous preview, avatar and delayed changes. No hosted writes, production, migration 0031, merge, deploy or invitations. Enhanced Beta NO-GO pending SMTP OTP, three JWT actors, protected media C2/C3, Secret hourly expiry, account deletion, device/rollback and independent approvals. Media/Secret/analytics OFF; domain/Apple held.

**Next:** Check exact SHA CI, route for separate review/device QA and resume nonoverlapping scope.

## CURRENT BETA-P0-49 · Composer stale dialog/async navigation lease — 22 Nov 2026

**ARCHITECT → FRONTEND:** Child of #132 immutable `81ae72b255d9289a08e4b8d4069e2ad41693c4fa`, branch `codex/beta-composer-stale-discard-scope-20261122-run15`. Previous composer can unmount on target/actor switch while a native Discard confirmation remains queued; old callback could dispatch navigation after cleanup and affect the new session. An explicit monotonic scope lease (including ABA and unmount invalidation) now guards pending callbacks, success redirects and submit feedback against a replaced actor or target. New pure lease matrix and source contract. Distinct device/simulator QA and Reviewer gate remain outstanding.

**Safety:** Staging-only `ewintxgdxdvschiqodkq`; original production untouched. No hosted writes, migration 0031, main merge, deploy, invites or held domain/Apple work. Enhanced Beta NO-GO pending real SMTP OTP, three JWT actors, C2/C3 media, Secret cleanup, deletion and native/rollback/independent gates. Media/Secret/analytics OFF.

**Next:** Verify exact head CI/SHA, route for independent review and device QA, continue next unblocked task.

## CURRENT BETA-P0-48 · Composer draft reset on account/destination change — 22 Nov 2026

**ARCHITECT → FRONTEND:** New child of #131 exact `c415d1bd6c4151dca795533b91c331f18dce647e` on isolated `codex/beta-composer-actor-target-remount-20261122-run15`. Compose screen uses authenticated actor+Wall/recipient/Shared destination as the child React key. A switched actor/target no longer inherits previous draft, verified target, media upload state or submit locks during pre-effect render. Old draft's cleanup remains attached to its unmounted editor. Pure actor/destination matrix and source wiring test added; server authorization unchanged.

**Pending:** exact candidate CI, independent REVIEWER and behavioral QA on device/simulator for A→B, target X→Y, in-flight send/upload, unsaved draft and deep links. No staging writes, 0031, main merge, rollout, invitations or original production access. Enhanced Beta NO-GO: real OTP, 3 JWT actors, C2/C3 media, Secret cron, deletion, device/rollback independent gates. Media/Secret/analytics OFF; domain/Apple held.

**Next:** Check own SHA/tree CI and independent verification, proceed on the next nonoverlapping task.

## CURRENT BETA-P0-47 · Recovery deletion status actor/retry fence — 22 Nov 2026

**ARCHITECT → FRONTEND:** New draft child of #130 immutable `1370796449febf194051ead38d4b67755e6d06ea` on `codex/beta-recovery-status-actor-revision-20261122-run15`. The account-recovery screen's fetched deletion schedule and restore affordance were not actor-scoped during pre-effect account switches. The current render now derives status and deadline only when actor, `deactivated` route and retry revision match the fetched result; former actor's pending restore cannot keep a new actor busy. Regression covers A→B, expired/ready/error, retry, signout and delayed promises at source/contract level. Independent Reviewer and real behavioral QA still required for this exact candidate; static tests alone are not device proof.

**Unchanged release gates:** Staging `ewintxgdxdvschiqodkq` only; original production untouched. No hosted writes, 0031, merge, deployment, tester invitation, domain/DNS or Apple work. Media/Secret/analytics OFF. Enhanced Beta **NO-GO** until true SMTP six-digit OTP, real three-JWT positive/negative access, protected media C2/C3, Secret cleanup, account deletion and native/device/rollback/independent review evidence.

**Next:** Verify own exact-head CI and SHA/tree, record independent Reviewer/QA, continue next unblocked scoped beta implementation.

## CURRENT BETA-P0-46 · Generic unavailable deep-link acknowledgement bound to actor/reference — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #129 exact `c623076a6953da0fd10aff42ffb8f2dbecc895b1`, preserving previous stacked history without altering shared branches. The generic unavailable destination route stored one raw token and deduplicated claims only by opaque reference. If a viewer or reference changed during auth navigation, the previous token could continue to render a stale terminal state or be acknowledged from the old route. Scope claimed token to the authenticated viewer plus exact opaque reference; only acknowledge/display the matching token, and safely return Home for invalid/missing current claims. Helper has an executable actor/reference/readiness matrix and source wiring regression `tests/frontend-unavailable-link-actor.test.mjs`. No changes to deferred coordinator or permissions.

**Gates:** Exact SHA GitHub CI (TS/lint/contracts/SQL/Edge/media/Expo/exports), independent REVIEWER and behavioral QA for A→B, ref R1→R2, invalid reference, signout and return from onboarding. No real-device or JWT proof from source tests. Staging-only, original production untouched. No hosted write, schema/Auth/RLS/API/flag, migration 0031, merge, deployment or tester invites. Enhanced Beta **NO-GO** pending real six-digit SMTP OTP, three JWT actors, private media C2/C3, Secret expiry, account deletion, device and rollback, independent gates and Founder GO. Secret/media/analytics OFF; domain/DNS/Apple held.

**Next:** Verify PR #130 exact-head CI and request independent Reviewer/QA; continue remaining unblocked scope on a new branch.


## CURRENT BETA-P0-45 · Shared Wall invite preview, response and lock actor/route isolation — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #128 exact `d4b12e83bb78d8984ccf8bf335554f31b2a121d7` preserving draft ancestry. `app/shared/invite/[id].tsx` held prior account's invitation name, inviter, privacy and response state until focus cleanup; a route change could show a previous private invitation, while claimed deferred references were deduplicated only by reference and a stale `respond` finally could release another account's mutation lock. Add viewer+Wall+deferred-reference key; show invite/errors/actions only after the exact key loads; reject stale resolution and retry, scope deferred token to exact key, and separate mutation fence from read fence to avoid stale response unlocks. No changes to backend invite authorization or existing coordinator. Executable key matrix + source guards in `tests/frontend-shared-invite-actor-route.test.mjs`.

**Gates:** Exact-head CI including TypeScript/lint, contracts, DB security, Edge/media and Expo/native where available. Independent Reviewer and separate real-device QA on invite A→B, Wall X→Y, reference R1→R2, accept/decline, old confirmation callback, slow/offline load and in-flight response, retry and UI semantics; source tests are not behavioral QA. STAGING ONLY `ewintxgdxdvschiqodkq`, protect original production. No hosted writes, schema/Auth/RLS/API/flag modifications, migration 0031, main merge, deployment or invitations. Enhanced Beta **NO-GO** pending true SMTP six-digit OTP, three hosted JWT actors, media C2/C3, Secret cleanup, deletion, independent QA/device/rollback and Founder GO. Media/Secret/analytics OFF; domain/Apple held.

**Next:** Verify PR #129 own CI and independent gates; proceed with unblocked beta scope while external release requirements remain held.


## CURRENT BETA-P0-44 · Root deferred redirect bound to authenticated account — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #127 immutable `1290b956205f3b9906be47e68d7f7c0c2c361761`, maintaining untouched PR #30–#127 ancestry. The root `app/index.tsx` kept a plain resolved redirect string from account A. While session B became ready but before root `useEffect` invalidated that string, render could redirect B to A's previously resolved Wall, invite or fallback. A new `ActorRedirectTarget` records the resolving actor with its exact destination; `visibleRedirectForActor` fails closed until the currently authenticated actor matches. Async completion remains guarded by the pre-existing `preparedFor` lease and the deferred coordinator is not altered. Existing root contract adjusted to require scoped destination plus executable pure actor matrix `tests/frontend-root-redirect-actor.test.mjs`.

**Gates:** Verify exact-head TypeScript/lint/contracts/Postgres/Edge/media CI and Expo/disposable native build where available. Independently review exact unchanged tree and behaviorally QA account A→B before effect, B→A, logged-out links, fallback Discover, slow coordinator response, onboarding return and no stale redirect. Source/unit checks are not installed-device or real-user proof. No hosted writes, auth/schema/API/flags, production, migrations 0031, main merge, deploy or tester invitations. Enhanced Beta **NO-GO**: six-digit SMTP OTP, 3 genuine JWT actors, private media C2/C3, Secret cron cleanup, deletion, native QA/rollback, independent gates and Founder GO outstanding. Media/Secret/analytics OFF; domain/DNS/Apple held.

**Next:** Verify PR #128 immutable CI and REVIEWER/QA, then continue independent work on remaining beta items.


## CURRENT BETA-P0-43 · Handle deep-link resolution fenced to account + route + deferred reference — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of PR #126 immutable parent `b1ce103aad7f379338ec9e391a30533a973da86b` (tree `018b4c0251a6f655dbe7bd0a7545fb2b36b9e900`), preserving stacked lineage #30–#126. The `/u/[handle]` route kept resolved target, retry and not-found state as unscoped component booleans/strings. If an authenticated viewer changed or an inbound handle/deferred reference changed before a new effect reset, the previous result could redirect a new session or present an outdated outcome. One explicit subject key (authenticated account, canonical handle, deferred reference, ready account state) now fences resolved display/redirect and claimed deferred attempts synchronously. Async completion and Retry are rejected after a route/account change even before focus-effect cleanup. Existing deferred coordinator, destination verification and safe fallback remain unchanged.

**Checks:** New executable pure scope matrix and source-boundary regression `tests/frontend-handle-route-actor-scope.test.mjs`; exact head needs independent CI (typecheck/lint/contracts/Postgres/Edge/media and native/Expo where supported), Reviewer and device/simulator QA on A→B, handle X→Y, reference R1→R2, delayed resolution, offline retry and logout. Source tests cannot certify a real authenticated invite transition. No hosted writes, security/schema/Auth/flag changes, production contact, merge, deployment or tester invitation. Enhanced Beta **NO-GO** until SMTP OTP, 3 real JWT actors, private media C2/C3, Secret one-hour cleanup, deletion 0031, device/rollback, independent gates and Founder GO. Media/Secret/analytics OFF, domain/DNS/Apple held.

**Next:** Check PR #127 exact SHA and CI; route unchanged tree to independent Reviewer and separate behavioral QA; continue another nonoverlapping beta task while external gates remain blocked.


## CURRENT BETA-P0-42 · Synchronize moderation contract with actor-gated Settings — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND test correction.** New isolated child of #125 immutable `6ea34043e7ad8eab001c921b8812ec083b748ce0`. PR #124's exact-head CI `44952933951` caught a stale source assertion in `tests/frontend-moderation.test.mjs` expecting unsafe direct `profile?.is_admin` in Settings even though BETA-P0-40 correctly changed that screen to require `profile.id === authenticated actor`. This test-only correction now positively checks that the Settings administrator affordance derives from `actorProfile` and that `actorProfile` is fail-closed on identity mismatch, while rejecting a direct stale-profile conditional. No production code, permissions or runtime changed. Historical #124 CI failed and cannot be called green by inheritance. This child must earn its own 4/4 CI and independent review/QA.

**Gates:** exact commit/typecheck/lint/contracts/Postgres/Edge/media/Expo+native outputs. Status history #124/#125 source CI should be treated as noncertifying and the corrected accumulated candidate reviewed independently. No original production, hosted writes, migrations, main merge, deployment or tester invitation. First Enhanced Beta NO-GO: 6-digit SMTP OTP, 3 hosted JWT actors, C2/C3, Secret cron, 0031 deletion, native QA/rollback and independent gates outstanding; media/Secret/analytics OFF, domain and Apple held.

**Next:** Verify #126 CI, compare regression to #124–#125 and then route exact integrated source for Reviewer and native QA; continue separate unblocked engineering work.


## CURRENT BETA-P0-41 · Profile tab header and sharing current-actor gate — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #124 immutable `951d19aeb9e2ebf4e2898a983505942f1ab65fe1`. The Profile tab counters already had actor-specific async fencing, but the avatar, name, handle, bio, social links and share destination still used the raw `profile` context without verifying `profile.id === session.user.id`. If a new session renders before its profile resolves, old-account private/identifying details and potentially the wrong Wall invite could be displayed. Bind all identity presentation and Share/Edit actions to matched actor profile, preserve the existing anonymous/empty fallback and counter fences. New source/matrix regression `tests/frontend-profile-view-actor-gate.test.mjs`. No new design, API, Auth, storage, schema or feature flag.

**Gates:** Exact new SHA CI, independent Reviewer, distinct behavioral QA for A→B pre-effect and delayed profile refresh, old share tap, logout, profile absent/retry and accessible avatar. Not verified on native devices. No hosted writes/prod access, migrations 0031, merge, deploy or invitations. Enhanced Beta **NO-GO** pending verified six-digit SMTP OTP, three real hosted JWT identities, C2/C3 media playback, Secret hourly cleanup, deletion/purge, device/rollback and independent gates/Founder approval; media/Secret/analytics OFF, domain/Apple held.

**Next:** Verify exact-source CI/reviews/QA and continue next unblocked beta task after checkpoint.


## CURRENT BETA-P0-40 · Settings administrative and account-state actor binding — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #123 immutable `ab4393aec9ecedd8dc16d8b7f670d07a56e28889`. Settings showed Moderation queue when `profile.is_admin` and enabled account deactivation/deletion controls when `profile.account_status` was active, without requiring that profile to match the currently signed-in session. Account provider updates are asynchronous; old-role/profile metadata must not grant A's UI controls to B, even temporarily. Restrict these controls and the confirmation handler to a `profile.id === actorId` snapshot, leaving server authorization authoritative. Dedicated source/actor matrix `tests/frontend-settings-admin-actor-gate.test.mjs`. No product journey, admin backend/API/schema, or visual redesign.

**Gates:** New exact SHA CI, independent Reviewer and separate behavioral QA for admin A→non-admin B, deactivate button, no-profile/loading, signout and stale Alert pending. This is not server security certification. No original production, hosted writes, schema/flags/migrations 0031, main merge, deployment or invitation. Enhanced Beta **NO-GO** while SMTP OTP, real three-JWT actors, protected media, Secret cron, deletion, device/rollback, independent gates and Founder GO outstanding; media/Secret/analytics OFF, domain/DNS/Apple held.

**Next:** Inspect CI for this head and previous #120–#123, obtain independent Reviewer/QA; resume next unblocked issue after checkpoint.


## CURRENT BETA-P0-39 · Person report actor/target form isolation — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #122 immutable `fbeb1505e3baba53375fdf7865040b37c7f0656b`. The person-report form's prior reason, free-text report details, block toggle and success state could appear for a changed account/target before `useFocusEffect` reset. Gate the entire report form behind a focus-loaded matching `actor:target` identity, and fence late form input, switch and submit handlers before report/block invocation. Preserve existing report-first/optional-block retry coordinator, RLS, server authorization and moderation UX. Add source+subject-matrix regression `tests/frontend-report-user-subject-fence.test.mjs`.

**Verification:** Exact-head CI, independent Reviewer and separate device QA for A→B, X→Y before focus, form input and old submit callbacks, report succeeds/block fails retry, slow submission, sign-out and offline required. Source assertions are not native behavioral proof. No hosted writes, schema/auth/API/flag changes, production, migration 0031, merge, deploy or invitations. Enhanced Beta **NO-GO**; real six-digit SMTP OTP, 3 hosted JWT actors, C2/C3 media, Secret hourly cleanup, deletion, device/rollback and independent gates remain blocked. Domain/DNS and Apple held, media/Secret/analytics OFF.

**Next:** Verify exact CI, independent review/QA, continue remaining unblocked task on next isolated branch.


## CURRENT BETA-P0-38 · Fail-closed Shared Wall report destination and form — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated draft child of #121 immutable `9321064de78e952bb80181f15988483cb6303060`. Report Shared Wall already rejects stale asynchronous read responses, but the old Wall name, reason/details and submission state could remain visible to account B or another Wall before focus cleanup. Gate displayed Wall name, error and entire authorized form by `authenticatedActor:routeWall` subject; clear name on new load; settle allowed/denied/failed current-subject loads for retry; suppress submission by stale account/route event handlers. Existing report record, owner refusal, source of truth and RLS remain unchanged. Test `tests/frontend-report-wall-subject-fence.test.mjs` includes actor/route state matrix and source guards.

**Gates:** Exact-head GitHub CI, independent Reviewer and separate device QA (A→B, wall X→Y before focus, owner refusal, not-found, slow/failure retry, old submit callback) required. Source tests are not behavioral verification. No Auth/schema/API/flag or hosted writes, production access, migration 0031, merge, deploy, paid service, invitation or blocked external action. Enhanced Beta **NO-GO**, media/Secret/analytics OFF, OTP/three-JWT/media/Secret/deletion/device/rollback/independent gates and Founder GO outstanding.

**Next:** Verify own CI and independent review/device QA; continue separate unblocked source tasks under new branches.


## CURRENT BETA-P0-37 · Account-bound Profile editor and stale event handlers — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** New isolated child of #120 head `51bc70a2212c325620e74361a8d20eef0d3731c1`. The edit-profile modal initialized draft identity, avatar, username and social links from `profile`, but on account A→B could render A's cached fields until `useFocusEffect` ran. It also allowed a stale A callback to initiate image picker/save before focus cleanup, even though response fencing existed. Gate the whole editor behind `profile.id === authenticated actorId` and a focus-loaded actor; show existing spinner while B's profile is unresolved, reset all drafts on profile change/sign-out/blur, and reject old actor callbacks before opening picker/uploading/saving. Preserve existing profile schema, validated save, backend authorization and visual form. Added `tests/frontend-profile-edit-actor-guard.test.mjs`.

**Gates:** Fresh exact-source CI, independent Reviewer and native behavioral QA required for A→B before focus, stale modal save/photo callback, delayed auth/profile resolution, signout, failure and retry, no prior-account display. Source assertions are not runtime QA. No hosted writes, auth/SQL/schema/flag, production, main merge, deployment or invitations. Enhanced Beta **NO-GO** while verified SMTP/six-digit OTP, three authenticated JWT actors, protected media C2/C3, Secret cron, account deletion 0031, device/rollback, independent QA and Founder GO remain blocked; Secret/media/analytics OFF and domain/Apple held.

**Next:** Check exact-head CI and independent review/device QA, and continue another separate unblocked task.


## CURRENT BETA-P0-36 · Fail-closed Alerts across account changes — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #119 immutable `07f191bdc3cf9285111935573be4c1e50e4c9dbe`, original tree `810de7276b69ce236c74b9ad9451994c350d2cc9`. The Alerts tab already checks asynchronous responses against the authenticated user, but previously cached sensitive Alerts (actor name, recipient notifications, unread state, pages and errors) could render for account B before `useFocusEffect` cleared account A. Gate every rendered Alert, error and history cursor by its settled authenticated actor; clear items and cursor at the start of a new load, settle failed loads for a current-actor retry, and reject old-actor open/page actions before navigation or writes. Retain owner-scoped receipt behavior, pagination and current empty/retry UX. New `tests/frontend-alerts-actor-display.test.mjs` checks the source wiring and A→B data selection.

**Evidence/Gates:** Requires exact new SHA GitHub CI, independent Reviewer approval and separate native behavioral QA for A→B before focus, delayed initial/error/older-page load, Alert open, receipt, retry and sign-out. CI/source tests are NOT device E2E proof. Staging `ewintxgdxdvschiqodkq` only; protected production `wfsfafmgvxevpzrurofz` untouched. No hosted write, schema/auth/API/flag change, paid service, merge, deployment or invitation. Enhanced Beta **NO-GO** pending verified 6-digit SMTP OTP, 3 real hosted JWT actors, private media C2/C3, Secret cron, migration 0031/purge, independent QA, installed devices/rollback and Founder GO. Media/Secret/analytics OFF; domain/DNS/Apple held.

**Next:** Check new branch/head CI; obtain independent Reviewer and simulator/device QA; continue next unblocked scoped task without editing another worker's branch.


## BETA-P0-35 · Personal settings discard prompt actor lease — 22 Nov 2026

**ARCHITECT → FRONTEND:** Isolated child of #118 `074824a77d2ae1c771a3c6fe758cd4b886fd441b`. Previously a delayed Discard callback could navigate after account change, and simultaneous back gestures could stack prompts during pending save. The before-remove dialog now captures an action-fence lease, aborts stale A→B callbacks, limits dialogs and blocks removal during saving; lifecycle resets prompt state. New `tests/frontend-personal-settings-discard-lease.test.mjs`. Must verify new exact-head CI, obtain independent Reviewer and separate real device/simulator QA. No hosted/staging writes, production access, merge/deploy/feature activation. Enhanced Beta remains NO-GO. 

**Next:** CI/independent QA then next unblocked work; preserve verified SMTP/3 JWT actors, media, Secret, 0031 deletion, installed-device and Founder gates.


## BETA-P0-34 · Personal Wall settings account-render guard — 22 Nov 2026

**ARCHITECT → FRONTEND:** Isolated child of #117 `6be90c1de356ba4b128d3faa735245fc5900ef0e`. Prior-account visibility/contribution/Anonymous settings and errors could flash before focus reset; current actor now gates rendered draft and save/dirty, marks a failed actor load settled so retry works, and hides retry while signed out. New source/state regression; exact SHA CI and separate Reviewer/native QA pending. No hosted/production writes, schema/API/flags, merge or launch. STAGING `ewintxgdxdvschiqodkq` only; original production protected; Enhanced Beta remains NO-GO with media/Secret/analytics OFF.

**Next:** New CI and independent Reviewer/QA; genuine OTP, three hosted actors, media, Secret, deletion, device and Founder release gates still open.


## BETA-P0-33 · Status editor guard / async lease separation — 22 Nov 2026

**ARCHITECT → FRONTEND:** Isolated child of #116 `d6c60a9796fbfe734a630ffed2fabfefb0ca0f8f`. A stale account's save/remove `finally` could release a new account's Status navigation guard; read refresh shared the operation fence. Separate action/read generation, current-subject protection of stale modal callbacks, reset per-focus approved/busy/dirty guard state, conditional final release. Adds `StatusRemovalGuard.resetSession` and unit/source race tests. Exact new-head CI, independent Reviewer and behavioral QA required; not an installed-device validation, do not merge/deploy. Staging-only `ewintxgdxdvschiqodkq`; original production protected. Media/Secret/analytics remain OFF.

**Next:** CI exact head, Reviewer/QA on A→B delayed save/remove, concurrent reload and stale Alert; then resume independent task queue. All OTP/JWT/media/Secret/deletion/device/Founder gates remain.


## BETA-P0-32 · Status editor account/Wall render fence — 22 Nov 2026

**ARCHITECT → FRONTEND:** Isolated child of #115 `b1ed1637c86f5349f41ded85d4f0eeea9108b415`: before focus cleanup, old Status body/draft can be rendered for a changed account/Wall. Visible editor values, dirty/save/remove controls and loading are now gated by matching `userId:wallId`; success/denied/error states are tagged for authorized retry, with no server contract or UX redesign. Regression `tests/frontend-status-actor-render-fence.test.mjs`. New exact-head CI plus independent Reviewer and actual behavioral native QA required; no self-certification or release GO. Staging `ewintxgdxdvschiqodkq` only, original production untouched. No hosted writes, merge/deploy or invite. Media/Secret/analytics OFF.

**Next:** Capture immutable child SHA/tree, verify checks, route independently to Reviewer/QA; separately investigate StatusRemovalGuard in-flight account switching. Real OTP/three JWTs, media, Secret, deletion, device and Founder GO remain blocked.


## BETA-P0-31 · Approved Writers actor-bound roster guard — 22 Nov 2026

**ARCHITECT → FRONTEND:** Child of #114 `dfb8270e96764be9a1bdd20f985e51b643883b13` adds pre-focus session render gate to Approved Writers roster/search, and blocks stale search/add/remove/confirm actions. Current actor selected/unselected, loading, error and retry unchanged. New static/regression test; exact-head CI, independent Reviewer and native behavioral QA still pending. No hosted writes/production, merge or deploy. Enhanced Beta **NO-GO**, external holds unchanged.

**Next:** Verify exact child SHA/tree/CI, route to independent Reviewer and device QA, then next unblocked task or future actual authorized three-JWT tests.

## BETA-P0-30 · Internal Enhanced Beta release/rollback packet — 22 Nov 2026

**ARCHITECT:** New `docs/handoffs/ENHANCED_BETA_RELEASE_PACKET_2026-11-22.md` documents exact source ancestry through #113 `138391e3dccd0aad5d760f1001761b01376c0161`, pending build/identity/sender/device gates, withheld media/Secret/deletion, build-time client flags versus server-authoritative disable, future rollback, and draft (unpublished) tester release notes. No new deployment/feature switch, no production contact or tester invite. Treat it as a preparation checklist, **not** a GO. Independent review and QA remain separate.

**Next:** Verify new PR CI and exact tree; continue unblocked work, then execute real staging three-JWT/device validation only after approved sender and actual test identities exist. Domain/DNS and Apple holds unchanged.

## BETA-P0-29 · Blocked identities actor-bound display guard — 22 Nov 2026

**ARCHITECT → FRONTEND:** Isolated child of #112 exact `9ffc0e947dcc085d2c71be8a7cba6396d39a2541`. Account-switch renders could disclose cached previous-account blocked users before `useFocusEffect` cleanup. `app/blocked-users.tsx` now gates roster and errors on currently loaded actor, while tagging current-actor success and error/expired page states so retries still work. Regression `tests/frontend-blocked-user-actor-display.test.mjs`. Requires exact-commit CI, independent Reviewer and actual simulator/device QA of account A→B, failure/retry and pagination. No hosted/production mutation, main merge or release. Enhanced Beta NO-GO; media/Secret/analytics OFF; Founder domain/Apple holds remain.

**Next:** Complete exact-tree verification and independent Reviewer/QA; return to higher-impact staging OTP and three-JWT gates once authorized accounts/sender exist.

## BETA-P0-28 · Moderator report visibility on administrator account switch — 22 Nov 2026

**ARCHITECT → FRONTEND:** Child of #111 exact `2ab2890dcfef1e296e0edab167fec99cecfa4d96`. Fixed a pre-focus-render privacy exposure in `app/moderation.tsx`: old administrator report/audit rows or error could be visible to a newly signed-in administrator while current-actor fetch was still starting. Gate entire report UI to the actor that produced the current fetch result; retain non-admin deny and error/retry. New Node source/state contract; child CI plus independent Reviewer and simulator/device QA are required, not self-certified. No hosted/production writes or feature flag activation, mergers, deployments or invitations.

**Next:** Capture exact SHA/tree, CI and independent verdicts; verify admin A→B before focus, failure/retry and non-admin route. Enhanced Beta **NO-GO** until OTP/three-JWT/media/Secret/deletion/device/rollback and Founder gates are resolved.

## BETA-P0-27 · Social follower/following route-subject display guard — 21 Nov 2026

**ARCHITECT → FRONTEND:** New isolated child of #110 exact `f94eb8c5af1bf4f0c6eeb2c6236e3eae6b7eafce`. In `app/social/[kind].tsx`, loaded follower/following names could persist between a viewer, target or list-kind change before focus cleanup runs. A current render-subject gate now hides previous lists/errors immediately, preserves the existing loading and retry contract, and is covered by a new Node source/logic contract test. Requires exact-head CI, independent Reviewer and real behavioral device/simulator QA. No hosted writes, protected production, merges, releases, credential requests, or feature activation. **Enhanced Beta NO-GO.**

**Next:** Capture own immutable head/tree and CI; independently review and QA on multi-user/route-switching. Remaining gates are true OTP delivery, three JWT actors, private media, Secret scheduler, deletion migration/purge, device/rollback and Founder GO.


## BETA-P0-26 · Profile counter render actor fencing — 21 Nov 2026

**ARCHITECT → FRONTEND:** Isolated descendant of [#109](https://github.com/darshitmeghani1992/the-wall/pull/109) at `ac43236da37bf5a2736cfbed6a5b4265e8801333`. Profile read resets on focus already, but before that effect commits a new actor can still see old account's follower/following/friend numbers or stale error. New request-actor identities gate each counter's visible value/error synchronously at render, showing existing loading indicator until current actor's authorized request resolves. Source change and Node test only; require own exact-head GitHub CI, independent Reviewer and behavioral QA on A→B switching and slow/failing requests. #109 CI 4/4 passed on its old commit, no implicit certification of this child. Enhanced Beta NO-GO; no production access, hosted writes, deployments, merges or invitations.

**Next:** Verify exact SHA CI, record independent Reviewer/QA status in #57, then continue unblocked work. True six-digit OTP, hosted three-JWT actor validation, media, Secret, deletion 0031, device/rollback and Founder gates stay open.


## BETA-P0-25 · Home friend count actor reset — 21 Nov 2026

**ARCHITECT → FRONTEND:** New isolated child of #108 at `677db50ab226ce47259cf3605f5d118d1b429544`. On every main My Wall load `friendCount` now becomes unavailable before the new actor/Wall data arrives, rather than displaying the previous session's stale total. Current-user server result still overwrites when available; failure stays unavailable. Added source/regression test `tests/frontend-home-friend-count-session-reset.test.mjs`. CI/Reviewer/QA exact-SHA gates and device slow-counter testing remain open, no backend or hosted changes, Enhanced Beta NO-GO.

**Next:** monitor own CI, request independent Reviewer and QA on unchanged tree; proceed with the next separately-owned unblocked queue item. 6-digit SMTP OTP, three actual staging JWT actors, private media/Secret/deletion/device and Founder gates remain.

## BETA-P0-24 · My Wall Shared Wall tab actor reset — 21 Nov 2026

**ARCHITECT → FRONTEND:** Stacked on #107 immutable source `99d8d7612d5a4cbcc616743940f1523bc3872329`, isolated new branch. The home tab's async Shared Wall response was actor-fenced, but already-loaded tab names remained visible until the new account's fetch completed. `app/(tabs)/home.tsx` now clears the prior list and error synchronously on focus/session/route changes before refreshing authorized current-actor Walls. `tests/frontend-home-shared-wall-session-reset.test.mjs` adds source-order and actor-fence unit coverage. CI and real native behavior are distinct; exact SHA needs independent Reviewer and QA before any release. No backend/hosted/production/flag change.

**Next:** verify exact-head CI, hand off unchanged tree for separate Reviewer and QA, then pick another unblocked task. Enhanced Beta remains NO-GO; held SMTP, genuine 3-JWT actors, private media/Secret/deletion/device gates and Founder review unchanged.

## BETA-P0-23 · Mark recipient people-picker session/search correction (21 Nov 2026)

**ROLE: ARCHITECT → FRONTEND.** New isolated descendant of #106 at `36623f29d02f2c7c0a18445f5e3d08ce6ecd5d35`. The people picker now empties prior actor/query results on focus changes and invalidates pending friend/search queries whenever input changes, without modifying friend APIs or permission gates. Clearing search restores the active actor's friend list. Test `tests/frontend-people-picker-stale-search.test.mjs` checks source bindings and actual fence invalidation. Exact-head GitHub CI required, then independent Reviewer and QA on changed-account/slow-network/native behavior; not certified by source-only tests.

**Next:** verify own CI, Reviewer and QA; inspect issue #57 gates, then pick another unblocked isolated slice. Staging-only, no hosted writes, original production protected. Real six-digit OTP/three authorized JWT actors, media/Secret/deletion/device and Founder gates are still outstanding. Enhanced Beta NO-GO.

## BETA-P0-22 · Preserve Shared Wall join/leave mutation lock across account and Wall switches (21 Nov 2026)

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** New isolated descendant of draft [#105](https://github.com/darshitmeghani1992/the-wall/pull/105) at `570704bf87f1f19b6f542d16c4af70bcfabdc532`, retaining #103–#105 and historical ancestry. The Shared Wall detail screen's join/leave actions unconditionally cleared a shared exclusive mutation lock after asynchronous completion. When actor/Wall A navigates away while its request is pending and actor/Wall B acquires the reset lock, A's old `finally` could release B's lock. The same generic focus generation is used for Wall reads; merely gating `finally` on that read token also risks stranding a valid join after `void load()`. Added a separate mutation fence, focus/blurred with the screen and current actor, guarded both actions' cleanup by the current mutation lease; unchanged read fence and server-side membership RPC authority remain.

**Verification:** `tests/frontend-shared-wall-join-leave-lock.test.mjs` asserts guarded join/leave source and executes separate read vs mutation generation plus old/new actor lock races. Exact-head GitHub CI required on this branch, then independent Reviewer + real device/simulator QA must test slow join/leave while reloading Wall, signing out/switching actors, navigating to another Wall, and avoiding duplicate actions. Not an installed-device pass. No schema, RPC, Auth, policy, UX design or feature flag modifications, hosted writes, production use, deployment, main merge, paid credits or invitations. Enhanced Beta **NO-GO** pending real 6-digit OTP/3 JWT actor tests, media, Secret cleanup, migration 0031/worker, device/rollback, independent gates and Founder GO.

**Next:** Verify exact SHA/CI for #104–#106, independent Reviewer and QA; continue from newest canonical queue on another isolated branch only when safe. Domain and Apple developer holds remain.


## BETA-P0-21 · Cancel stale Shared Wall member invite searches (21 Nov 2026)

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** New isolated descendant of [#104](https://github.com/darshitmeghani1992/the-wall/pull/104) at immutable source `1c37de282190a420650cc6361de0aa76531d91af`. Shared Wall member invite search used the same generation fence as the member-list load and did not invalidate pending searches when the typed query changed. An older response or error could repaint results for a different query, a search could invalidate a pending member load, and its spinner/error could remain stale when editing. Added an independent search-specific SessionFocusFence, canceled stale responses on edit, cleared stale spinner/error/results on input changes, and reset search-owned form state on focus/account transitions. Read-only list fetch and mutation fence remain separate; actor and owner check, actual RPC authorization, app navigation and backend contracts remain unchanged.

**Verification:** `tests/frontend-shared-member-search-stale.test.mjs` asserts separate search wiring, query invalidation and cleanup; executes generation regression cases for query edit, replacement query, actor switch and concurrent list load. Exact-head GitHub CI and independent Reviewer + installed-device/simulator QA must verify slow success/error search, editing and new query while loading members, logout/account switch and visibility of prior query. Local source contracts are **not** end-to-end QA. No schema, auth, backend, analytics, hosted writes, production operations, merges, deployment, external credits, or tester invitations. Enhanced Beta **NO-GO** with real SMTP/OTP, 3 authenticated actors, private media/Secret, deletion 0031, device QA and rollback gates outstanding.

**Next:** Verify fresh exact-head CI and independent review/QA for #104 and this draft. Continue another unblocked task on a new branch; hold domain and Apple enrollment.


## BETA-P0-20 · Isolate Shared Wall member mutation ownership from reads and account switches (21 Nov 2026)

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated descendant of draft [#103](https://github.com/darshitmeghani1992/the-wall/pull/103) at exact immutable commit `1ed892b197a05339dfa0f04c08252e9a0c586052`; earlier drafts and source ancestry preserved. The Shared Wall members screen's invite/revoke-or-remove/ownership-transfer operations unconditionally released the shared exclusive mutation lock in `finally`. A slow operation from actor A could therefore release actor B's new lock after an account/focus switch. The same fence was also shared with member refresh and person search; merely checking that old fence in `finally` would strand legitimate same-account operations after a refresh or search. Assign mutation operations their own session/focus fence, invalidate it on blur/account change, and release the lock only when the mutation lease is still current. Keep the independent read/search fence and server-side RPC authorization unchanged.

**Verification:** `tests/frontend-shared-members-mutation-lock.test.mjs` enforces guarded mutation `finally` source wiring for all three actions and exercises two real SessionFocusFence/lock regressions: a read/search during an in-flight mutation does not strand the lock, and an old account completion cannot unlock the new actor's mutation. Exact-SHA GitHub CI (contracts, lint, types, DB security, Edge/media, Expo/iOS/Android) and separate independent Reviewer + behavioral QA are required; regression tests are **not** native/device QA. QA must reproduce slow invite, member removal and ownership transfer with simultaneous search/refresh and account switch. No hosted writes, database change, migrations, prod access, merges, deploy, feature enables, tester invites, or paid model calls.

**Next:** Verify this new PR's immutable SHA and complete CI; independent Reviewer then QA. Select another unblocked queue task on a fresh isolated branch, do not edit owned branches. Enhanced Beta remains **NO-GO** pending verified six-digit OTP and 3 JWT actors, secure private media/Secret expiry, 0031 deletion, installed-device and rollback evidence, and Founder gates. Domain and Apple holds remain in place.


## BETA-P0-19 · Fence stale Shared Wall creation mutation cleanup across account switches (21 Nov 2026)

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** An isolated descendant of draft #102 at immutable head `301d63376bbe0942c0f0df7926618552c13dc173`. In Shared Wall creation, the async `submit` flow correctly checks a per-account focus token before updating UI but unconditionally released the global `mutationInFlight` lock in `finally`. When actor A's submitted request outlives a focus/account switch, a new actor B can acquire the reset lock; actor A's late `finally` then clears B's lock, enabling duplicate B submits. Restrict the final release to the unchanged actor/token. The existing focus cleanup still releases the old lock, and successful same-actor creation releases it before navigation; no API/schema/auth/UX policy changed.

**Verification/gates:** `tests/frontend-shared-create-mutation-lock.test.mjs` asserts guarded finally wiring and executes an old-request/new-account lease race with actual SessionFocusFence and mutation-guard logic. Fresh exact-head CI for contracts/lint/types/DB/native/Edge/media; independent Reviewer and behavioral QA must test A-start → session B switch → B-start while A's network response is delayed, including back/navigation behavior and no duplicate creations. No hosted writes, production access, migrations, merges/deployments, tester invites or new paid services. Enhanced Beta **NO-GO**: real OTP/three user JWT, media C2/C3, Secret cron, account deletion 0031, device/rollback and independent gates remain.

**Next:** verify this branch's fresh CI and Reviewer/QA; take another unblocked product task only on a new isolated branch. Preserve stacked PRs, issue #57 and hold instructions.


## BETA-P0-18 · Clear stale public Shared Wall search results across accounts (21 Nov 2026)

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated descendant of draft #101 immutable head `eb84fff912ca53ad669e12514c0ca9fd085393f1` (preserves #94–#101 code lineage; no edits to a worker-owned branch). Discover focus/session reset already cleared People results, friend/requests and query identity but omitted `wallResults`. With Walls mode retained, a second user (or signed-out screen) could see a previous session's stale public Shared Wall search cards. Clear the old Walls search results in the same focus/session reset. Keep account/focus fences, server authorization and existing search contracts unchanged. This is a UI consistency/identity-bound cache fix, not a claim of private data exposure; the results were public.

**Verification/gates:** `tests/frontend-discover-account-results.test.mjs` asserts that the focus lifecycle clears both categories and executes a session-token invalidation test. Exact-head `npm run test:contracts`, `npm run lint`, `npm run typecheck` plus native/DB/Edge/media CI required. Independent Reviewer and distinct behavioral QA must test account A Walls search → account B or sign-out with that tab still mounted, including stalled requests. No hosted writes, production access, migration, merge, deployment, unapproved feature activation, new credits or tester invites. Enhanced Beta **NO-GO**: genuine staging OTP/three actors, hosted JWT/RLS, C2/C3 media, Secret cron, 0031 deletion, device/rollback and Founder GO all outstanding.

**Next:** verify PR exact-head CI and isolated Reviewer/QA, then take another unblocked Core+Enhanced Beta task from this canonical queue. Domain and Apple holds unchanged.


## BETA-P0-17 · Clear account-specific Profile counts on sign-out / session change (21 Nov 2026)

**ARCHITECT sequencing → FRONTEND implementation.** Isolated descendant of draft #100 (no existing worker branch modified). ProfileScreen already fenced asynchronous friend/follower reads by actor and focus, but when a session became null, those reads could not start and their prior loading flags/number counters remained in local component state. On focus/session transition, clear account-specific follower/following counts, friend count and old errors; run both reads only with a signed-in actor, otherwise explicitly clear spinners. Preserve backend as the authority, retry UI and current fence guards. `tests/frontend-profile-count-session-reset.test.mjs` asserts this source wiring and exercises old/new actor focus-token invalidation. No visual redesign, new product policy, RLS/API/schema/migrations, flag changes, hosted writes or external credentials.

**Verification:** source and tests are committed on the separate branch; check fresh exact-head CI (`npm run test:contracts`, `npm run lint`, `npm run typecheck` and CI's native/DB/media/Edge checks). No actual sign-out/switch native QA is claimed. Separate Reviewer and QA must verify account switch/log-out while count fetch is stalled, fresh account totals and no former account flash on unchanged app SHA. #100 remains independent draft and must also pass its exact-head gates. **Enhanced Beta NO-GO** until authorized OTP + 3 genuine actors, hosted RLS and definer, private C2/C3 media, Secret expiry, 0031 account deletion, device/rollback evidence and Founder GO. Domain and Apple enrollment held; no main merge or deployment authorized.

**Next:** verify exact-head CI, independent Reviewer then independent behavioral QA. Continue another unblocked task only on an isolated branch when safe, and keep issue #57 synchronized; do not manufacture launch evidence.


## BETA-P0-16 · Discover clears stale search feedback on input or category changes (21 Nov 2026)

**ARCHITECT sequencing → FRONTEND implementation.** On the immutable #99 application test descendant `fb4453327757240655e4cc332277244964609066`, code inspection found two adjacent presentation defects: editing a failed People/Shared Wall query cleared results but left the error for the old query visible, and switching People↔Walls invalidated the pending search fence but left the prior spinner active. New isolated branch `codex/beta-discover-feedback-reset-20261121-run6` resets the error when typing and resets searching on category switch; original session/query race fences remain intact, server search contracts unchanged. Negative/positive source and executable focus-fence checks in `tests/frontend-discover-feedback-reset.test.mjs`. No UX redesign, new policy, API, schema, migration, feature flag or backend change.

**Evidence and gates:** local full dependencies/native device were not available to this connector-only execution; fresh CI on the exact new PR head is mandatory (contracts, lint, typecheck, platform checks), followed by an independent Reviewer and independent behavioral QA reproducing failed search → edit and pending search → switch on an actual device/simulator. No hosted staging writes, production access, merge, deployment, credentials, new paid service or invitations. Existing #99 exact-head [CI success](https://github.com/darshitmeghani1992/the-wall/actions/runs/44909863167) is ancestor evidence ONLY, not evidence for this branch. **Enhanced Beta NO-GO:** SMTP/six-digit OTP and 3 real actor JWT, hosted permissions/Shared Wall RETURNING, media C2/C3, Secret one-hour cron, deletion 0031/worker, native QA, rollback and Founder GO remain open.

**Next:** verify this branch's own CI and separate Reviewer/QA, then choose the next unblocked source task. Do not modify other worker-owned branches or merge without unchanged-head gates. Resume from this queue + [issue #57](https://github.com/darshitmeghani1992/the-wall/issues/57). Domain and Apple holds remain unchanged.


## BETA-P0-15 · Discover stale search failure after query change (21 Nov 2026)

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** New isolated descendant of draft [#98](https://github.com/darshitmeghani1992/the-wall/pull/98) at exact base SHA `bf3f85d0c03889ce54af4bc83f3a5fc36b645ab2`. The People and Shared Wall search success branches already refused results when the user edited the query while a request was in flight; their **error** branches only checked focus/session. An old failed search could therefore surface an error against a different, newer search input. Added the same normalized-query freshness check to both failure paths; no new API, UX policy, data migrations or feature activation. `tests/frontend-discover-stale-search.test.mjs` exercises actual normalizers and source freshness contract. No pending request touches the screen for a different account.

**Evidence:** source and test committed to a fresh branch, not to #98 or any other worker-owned branch. Verify immutable new-head GitHub CI `npm run test:contracts && npm run lint && npm run typecheck`, then distinct independent Reviewer and behavioral QA (slow/failing People and Shared Wall searches with input edits and mode switches, offline/retry) before any merge. No hosted writes/production/feature flags/paid credits/invitations/merges/deployments. **Enhanced Beta NO-GO**: genuine staging SMTP+OTP, three JWT actors, independent approvals, C2/C3 media, Secret expiry, deletion migration 0031, device QA and rollback remain release gates.

**Next:** exact-head CI and independent inspection of both #98/#99; after that select next unblocked task from this canonical queue. Retain issue #57 tracking and approved hold on domain and Apple enrollment.


## BETA-P0-14 · Alert navigation latency / offline receipt (21 Nov 2026)

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** New isolated descendant of [#97](https://github.com/darshitmeghani1992/the-wall/pull/97) head `7a83b101045451d9d99b8787da261144fffeb82e`; prior #94→#97 implementation source preserved, no owned branch edited. The approved Alerts press handler awaited `markNotificationRead` **before** `router.push`, so a stalled/failed Auth/network call delayed navigation indefinitely (particularly offline). The new `openNotificationWithoutWaitingForReceipt` utility performs navigation immediately, then asynchronously performs the best-effort read receipt. Both rejected and synchronously throwing receipt callbacks are isolated. The screen retains recipient-ID checks, SessionFocusFence and server-confirmed receipt ID before any visible read-state change. This does **not** optimistically mark read, change API/RLS/schema, modify visual design or bypass auth.

**Tests:** `tests/frontend-alert-open.test.mjs` executes pending, rejected, throwing and already-read flows; source wiring asserts identity/focus fences and confirmed-receipt-only UI update. Must run actual `npm run test:contracts && npm run lint && npm run typecheck` on immutable new PR head (GitHub CI if local dependencies unavailable). Independent Reviewer then separate behavioral QA must confirm on offline/slow network and real device without stale-account UI. No hosted mutations, production, main merge, feature activation, deployments or tester invites. **Enhanced Beta NO-GO** until integrated unchanged candidate, verified SMTP+real 3-user JWT, C2/C3 media, Secret expiry, 0031 deletion, native QA, release rollback and Founder gates.

**Next commands:** Verify exact SHA CI and test logs; obtain independent Reviewer/QA. Continue unblocked frontend code/test slice on a new branch after refreshing latest open PRs, without colliding with active worker. Keep issue #57 and BUILD_STATUS as queue. No CODEX Cloud dispatch linkage claimed.


## BETA-P0-13 · Alerts pagination duplicate suppression (21 Nov 2026)

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** New isolated branch stacked on #96 immutable exact source `4551d4da20bb7234e55f33ffb1e3747fd81758b9` and preserving #95 → #96 ancestry. The existing `appendUniqueNotifications(current, older)` skipped only IDs already present in the previous page. Multiple copies of a new ID within the incoming API page were all appended because the known-ID set was not updated. Fixed the merge to record each accepted ID, keeping first-seen object identity, preserving order, retaining input immutability, and making retried/overlapping pages idempotent. Added executable typed tests for repeated incoming IDs, page-boundary overlap and duplicate retry. This is a local presentation-state bug fix, **not** an authorization, API, schema or product policy change.

**Verification:** exact-head GitHub CI required for `npm run test:contracts && npm run lint && npm run typecheck`; no installed-device or real Alerts server QA has been performed by this run. Independent Reviewer should validate stable pagination behavior and handling of duplicate response rows; independent QA should exercise Alerts on simulator/device, retries, offline-to-online pagination, and focus/read receipts on an unchanged candidate when available. Nothing is approved for main merge, staging hosted changes, production, paid API, feature activation or tester invitation. **Core + Enhanced Beta NO-GO** pending unchanged integrated source, independent reviews, verified OTP and three actors, private media, Secret cleanup, deletion/device and rollback gates.

**Next:** verify independent CI for this descendant and #96, obtain distinct Reviewer/QA evidence before any merge. Continue independent unblocked product code/test work while credentials and native device validation are gated; do not duplicate another worker's branch.


## BETA-P0-12 · Personal Wall share-link canonicalization (21 Nov 2026)

**Role:** ARCHITECT sequencing → FRONTEND implementation. A share-sheet link created by `wallDeepLink(handle)` previously interpolated arbitrary handle text; malformed separators, query strings, whitespace and fragment characters could produce a URL the strict native/deferred-intent parser refused. In a new isolated descendant of draft PR #95 immutable source head `e2c97c2d7004f72927bfe155a680f85891c064a0`, `src/lib/share-contract.ts` now validates and lowercases handle-only links to match the parser, preserves canonical valid handle behavior, and returns null for unsupported/oversized input. `src/lib/share.ts` uses the validated link for all three Personal Wall share entry points and associated `has_handle` analytics, falling back to a no-link invitation on invalid input instead of sending a broken link. Added executable pure contract cases and source wiring regression test.

**Scope/evidence:** no changed backend/API/auth/schema/migrations, no security flag activation, media or Secret enablement, hosted writes, production access, merge/deployment or tester invitation. No React Native device QA or live recipient deep-link test is claimed. Exact-head GitHub CI is required; independent Reviewer and behavioral QA must verify valid/invalid handles, cross-user sign-in → intended Wall, share-sheet behavior and no claimed conversion from unavailable universal links. Older #95 and #94 heads retain their own review gates. Core + Enhanced Beta **NO-GO** pending real SMTP/six-digit OTP, real 3-JWT/hosted authorization, media/Secret/deletion/device and two-key evidence.

**Next:** run `npm run test:contracts && npm run lint && npm run typecheck` on the published exact SHA (GitHub CI if local runner unavailable); independent Reviewer/QA on exact unchanged head. Then resume a **separate unblocked** frontend bug/test slice; do not edit an active worker's branch. Keep source of truth at this queue and issue #57.


## BETA-P0-11 · Mark removal allowance stale read fix — 21 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** New isolated descendant of PR #94 `2d6ee7283c59a40eb0434324920b71e7d86a6fe0` (preserves #91/#92/#94 dependency ancestry, no other working branch modified). `MarkDetailModal` previously awaited the normal-removal allowance and unconditionally updated UI state even if the user changed account, switched Mark, dismissed the remove panel or a subsequent request superseded the first. A stale account's quota/error could appear on a different Mark. Implemented existing session/target fences plus monotonically increasing allowance request token, guarded all success/error/finally updates, invalidated on exit/account/Mark switch and requested fresh quota on each entry. Server removal quota enforcement unchanged. Added source guard contracts and executable session/target fence tests in `tests/frontend-mark-allowance.test.mjs`.

**Scope:** FRONTEND-only read/presentation race fix and tests, no backend/schema, feature flags, hosted writes, production, merge or deployment. No external identity/SMTP required. New source/test on isolated branch; exact-head CI and independent Reviewer/behavioral QA required. No claim that existing hosted OTP/three-JWT/media/Secret/deletion gates are satisfied. **Core + Enhanced Beta NO-GO.**

**Next:** run `npm run test:contracts && npm run lint && npm run typecheck` on the exact head (CI if local environment unavailable); independent Reviewer audit target/account/panel race and QA slow-response account/target switches; verify no stale quota displayed and no false removal success, then keep working on separate unblocked feature tests. The unresolved release blockers are still captured by issue #57 and the canonical queue.


## BETA-P0-07 · Codex Cloud dispatch feasibility — 21 Nov 2026

**Verified:** The authorized Mac can run official Codex CLI 0.171.0, but `codex login status` returned `Not logged in` and `codex cloud list --json` refused without ChatGPT sign-in. No task was dispatched; no task ID exists. ChatGPT automation and GitHub connectors expose no supported Codex Cloud create-task action. Official Agents API has separate charges and is excluded. The existing enabled hourly The-Wall engineering loop is the supported subscribed execution fallback; no duplicate scheduler is authorized. New-generation Cloud environment discovery is unverified. See `docs/handoffs/CODEX_DISPATCH_FEASIBILITY_2026-11-21.md`. **Core + Enhanced Beta NO-GO.**

## BETA-P0-04 · Shared Wall definer regression — 21 Nov 2026

BACKEND read-only staging catalog evidence: 16 Wall/member SECURITY DEFINER routines; zero anonymous EXECUTE grants; the actor-supplied-ID helpers `can_view_wall`, `is_wall_member`, and `lock_shared_wall_member_rows` have no authenticated direct EXECUTE grant. Added disposable database privilege regression `74_wall_member_definer_grants.sql`. Independent Reviewer, QA and real three-actor HTTP tests still pending. No hosted writes, merges or production access.


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
