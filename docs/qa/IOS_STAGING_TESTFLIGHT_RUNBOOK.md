# iOS Enhanced Beta — staging signed-install / TestFlight runbook (draft, held)

**Owner:** ARCHITECT release sequencing → DEVOPS signing and QA verification, independent REVIEWER before promotion. **Status 23 Nov 2026: NOT approved to execute any signed build, submission, tester invitation, environment write, migration, or release.** This runbook covers a proposed **staging-only** iOS QA/TestFlight artifact. A public self-serve release still requires a separately approved release environment, security review, and Founder GO. Android follows later.

## Immutable input and mandatory preflight

- Pin an **exact reviewed integrated PR candidate** and CI tree. The staging source combines Poll persistence/read/vote/close/moderation/account purge and photo/voice/video/Secret client paths, but the high-risk backend/UI rollout remains OFF. A CI result from a different SHA cannot promote this SHA.
- Validate the signed build uses `app.json` bundle identifier `com.thewall.app` and EAS profile `ios-staging-testflight` only. The profile is `distribution: store`, isolated `channel: ios-staging-testflight`, EAS `environment: preview`, `ios.simulator: false`. It does **not** configure automatic submit.
- The existing `eas-build-pre-install` guard must pass with an exact `https://ewintxgdxdvschiqodkq.supabase.co` public endpoint, an approved project-bound public key, and media/Secret/account deletion flags OFF. The protected original `wfsfafmgvxevpzrurofz` is strictly forbidden. No service-role or personal token belongs in public EAS/Expo variables or logs.
- Confirm the chosen reviewed candidate's TypeScript/lint, contracts, disposable Postgres tests, Edge/media processing, Expo Doctor, iOS prebuild and iOS export are green. An unsigned macOS iOS Simulator native build and first-launch smoke is additional evidence, not evidence of signing or installed-iPhone behavior.
- Verify a dedicated, correctly configured six-digit staging email OTP sender with **real delivered** codes and three authorized tester identities (new user, permitted writer/member, unrelated/blocked actor), server RLS/HTTP negative access and session recovery. This is currently blocked; no synthetic-success or bypass.
- Independently verify hosted C2/C3 private media upload/processing/revocable playback, signed URL expiry, quota and cleanup, Secret one-time reveal/hour expiry and scheduled cleanup, 0031/0038 account deletion lifecycle/rollback, safe Poll permissions/vote/close/open+closed ballot purge, moderation, support, abuse limits. The currently held Poll/media/Secret toggles remain OFF until a separately authorized host rollout and exact test evidence.

## Command sequence — execute only after all respective gates are explicitly lifted

1. Checkout the exact authorized source commit, inspect `git rev-parse HEAD`, `git status --porcelain`; do not build from a floating branch.
2. `npm ci --no-audit --no-fund` then `npm run typecheck && npm run lint && npm run test:contracts && npm run verify:ios-prebuild && npm run export:ios`.
3. From an approved secured operator console with authorized EAS/Apple sessions, verify the exact EAS profile/env without printing credentials. `eas build --platform ios --profile ios-staging-testflight --non-interactive` is **NOT authorized yet**. Successful build alone is not device approval.
4. Capture immutable EAS build ID, IPA hash, app version/build number, Xcode/SDK version, app backend ref, feature-flag snapshot, submitted TestFlight build and Apple review status. Check App Store Connect bundle ID ownership and signing before attempting distribution.
5. Independent QA installs the **same signed build** on a physical compatible iPhone (including the designated iPhone 18 Pro Max if available) and verifies real OTP→onboarding, Personal/Shared Wall privacy, follow/friend/writer, creation, text/media/standard single+multi polls, votes and closing, Anonymous/Secret, reporting/moderation, invite routing, account switches, offline/retry, camera/microphone recording and playback, Screen Reader, safe expiry/deletion and actor-negative cases. Reject screenshots/source assertions as substitutions for on-device behavior.
6. Founder approves the separately reviewed environment, legal/privacy/support readiness, open signup abuse controls and external TestFlight invitation/distribution. Only then is submission, external review and public invitations eligible. This document is not release authorization.

## Immediate rollback / stop distribution

- For a defect before external invitation: keep the profile unsubmitted and hold the reviewed feature gates OFF. Do not workaround OTP, RLS, storage/media, or account deletion by disabling checks.
- For an incident after approved TestFlight distribution: pause/disable the affected external TestFlight group or build enrollment via authorized App Store Connect operator, turn OFF independently authorized server feature gates, block/rotate affected capabilities in the **approved environment only**, and follow the reviewed forward-migration/storage restoration runbook. Native clients already installed cannot be remotely uninstalled; server-side denial and an approved replacement build may be needed.
- Record incident time, exact build ID/commit, hosted schema/migration versions, public flags, issue owner, containment tests and independent Reviewer/QA re-verification before reopening distribution.
- Never apply a destructive down-migration or erase private media/account records as a rollback without the dedicated Founder and independent security gates.

**Release criterion:** signed unchanged app + separately approved hosted backend with complete Enhanced Beta features + real 3-actor/negative JWT/media/Secret/Poll checks + independent Reviewer APPROVE and QA PASS + Founder release authorization. Until then: **NO-GO**.
