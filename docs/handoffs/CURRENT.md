# CURRENT — Operational Handoff

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
