# The-Wall — Enhanced Beta release packet (PREPARATION ONLY)

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
