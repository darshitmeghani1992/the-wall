> **22 Nov 2026, PR #158 runtime credential follow-up — PREPARATION ONLY.** The client-side staging-only runtime guard was incomplete when supplied a legacy JWT key from local Metro or a non-EAS builder; new child [#158](https://github.com/darshitmeghani1992/the-wall/pull/158) blocks privileged/foreign/opaque keys using a portable role/ref parser. Parent #157 has 4/4 green CI; #158 final-head CI, independent Reviewer, Expo-device QA and actual three-actor hosted testing are pending. Local claim parsing is not signature verification. Staging only, no production, hosted writes, migration, merge or deployment. **Enhanced Beta NO-GO:** verified OTP SMTP, three actors, C2/C3, Secret cron, account deletion, device/rollback and Founder gates remain outstanding. Media/Secret/analytics OFF.


> **22 Nov 2026 update — staging-only runtime guard #156:** The earlier EAS pre-install and read-only probe guards now have an additional client-side exact-staging-origin filter in `src/lib/config.ts` to protect local Expo/Metro and alternative build paths. Draft [#156](https://github.com/darshitmeghani1992/the-wall/pull/156), source/test `e5889947889b0c21ff0b69e6cd1f7eee02962984`; exact final-head CI, independent Reviewer and real iOS/Android behavior not yet certified. Original production never queried or modified. Approved staging read-only: ACTIVE_HEALTHY, 35/35 public RLS, 0 authenticated users, no Secret cron, no deployed deletion RPC. **Enhanced Beta NO-GO**: SMTP, three real authenticated JWTs, media C2/C3, Secret expiry, deletion, Reviewer/QA/device/rollback remain open; media/Secret/analytics OFF, domain and Apple holds remain.

# The-Wall — Enhanced Beta release packet (PREPARATION ONLY)

> **22 November — release engineering correction, not beta GO:** [PR #153](https://github.com/darshitmeghani1992/the-wall/pull/153) final SHA `bc3d0aed1e649e97f24da70485415c7fb84bbada` failed client-contract CI due to stale EAS tests. [Draft #154](https://github.com/darshitmeghani1992/the-wall/pull/154) aligns tests to exact approved staging origin and verifies original production rejection; [draft #155](https://github.com/darshitmeghani1992/the-wall/pull/155) refuses modern `sb_secret_*` and legacy service-role/mismatched JWTs before preflight HTTP or client packaging. These are **source-only safety improvements**, not EAS signed build, independent review, runtime QA, or deployment. Exact final-head CI must pass, followed by independent Reviewer/QA. Fresh approved staging READ ONLY: ACTIVE_HEALTHY, public RLS 35/35, 0 Auth users, no `pg_cron`, account deletion RPC absent. All Enhanced Beta GO gates remain open; media/Secret/analytics OFF, no production access, hosted writes, migrations, merges, tester invitations or Apple/domain actions.


> **Release packet continuation — PRs #152–#153 (22 Nov 2026):** [#152](https://github.com/darshitmeghani1992/the-wall/pull/152) has exact final commit `4671d77c9811481a96069d89725e7d5df10dc352`, tree `7fc99b577749aec15ec740fd0a6b5e775b593e6f`, with **all four CI jobs green**; it closes two auth callback fail-open cases (alternate provider errors/malformed codes and no returned session) and adds direct pure behavioral tests. Child [#153](https://github.com/darshitmeghani1992/the-wall/pull/153), code/test SHA `ff125bedd4e3a9c125919b5c779c6d3fc9614c4a`, hard-blocks beta EAS builds and read-only probes against any nonapproved Supabase origin, **without calling original production**. Its final docs-head CI is not yet complete; do not treat its ancestor's green CI as certification. Fresh approved staging read-only evidence: ACTIVE_HEALTHY, 35/35 public tables RLS, 0 authenticated users, private mark media, 0 pg_cron and no deletion RPC; **0031 withheld**. All installed-device, 3-JWT, SMTP, media, Secret, deletion and independent Reviewer/QA gates are still **NO-GO**. No PRs merged, hosted writes or deployments, production access, credentials, signing, Apple/domain actions or tester invitations. The older #113 and #149 entries below are explicitly historical, not current release references.


> **Additional current checkpoint — PR #151 (22 Nov 2026):** [draft #151](https://github.com/darshitmeghani1992/the-wall/pull/151) adds fail-closed native OAuth browser cancellation/error/redirect/session handling to `src/lib/auth.tsx`. Source/test SHA `53d893ff270713491961d402f643941785a94f87`. The source tests and CI do **not** certify actual provider sign-in; OAuth providers remain OFF on staging. The intermediate draft #150 documents audited PR #30–#149 ancestry/file overlaps; no old PR declared superseded. Latest exact source+docs SHA must be rechecked before independent review and device QA. All Enhanced Beta gates below remain **NO-GO**.


> **Live checkpoint, 22 November 2026:** newest isolated [draft PR #149](https://github.com/darshitmeghani1992/the-wall/pull/149) includes the previously verified #148 auth callback result-check and a new provider-declined OAuth rejection + retry path. Latest source/test SHA `5ea956cf27b960e6ff5b5c4241fb02f8b9d5edfc` is **not** independently certified. The earlier #113 SHA and release evidence below are **historical snapshots**, not the current integration candidate. No current-device artifact, Reviewer approval or QA certification is claimed. Staging read-only preflight on 22 Nov: ACTIVE_HEALTHY; 35 public tables, all RLS enabled, private mark-media, 0 real Auth users, no cron scheduler and no account deletion RPC. Source migrations 0001–0030, 0032–0034 recorded; 0031 intentionally withheld. **Enhanced Beta NO-GO**. Original production protected, no deployments or host writes in this checkpoint.


**Recorded:** 22 November 2026. **Release tracker:** [issue #57](https://github.com/darshitmeghani1992/the-wall/issues/57). **Verdict:** **NO-GO**. This document is an operational checklist and draft release copy, not an approval, release artifact or evidence of installed-device testing.

## Immutable starting point and scope

- Repository: `darshitmeghani1992/the-wall`.
- Draft stack: #30→#34–#56→#58 and later; latest source continuation through [#113](https://github.com/darshitmeghani1992/the-wall/pull/113), head `138391e3dccd0aad5d760f1001761b01376c0161`, tree `b4e704e050d011c7f4358a34b461d61df9c6cf4e`. Newer document-only descendant must be independently checked at its exact SHA; ancestor CI is never inherited as certification.
- This source is **unmerged** and **undeployed**. Existing [Android preview APK](https://expo.dev/accounts/darsh9899/projects/the-wall/builds/a1037ffa-c214-471b-8949-7796cbaeba81) is an earlier build; it is **not** evidence for the #113 candidate. No signed current-candidate iOS artifact or TestFlight installation is verified.
- Approved runtime target: isolated staging `ewintxgdxdvschiqodkq` only. Original production `wfsfafmgvxevpzrurofz` is out of bounds.
- Issue #57's controlled text-first milestone is **internal verification only**. A first release needs every approved Core through Enhanced Beta feature independently certified (including real photo/voice/video, Secret, deletion) or an explicit new Founder/Product scope decision. Existing flags do not silently reduce the approved Enhanced Beta scope.

## Proposed internal tester release notes — NOT PUBLISHED

The-Wall is a friends-first social app where other people leave Marks on your Personal Wall, and invited people contribute to Shared Walls. The first beta is intended to exercise email-code sign-in, onboarding, Personal/Shared Wall permissions, friends/followers, approved writers, text Marks, reactions, Alerts, discovery, reporting and account recovery. These descriptions are **targets**, not independently verified live features. Photo/voice/video Marks, one-time Secret Marks, permanent account deletion and optional analytics are withheld until their hosted, security, lifecycle and device tests are proven. Do not distribute these notes as an availability announcement.

## Concrete NO-GO evidence, as of this packet

| Gate | Evidence / condition | Decision |
|---|---|---|
| Build & lineage | Draft source #113 `138391e3dccd0aad5d760f1001761b01376c0161`. Latest source-only CI must pass at the exact unchanged descendant head; Reviewer approval + independent QA still absent | NO-GO |
| Staging data | Read-only staging SQL on 22 Nov: 0 Auth users, profiles, Walls, Marks and Storage objects; 0 public tables without RLS. `cron.job` relation absent | NO-GO for real-user QA/Secret |
| Real email authentication | Supabase email UI expects six-digit `verifyOtp`; verified custom SMTP sender and `{{ .Token }}` email must deliver to legitimate consenting testers (issue #45) | NO-GO |
| Authenticated privacy | Need 3 distinct actual JWT holders: new user, member/friend, unrelated/blocked. Verify PostgREST JWT denial separately from SQL fixture; Shared Wall `INSERT RETURNING`, membership, blocks, Secret reads, security-definer callers | NO-GO |
| Protected media | C2/C3 gateway + isolated processor, signing, quotas, cleanup, private playback and adverse-network testing not hosted/proven | OFF |
| Secret retention | Hosted hourly cleanup and service-only call path absent; require one-time reveal, one-hour expiry and cron monitoring evidence | OFF |
| Account deletion | Staging migration 0031 + purge worker withheld; legal retention, independent QA, irreversible purge and Founder gates pending | OFF; release blocker |
| Devices, independence & operations | Simulator and physical-device iOS/Android accessibility/offline/retry flows, reviewer, QA, kill-switch/rollback drill and Founder release GO outstanding | NO-GO |
| External holds | No domain purchase/DNS or Apple Developer enrollment/signing/TestFlight now. Prepare only; no bypass | HOLD |

## Feature-disable and incident containment instructions

These are **future operator checks**, not authorization to edit hosted settings or redeploy:

1. Verify the built client's `EXPO_PUBLIC_MEDIA_MARKS_ENABLED` is **not** `true` and the authoritative PostgreSQL `media_kind_controls` for photo/voice/video all remain disabled. Client build-time flags are **not** runtime security boundaries: old installed binaries can retain prior values. Never treat a UI flag as a substitute for server-side denial.
2. Verify `EXPO_PUBLIC_SECRET_MARKS_ENABLED` is **not** `true` and the database Secret rollout gate remains disabled. If a future Secret scheduler is active and must be stopped, first disable new Secret creation; only then use the **reviewed and separately authorized** `supabase/operations/secret-expiry-unschedule.sql`. Do not stop cleanup while existing unexpired Secrets still require their deletion promise.
3. Verify `EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED` is **not** `true` while migration 0031/worker is withheld. Account deletion is not a temporary security exemption or an App Store compliance waiver. **Never** roll back 0031 after a live deletion request or Auth Admin purge; see `docs/handoffs/ACCOUNT_DELETION_OPERATIONS_RUNBOOK_2026-09-18.md`.
4. Leave `EXPO_PUBLIC_POSTHOG_KEY` unset pending an approved analytics/privacy audit; `src/lib/analytics.ts` no-ops without a key. Do not put credentials in `EXPO_PUBLIC_*`, issues, logs or code.
5. If a real incident occurs after a future release: stop further tester invitations; disable the relevant **server-side** writes/capability first under authorized change control, preserve forensic evidence without JWT/PII, then prepare a new signed client build if client UX must change. Existing installed bundles cannot be remotely rewound by changing `EXPO_PUBLIC` variables.
6. No main merge, hosted schema/Auth/Storage/Edge write, irreversible migration, production operation, build publication or invitation without the previously defined Founder/Reviewer/QA gates.

## Reproducible GO checklist (unexecuted)

- Pin exact PR head SHA, Git tree, migration set, feature flag snapshot (redacted), Edge function versions, worker image digest/build ID and server ACL snapshot.
- On that **unchanged** candidate, record GitHub CI URLs for TypeScript, lint, contracts, disposable Postgres, Edge/media and native exports; rerun on any source/config/backend changes.
- Obtain independent Reviewer **APPROVE** on the exact tree, followed by separate QA **PASS** for same tree + unchanged backend, real OTP and multi-user HTTP permissions, device capture/video, offline/retry, accessibility and error/deletion handling.
- Check actual signed Android/iOS build artifact IDs, install and exercise every approved Enhanced Beta feature. Complete a rollback drill with safe media/Secret disabling without compromising retention/deletion.
- Only then route explicit launch GO to Founder; release notes may be finalized and testers invited after the remaining gates close.

## Next runnable work without external secrets

Finish exact-head CI for #112 and #113; perform a file-level lineage/overlap review and independent code review, and continue separately scoped frontend/security tests. When legitimate tester identities and SMTP are configured externally, run `scripts/staging-three-jwt-readonly.mjs` only with its documented opt-in and valid non-privileged credentials in an authorized runtime; **never** paste JWTs into chat/PR. The current three-user hosted tests cannot execute with zero Auth users.
