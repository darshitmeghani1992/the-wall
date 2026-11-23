## D-52 · 24 Nov 2026 · Native picker scope rather than foreground-only cancellation (held)
- **ARCHITECT → FRONTEND:** A native camera/gallery or permission UI may temporarily leave active AppState. Unlike protected network operations, local attachment selection must tolerate that legitimate transition while staying bound to the current composer actor/destination, discard intent and submission lock. Reserve one synchronous picker slot, check scope after each asynchronous result, block competing post/type intents, and release in finally. Do not overwrite existing different-kind media. No API, schema, rollout or product scope change.
- **Evidence:** draft #266, source regressions and exact CI pending; physical iPhone camera/gallery, cancellation, account/destination change and protected upload acceptance remain independent. No hosted operations authorized.

## D-51 · 24 Nov 2026 · Native Voice recorder startup must be a visible, guarded composer state (held)

- **Finding:** The existing synchronous microphone lease protected against duplicate starts and stale permission callbacks, but until native `startAsync()` resolved, the hook still exposed `idle`. The composer allowed an unrelated Mark submission or navigation in that permission window and did not catch native start rejection from the Voice tap.
- **ARCHITECT boundary → FRONTEND implementation:** Extend local Voice phase to `starting` before the first native async permission request. Treat it like recording for client submit/discard/mode guards, show a minimal accessible pending state, return to idle on permission denial/native failure, and surface safe recoverable microphone errors. Preserve backend authorization, media privacy, 60s cap, generation fence and approved product behavior. Do not insert a dependency or enable disabled media.
- **Evidence and gates:** Isolated [draft #264](https://github.com/darshitmeghani1992/the-wall/pull/264), based on #263 exact `2db48d083c4d489986f87327eacee0ddec86f1cf`; source/test SHA `d771ab3f87b954ee22425e9aedaddef54e1073cb`. Requires final-head CI and independent Reviewer plus real-device mic/cancel/deny/start/stop and accessible navigation tests; no signed iPhone testing claimed.
- **Rollback:** Withhold/revert this held source-only branch. No server state or storage change. Staging-only, media/Poll/Secret gates OFF, original production untouched; full public beta NO-GO.

## D-50 · 23 Nov 2026 · Removed Secret Marks are permanently unrevealable (draft, held)

- **PRODUCT acceptance:** Issue #57 and #66 require removed Secret Marks never yield content. Keep the existing `missing` denial reason rather than introduce a new public response contract. Other one-time reveal and one-hour expiry semantics remain unchanged; Secret rollout stays OFF.
- **ARCHITECT → BACKEND design:** Add held migration `0039_secret_removed_payload_guard.sql` without rewriting 0010/0011 history. A `reveal_secret` call locks the parent Mark before consuming the child payload; a status transition to/from removed scrubs the child payload in that same transaction, including a later historical restoration attempt. `expire_secret_marks` preserves its integer count despite trigger-side deletion. Match canonical `marks.secret = true` after migration 0011, **not** retired `type='secret'`. Protect RPC/service/trigger privileges and fixed search_path.
- **Evidence:** [Draft #263](https://github.com/darshitmeghani1992/the-wall/pull/263), initially failed [DB CI 45240292065](https://github.com/darshitmeghani1992/the-wall/actions/runs/45240292065) due to obsolete selector in scheduler/trigger; source fixed at `393a10a8ffa1aca0f3e07728fe5a538be6657ec9` before final documentation commit. New disposable 63 tests owner removal, restoration, outsider, active single reveal, expiry, ACLs and replay; fresh exact-head CI, independent Reviewer, actual hosted three-JWT/concurrent removal QA and founder migration approval required.
- **Rollback and safety:** Do not run 0039 on hosted staging until Two-Key and explicit environment gate. No down-migration can resurrect scrubbed content; if an activated rollout fails, disable Secret creation/reveal and use reviewed forward migration, preserving deletion evidence. Protected historical production remains out of scope. Public iPhone beta **NO-GO**.

## D-49 · 23 Nov 2026 · Absolute elapsed-time deadline for reserved C3 pre-auth body slots (held)

- **Finding:** D-48's new reservation bounds concurrent work before JWS verification, but the existing `IncomingMessage.setTimeout(5_000)` is a socket **inactivity** timeout. A peer can send a byte every few seconds to occupy a scarce pre-verification reservation indefinitely. No hosted exploitation is claimed.
- **ARCHITECT → BACKEND scope:** Bound entire pre-verification JWS body read to five elapsed seconds with a disposable/unref'd timer, destroying incomplete requests even if chunks are trickled; always clear the timer in a `finally` and let D-48's rejection path release the admission counter. Retain byte-size limit, existing idle timeout, verified JWS requirement, empty 202/404/503 response contracts and durable C2 lease authority. A real HTTP chunked slow-trickle test must prove capacity returns for valid retry. This deadline does **not** cover the time spent in cryptographic verification; that separate phase stays capacity-bounded pending independent host review.
- **Rejected:** Inactivity-only limiter (drip attack), accepting a default unlimited pre-auth read timeout, changing public authorization or adding credentials.
- **Evidence/gates:** Integrated **draft [#261](https://github.com/darshitmeghani1992/the-wall/pull/261)** stacks only the #260 C3 source and regression on #258; independent exact-head CI, Reviewer and hostile ingress/hosting QA remain required. No hosted writes, signing, deployment, activation or policy change; staging only; public Enhanced Beta remains **NO-GO**.

## D-48 · 23 Nov 2026 · Bound C3 HTTP admission before signature verification (held)

- **Trigger:** The existing C3 worker advertised an in-process maximum of 1–5 pending jobs but reserved that capacity only after the full HTTP body had been consumed and Ed25519 JWS validation completed. Simultaneous slow/forged requests could therefore bypass the bound and expend memory/crypto even when a job slot was occupied. This is a source-level exposure; no hosted incident is asserted.
- **ARCHITECT decision → BACKEND implementation:** Reserve one bounded admission slot immediately after cheap method/headers/content-length checks; return existing retryable HTTP `503` when full without reading/verifying additional requests; release reservation on invalid body/JWS (`404`) or when processing settles. Preserve successful `202` only after verification, C2 durable nonces/lease, exact staging origin, and non-hosted status. Private ingress ACL, rate controls, image sandbox and operational verification remain independently necessary.
- **Alternatives rejected:** Retain post-verification queue only (unbounded pre-admission resource use); rely exclusively on future reverse-proxy throttling (single external misconfiguration undermines local worker bounds); add a new public API status (unneeded contract change).
- **Status/gates:** [Draft #260](https://github.com/darshitmeghani1992/the-wall/pull/260) is source-only on integrated candidate #258 pinned `482eb86c464b4a09554c1882e2eb3f812d7a9d1b`, with new real HTTP regression cases. Exact-head media/security CI, independent Reviewer, runtime proof, hosted signed dispatch, private playback and Founder deployment authorization still required. No host, signing, migration, feature activation or distribution. Public Enhanced iOS beta **NO-GO**.

## D-47 · 23 Nov 2026 · Separate held iOS staging TestFlight packaging from production submission

- **Release need:** An unsigned iOS simulator smoke is insufficient for the first genuine full-feature iPhone testers. The existing `eas.json` lacked a named staging-specific store IPA profile, making later signed QA prone to using the generic `production` EAS build profile with ambiguous channels.
- **ARCHITECT decision (approved draft preparation only):** Add explicit `ios-staging-testflight` EAS build profile with `distribution: store`, channel `ios-staging-testflight`, `environment: preview`, and `ios.simulator: false`; no automatic submit. Reuse the existing hard-fail `eas-build-pre-install` validation of approved staging origin, project-bound public key, and disabled sensitive feature flags. Add a source contract and a fail-closed signed-iPhone QA/rollback runbook at `docs/qa/IOS_STAGING_TESTFLIGHT_RUNBOOK.md`. This is **not** a public release environment and does not authorize an Apple signed build.
- **Alternatives rejected:** Use the production build profile for first testers; allow public submission during preparation; copy signing credentials into GitHub/EAS public files; enable Poll/media/Secret before hosted proofs.
- **Verification:** The new profile is source/config only, requires exact-head CI for its new contract test, and future authorized Apple signing, separate QA/Reviewer, real three-actor OTP, private hosted media, Secret cron, Poll migration/permissions and deletion. **NO-GO.** No Apple credentials, EAS build invocation, Apple enrollment, TestFlight submission/invites, hosted writes, migration, feature activation or production access.
- **Rollback:** While unbuilt, remove this draft profile/branch. After independently approved signing, stop TestFlight distribution through the authorized operator; keep high-risk gates fail closed and follow reviewed forward-only backend recovery rather than destructive rollback.

## D-46 · 23 Nov 2026 · Atomically extend held permanent-account purge to private standard Polls

- **Prior authority:** Founder-approved standard 2–6-option Polls; author-controlled closing and live aggregate results; deletion of the account's ballots from open **and closed** Polls; D-13 30-day recoverable deletion; ADR-017 private Poll parent outside legacy Mark/Realtime. No new user-facing product policy selected.
- **Technical decision (ARCHITECT → BACKEND):** Add an additive, held service-only `prepare_account_deletion_for_purge_with_polls(user_id, expected_requested_at)` wrapper (0038). Within **one PostgreSQL transaction**, call the existing 0031 preparer to retain deactivation, immutable deadline, Shared-Wall ownership and avatar requirements, then erase that user's private Poll ballots, authored Poll parents and Poll retry receipts. Use FK cascades for choices/options; continue computing counts from remaining ballots, including closed Polls. Change only the unactivated deletion worker's privileged RPC name to avoid final Auth identity deletion before Poll cleanup. Fail closed until both reviewed migrations and the worker agree.
- **Alternatives:** Rely solely on Auth FK deletion (leaves Poll authored content/ballots visible after successful 0031 preparation if Auth Admin deletion fails); issue a second independent post-prepare transaction (partial erasure crash window); rewrite 0031 (unnecessary migration history risk). Rejected. Rollback before hosting: drop unused 0038 wrapper and restore worker's original RPC. After hosted approval, disable worker before rollback; never resurrect erased data.
- **Evidence and gate:** Draft [#249](https://github.com/darshitmeghani1992/the-wall/pull/249), source commit `ccb483ba18ca069794326a62140dc72952bca3c5`, disposable SQL #87 + Edge adapter check pending exact CI [45197677904](https://github.com/darshitmeghani1992/the-wall/actions/runs/45197677904). **Not independently reviewed, not staged/deployed, no irreversible account operation performed.** Founder/Reviewer/QA, hosted schema, service-worker authorization and exact-device evidence remain required.

## D-45 · 23 Nov 2026 · Give private standard Polls a first-class moderation target (draft only)

- **Problem:** Standard Poll parents are held in private `mark_polls`, not legacy `marks`. Existing Mark reports and admin removal cannot safely target them; storing a Poll UUID in `reports.mark_id` would violate FK isolation and risk bypassing moderation.
- **Decision (ARCHITECT → BACKEND/FRONTEND):** Draft migration `0037_standard_poll_moderation.sql`: additive `reports.reported_poll_id` and exclusive-target check; actor-bound SECURITY DEFINER helper for report eligibility so client RLS does not require private-table SELECT; actor-bound audited `admin_remove_poll`, idempotent on already-removed Polls; add `moderation_actions.target_poll_id`. The client reports a Poll by its dedicated target, with a fenced Poll report form and moderator action; no Poll data is passed through legacy Mark interfaces.
- **Alternatives rejected:** Reinterpret Poll IDs as ordinary Mark IDs, grant clients private Poll-table reads, or silently resolve Poll reports without taking the requested content action.
- **Verification and gate:** Draft [PR #247](https://github.com/darshitmeghani1992/the-wall/pull/247). Disposable Postgres migration/test suite and exact-tree CI must pass, followed by independent Reviewer/QA and live three-user/device checks on separately authorized staging. **No hosted migration, feature activation, merge, deployment or production contact.** Existing Apple/OTP/media/Secret/deletion and public-release gates remain NO-GO.
- **Rollback:** Before hosted apply, discard draft branch. After future approved deployment, require a reviewed forward migration/rollback that preserves existing report and moderation audit history.

## D-44 · 23 Nov 2026 · Lock prepared irreversible deletion worker to approved staging origin

- **Risk (ARCHITECT → BACKEND):** The account-deletion adapter's former HTTPS-only URL check accepted any Supabase project root. A future privileged scheduler configured with the wrong project URL/credential could address an unapproved environment, including the protected original; no deployed deletion worker or observed incident is claimed.
- **Technical decision:** In the unactivated staging candidate, permit only exact `https://ewintxgdxdvschiqodkq.supabase.co` with optional trailing slash before constructing the privileged adapter. Fail closed on foreign/ambiguous origins regardless of credentials; no feature toggle or secret can override. The separately approved public beta environment will require its own reviewed source/origin binding and release authorization rather than silently reusing this staging-only implementation.
- **Gate:** [Draft #210](https://github.com/darshitmeghani1992/the-wall/pull/210), source `edb1a74999927c4f568ecf5e1d19484dd5828ffe`. Disallow original production access. Migration 0031, retention/legal decisions, deployed purge worker, irreversible deletion, independent Reviewer/QA, runtime rollback and Founder approval all remain pending. No SQL/hosted write, merged implementation or deletion activation occurred. **NO-GO.**

## D-43 · 23 Nov 2026 · C3 worker executable is staging-only until separately approved release origin

- **Risk (ARCHITECT → BACKEND):** Media gateway adapters validate the Supabase hostname shape and signed dispatch, but the container entrypoint accepted any well-formed Supabase project origin. With media ever enabled, a misdirected worker could attempt privileged processing against the historic production or an unapproved project; this is a deployment-misbinding risk, not evidence of prior exploitation.
- **Technical decision:** This staging candidate's `startWorkerRuntime` enforces an immutable exact staging origin (optional root slash) **before** network work or listener startup. Accept no production or other environment by default. A public open beta release backend must have its own explicitly authorized and independently reviewed origin binding/code and cloud deployment, not an environment-variable-only accidental cutover. Preserve all existing feature flags and security controls OFF.
- **Status:** [Draft #198](https://github.com/darshitmeghani1992/the-wall/pull/198), source tests and CI/Reviewer/QA pending. No hosted or distribution changes. Separate [ARM64 image proof](https://github.com/darshitmeghani1992/the-wall/actions/runs/45129237153) passed on sibling #195, **not** an approved runtime image or deployment. **Enhanced/open beta NO-GO.**

## D-42 · 23 Nov 2026 · Alert route references must be canonical UUIDs

- **Risk (ARCHITECT → FRONTEND):** Alert route interpolation previously accepted any non-empty actor, Wall or focused Mark value. Real notification table IDs are UUID typed, but stale/corrupted externally rehydrated metadata could produce unintended nested paths or query components.
- **Implementation constraint:** Reject malformed actor destinations to Discover, malformed Wall/owner destinations to Alerts, and omit malformed focused-Mark identifiers while keeping an otherwise valid Wall path. Preserve valid UUID routes, explicit fallback and server-side RLS as authorization source; don't infer an exploit from this defensive change.
- **Status:** [Draft #181](https://github.com/darshitmeghani1992/the-wall/pull/181) source/test `ca46dbbdb3b07ca0b6f9552d799ff405867a1703`; exact CI, separate Reviewer and installed-device QA are required. No API/schema/UX scope change, no hosted mutation, no merge. **Enhanced Beta NO-GO**.

## D-41 · 2026-11-22 · Failed Auth session restoration must not hang or expose unreconciled destination state

- **Risk:** A rejected initial `auth.getSession` or deferred destination reconciliation skipped existing loading-finalization code, leaving indefinite splash. A later Auth event error could do likewise.
- **Decision (ARCHITECT → FRONTEND):** Convert thrown/result Auth bootstrap errors into a fail-closed signed-out re-auth route, not a success or infinite loading state. Begin an `AccountRouteFence` token *before* the first identity-dependent await, and ignore stale rejected bootstraps/events after account change (including A→B→A). Invalidate the failed subject marker and route fence before fail-closed navigation so same-user token refresh cannot bypass reconciliation. Preserve deferred destination ownership barriers; never surface an unverified signed-in route.
- **Status:** Source/test draft child of #173; exact CI and independent Reviewer and mounted-device/offline QA required. No Product scope/schema change, hosted writes or merge. **Enhanced Beta NO-GO.**

## D-40 · 2026-11-22 · Successful reaction-summary batches authoritatively clear missing IDs

- **Trigger:** Aggregating `mark_reactions` omits zero-row Marks; a partial/empty successful batch merged by present IDs could leave a removed reaction visibly counted after background/foreground retry.
- **Decision (ARCHITECT → FRONTEND):** Reconcile all *requested* IDs against each successful batch result. Missing IDs become independent `{counts:{}, mine:null}` objects, after existing session, mutation-lease and read-epoch gates. Ignore unrequested IDs. Treat rejected/network-failed batches as retryable failures, not authoritative empty data. No API/schema, UX or security-contract change.
- **Status:** [Draft #173](https://github.com/darshitmeghani1992/the-wall/pull/173), pure regression tests plus source; CI and independent Reviewer/behavioral QA required for final SHA. Staging-only; no merges or hosted writes. Enhanced Beta **NO-GO**.

# The-Wall Decision Log

## D-39 · 2026-11-22 · Reaction offline retry on app foreground
- **Trigger:** Failed initial reaction-summary requests abandon claim leases but may never retry when their `marks` and `userId` dependencies stay unchanged as the user returns from offline/background.
- **Decision (ARCHITECT → FRONTEND):** Use built-in React Native AppState (no new dependency); on inactive/background→active, invalidate older reaction read epochs, clear tracker claims and trigger a fresh visible-Mark batch without clearing pending mutation leases. Preserve fail-closed actor/session epoch guards. No claim to detect connectivity changes while app remains active.
- **Status:** [Draft #172](https://github.com/darshitmeghani1992/the-wall/pull/172), source+contract tests; full unchanged-head CI/independent Reviewer/device QA required. Staging-only, no hosted writes/merges/deployments. **Enhanced Beta NO-GO**.

## D-38 · 2026-11-22 · Prevent stale reaction reads from overriding later user intent
- **Trigger:** Initial batch reads and realtime refreshes can resolve out of order after an optimistic reaction tap; a user-ID-only guard cannot detect account A→B→A session replay.
- **Decision (ARCHITECT → FRONTEND):** Use a per-Mark read epoch incremented on each reaction mutation, plus a session epoch across account changes, for both initial batch and single-Mark result application. Ignore reads from older epochs or during an active reaction lease. Refresh server truth after releasing the exact settled lease; failed writes still roll back immediately when offline. This is a reversible client correctness fix within the approved reaction UX, not an authorization replacement or new product behavior.
- **Status:** [Draft #171](https://github.com/darshitmeghani1992/the-wall/pull/171), CI on unchanged final SHA and independent Reviewer/device/offline/three-actor QA required. Media/Secret/analytics OFF; staging only, no hosted writes, migrations or release actions. **Enhanced Beta NO-GO.**

## D-37 · 2026-11-22 · Reaction client mutations must be bound to the initiating actor and confirm deletes
- **Trigger:** `setReaction` and `removeReaction` used whichever signed-in user `auth.getUser()` resolved after a tap; an account transition could redirect an otherwise valid reaction to a replacement account. Removal returned success while signed out and treated RLS-denied/absent rows as successful, undermining honest optimistic feedback.
- **Decision (ARCHITECT → FRONTEND):** Reuse existing `requireExpectedActor` with the initiating `userId` on add and remove, after server Auth resolution; short-circuit optimistic hook reactions when the user changed or signed out. Use PostgREST `DELETE ... RETURNING mark_id` and reject missing/mismatched rows. On failed optimistic writes, restore the last confirmed pre-tap summary immediately even when offline; a bounded per-Mark mutation lease suppresses double taps and stale actor completion, then try a best-effort resync. This is client resilience, not proof of persistence until runtime verifies the write. Preserve database RLS as authoritative; this is a UI/client identity race guard, not an authorization grant.
- **Status:** Isolated [draft #170](https://github.com/darshitmeghani1992/the-wall/pull/170), contract regressions and full source CI required; independent Reviewer and real actor-switch/devices/HTTP QA remain blocked. No schema, hosted writes, production, merge/deploy, media/Secret activation, domain/Apple actions. **Enhanced Beta NO-GO.**


## D-36 · 2026-11-22 · Preview build pre-install must reject unverified high-risk feature flags
- **Trigger:** A staging-targeted EAS preview could still be built when inherited public variables indicated that media, Secret or account deletion were enabled, although the hosted processor, cron and permanent-delete lifecycle remain unverified. UI hard-holds in D-35 prevent activation, but the build configuration should not misrepresent release readiness.
- **Decision (ARCHITECT → BACKEND):** Reject `EXPO_PUBLIC_MEDIA_MARKS_ENABLED`, `EXPO_PUBLIC_SECRET_MARKS_ENABLED` or `EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED` when equal to `true` at the existing EAS pre-install guard; preserve staging-origin/client-key checks and sanitized logs. `false`/unset leave the guard eligible. This is defense-in-depth, not a substitute for server authorization or independent source/device QA. Any subsequent activation still needs Founder, Reviewer and QA gates.
- **Status:** Isolated child of #168 with Node spawn regression tests; no signing, source merge, hosted changes or release. **Enhanced Beta NO-GO**.


## D-35 · 2026-11-22 · High-risk beta creator capabilities cannot be enabled by public build flags alone
- **Trigger:** The media, Secret and deletion UI helper functions accepted the string `true` from `EXPO_PUBLIC_*` even though C2/C3 processor/playback, one-hour Secret cron and account-deletion migration 0031/purge are not independently proven in staging. An inherited EAS environment could inadvertently advertise these unavailable irreversible/privacy-sensitive user journeys.
- **Decision (ARCHITECT → FRONTEND):** Freeze the three *client-facing capability helpers* OFF for this private-beta candidate regardless of build environment. Require an explicit new reviewed source revision after the existing Founder/backend/runtime/QA gates to activate. Preserve server-side permission boundaries; hiding a composer is not security certification or a substitute for actual account deletion before TestFlight/App Store.
- **Scope/Gates:** Isolated child of #167, six scoped modules/tests; source CI and independent device/Reviewer/QA remain pending. All original production, hosted write, migration, merge/deploy, SMTP, domain and Apple holds unchanged. **Enhanced Beta NO-GO.**


## D-34 · 2026-11-22 · OAuth provider availability cannot cross redirected origin boundary
- **Trigger:** The Auth settings availability fetch included a public `apikey` but accepted default browser/native fetch redirects. That could expose the app's staging key to a redirected host or enable unapproved provider buttons from that response even when the intended Supabase Auth endpoint is unavailable.
- **Decision (ARCHITECT → FRONTEND):** Set `redirect: "error"` and `method: "GET"` on the `/auth/v1/settings` provider probe, retaining all-error `noOAuthProviders` behavior. No new OAuth provider is enabled. Test mock redirect rejection and request options. **No client credential is secret**, but client access and capability discovery must still respect the approved origin. Review actual installed-device traffic before release.
- **Implementation:** [Draft #167](https://github.com/darshitmeghani1992/the-wall/pull/167), source/test only plus checkpoint docs; independent Reviewer/device QA and real Google/Apple settings still required. Existing staging-only/Apple/domain/privacy holds remain.


## D-33 · 2026-11-22 · Optional telemetry is hard-disabled in the Enhanced Beta client
- **Trigger:** Even though the private beta approval required optional analytics OFF, the client-side `analytics.ts` automatically instantiated the PostHog SDK when `EXPO_PUBLIC_POSTHOG_KEY` was set; inherited EAS variables could activate collection without an explicit privacy sign-off.
- **Decision (ARCHITECT → FRONTEND):** Make `track` and `identify` no-ops with no import/initialization of any third-party tracking SDK in the Enhanced Beta client. A key or build variable alone must not enable telemetry. Restore collection only under a separate Founder product/privacy approval and independent Reviewer/QA with event/identity/consent, bundle, network and policy evidence.
- **Implementation:** Draft [#166](https://github.com/darshitmeghani1992/the-wall/pull/166), scoped to `src/lib/analytics.ts` + `tests/frontend-analytics-privacy-hold.test.mjs`; no hosted changes or flags. **Not** device-verified/independently certified. Existing D-22/D-14 staging-only and release holds stay in force.


## D-32 · 2026-11-22 · An anonymous HTTP denial alone cannot certify the private-Wall RLS predicate
- **Trigger:** The seventh read-only private-Wall check counted HTTP 401/403 as proof of anonymous non-visibility. A valid RLS filter might instead return HTTP 200 with `[]`; 401/403 may originate at a gateway, API key validation or table-level grant denial, without exercising the Wall RLS predicate. Merely removing an invalid publishable Bearer in D-31 does not eliminate this ambiguity.
- **Decision (ARCHITECT sequencing → BACKEND harness):** On the existing publicly readable `walls` SELECT endpoint with a valid staging public key, require HTTP 200 with exact empty JSON array for the seventh anonymous private-Wall check. Treat 401/403 as **inconclusive/NO-GO**, not privacy-pass; reject 3xx/5xx, invalid JSON and nonempty results. This does not grant anyone access or adjust production/staging schema. The existing 3 server-verified actor JWT checks are mandatory before the anonymous check.
- **Fresh staging SQL evidence (read-only, 22 Nov):** `public.walls` has RLS enabled; `anon` table SELECT privilege is **true**, but the single deployed `walls view canonical` SELECT policy applies to `authenticated` only. A valid anonymous PostgREST GET should therefore return 200 `[]` by RLS default-deny; this is not evidence of a tested real private-Wall fixture (0 Auth users, 0 Walls). Distinguish historical migration 0001 from deployed canonical policy.
- **Alternative:** Accepting 401/403 as a secure access denial remains valid for a broader *HTTP denial* assertion but is insufficient for the specifically claimed *RLS policy execution* result. If the staging `anon` role intentionally cannot SELECT `walls`, obtain an independent policy/grant review and document that separately; never manufacture RLS evidence.
- **Gates:** [Draft #165](https://github.com/darshitmeghani1992/the-wall/pull/165) code/tests only. Exact final-head CI, independent Reviewer, genuine authorized three-JWT HTTP/SQL and unchanged candidate device QA needed. Original production protected; no writes/merges/deployments/provider enrollment. **Enhanced Beta NO-GO.**


## D-31 · 2026-11-22 · Separate modern publishable API key from a user JWT on anonymous staging checks
- **Trigger:** Read-only preflight and the seventh private Shared Wall HTTP negative check used `Authorization: Bearer sb_publishable_...` on unauthenticated requests. Supabase's modern publishable keys are not JWTs; an invalid-JWT 401 might be incorrectly counted as private RLS denial, rather than checking the `anon` database role. See https://supabase.com/docs/guides/getting-started/api-keys and https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys.
- **Decision (BACKEND, architect sequenced):** For modern publishable-key anonymous read-only calls, use `apikey` only. Preserve `Authorization: Bearer <legacy anon JWT>` for verified legacy public keys, and use the actual verified actor JWT as Bearer on authenticated calls. Keep exact staging origin and redirect rejection, table/response checks, approval gates and no-secret logging unchanged.
- **Gates:** Draft #164 source+mock tests only. A green CI badge never certifies true hosted anonymous RLS or three-user access control; independently review, run authorized real HTTP and SQL checks, and hold media/Secret/deletion/Apple/domain/production gates. **Enhanced Beta NO-GO.**


## D-30 · 2026-11-22 · Treat public-anonymous private-Wall access as a distinct HTTP denial gate
- **Trigger:** The opt-in staging three-JWT audit proved (when genuinely executed) authenticated owner/member access and outsider isolation but omitted a separate anonymous public-key read of the same private Shared Wall.
- **Decision:** Require one additional GET using only a staging public anon/publishable key, exact private Wall filter and no redirect; accept a 401/403 or RLS-filtered empty 200 array, fail on any row, malformed 200 response or unexpected HTTP status. The prior three authenticated identities must first pass real Auth HTTP identity checks.
- **Scope/Gates:** Draft #163 BACKEND harness/test only, no real user fixtures, hosted writes, network credentials, auth permission changes or beta GO. Source tests/green CI are not independent hosted JWT/RLS verification, Reviewer signoff or QA.


## D-29 · 2026-11-22 · Require a present, locked-OFF Secret rollout singleton before disabling expiry cleanup
- **Trigger:** The #161 unschedule runbook checked whether any rollout row was enabled but did not require a row to exist or prevent a concurrent administrative update to enabled=true between validation and unschedule.
- **Decision:** Preserve first-stage independent creation-disable commit, explicitly refuse a missing/invalid disabled singleton in both stages, and acquire a write-conflicting lock on the rollout table throughout final payload/job checks and cron shutdown. A missing row is NOT proof of disabled creation.
- **Scope/Gates:** #162 draft only; a structural runbook/test update without execution. Requires disposable Postgres/pg_cron race QA, independent security Reviewer and Founder/operator approval before any scheduled cleanup operation. All other beta NO-GO gates and staging-only protection unchanged.


## D-28 · 2026-11-22 · Secret scheduler shutdown requires confirmed empty payload backlog
- **Trigger:** Old operator unschedule file disabled new Secret creation then stopped the cleanup job even when one-time payloads remained, contrary to the one-hour deletion guarantee.
- **Decision:** Keep the creation flag OFF independently and refuse shutdown unless an explicit transaction obtains concurrent write locks, confirms zero rows in `mark_secrets`, validates exactly one intended cron job, and confirms creation disabled. Keep cron running on any safety failure; never force-delete pending data merely to pass this gate.
- **Constraints:** Draft #161 only; no live SQL, hosted migration, Secret activation or irreversible action. Require independent security Reviewer, disposable DB + cron concurrency QA and Founder operational release gates before usage. Existing Secret OFF and all other Enhanced Beta NO-GO conditions unchanged.


## D-27 · 2026-11-22 · HTTP preflight never follows redirects carrying public API credentials
- **Trigger:** The staging-only preflight issued Auth/REST requests with the `apikey` header but retained default fetch redirect-follow, unlike the independently prepared three-JWT harness. Unexpected 30x responses may lead to additional outbound requests outside approved staging.
- **Decision:** Set `redirect: 'error'` for every credential-bearing staging preflight GET; 302 and thrown redirect failures are NO-GO. Keep exact approved origin validation, public-key checks, and private table negative gates; no new endpoint or hosted permission change.
- **Verification/gates:** New draft #160 BACKEND source and regression tests; exact final SHA CI, independent security Reviewer, staging read-only and device QA remain required. Original production protected; media/Secret/analytics OFF.


## D-26 · 2026-11-22 · EAS/preflight accept only Supabase public API key formats accepted by runtime
- **Trigger:** #158 closes a runtime Expo credential leak, but `validatePublicClientConfig` and EAS CLI still accepted opaque strings that runtime explicitly rejects. This produces an unusable/broken beta build while reporting EAS configuration success and risks sending unrecognized credentials in read-only HTTP probes.
- **Decision:** Fail closed on noncanonical keys at the shared Node validation entrypoint: accept modern `sb_publishable_*` and legacy JWT-shaped public key only; require exact staging project and `role=anon` for legacy credentials before any HTTP. Preserve staging-only origin and existing secret-key bans; print no secret values. Align EAS and preflight contract fixture keys accordingly.
- **Alternatives:** Keep accepting opaque keys (inconsistent and potentially unsafe); rely on Expo runtime to reject (too late after packaging).
- **Gates:** Draft #159 (BACKEND) with unit/mocked no-network/no-log tests; exact CI and independent security review plus EAS/device QA needed. No hosted config, provider, auth, migrations, original production or deployment changed.


## D-25 · 2026-11-22 · Validate legacy public JWT role/project in local runtime before Supabase client creation
- **Trigger:** #155–#157 guard EAS builds, read-only staging probes and the 3-JWT audit; #156's Expo runtime gate only checked staging URL and obvious modern `sb_secret_*`. Local Metro/alternative builds bypass EAS hooks and could bundle or forward a privileged or foreign legacy JWT.
- **Decision:** Keep staged runtime config accessible only for exact approved staging host and keys of two known public formats: `sb_publishable_*`, or legacy JWT locally decoded (portable bounded base64url UTF-8) with `role=anon` and `ref=ewintxgdxdvschiqodkq`. Fail closed on unknown, malformed or privileged keys. This is a local consistency check **not signature verification**; backend must still validate every JWT and read-only probes must prove connectivity. Same `selectBetaClientConfig` API, no OAuth/hosted/policy/feature change.
- **Alternatives:** Allow opaque keys (unsafe); depend solely on EAS (bypassable outside EAS); introduce Node Buffer/atob polyfill inside Expo (unnecessary dependency/platform risk).
- **Reversibility / gates:** Small reversible frontend-only runtime guard and fake-credential unit tests, draft #158, independent Reviewer + installed-device QA required. Production enablement is a separate Founder decision; never weaken this in an unrelated PR. No live credentials or hosted writes.


## D-24 · 2026-11-22 · Add runtime staging origin guard for client outside EAS
- **Trigger:** EAS pre-install and read-only staging preflight now enforce the approved project, but `src/lib/config.ts` previously exported arbitrary EXPO_PUBLIC URL directly to `createClient`. A local Expo or non-EAS start could accidentally use the original production origin.
- **Decision:** For the held staging-only beta, select Supabase runtime client settings only for `https://ewintxgdxdvschiqodkq.supabase.co`, allowing a trailing slash; otherwise export undefined so the existing inert localhost fallback is used. Refuse modern `sb_secret_*` in the client runtime. Keep the stronger legacy JWT role/ref validation before EAS builds and HTTP preflight, and do not misrepresent the client-side filter as complete legacy-key validation.
- **Alternatives:** Rely only on EAS lifecycle hook (rejected, local Metro can bypass); auto-rewrite arbitrary origins (rejected, may hide misconfigured environments); touch original production (prohibited).
- **Reversibility/gates:** Reversible staging-only client code and regression tests, draft #156, no hosted writes. Requires independent security Reviewer and runtime QA prior to release. Future production enablement needs an explicit separate authorized release decision, not removal of the guard as a side effect.


## D-23 · 2026-11-22 · Fail closed on privileged Supabase keys in all preview clients and probes
- **Trigger:** Release train is staging-only. EAS and preflight accepted a nonempty key without rejecting modern `sb_secret_*` or, on the read-only preflight path, privileged/mismatched legacy role-bearing JWTs. Unsafe keys must not be bundled, logged, or sent over the network even for read-only checks.
- **Decision:** Enforce public-key-only client settings: block `sb_secret_*` at common config validation and check legacy JWT role `anon` and exact approved staging project reference before any preflight HTTP. Preserve approved staging-only hostname from PR #153. Source-only changes staged in draft PR #155. Never print key values or URLs on EAS failure.
- **Alternative rejected:** Rely exclusively on server enforcement or read-only intent to tolerate service-role/secret credentials; doing so could disclose a high-privilege key in a distributed Expo binary or CI request headers.
- **Reversibility / gate:** Easily reversible test+tooling code, but weakening it would need explicit authorized environment and security review. No live credentials read or changed, no new provider/Auth/hosted policy. Independent Reviewer and QA, CI and release authorization remain required.


## D-22 · 2026-11-21 · Stage real-JWT privacy smoke without creating accounts or leaking tokens
- **Purpose:** BETA-P0-04 distinguishes synthetic SQL role tests from actual authenticated HTTP JWT boundary checks. Pre-existing authorized staging accounts are required; current staging has none.
- **Decision:** Build a **read-only**, opt-in Node test utility that verifies three distinct actor IDs via Auth `/user` and checks private Shared-Wall visibility for owner, permitted member and unrelated outsider using six GETs. Hard-code only the approved staging host; reject original production, missing opt-in, repeated actors, 401s, unexpected visibility; never log tokens or response bodies. Mock it in ordinary CI with zero credentials.
- **Boundaries:** Does not create/modify accounts, invoke migrations, test mutation RPCs, send OTP or assert full three-user QA. Credential management stays with authorized runtime, not PR secrets or chat. Higher-risk follow-up real JWT tests and independent review still required. Rollback is removal of the source-only utility.


Meaningful technical decisions. Trivial choices are omitted (§94). Format:
date · decision · reason · alternatives · reversibility · Founder Gate?

---

## D-15 · 2026-11-21 · Separate definer catalog exposure from per-caller security verification
- **Decision:** For BETA-P0-04, inventory staging `public` SECURITY DEFINER routines by effective `anon`/`authenticated` `EXECUTE` grants, separate trigger-only functions from directly invokable RPCs, and track individual `auth.uid()` guard checks. Catalog metrics are **read-only triage evidence**, not proof of secure function behavior or successful hosted authenticated HTTP denial.
- **Evidence and reason:** `ewintxgdxdvschiqodkq` query returned 113 SECURITY DEFINER functions, 0 `anon` callable, 59 `authenticated` executable (33 direct functions + 26 trigger-returning), 54 internal-only, 0 missing explicit `search_path`. All 33 direct routines contain `auth.uid()` text. The former blanket '59 risky definer functions' label conflated ordinary SQL RPC endpoints and trigger functions and could lead to unsafe blind revocation.
- **Alternatives:** Blanket REVOKE (rejected without caller/trigger audit); automatically classify `auth.uid()` reference as authorization proof (rejected); skip real three-actor JWT tests in favor of catalog SQL (rejected).
- **Reversibility:** Reversible documentation methodology only. **Founder Gate?** No for this read-only audit; **yes** for unapproved hosted grant/schema/function changes and releases. No roles, grants, flags or production data changed.
- **Next:** source/body/callsite trace for each exposed RPC, reviewed code tests for confirmed defects, independent Reviewer + QA using hosted JWT actors and migration-safe rollout. See `docs/handoffs/STAGING_DEFINER_CALLER_TRIAGE_2026-11-21.md`.

## D-14 · 2026-11-21 · Single tracked first-beta release train and exact-SHA evidence
- **Decision:** Use `docs/BUILD_STATUS.md` as the single resumable development queue and issue #57 as its linked human-facing tracker. The first-beta scope is explicitly expanded through Enhanced Beta; a controlled text-first source candidate is only an **internal certification checkpoint**. Complete photo/voice/video and Secret runtime verification before any final first-beta GO. Keep domain/DNS and Apple Developer enrollment/signing held per Founder; no implication that SMTP delivery can be skipped.
- **Reason:** A linear set of unmerged draft PRs and multiple older checkpoint documents have allowed stale source/status claims. The latest source line descends from #30; CI #221 succeeded for #58, but independent review and E2E/device/hosted requirements remain open.
- **Alternatives:** Treat `main` or an older September status percentage as current (rejected); mark feature-flagged media and Secret functionality complete (rejected); merge the entire long stack without independent review (rejected).
- **Reversibility:** Documentation and sequencing only; reversible. No role charter, Constitution, schema, prod environment or feature-flag modification. **Founder Gate?** This decision records explicit Founder sequencing and does not grant permission to merge/deploy, mutate hosted state, create accounts or activate unfinished features.
- **Process:** Every task records role, acceptance criteria, dependency, evidence, blocker, next action; every certification binds exact SHA and staging runtime. Changing source invalidates earlier SHA CI/Review/QA where affected.


## D-0 · 2026-08-20 · Verify the security layer against a real Postgres each session
- **Decision:** Run `supabase/tests/run_tests.sh` against a locally-initialized Postgres 16
  cluster (server binaries are present in the environment) as the standard QA/Security gate,
  instead of leaving RLS "Believed-likely / hosted not run."
- **Reason:** The kickoff mandates adversarial security testing and Two-Key QA. A real DB
  turns RLS/anonymity/secret/membership claims from *believed* into *verified*.
- **Alternatives:** Docker Postgres (daemon unavailable here); hosted Supabase (needs Founder
  credentials — a Gate); static review only (insufficient for a security gate).
- **Reversibility:** Fully reversible (test-only infra).
- **Founder Gate?** No.

## D-1 · 2026-08-20 · Complete Secret lifecycle via migration 0010 + a gated reveal RPC
- **Decision:** Implement Master Spec §27.3/§27.4/§68 as an additive migration `0010`:
  add `expires_at` (default now()+1h) and `opened_at` to `mark_secrets`; add a
  `SECURITY DEFINER` `reveal_secret(uuid)` RPC that (a) authorizes the caller as the wall
  owner/recipient, (b) performs a single atomic `UPDATE … WHERE opened_at IS NULL AND now()
  < expires_at RETURNING content`, and (c) classifies failure as `consumed` / `expired` /
  `not_authorized` / `missing` without leaking content. **Revoke** direct `SELECT` on
  `mark_secrets` from `authenticated` so all reads go through the one-time RPC (a retained
  direct SELECT would defeat one-time reveal). Add `expire_secret_marks()` cleanup fn for a
  scheduled job.
- **Reason:** One-time reveal must be **server-atomic** (spec: "do not rely on client-only
  flag"; two simultaneous reveals must not both succeed). A row-locked conditional UPDATE is
  the simplest correct primitive; `RETURNING` gives content only to the single winning caller.
- **Alternatives:** Client-side "opened" flag (rejected — spoofable, not atomic); advisory
  locks (heavier, unnecessary); trigger-based consume (less legible than one gated RPC).
- **Reversibility:** Additive/idempotent migration; reverting means dropping the columns/fn
  and restoring the SELECT grant. Reversible pre-hosted-apply.
- **Founder Gate?** No for code; **hosted apply is a destructive-production Gate** (unchanged).

## D-2 · 2026-08-20 · Distinct `expired` vs `consumed` reveal states (not a single "gone")
- **Decision:** `reveal_secret` returns `jsonb {ok, reason, content?}` so the client can show
  §111's *specific expired state* separately from *already opened*.
- **Reason:** Spec §111 wants a specific expired message; distinguishing costs one extra
  classify query and leaks nothing (content only ever returned on `ok`).
- **Reversibility:** Reversible (return-shape only).
- **Founder Gate?** No.

## D-3 · 2026-08-20 · Reads of `mark_secrets` are RPC-only for clients; moderation stays direct
- **Decision:** After 0010, `authenticated` has **no** direct table privilege on
  `mark_secrets`; the client uses only `reveal_secret`. `service_role` keeps its explicit
  `SELECT` grant for the moderation read path (§53). The now-moot owner SELECT policy is
  dropped for clarity. Existing `60_secret_marks.sql` owner/non-owner reads are updated to
  the RPC path; new `61_secret_reveal.sql` proves the lifecycle.
- **Reason:** One-time reveal is only real if the content cannot be re-read out-of-band.
- **Reversibility:** Reversible (re-grant + re-add policy).
- **Founder Gate?** No.

## D-4 · 2026-08-20 · Reconciliation posture — Master Spec wins over prototype Mark types
- **Decision:** The obsolete prototype Mark types (`roast`, `award`, `poll`, `doodle`,
  `prediction`) and the "pick a type" composer conflict with §4 (excluded: games/doodles)
  and §21 (single integrated composer; Secret/Anonymous are modes, not types). They are
  **flagged for reconciliation** (BUILD_STATUS Reconciliation Debt) and will be collapsed to
  the integrated composer in a following frontend slice — **not** touched in the same commit
  as the high-risk Secret DB change, to keep the Two-Key security diff minimal and reviewable.
- **Reason:** Authority order (§1) puts the Master Spec above existing code; but sequencing a
  large frontend refactor separately from a security migration keeps each diff auditable.
- **Reversibility:** Reversible (product/UI).
- **Founder Gate?** No (engineering sequencing, §89). Visual result later merits Founder QA.

## D-5 · 2026-08-20 · Secret is an orthogonal mode; canonical Mark types are text/photo/voice/video (migration 0011)
- **Decision:** Retire the prototype Mark *types* (sticky/roast/award/poll/doodle/prediction)
  from the app; the canonical content types are text/photo/voice/video, and Secret (like
  Anonymous) is a boolean MODE that can apply to any of them. Migration 0011 adds the enum
  values + `marks.secret` and repoints the extract trigger, F1 CHECK, and expiry cleanup from
  `type='secret'` to the flag. Legacy enum values remain (Postgres can't drop them) but are
  unused.
- **Reason:** Master Spec §21 (single integrated composer, no type-picker), §27 ("any
  supported Mark may be Secret"), §4 (games/doodles excluded). The flag is safe on the
  realtime row — content still lives only in `mark_secrets`.
- **Alternatives:** Rebuild the enum (destructive column swap — rejected); keep `secret` as a
  type (breaks orthogonality with photo/voice/video — rejected).
- **Reversibility:** Additive/idempotent migration; pre-hosted-apply. **Founder Gate?** No
  (product behavior already fixed by the Master Spec); hosted apply remains a deploy Gate.

## D-6 · 2026-08-20 · Voice/Video reuse the existing `attachments` bucket (no new storage surface)
**Status:** Superseded by ADR-012 for all Mark media. Public `attachments` remains only for the
explicit non-Mark uses retained by that architecture.

- **Decision:** Voice + Video media use the already-verified public, path-scoped `attachments`
  bucket (ADR-006/0003) under `marks/<wallId>/…`, exactly like photos — no new bucket, policy,
  or migration. Client enforces per-kind byte caps + a MIME allowlist; server-side bucket
  limits (`file_size_limit`/`allowed_mime_types`) are a hosted-config hardening task.
- **Reason:** Reuse the verified protection model rather than open a new storage security
  surface; Secret media (which would need signed URLs) does not exist yet (Secret is text-only).
- **Reversibility:** Fully reversible (client + config). **Founder Gate?** No.

## D-7 · 2026-08-20 · expo-av for voice recording + audio/video playback
- **Decision:** Use `expo-av` (~14.0.7, SDK 51) for mic recording and audio/video playback;
  video capture via `expo-image-picker` with a 30s cap. Mic permission requested on first
  record only (never during onboarding — §24).
- **Reason:** First-party Expo module already in the managed workflow; minimal new surface.
- **Alternatives:** expo-video/expo-audio (newer, not in SDK 51's stable set) — deferred.
- **Reversibility:** Reversible (dependency). **Founder Gate?** No.

## D-8 · 2026-08-20 · Mark-lifecycle rules are trigger/RLS-enforced, not client-trusted (migration 0012)
- **Decision:** Enforce §32 (sender 10-min edit/delete window) and §33 (owner normal-removal
  quota 3/30d, safety unlimited) in the DB: the `marks_guard_moderation` BEFORE-UPDATE trigger
  rejects late author edits (`MARK_EDIT_WINDOW`) and over-quota normal removals
  (`MARK_REMOVAL_QUOTA`) and stamps `removed_by`/`removed_at`; the DELETE RLS policy is
  author-only within the window. The owner's 0001 hard-delete path is removed so removal can't
  bypass the quota. Removal reason is `normal`/`safety`/`moderation`; safety/moderation are
  never limited.
- **Reason:** These are API-abuse vectors (§100 "sender edit after 10 min", "remove Mark quota
  bypass") — client checks are insufficient; server time is authoritative.
- **Alternatives:** Client-only gating (rejected — bypassable); a bypassable RPC for removal
  (rejected — owner could UPDATE directly); an `editable_until` column (redundant with
  created_at + a fixed window).
- **Reversibility:** Additive/idempotent migration; pre-hosted-apply. **Founder Gate?** No
  (fixed product rule); hosted apply remains a deploy Gate.
- **Follow-up:** the owner Mark-removal / sender edit **UI** (a Mark detail/action sheet, §30)
  is a separate frontend slice; the data layer (`removeMark`/`editMarkText`/helpers) is ready.
  MVP treats a `safety` reason as owner-asserted; linking it to an actual report/block to
  prevent gaming is a later hardening.

## D-9 · 2026-08-21 · Account deactivation gates the two RLS chokepoints, not the profile row (migration 0013)
- **Decision:** Implement §82 deactivation by adding `profiles.account_status`/`deactivated_at`
  + `is_active_account(uid)` and gating the existing `can_view_wall`/`can_contribute` SECURITY
  DEFINER functions and the friendships-insert policy — NOT by hiding the profile row. A
  deactivated account's PERSONAL wall becomes non-viewable/non-contributable, the account can't
  contribute anywhere or be friend-requested, and it's excluded from people search. SHARED
  walls it owns stay accessible to members (gate is personal-wall-only). Self-service
  `deactivate_account()`/`reactivate_account()` RPCs (self-only) stamp `deactivated_at`.
  **Correction (2026-09-15, migration 0027):** the zero-argument
  `deactivate_account()` surface is retired and non-callable by API roles. Clients use
  `deactivate_account(p_expected_actor_id uuid)`, which compares the expected account with
  the request token's `auth.uid()` in the same authoritative transaction. Reactivation is
  unchanged.
- **Reason:** Hiding the profile row would break author display on existing Marks. Gating the two
  chokepoints (already the tested centre of visibility/contribution) keeps blast-radius minimal
  and the SEC-001 suite as the regression guard. Shared walls aren't gated on owner-active
  because deactivation is reversible and members must keep access; Shared-Wall ownership is
  handled at FINAL deletion (§43/§82).
- **Alternatives:** RLS on `profiles` SELECT to hide deactivated rows (breaks Mark authorship —
  rejected); a dedicated `deactivations` table (more surface, no benefit — rejected).
- **Reversibility:** Additive/idempotent migration; pre-hosted-apply. **Founder Gate?** No for
  code; the hosted 30-day purge job (hard delete + ownership transfer) is a deploy Gate.

## D-10 · 2026-08-21 · Follow edges are world-readable (public), not just aggregate counts (migration 0014)
- **Decision:** The `follows` table's SELECT policy is `using(true)` — the full follow
  edge-list (who follows whom) is world-readable, not only the aggregate follower/following
  counts §106 declares public. `getFollowCounts`/`isFollowing` read it directly.
- **Reason:** Following is defined (§3.3/§17) as a one-way relationship to keep up with a
  **public** Personal Wall — an inherently public act, matching the standard public-social
  model and the repo's existing world-readable `profiles`. Blocked-pair edges never persist
  (the `blocks_remove_follows` trigger tears them down), so no blocked relationship leaks.
- **Alternatives:** Count-only-public via a SECURITY DEFINER `get_follow_counts(uid)` RPC plus a
  SELECT policy narrowed to the viewer's own edges — deferred; adopt if Product later wants the
  follow graph private. (Reviewer flagged this as a Product scope-flag, not a security defect.)
- **Reversibility:** Reversible (swap the SELECT policy + add the RPC). **Founder Gate?** No —
  the spec is silent on edge visibility and no §81 privacy promise (private wall/anon/secret/
  private membership) is weakened; edges are for public walls only.

## D-11 · 2026-08-22 · Admin capability via is_admin flag + DEFINER RPCs; privileged columns are client-immutable (migration 0017)
- **Decision:** Implement §52/§53 with a `profiles.is_admin` flag, an `is_admin()` helper, a
  `moderation_actions` audit table (admin-only read; client-unwritable), account `'suspended'`
  status, and three `SECURITY DEFINER` admin RPCs (`admin_remove_mark`/`admin_suspend_account`/
  `admin_resolve_report`) each gated on `is_admin(auth.uid())`. A BEFORE-UPDATE trigger
  `profiles_guard_privileged` reverts `is_admin`/`account_status`/`deactivated_at` for any
  non-privileged caller, so those columns change ONLY through the DEFINER RPCs — never via the
  0001 `profiles update self` policy.
- **Reason:** Independent review found the `profiles update self` policy would otherwise let any
  client `set is_admin=true` and self-promote to admin (privilege-escalation BLOCKER, caught at
  `4c7a71a`). Gating the columns at the write boundary (trigger) is the minimal, robust fix and
  also makes `is_admin` un-settable by clients (§53 "admin never reachable by ordinary users").
  In-app admins are NOT `service_role`, so they still cannot read `anonymous_mark_authors` —
  anonymity stays service_role-only (§53).
- **Alternatives:** Column-privilege GRANTs (Postgres column-level privileges don't compose with
  the existing row policy cleanly — rejected); a separate admins table (more surface — rejected).
- **Reversibility:** Additive/idempotent migration; pre-hosted-apply. `is_admin` is bootstrapped
  only by a backend/SQL actor (postgres/service_role). **Founder Gate?** No for code; hosted
  apply remains a deploy Gate.

## D-12 · 2026-09-15 · Blocked Users management uses a narrow outbound-only RPC (migration 0028)
- **Decision:** Keep the canonical bilateral profile RLS boundary unchanged. Add
  `list_my_blocked_users(expected actor, cursor)` as an authenticated-only,
  `SECURITY DEFINER` read for an active caller's own outbound block associations. It returns
  at most 20 rows containing only user id, display name, handle, avatar URL, and block time;
  it cannot accept an arbitrary blocker id and never reveals inbound blocks. The RPC compares
  the expected account with one captured `auth.uid()` before any other validation.
- **Reason:** Profile RLS correctly hides both parties across a block, so joining blocks to
  profiles through ordinary client reads erases the identity needed for the blocker to undo
  their own block. Broadening profile visibility would weaken a larger privacy boundary. A
  narrow actor-bound projection exposes only what the management screen needs.
- **Alternatives:** Broaden profile SELECT across outbound blocks (rejected — weakens general
  profile privacy); show irreversible anonymous block rows (rejected — unusable); expose an
  arbitrary blocker argument (rejected — authorization/enumeration risk).
- **Reversibility:** Client-first rollback: remove RPC callers, revoke its authenticated grant,
  then drop the exact function. Migration 0028 writes no user data. **Founder Gate?** Approved
  for source implementation and testing only; hosted migration remains unapproved.

## D-13 · 2026-09-18 · Permanent account deletion requires ownership resolution and deletes authored content
- **Decision:** Permanent deletion is distinct from ordinary deactivation. Scheduling requires
  strong `DELETE` confirmation and zero owned Shared Walls; each Shared Wall must first be
  transferred to an active accepted member or explicitly deleted by its owner. The server starts
  an immutable 30-day recovery window and deactivates the account atomically. Reactivation during
  that window cancels deletion atomically. Final service-only purge deletes all Marks authored by
  the user on every Wall before deleting the auth identity; the Personal Wall and remaining
  identity-owned/social data then follow existing cascades. Protected media uses its durable
  deletion outbox, and public avatars must be removed through the Storage API before service-only
  purge preparation and Auth Admin identity deletion.
- **Reason:** Silent Shared-Wall cascade deletion would destroy other members' group history;
  silent transfer would grant control without consent. Conversely, leaving authored Marks with a
  null author would contradict the Founder's explicit full-deletion decision. A separate lifecycle
  prevents reversible deactivation from being confused with permanent deletion.
- **Alternatives:** Keep authored Marks as `Deleted user` (superseded by the 2026-09-18 Founder
  decision); auto-transfer Shared Walls (rejected — consent/selection ambiguity); delete owned
  Shared Walls automatically (rejected — disproportionate group-data loss).
- **Reversibility:** Scheduling is reversible for 30 days; final purge is intentionally
  irreversible. Migration 0031 is additive before hosted application. **Founder Gate?** Product
  behavior and draft source implementation approved; hosted migration, scheduler, merge, and
  deployment remain unapproved and require independent Two-Key review plus QA.
