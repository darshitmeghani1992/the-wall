# CURRENT — Operational Handoff

> Operational state, not canonical governance. Product authority remains
> `THE_WALL_MASTER_BUILD_SPEC_v1.1.md`; AIOS authority remains `docs/aios/`.

## Current state — 2026-09-03

- Overall production-ready MVP completion estimate: **42%**.
- Feature implementation estimate: **approximately 52%**.
- Production/release readiness estimate: **approximately 30%**.
- These are weighted delivery estimates, not a claim that 42% of files or screens are done.
- P0 authorization hardening is on draft PR #18 at `ab55395`; CI run 89 passed TypeScript,
  lint, and all 135 PostgreSQL security assertions. It remains unmerged and undeployed.
- Protected-media architecture and C1 database foundation are locally committed on
  `codex/protected-media-foundation` at `6aa31bb`, based on `ab55395`.
- Independent Two-Key source review approved C1 pending PostgreSQL runtime execution.
- No protected-media migration has been applied to hosted Supabase or production.

## C5a protected-media reader — review handoff (2026-09-08)

### Implementation State

**Status: source approved by independent Frontend and Backend review; ready for QA, not Done.**

- The current worktree contains the protected-reader request/response parser, bounded cache and
  retry lifecycle, and protected Photo/Voice/Video presentation in `MarkView`.
- The local Edge reader implements the bound `/functions/v1/mark-media/read` route and exact minimal
  manifest. This is local implementation state, not evidence of a hosted Supabase deployment.
- **Verified locally:** typecheck, lint, targeted client contract tests, and targeted Edge reader
  tests pass.
- **Verified by independent review:** the corrected exact C5a source closed cache resurrection,
  legacy dot-segment handling, AV lifecycle registration, concurrent retry-budget, and O(N²)
  lifecycle fan-out findings.
  - Frontend Reviewer approved commit `2a8492db685f28a0a0ec6b8edb9df1bc8758219d`, exact digest
    `b74e38cbf637f6c2165eab2b8c93359d82d10d5d7dfb342d2fa7a7e82caf5b89`.
  - Backend Reviewer approved commit `32cd18520bb0ba54fba51f614aafba0ba6057667` with exact SHA-256:
    `media-contract.ts` `1ea46779974e523484697d054bea3f293a6339d33c4a58eef7fa1a06835602e1`;
    `mark-media/index.ts` `7e2297375cfe358437b6ca1a949a34ea13f1a430cd92cc23bcfaf12d0b763e4a`;
    `mark-media.test.ts` `e61dcbb9131fe9cb59e6c74283134fc696dd1164be74d636da0d14e2e2d7f583`.
- Public legacy `marks.media_url` fallback is disabled entirely. C5a consumes protected manifests
  only; legacy media remains unavailable until safely migrated into linked private canonical media.
- **Unverified:** hosted Supabase signing/RLS behavior, physical iOS and Android rendering/playback,
  AV/background lifecycle on real devices, VoiceOver/TalkBack, network-expiry behavior, and actual
  compact/large viewport behavior.
- No merge, hosted migration, deployment, or production-data change has occurred.

### Consumption Compliance Check

**PASS for the reviewed local source; hosted consumption remains unverified.**

| Consumed contract | Local implementation match | Deviation |
|---|---|---|
| `POST /functions/v1/mark-media/read` with exact lowercase `mark_id` + fresh `request_id` | Yes | None |
| Exact `status`, `expires_at`, and ordered `items` DTO; no path/hash/byte/identity fields | Yes | None |
| 400/401/403/404 and opaque native failure share one whole-manifest refresh budget | Yes | None in reviewed source |
| Cache identity is subject + session generation + Mark; lifecycle clears volatile URLs | Yes | None in reviewed source |
| Public legacy URL fallback | Yes | Disabled entirely, as required by the amended contract |

This PASS is limited to exact local source and test evidence. The Backend contract remains
undeployed to hosted Supabase, so live interoperability is unverified and requires QA.

### Quality Bar Check

**SOURCE CHECK PASSED; physical-device Quality Bar remains open.**

- Implemented behavior preserves full-frame photos, ordered photo viewing, explicit loading and
  unavailable states, native Voice/Video controls, and silent bounded recovery without exposing
  private URLs or internal errors.
- The interaction is designed to keep ordinary viewing low-friction while failing closed after one
  refresh attempt.
- Perceived loading quality, playback continuity, carousel gestures, accessibility, large-text
  behavior, real viewport layout, and background/resume experience have not been observed on
  physical iOS/Android. Independent device QA is required before C5a can be called Done.

## Completed or strongly established

- Founder-approved Master Build Spec, product rules, interaction reference, and developer handoff.
- Expo/React Native application foundation, routing, theme, Supabase client, auth and onboarding
  groundwork.
- Personal Wall, person profile/Wall, Discover, composer, Shared-Wall and notification surfaces
  exist, with completeness varying by journey.
- Backend entities and authorization for friendships, follows, approved writers, Shared-Wall
  membership, reactions, Anonymous/Secret Marks, moderation, blocking and account lifecycle.
- P0 corrections for blocking, reaction access, member-only Shared-Wall posting, Personal-Wall
  contribution rules, retired features and anonymity privacy.
- Mark-detail frontend checkpoint: reactions, sharing, reporting, edit/delete and safety removal;
  round varied pins and contained media framing.
- Protected-media C1 source: private bucket boundary, reservations, quotas, ordered five-photo
  model, cleanup outbox/evidence, worker lifecycle, kill switches and physical race harnesses.

## Active critical path

1. Upload `5579687` and `6aa31bb` to a separate draft CI branch after explicit external-source
   authorization accepted by the execution platform.
2. Run migration `0020`, all SQL regression tests and physical-session race suites 54/55 on
   clean PostgreSQL in CI; fix every failure and repeat Reviewer + QA/Security.
3. Build protected-media processor/API and storage cleanup worker (C2).
4. Integrate signed private-media reads and the ordered multi-photo composer/viewer in Expo (C3).
5. Complete and device-test onboarding, Status, My Wall navigation and first-use walkthrough.
6. Complete Discover, friends/followers/approved writers and profile counts.
7. Complete full Shared-Wall create/invite/join/manage/transfer/delete lifecycle.
8. Complete Alerts routing, deep-link restoration/store fallback, settings, block/report,
   moderation and account-deletion UI.
9. Run accessibility, performance, offline/error, security/privacy and physical-device QA.
10. Validate hosted Supabase/EAS, prepare TestFlight and Play internal builds, then obtain the
    Founder ship gate before any public release.

## Progress model

| Workstream | Weight | Completion | Weighted contribution |
|---|---:|---:|---:|
| Product, UX contract and architecture | 10% | 100% | 10.0% |
| App foundation, auth and onboarding | 10% | 60% | 6.0% |
| Core backend and permission security | 20% | 75% | 15.0% |
| Core Wall and Mark client journeys | 15% | 50% | 7.5% |
| Friends, followers and Shared Walls | 15% | 40% | 6.0% |
| Protected media end to end | 10% | 25% | 2.5% |
| Alerts, settings, safety and deep links | 10% | 40% | 4.0% |
| Device QA, accessibility, performance and release | 10% | 10% | 1.0% |
| **Total production-ready MVP** | **100%** |  | **42.0%** |

## Verification boundary

- **Verified:** P0 remote CI at `ab55395`; C1 exact source hashes and static shell/diff checks.
- **Pending:** C1 PostgreSQL runtime, hosted Supabase behavior, processor and signed-read services,
  physical iOS/Android rendering, accessibility, performance, push, universal links and release.
- A screen existing in source does not count as complete until its backend contract, error states,
  device behavior and acceptance tests pass.

## External gate currently required

The execution platform requires explicit approval before uploading repository source to GitHub.
Authorization is limited to the two local protected-media commits, a separate CI branch and a
draft PR. It does not include merge, hosted migration or deployment.
