# The-Wall Build Status

## BETA-P0-45 · Shared Wall invite preview, response and lock actor/route isolation — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #128 exact `d4b12e83bb78d8984ccf8bf335554f31b2a121d7` preserving draft ancestry. `app/shared/invite/[id].tsx` held prior account's invitation name, inviter, privacy and response state until focus cleanup; a route change could show a previous private invitation, while claimed deferred references were deduplicated only by reference and a stale `respond` finally could release another account's mutation lock. Add viewer+Wall+deferred-reference key; show invite/errors/actions only after the exact key loads; reject stale resolution and retry, scope deferred token to exact key, and separate mutation fence from read fence to avoid stale response unlocks. No changes to backend invite authorization or existing coordinator. Executable key matrix + source guards in `tests/frontend-shared-invite-actor-route.test.mjs`.

**Gates:** Exact-head CI including TypeScript/lint, contracts, DB security, Edge/media and Expo/native where available. Independent Reviewer and separate real-device QA on invite A→B, Wall X→Y, reference R1→R2, accept/decline, old confirmation callback, slow/offline load and in-flight response, retry and UI semantics; source tests are not behavioral QA. STAGING ONLY `ewintxgdxdvschiqodkq`, protect original production. No hosted writes, schema/Auth/RLS/API/flag modifications, migration 0031, main merge, deployment or invitations. Enhanced Beta **NO-GO** pending true SMTP six-digit OTP, three hosted JWT actors, media C2/C3, Secret cleanup, deletion, independent QA/device/rollback and Founder GO. Media/Secret/analytics OFF; domain/Apple held.

**Next:** Verify PR #129 own CI and independent gates; proceed with unblocked beta scope while external release requirements remain held.


## BETA-P0-44 · Root deferred redirect bound to authenticated account — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #127 immutable `1290b956205f3b9906be47e68d7f7c0c2c361761`, maintaining untouched PR #30–#127 ancestry. The root `app/index.tsx` kept a plain resolved redirect string from account A. While session B became ready but before root `useEffect` invalidated that string, render could redirect B to A's previously resolved Wall, invite or fallback. A new `ActorRedirectTarget` records the resolving actor with its exact destination; `visibleRedirectForActor` fails closed until the currently authenticated actor matches. Async completion remains guarded by the pre-existing `preparedFor` lease and the deferred coordinator is not altered. Existing root contract adjusted to require scoped destination plus executable pure actor matrix `tests/frontend-root-redirect-actor.test.mjs`.

**Gates:** Verify exact-head TypeScript/lint/contracts/Postgres/Edge/media CI and Expo/disposable native build where available. Independently review exact unchanged tree and behaviorally QA account A→B before effect, B→A, logged-out links, fallback Discover, slow coordinator response, onboarding return and no stale redirect. Source/unit checks are not installed-device or real-user proof. No hosted writes, auth/schema/API/flags, production, migrations 0031, main merge, deploy or tester invitations. Enhanced Beta **NO-GO**: six-digit SMTP OTP, 3 genuine JWT actors, private media C2/C3, Secret cron cleanup, deletion, native QA/rollback, independent gates and Founder GO outstanding. Media/Secret/analytics OFF; domain/DNS/Apple held.

**Next:** Verify PR #128 immutable CI and REVIEWER/QA, then continue independent work on remaining beta items.


## BETA-P0-43 · Handle deep-link resolution fenced to account + route + deferred reference — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of PR #126 immutable parent `b1ce103aad7f379338ec9e391a30533a973da86b` (tree `018b4c0251a6f655dbe7bd0a7545fb2b36b9e900`), preserving stacked lineage #30–#126. The `/u/[handle]` route kept resolved target, retry and not-found state as unscoped component booleans/strings. If an authenticated viewer changed or an inbound handle/deferred reference changed before a new effect reset, the previous result could redirect a new session or present an outdated outcome. One explicit subject key (authenticated account, canonical handle, deferred reference, ready account state) now fences resolved display/redirect and claimed deferred attempts synchronously. Async completion and Retry are rejected after a route/account change even before focus-effect cleanup. Existing deferred coordinator, destination verification and safe fallback remain unchanged.

**Checks:** New executable pure scope matrix and source-boundary regression `tests/frontend-handle-route-actor-scope.test.mjs`; exact head needs independent CI (typecheck/lint/contracts/Postgres/Edge/media and native/Expo where supported), Reviewer and device/simulator QA on A→B, handle X→Y, reference R1→R2, delayed resolution, offline retry and logout. Source tests cannot certify a real authenticated invite transition. No hosted writes, security/schema/Auth/flag changes, production contact, merge, deployment or tester invitation. Enhanced Beta **NO-GO** until SMTP OTP, 3 real JWT actors, private media C2/C3, Secret one-hour cleanup, deletion 0031, device/rollback, independent gates and Founder GO. Media/Secret/analytics OFF, domain/DNS/Apple held.

**Next:** Check PR #127 exact SHA and CI; route unchanged tree to independent Reviewer and separate behavioral QA; continue another nonoverlapping beta task while external gates remain blocked.


## BETA-P0-42 · Synchronize moderation contract with actor-gated Settings — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND test correction.** New isolated child of #125 immutable `6ea34043e7ad8eab001c921b8812ec083b748ce0`. PR #124's exact-head CI `44952933951` caught a stale source assertion in `tests/frontend-moderation.test.mjs` expecting unsafe direct `profile?.is_admin` in Settings even though BETA-P0-40 correctly changed that screen to require `profile.id === authenticated actor`. This test-only correction now positively checks that the Settings administrator affordance derives from `actorProfile` and that `actorProfile` is fail-closed on identity mismatch, while rejecting a direct stale-profile conditional. No production code, permissions or runtime changed. Historical #124 CI failed and cannot be called green by inheritance. This child must earn its own 4/4 CI and independent review/QA.

**Gates:** exact commit/typecheck/lint/contracts/Postgres/Edge/media/Expo+native outputs. Status history #124/#125 source CI should be treated as noncertifying and the corrected accumulated candidate reviewed independently. No original production, hosted writes, migrations, main merge, deployment or tester invitation. First Enhanced Beta NO-GO: 6-digit SMTP OTP, 3 hosted JWT actors, C2/C3, Secret cron, 0031 deletion, native QA/rollback and independent gates outstanding; media/Secret/analytics OFF, domain and Apple held.

**Next:** Verify #126 CI, compare regression to #124–#125 and then route exact integrated source for Reviewer and native QA; continue separate unblocked engineering work.


## BETA-P0-41 · Profile tab header and sharing current-actor gate — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #124 immutable `951d19aeb9e2ebf4e2898a983505942f1ab65fe1`. The Profile tab counters already had actor-specific async fencing, but the avatar, name, handle, bio, social links and share destination still used the raw `profile` context without verifying `profile.id === session.user.id`. If a new session renders before its profile resolves, old-account private/identifying details and potentially the wrong Wall invite could be displayed. Bind all identity presentation and Share/Edit actions to matched actor profile, preserve the existing anonymous/empty fallback and counter fences. New source/matrix regression `tests/frontend-profile-view-actor-gate.test.mjs`. No new design, API, Auth, storage, schema or feature flag.

**Gates:** Exact new SHA CI, independent Reviewer, distinct behavioral QA for A→B pre-effect and delayed profile refresh, old share tap, logout, profile absent/retry and accessible avatar. Not verified on native devices. No hosted writes/prod access, migrations 0031, merge, deploy or invitations. Enhanced Beta **NO-GO** pending verified six-digit SMTP OTP, three real hosted JWT identities, C2/C3 media playback, Secret hourly cleanup, deletion/purge, device/rollback and independent gates/Founder approval; media/Secret/analytics OFF, domain/Apple held.

**Next:** Verify exact-source CI/reviews/QA and continue next unblocked beta task after checkpoint.


## BETA-P0-40 · Settings administrative and account-state actor binding — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #123 immutable `ab4393aec9ecedd8dc16d8b7f670d07a56e28889`. Settings showed Moderation queue when `profile.is_admin` and enabled account deactivation/deletion controls when `profile.account_status` was active, without requiring that profile to match the currently signed-in session. Account provider updates are asynchronous; old-role/profile metadata must not grant A's UI controls to B, even temporarily. Restrict these controls and the confirmation handler to a `profile.id === actorId` snapshot, leaving server authorization authoritative. Dedicated source/actor matrix `tests/frontend-settings-admin-actor-gate.test.mjs`. No product journey, admin backend/API/schema, or visual redesign.

**Gates:** New exact SHA CI, independent Reviewer and separate behavioral QA for admin A→non-admin B, deactivate button, no-profile/loading, signout and stale Alert pending. This is not server security certification. No original production, hosted writes, schema/flags/migrations 0031, main merge, deployment or invitation. Enhanced Beta **NO-GO** while SMTP OTP, real three-JWT actors, protected media, Secret cron, deletion, device/rollback, independent gates and Founder GO outstanding; media/Secret/analytics OFF, domain/DNS/Apple held.

**Next:** Inspect CI for this head and previous #120–#123, obtain independent Reviewer/QA; resume next unblocked issue after checkpoint.


## BETA-P0-39 · Person report actor/target form isolation — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #122 immutable `fbeb1505e3baba53375fdf7865040b37c7f0656b`. The person-report form's prior reason, free-text report details, block toggle and success state could appear for a changed account/target before `useFocusEffect` reset. Gate the entire report form behind a focus-loaded matching `actor:target` identity, and fence late form input, switch and submit handlers before report/block invocation. Preserve existing report-first/optional-block retry coordinator, RLS, server authorization and moderation UX. Add source+subject-matrix regression `tests/frontend-report-user-subject-fence.test.mjs`.

**Verification:** Exact-head CI, independent Reviewer and separate device QA for A→B, X→Y before focus, form input and old submit callbacks, report succeeds/block fails retry, slow submission, sign-out and offline required. Source assertions are not native behavioral proof. No hosted writes, schema/auth/API/flag changes, production, migration 0031, merge, deploy or invitations. Enhanced Beta **NO-GO**; real six-digit SMTP OTP, 3 hosted JWT actors, C2/C3 media, Secret hourly cleanup, deletion, device/rollback and independent gates remain blocked. Domain/DNS and Apple held, media/Secret/analytics OFF.

**Next:** Verify exact CI, independent review/QA, continue remaining unblocked task on next isolated branch.


## BETA-P0-38 · Fail-closed Shared Wall report destination and form — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated draft child of #121 immutable `9321064de78e952bb80181f15988483cb6303060`. Report Shared Wall already rejects stale asynchronous read responses, but the old Wall name, reason/details and submission state could remain visible to account B or another Wall before focus cleanup. Gate displayed Wall name, error and entire authorized form by `authenticatedActor:routeWall` subject; clear name on new load; settle allowed/denied/failed current-subject loads for retry; suppress submission by stale account/route event handlers. Existing report record, owner refusal, source of truth and RLS remain unchanged. Test `tests/frontend-report-wall-subject-fence.test.mjs` includes actor/route state matrix and source guards.

**Gates:** Exact-head GitHub CI, independent Reviewer and separate device QA (A→B, wall X→Y before focus, owner refusal, not-found, slow/failure retry, old submit callback) required. Source tests are not behavioral verification. No Auth/schema/API/flag or hosted writes, production access, migration 0031, merge, deploy, paid service, invitation or blocked external action. Enhanced Beta **NO-GO**, media/Secret/analytics OFF, OTP/three-JWT/media/Secret/deletion/device/rollback/independent gates and Founder GO outstanding.

**Next:** Verify own CI and independent review/device QA; continue separate unblocked source tasks under new branches.


## BETA-P0-37 · Account-bound Profile editor and stale event handlers — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** New isolated child of #120 head `51bc70a2212c325620e74361a8d20eef0d3731c1`. The edit-profile modal initialized draft identity, avatar, username and social links from `profile`, but on account A→B could render A's cached fields until `useFocusEffect` ran. It also allowed a stale A callback to initiate image picker/save before focus cleanup, even though response fencing existed. Gate the whole editor behind `profile.id === authenticated actorId` and a focus-loaded actor; show existing spinner while B's profile is unresolved, reset all drafts on profile change/sign-out/blur, and reject old actor callbacks before opening picker/uploading/saving. Preserve existing profile schema, validated save, backend authorization and visual form. Added `tests/frontend-profile-edit-actor-guard.test.mjs`.

**Gates:** Fresh exact-source CI, independent Reviewer and native behavioral QA required for A→B before focus, stale modal save/photo callback, delayed auth/profile resolution, signout, failure and retry, no prior-account display. Source assertions are not runtime QA. No hosted writes, auth/SQL/schema/flag, production, main merge, deployment or invitations. Enhanced Beta **NO-GO** while verified SMTP/six-digit OTP, three authenticated JWT actors, protected media C2/C3, Secret cron, account deletion 0031, device/rollback, independent QA and Founder GO remain blocked; Secret/media/analytics OFF and domain/Apple held.

**Next:** Check exact-head CI and independent review/device QA, and continue another separate unblocked task.


## BETA-P0-36 · Fail-closed Alerts across account changes — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #119 immutable `07f191bdc3cf9285111935573be4c1e50e4c9dbe`, original tree `810de7276b69ce236c74b9ad9451994c350d2cc9`. The Alerts tab already checks asynchronous responses against the authenticated user, but previously cached sensitive Alerts (actor name, recipient notifications, unread state, pages and errors) could render for account B before `useFocusEffect` cleared account A. Gate every rendered Alert, error and history cursor by its settled authenticated actor; clear items and cursor at the start of a new load, settle failed loads for a current-actor retry, and reject old-actor open/page actions before navigation or writes. Retain owner-scoped receipt behavior, pagination and current empty/retry UX. New `tests/frontend-alerts-actor-display.test.mjs` checks the source wiring and A→B data selection.

**Evidence/Gates:** Requires exact new SHA GitHub CI, independent Reviewer approval and separate native behavioral QA for A→B before focus, delayed initial/error/older-page load, Alert open, receipt, retry and sign-out. CI/source tests are NOT device E2E proof. Staging `ewintxgdxdvschiqodkq` only; protected production `wfsfafmgvxevpzrurofz` untouched. No hosted write, schema/auth/API/flag change, paid service, merge, deployment or invitation. Enhanced Beta **NO-GO** pending verified 6-digit SMTP OTP, 3 real hosted JWT actors, private media C2/C3, Secret cron, migration 0031/purge, independent QA, installed devices/rollback and Founder GO. Media/Secret/analytics OFF; domain/DNS/Apple held.

**Next:** Check new branch/head CI; obtain independent Reviewer and simulator/device QA; continue next unblocked scoped task without editing another worker's branch.


## BETA-P0-35 · Lease unsaved settings discard to authenticated actor — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #118 exact `074824a77d2ae1c771a3c6fe758cd4b886fd441b`. The Personal Wall settings `beforeRemove` confirmation captured a navigation action, but its delayed Discard callback could still dispatch after account A→B or sign-out; duplicate modal prompts were also possible, and a back gesture during an in-flight save could navigate incorrectly. Use the existing account action `SessionFocusFence` as a lease for the captured confirmation, discard old callbacks when the actor/focus generation changes, prevent multiple prompts and navigation during an in-flight mutation, reset prompt state on focus/blur. No server/schema/API/product/visual change; preserve current unsaved change and Save settings journeys. Regression `tests/frontend-personal-settings-discard-lease.test.mjs` includes actual `SessionFocusFence` race checks.

**Verification:** exact new SHA CI and independent Reviewer/behavioral QA needed on account switches, stale modal callbacks, dirty discard, saving while back gesture, cancel and retry. Unit/source checks are not real device QA. Prior #118 exact SHA was 4/4 CI but cannot certify child. STAGING ONLY `ewintxgdxdvschiqodkq`; original production untouched. No hosted write, migration 0031, main merge, paid service, release or tester invitation. Enhanced Beta **NO-GO**: six-digit SMTP OTP, real three-user JWT HTTP suite, C2/C3 media, Secret one-hour cron, deletion/purge, installed-device/rollback and independent Reviewer/QA/Founder approval outstanding; media/Secret/analytics OFF; domain/DNS/Apple held.

**Next:** Verify child exact tree and CI, independent code review and native UX test. Continue independent unblocked task after checkpoint.


## BETA-P0-34 · Personal Wall settings actor-bound render and retry — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #117 exact `6be90c1de356ba4b128d3faa735245fc5900ef0e`. Personal Wall visibility, writing and Anonymous configuration could remain rendered from account A after a new account B session/route render but before focus-effect cleanup. Bind settings, error/dirty and save eligibility to the actor whose read settled; show the existing spinner while B loads, and settle errors under B to preserve retry. Sign-out fails closed without an unusable retry action. All three server-saved settings remain atomic and backend owner validation is unchanged. New `tests/frontend-personal-settings-actor-display.test.mjs` source/state checks; no UI redesign, schema, API, security policy or flags changed.

**Gates:** new exact SHA CI, independent Reviewer approval and separate simulator/device behavioral QA must verify account A→B before focus, failed B load and retry, sign-out, pending save and no stale options. Not release certification; previous #117 CI/evidence do not cover this child. No hosted writes, production access, irreversible migration, main merge, signing, deployments or tester invitations. Enhanced Beta **NO-GO**: real SMTP 6-digit OTP, 3 authenticated JWT actors, C2/C3 photo/voice/video, Secret one-hour cron, 0031 deletion/purge and installed-device/rollback + independent QA/Founder GO outstanding. Domain/DNS and Apple held; media/Secret/analytics OFF.

**Next:** Verify exact-head CI and lease/QA independence, then continue unblocked tests/implementation from this canonical queue.


## BETA-P0-33 · Status removal guard account-switch lease isolation — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #116 immutable `d6c60a9796fbfe734a630ffed2fabfefb0ca0f8f`, retaining #30–#116 drafts. Status save/remove shared the read-generation fence and unconditionally finished the reusable navigation removal guard in late `finally`; an A-account request could clear B's exclusive operation or old `approved`/dirty navigation state could carry into B. Separate action/read fences, reset session-scoped guard/confirmation state on focus/blur, release guard **only** under the current action lease, and reject stale modal callbacks/old route subjects. Keep server-authoritative save/remove, existing prompts, denial/dirty behavior and UI intact. Add `StatusRemovalGuard.resetSession()`, a unit regression and `tests/frontend-status-action-actor-lease.test.mjs`.

**Gates:** exact new SHA CI and independent Reviewer + separate native behavioral QA for delayed A-save/remove while B edits, read refresh vs save, stale Alert dismissal, unsaved confirmation and back navigation. #116 actor-render privacy checks don't certify this distinct change. No hosted writes, production access, migrations, main merge, external billing, deployment, tester invitation or protected feature activation. Enhanced Beta **NO-GO** pending real OTP/3 JWT actors, C2/C3 private media, Secret cron, account deletion 0031/purge, native QA/rollback and Founder release gates. Domain/DNS and Apple held.

**Next:** check exact child SHA/tree and CI; independently review/test on device, continue remaining unblocked tasks on new isolated branches.


## BETA-P0-32 · Status editor actor/Wall render privacy guard — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #115 immutable `b1ed1637c86f5349f41ded85d4f0eeea9108b415`. The Status editor already fences delayed network responses and clears state on focus, but could briefly render the previous account's or previous Personal Wall's Status text/draft **before** the focus effect clears it. Bind the visible Status/body, save eligibility, dirty/remove controls and loading/error transition to the current `userId:wallId` subject; mark both authorized results and denied/failed loads as settled for that subject so authorized retry still works. Loading and navigation preserve the existing user journey. New source/state regression `tests/frontend-status-actor-render-fence.test.mjs`. Backend permission remains authoritative; no UI redesign, auth/schema/API/flag changes.

**Verification / gates:** Exact-head CI must run separately from #115; status editor actor A→B, Wall X→Y, delayed success/failure, retry, unsaved edits and back/removal needs independent Reviewer and behavioral device QA. Source contracts do **not** prove native privacy. Prior #115 exact SHA `b1ed1637c86f5349f41ded85d4f0eeea9108b415` passed 4/4 GitHub CI ([run 44942504092](https://github.com/darshitmeghani1992/the-wall/actions/runs/44942504092)); its approval/QA are still pending. No production access, hosted writes, feature activation, migrations, merges, deployments or tester invitations. Enhanced Beta **NO-GO** until real six-digit OTP delivery, 3 genuine hosted JWT actors, C2/C3 media, one-hour Secret cleanup, 0031 deletion/purge, device/rollback and Founder release gates.

**Next:** Verify new child exact SHA/tree/checks and independent Reviewer/QA; next separately leased unblocked task should assess `StatusRemovalGuard` in-flight ownership on account switch without conflating it with this UI-render fix. Domain/DNS and Apple enrollment/signing remain held.


## BETA-P0-31 · Fence Approved Writers roster and controls by account — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #114 immutable `dfb8270e96764be9a1bdd20f985e51b643883b13`, preserving prior stacked drafts. Approved Writers cached roster and search UI persisted until `useFocusEffect` cleanup; a new account render could expose prior actor writer names or accept stale UI actions. An actor-bound `loadedActorId` gate hides cached content until current actor's settings and roster load. Search, add, remove and confirmation fail closed on actor mismatch. Current actor error/retry and non-selected explanation still function. Added dedicated Node contract `tests/frontend-approved-writers-actor-display.test.mjs`. No server permissions, API, UX design, schema or flags changed.

**Gates:** Child exact SHA/tree CI, independent Reviewer and separate behavioral QA (A→B, delayed/failed loads, unselected/selected, stale confirm, retry) pending. This implementation is NOT release certification. No production, hosted writes, migrations, merge, deployment or invites. Enhanced Beta **NO-GO** pending real six-digit SMTP/OTP, three real JWT actors, media C2/C3, Secret cron, deletion 0031/purge, device QA/rollback and Founder GO. Domain/DNS and Apple signing held.

**Next:** Capture CI and exact tree, independent review/QA and continue next authorized unblocked queue item.

## BETA-P0-30 · Enhanced Beta release packet and rollback preparation — 22 Nov 2026

**ROLE: ARCHITECT documentation.** Independent source-only release packet `docs/handoffs/ENHANCED_BETA_RELEASE_PACKET_2026-11-22.md` prepared as a separately owned descendant of #113 exact `138391e3dccd0aad5d760f1001761b01376c0161`. Captures verified staging emptiness/absence of cron, exact feature flag names, server controls, interim private beta release copy explicitly **NOT PUBLISHED**, migration 0031/Secret safety ordering, immutable GO evidence and rollback/release artifact prerequisites. Does **not** declare source/CI/QA certification, merge or authorize hosted writes.

**Next:** Capture new documentation PR SHA/tree/CI; independent Reviewer/QA must verify unchanged candidate before any GO; complete OTP, authenticated security, media, Secret, deletion, device and Founder gates. Enhanced Beta **NO-GO**.

## BETA-P0-29 · Hide previous-account blocked-user roster before focus reset — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated descendant of #112 immutable `9ffc0e947dcc085d2c71be8a7cba6396d39a2541` while preserving historical #30→#112 draft lineage. In `app/blocked-users.tsx` stale blocked user names, pagination or prior errors could briefly appear on a new account's pre-focus render, although already-ongoing HTTP reads were fenced by authenticated actor. A new `loadedActorId` render gate now hides blocked-list UI until a result or error belongs to the current actor. Current-actor failed/unavailable responses still reach existing retry, including API error states. Adds `tests/frontend-blocked-user-actor-display.test.mjs` covering wiring and A→B display behavior.

**Verification:** Parent #112 CI and exact child CI are distinct; new HEAD CI, independent Reviewer and behavioral QA remain required (account A→B before focus, delayed response, block list pages, authorized empty/error/retry, logout). Source/Node tests do not certify native behavior or RLS. No backend/API, Auth, schema, flags, migrations, hosted writes, production access, merge, deployment, or invitations. Enhanced Beta **NO-GO** pending real six-digit SMTP OTP, three real JWT actors, private media C2/C3, Secret scheduler, deletion 0031/worker, installed-device QA/rollback, Reviewer and Founder GO. Domain/DNS and Apple held.

**Next:** Record immutable SHA/tree and CI, request independent code review and distinct behavioral QA; continue remaining unblocked work without editing leased branches.

## BETA-P0-28 · Admin moderation queue actor-bound render guard — 22 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated descendant of #111 exact `2ab2890dcfef1e296e0edab167fec99cecfa4d96`, preserving #30→#111 draft ancestry and not modifying prior worker branches. The moderation screen fenced asynchronous report requests by actor, but retained already-rendered administrator report rows, action audit history and errors until the next focus effect. During admin A→admin B switching, a render before the focus cleanup could disclose A's sensitive report queue. A render-level `loadedActorId` guard now hides previous actor data immediately, preserves current-actor error/retry on failure, and does not modify server authorization or moderation actions. Added `tests/frontend-moderation-actor-display.test.mjs` source and state regression.

**Evidence:** #111 parent has successful GitHub CI run 44936315746 at its unchanged head, but the new child requires its own CI, independent Reviewer approval and behavioral QA for A→B admin transitions before focus, delayed successes and errors, non-admin gate, audit/closed tabs and retry. Node contracts are not runtime or security certification. No Auth/SQL/Storage/schema/flags, hosted writes, production access, merges, deployments or invitations. Enhanced Beta remains **NO-GO** pending genuine six-digit OTP, three real staging JWT identities, protected media, Secret scheduler, deletion 0031/purge, installed device/rollback, independent QA/Reviewer, and Founder GO. Domain/DNS and Apple enrollment/signing remain held.

**Next:** Check exact child commit/tree/CI, hand off to independent Reviewer and separate device QA, then continue another unblocked task under an isolated branch; never deploy from this draft.

## BETA-P0-27 · Fence follower/following lists by viewer, destination and list kind before focus effects — 21 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated source child of [#110](https://github.com/darshitmeghani1992/the-wall/pull/110) immutable `f94eb8c5af1bf4f0c6eeb2c6236e3eae6b7eafce`. `app/social/[kind].tsx` fenced asynchronous responses by viewer and requested target, but retained already rendered follower/following data and old error until `useFocusEffect` cleanup. A route-param/actor change could briefly display the previous list or mismatch Followers vs Following. Bind list visibility to the exact `viewer:target:kind` subject, keep existing loading/empty/error/retry UX and server-side access unchanged, and clear subject on focus cleanup. Add `tests/frontend-social-list-subject-fence.test.mjs` contract/race checks.

**Verification:** New immutable child requires its own GitHub CI, independent Reviewer approval, and distinct simulator/device QA for actor A→B, target X→Y, followers→following, error/retry and delayed old response. Static/Node tests alone do not establish runtime privacy. No hosted schema/auth/RLS/endpoint, flags, design, production, deployment, merges or tester invitations altered. Enhanced Beta **NO-GO** pending real six-digit SMTP OTP, 3 authenticated JWT actors, C2/C3 private media, Secret one-hour scheduler, deletion 0031/purge, device/rollback, independent Reviewer/QA and Founder GO. Domain/DNS and Apple enrollment/signing held.

**Next:** Record exact PR CI/commit/tree in issue #57 and route to independent Reviewer/QA; continue unblocked work on separate isolated branch without touching earlier branches.


## BETA-P0-26 · Prevent previous-account Profile counters during pre-effect render — 21 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of #109 exact `ac43236da37bf5a2736cfbed6a5b4265e8801333`; parent #101 only clears counters inside `useFocusEffect`. A user change may render before that effect runs, briefly exposing the prior account's follower/following/friend totals or fetch failure. Bind counter visibility to the actor that started each request, with an actor-mismatch showing the existing loading indicator; do not invent a zero before server counts load. Source-only change to `app/(tabs)/profile.tsx` plus `tests/frontend-profile-actor-render-fence.test.mjs`; no visual redesign, auth/permission changes, schema/API/feature flags or hosted changes.

**Verification:** New Node contract checks render gating, request-actor assignment and A→B state sequence. Exact commit CI, independent Reviewer and simulator/device behavioral QA (A→B before focus callback, delayed/failing B requests, sign-out, retry) remain required; source checks are **not** runtime QA. Parent #109 exact commit `ac43236da37bf5a2736cfbed6a5b4265e8801333` completed [4/4 CI](https://github.com/darshitmeghani1992/the-wall/actions/runs/44931763336); that does not certify this child. Enhanced Beta **NO-GO**: real SMTP six-digit OTP, genuine three-actor JWT hosted tests, private media C2/C3, Secret cron, account deletion 0031, independent Reviewer/QA, device and rollback evidence and Founder GO are missing. Staging only; no original production access, hosted writes, main merges, deployment or tester invitations.

**Next:** Check own immutable HEAD CI; give exact diff to independent Reviewer and behavioral QA. Continue next unblocked queue item on another isolated branch. Domain/DNS and Apple enrollment stay held.


## BETA-P0-25 · Prevent old account friend totals during My Wall reload — 21 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated child of [#108](https://github.com/darshitmeghani1992/the-wall/pull/108) immutable source `677db50ab226ce47259cf3605f5d118d1b429544`. My Wall's friend counter was not reset at the start of the actor-dependent main loading effect. Because `setWall(personalWall)` happens before optional friend-count query settles, the next account's Wall could briefly display the previous actor's count. Set `friendCount=null` at the beginning of every main account/Wall load, before network requests; retain server count and `FRIENDS UNAVAILABLE` until current account's value arrives. No product design, schema, RPC, permission, flag or backend changes.

**Verification:** Adds `tests/frontend-home-friend-count-session-reset.test.mjs` for reset-before-fetch, sourced count wiring and simple state progression. Requires own exact-head GitHub CI, independent Reviewer and real simulator/device QA for account A→B when B's counts are delayed/failed; not a native QA pass. No hosted staging writes, main merge, production access, deployments, feature activation or tester invitations. Core + Enhanced Beta NO-GO pending genuine OTP/three actor JWT, media C2/C3, Secret scheduler, deletion 0031, installed-device/rollback, independent Reviewer/QA and Founder release gates.

**Next:** verify own CI, route exact tree to independent Reviewer and QA; continue next unblocked slice separately. Domain/DNS and Apple Developer held.

## BETA-P0-24 · My Wall removes prior actor Shared Wall tabs on session/focus changes — 21 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** This isolated stacked draft descends from [#107](https://github.com/darshitmeghani1992/the-wall/pull/107) source `99d8d7612d5a4cbcc616743940f1523bc3872329`. My Wall previously fenced async Shared Wall response writes by actor, but it kept already-rendered Shared Wall tabs while a different account's replacement list was loading; a quick sign-out/account switch could transiently display previous-account private Shared Wall names. On every focused actor/route transition, reset tab data and its prior error before issuing the new actor's `getAccessibleSharedWalls` request. Keep existing read fence, backend RLS/permissions and retry behavior unchanged. No visual design, navigation, schema, API, migration, flags or hosted operations changed.

**Verification:** `tests/frontend-home-shared-wall-session-reset.test.mjs` checks source order and simulates old/new actor fence state. Contract tests and CI are implementation-level only; independent Reviewer and separate QA must verify actual UI on simulator/device (slow A list → switch to B, B empty/authorized, stale A success/failure, navigating away/back) with exact unchanged SHA. New PR needs its own full 4-job CI; ancestor CI alone is not enough. Enhanced Beta **NO-GO**, blocked by genuine six-digit SMTP OTP, 3 staging JWT actor suite, secure media C2/C3, Secret cleanup scheduler, deletion 0031/worker, installed-device/rollback and Founder release gates. Staging only, protect original production, media/Secret/analytics OFF, no hosted writes, merges, deployment or invitations.

**Next:** verify immutable PR head and CI, independent Reviewer and QA, then continue queue on a separately leased branch. Domain/DNS and Apple enrollment/signing remain held.

## BETA-P0-23 · People picker account/query fetch-fencing — 21 Nov 2026

**ROLE: ARCHITECT sequencing → FRONTEND implementation.** Isolated draft based on [#106](https://github.com/darshitmeghani1992/the-wall/pull/106) immutable source `36623f29d02f2c7c0a18445f5e3d08ce6ecd5d35`; prior stacked PRs remain untouched. The Mark recipient people picker previously retained the prior actor's friend results on focus/account switch and let a search requested for an earlier query repaint results or errors after input edits. This slice resets account-scoped picker data when focus/session changes; editing invalidates pending friends/search requests, clears stale results and error/loading state, and clearing a query reloads current-account friends. The backend friendship and Wall permissions, route, feature flags, and UX contract are unchanged.

**Verification:** Added `tests/frontend-people-picker-stale-search.test.mjs` with source-wiring assertions and executable `SessionFocusFence` generation cases for stale initial friends, old search, query edit and account changes. This draft requires **its own** exact-SHA GitHub CI (contracts, lint, types, DB security, Edge/media, Expo/native exports) plus independent Reviewer and behavioral QA on simulator/device (delayed friends/search success/failure, account switch, blank-query restoration, and selecting a permitted friend). CI source checks do **not** establish actual native behavior. No original production access, hosted staging writes, database/infra changes, merges, deployments, tester invites or new paid services. Core + Enhanced Beta remains **NO-GO**: real SMTP six-digit OTP, 3 authenticated JWT actors, private media C2/C3, Secret one-hour scheduler, migration 0031/purge, device/rollback and Founder release gates remain open.

**Next:** Verify the published PR's exact SHA and CI, hand off unchanged tree to independent Reviewer/QA; continue another unblocked task on a separate lease. Domain/DNS and Apple Developer held.

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
