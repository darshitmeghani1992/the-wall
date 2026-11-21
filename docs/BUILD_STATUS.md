# The-Wall Build Status

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

## BETA-P0-04 · False-positive private Shared Wall fixture guard — 21 Nov 2026

**ROLE: ARCHITECT sequence → BACKEND implementation.** New isolated draft `codex/beta-three-jwt-fixture-kind-20261121-run2` descends from test-only #86 corrected source `5e6c5de25489b4ddd365382788c5551523622ff1`. Existing read-only three-JWT HTTP audit could report a misleading PRIVATE SHARED Wall PASS using a private Personal Wall fixture, because it queried/checked only `id`. It now GETs `id,type,visibility` and fail-closes unless owner/member rows are the exact private Shared Wall; mock tests cover wrong `type`, public `visibility`, outsider leakage, identity and HTTP 401. Runbook updated; zero new requests or mutations. **Local true JWT QA remains blocked:** staging has no authorized actors or verified SMTP. Exact-head CI and independent Reviewer/QA remain mandatory, no hosted/prod writes or activation. **Next:** check draft CI and hand off security fixture validation; retain Enhanced Beta NO-GO.


## BETA-P0-04 · Suspended-owner Shared Wall regressions — 21 Nov 2026

**ROLE: BACKEND** test implementation under ARCHITECT's BETA-P0-04 security acceptance. New isolated branch `codex/beta-suspended-owner-returning-tests-20261121-run2` starts at [PR #85](https://github.com/darshitmeghani1992/the-wall/pull/85) `3e13b30cde449ac8023edaf01df6b1b35a8a734a`. Added two independent suspended-account SQL negative assertions to existing disposable test 73: the suspended owner cannot read an existing private Shared Wall or create another by `INSERT ... RETURNING`. Deactivated, outsider-spoof, and legitimate active-owner cases retained. **No schema/config/API/hosted data changes.** New exact-head CI, independent Reviewer, and QA still required; local PostgreSQL unavailable to this run. Real three-actor HTTP/OTP security evidence remains blocked by staging's zero Auth users and unverified SMTP. **Next:** check published draft CI, hand off tests, then continue independent authorized security work. Enhanced Beta NO-GO.


## BETA-P0-01 · Integrated lineage audit, application candidate (21 Nov 2026)

**ROLE: ARCHITECT**, documentation-only integration; source parent [#84](https://github.com/darshitmeghani1992/the-wall/pull/84) `f583ca520ad0dfa3b452dfc7ae85ece016597498`. Imported the exact audit text from [#74](https://github.com/darshitmeghani1992/the-wall/pull/74) `65a211c467a94e903bb74f1e3df7a4612e79104c` as `docs/handoffs/PR_LINEAGE_AUDIT_2026-11-21.md`. The audit's complete 351-path main→#30 blob inventory, historical PR base chain, and collision watchlist are preserved; this is not a 351-file semantic security review.

GitHub compare: #74 and #84 are distinct descendants of #67 `ebdf28c196a3f50e4b5218dd6038d12277d12953`; #74 adds 7 commits / only 3 docs files; #84 adds 18 commits / 8 files (docs plus staging JWT harness/tests, Shared Wall SQL, moderation race harness). #84's `src/components/marks/MarkDetailModal.tsx` blob `23a4e1159e258ae19a8636c2927961f75b0fab84` exactly matches the earlier #60/#61 file, and worker URL policy blob `88b235eb5c818b110abcd798ec63af766c1414aa` matches #65/#67. #81's parallel Gemini/cloud-tooling tree is **not** combined with this application verification candidate; compared to #67, it touches 31 tool/workflow/docs files and overlaps #84 only on continuity docs. Retain all drafts; no claim of supersession or independent approval.

**Source parent evidence:** #84 CI [44892196400](https://github.com/darshitmeghani1992/the-wall/actions/runs/44892196400) SUCCESS, 4/4; no submitted Reviewer approvals at inspection, no independent QA. This documentation integration has its **own new commit/tree** and must receive fresh exact-head CI and Reviewer/QA. Only after GitHub verifies this new head should it be a review candidate, **not** a certified release. Read-only staging 21 Nov: ACTIVE_HEALTHY; zero Auth users, Walls, Marks and private media objects; `pg_cron` absent. No hosted writes, production reads/writes, merges, releases, feature activations or invitations.

**Next unblocked work:** independent Reviewer should do a source-critical semantic scan of the audited historical auth/security/permissions/Mark/media files on this unchanged candidate, then distinct QA should execute non-hosted contracts and, when SMTP/three authorized actors exist, hosted JWT/OTP and device behavior. BACKEND should prepare another isolated security regression while waiting; do not assert beta readiness. **Core + Enhanced Beta: NO-GO.**


## BETA-P0-04 · Moderation concurrency test ordering — 21 Nov 2026

**ROLE: BACKEND test implementation.** Branch `codex/beta-moderation-race-readiness-20261121` stacks on [#83](https://github.com/darshitmeghani1992/the-wall/pull/83) at `e2e85511fdada01e6f5a1c9eb05b8980d0fca871`. The Shared Wall test passed on disposable PostgreSQL 16. The same suite then failed in test 96 when two sessions raced to claim the final normal-removal quota slot. The harness now waits for the first session to hold its transaction open and verifies that the contender reached a lock wait in all six quota, deactivation and suspension scenarios. All six passed in a targeted PostgreSQL 16 run. GitHub CI and independent Reviewer/QA must bind to this PR's exact head.

**Next:** complete the exact-head database suite and independent handoff, then incorporate #74's audit notes. A file-level scan from #67 found that #81 and #83 intersect only in three continuity documents. Real staging JWT/OTP and device evidence remain pending. Enhanced Beta remains NO-GO.


## BETA-P0-04 · Shared Wall write regression integration — 21 Nov 2026

**ROLE: ARCHITECT integration → BACKEND test implementation.** Branch `codex/beta-shared-wall-regression-integration-20261121` preserves both draft parents, #82 at `a019b54b20bf67b3cf1885cb9d439529a3ed2b2b` and #75 at `a7e40b0228acda35c547b82ad252fe4e3d040e49`. Test commit `5e771ee55957e1a85dc422d425a70176a7a90e02` adds plain INSERT denials alongside INSERT RETURNING and a successful own-wall write by the active outsider. This checks the write guard independently of the SELECT policy. The tests use a disposable Postgres transaction. The staging JWT preflight stays on the same branch.

**Evidence and routing:** GitHub reports CI for the published PR head, including this handoff commit. Independent Reviewer should check both parents and the SQL assertions. Independent QA should verify the unchanged PR head, then run the authorized three-actor read-only HTTP smoke when staging actors and OTP are available. No hosted database, deployment, release flag or production change. Enhanced Beta remains NO-GO.

**Exact next engineering task:** BETA-P0-01, reconcile #74's file-level audit evidence with this integrated draft and check remaining sibling PRs for source overlap before proposing an immutable release candidate. Live staging actor testing remains gated separately.


## Staging HTTP three-JWT privileged-key guard — 21 Nov 2026

**BETA-P0-04; ARCHITECT sequencing → BACKEND implementation.** Isolated draft `codex/staging-jwt-public-key-guard-20261121` from PR #77 immutable head `3a79cdd2fb6e15fb1a6df5edefc4550b26d4eaf9`, not cloud-worker branch #81. Added public-only API-key and staging Auth JWT local claims preflight with hostile no-network tests to prevent misleading RLS results from privileged service-role/secret keys. No app/schema/hosted users/config/feature flags altered. Exact CI and independent Reviewer/QA required; **no authorized hosted three-actor fixture is available, so live JWT RLS PASS is not claimed**. Next: check draft PR CI/review; when verified SMTP and authorized staging identities exist, run real actor HTTP tests. Text-first internal-only; Enhanced Beta NO-GO.



## BETA-P0-04 authorized three-JWT HTTP read-only harness — 21 Nov 2026 (BACKEND draft)

New isolated BACKEND test-only branch `codex/staging-three-jwt-readonly-20261121` descends from integrated application candidate PR #67 (not cloud-loop drafts). Added `scripts/staging-three-jwt-readonly.mjs`, six mock HTTP contract tests `tests/staging-three-jwt-readonly.test.mjs` (discovered by existing `npm run test:contracts`), and `docs/handoffs/STAGING_3_JWT_HTTP_READONLY_PREP_2026-11-21.md`. **Staging-only**, read-only six GETs, fail-closed on wrong origin/production, mismatched or duplicate JWT actor, unauthorized/missing known fixture and HTTP 401; checks actual `/auth/v1/user` identities and one private Shared-Wall owner/member/outsider RLS view. **No real JWTs or accounts supplied; not executed against staging**, which still has zero Auth users/Walls; mock success will not count as authentic HTTP E2E or QA. Next: exact-SHA CI, independent Reviewer review of harness, then authorized real tester identities and OTP/SMTP before live execution. Original production protected; Secret/media off; 0031 withheld; Enhanced Beta NO-GO.


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
