# The-Wall — Release Execution Baseline (2026-11-19)

**Status:** Planning / evidence baseline only. **Role:** ARCHITECT (release dependency sequencing). The application remains draft, unmerged, undeployed.

## Ground truth and authority

- Source candidate: draft PR #30, `codex/integrated-source-candidate`, commit `ea755876d600ca5e9b01ab0d117b5b01c5c8f41c`, tree `beb3cae2151e87244d22927b8a631d821f015ea1`. CI #195 passed on 2026-09-23. Full installed-app behavioral QA **not** approved.
- `THE_WALL_MASTER_BUILD_SPEC_v1.1.md` owns approved product behavior; `docs/aios/` owns governance. This plan cannot authorize scope changes, a migration, a merge, deployment, or release.
- Source stack: Expo SDK 51 / React Native 0.74.5 / Expo Router / TypeScript / Supabase. There is no tracked native Xcode project, Podfile, Package.swift, or standalone iOS Playbook in the source candidate. Do not rewrite the application in Swift.
- Test devices: iPhone 18 Pro Max as primary iOS acceptance device; add smaller iPhone and representative Android for cross-device proof. Development machine is the existing MacBook Pro.
- Device/host access: at the time of this handoff, Desktop Commander reported the Mac device offline. **Do not** record package installation, Xcode validation, local native builds, or physical device tests as performed.
- Tracking issue: #31. Complementary issue #27 covers withheld integrated behavioral QA.

## Gates and evidence to collect

### G0 — Repository/environment rebaseline (ARCHITECT)
- [ ] Refresh all PR heads, branches, CI runs, independent reviews, and conflicts. Treat PR #30 as source candidate, not an authorized merge.
- [ ] In a real checkout, inspect `git status`, recent `git log`, `rg 'TODO|FIXME|fatalError|mock|placeholder'`, package lock, scripts, migrations, app and worker folders, EAS and CI configuration.
- [ ] Record `node --version`, `npm --version`, `xcodebuild -version`, `xcrun simctl list devices`, `eas --version`, `git status`, and the Mac OS/Xcode compatibility; do not print secrets.
- [ ] Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:contracts`, `npm run test:worker`, `npm run check:expo`, `npm run export:ios`, `npm run export:android`, and DB/Edge CI suites. Capture exits and exact tree.
- [ ] Independently certify code against one unchanged tree (REVIEWER then QA). Author/self-review never counts as independent.

### G1 — Dependency and native iOS readiness (ARCHITECT → FRONTEND)
- [ ] Triage dated `npm audit --omit=dev` findings and dependency reachability; prior 2026-09-22 register recorded 13 high / 32 moderate / 2 low / 0 critical. Rerun today; do not treat old numbers as current.
- [ ] Plan and stage compatible Expo SDK upgrades, one checked step at a time; verify iOS native module compatibility and latest App Store submission SDK requirements before finalizing. Do not attempt an unsupported one-shot React Native/Swift migration.
- [ ] Generate native iOS project locally (Expo prebuild only on a disposable clean checkout) and inspect resulting `Info.plist`, permission messages, entitlements, and `PrivacyInfo.xcprivacy` manifests/dependency disclosures.
- [ ] Verify `app.json` identifiers, current branding, `userInterfaceStyle: light` versus approved visual system, display settings, fonts, safe areas, Dynamic Type, VoiceOver and reduced-motion handling.
- [ ] Validate release EAS profile, credentials isolation and distributable signed iOS build; existing `eas.json` exports alone are not proof.

### G2 — Staging integration (BACKEND, separate Founder infrastructure/migration gate)
- [ ] Provision isolated non-production Supabase and worker credentials through approved secret management; no service-role keys in Expo bundle or committed files.
- [ ] Verify all ordered migrations, RLS, rollback/restore, and actor/session guards using at least owner, approved contributor and unauthorized/blocked account.
- [ ] Host private protected media, signed reads, processing, cleanups, retries, quotas, race/duplicate-worker cases, orphan and legacy-media reconciliation. Keep production media disabled until verified.
- [ ] Explicitly authorize and test account deletion migration `0031`, scheduled worker, retention policy, safety recovery and final purge before hosted enablement.
- [ ] Validate rate limiting, report/moderation operations, audit logging and abuse controls against code, not checkbox documentation alone.
- [ ] Record negative tests, logs, source SHA, staging configuration version, and fail-closed results.

### G3 — End-to-end product closure (PRODUCT → FRONTEND → REVIEWER → QA)
- [ ] Verify signup/signin (email OTP, Apple/Google where supported), onboarding, profile, account reactivation/deletion.
- [ ] Verify personal/shared walls, Friends vs Followers, approved writers, invitations, wall switching and ownership transfer.
- [ ] Verify text, up-to-five-photo, voice and video Marks, Anonymous/Secret flows, edit/remove, reporting, reactions, history pagination and exact-Mark links.
- [ ] Verify Alerts read receipts and pagination, push routing, foreground/background behavior, stale links and login/install-intent restore once a public domain is selected.
- [ ] Eliminate dead actions, production mock data, stale loading, empty/error/offline states and misleading success copy.

### G4 — Device/quality assurance (QA, independent)
- [ ] Real iPhone 18 Pro Max, smaller iPhone, physical Android: camera, mic, photo/video, orientation/safe areas, keyboard, permissions, resumed uploads, session switching, notification taps.
- [ ] VoiceOver/TalkBack, Dynamic Type, contrast, reduced motion and different content lengths.
- [ ] Adverse/slow/offline networks, background termination, app reload, duplicate taps, pagination races and interrupted uploads.
- [ ] Measure against `docs/11_Performance.md` on physical devices and capture crash-free telemetry.
- [ ] No production-risk or Two-Key-critical findings; complete behavioral QA PASS on the exact release artifact.

### G5 — TestFlight, release operations and submission (Founder GO/NO-GO)
- [ ] Privacy policy, terms, user-generated-content reporting/blocking, community safety review, account deletion, data retention and support contact prepared and audited.
- [ ] Apple App Privacy and Google Data Safety declarations, permissions, accurate screenshots, metadata, account/demo access and rating reviewed.
- [ ] TestFlight and Play internal testing successfully install signed app; exact build IDs captured.
- [ ] Production infrastructure hardening, error monitoring, backup/restore exercise, incident runbook, phased rollout and rollback procedure verified.
- [ ] Founder approval for merge, production migration, production deployment, paid resources, and public release at each required gate.

## Locked MVP scope

Keep Personal Walls, Shared Walls, owner-controlled contributions, Friends/Followers, text/photo/voice/video Marks, Anonymous/Secret modes, reactions, Alerts, privacy, blocking, reporting and deletion. Prototype games, doodles, polls, awards, predictions, DM/chat, monetization and the landing page are excluded from this first release unless explicitly reopened through Product/Founder governance.

## Status / next executable step

The correct next action is G0 **on an accessible development machine**, then an isolated and reviewed dependency/native-readiness branch. Do not mark G1–G5 complete based on source CI. Until Mac connectivity or another authorized build runner is available, continue only safe remote repository reconnaissance and planning.

**Verification labels:** Existing recorded CI #195 and PR #30 evidence = **Verified historic**; real native build and hosted/device readiness = **Inferred/unverified**; date forecasts = **Inferred**.
