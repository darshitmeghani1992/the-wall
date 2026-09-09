# CURRENT — Operational Handoff

> Operational state, not canonical governance. Product authority remains
> `THE_WALL_MASTER_BUILD_SPEC_v1.1.md`; AIOS authority remains `docs/aios/`.

## Current state — 2026-09-09

- Engineering production-ready MVP estimate: **approximately 55.5%**.
- Feature implementation estimate: **approximately 65%**.
- **AIOS-certified current progress: pending.** The 55.5% figure is an engineering-progress estimate, not an AIOS certification claim.
- Current functional certification evidence head: exact commit `f1a22a19c21cf9b6b46b69054fc4e39d801e697c` on `codex/resume-mvp-sep8` (draft PR #21, CI-only). This handoff-only documentation update does not change application behavior.
- Full AIOS certification still requires an independent Reviewer session followed by independent QA on the exact reviewed version. The authoring session cannot self-certify under the Reviewer Charter.
- Production/release readiness remains materially lower because hosted Supabase, physical-device QA,
  accessibility, universal links/store fallback, and release builds are not yet fully verified.
- These are weighted delivery estimates, not a percentage of screens or files.
- Active development branch: `codex/resume-mvp-sep8`.
- No production deployment, hosted migration, destructive production-data change, or public release has occurred.

## Verification at this checkpoint

- Fresh author-side verification on the current functional code: `npm run typecheck` passes.
- Full-repository `npm run lint` completes with **0 errors and 12 warnings**. Earlier wording that said four warnings was incomplete and is superseded by this result.
- Expo production export previously passed for **iOS** and **Android** at the same functional branch head.
- GitHub Actions **CI run 123** on exact commit `f1a22a19c21cf9b6b46b69054fc4e39d801e697c` completed successfully on draft PR #21.
  - `Type-check & lint`: **SUCCESS**.
  - `DB security suite (SEC-001 + FP-C2)`: **SUCCESS**.
  - The DB job executed `bash supabase/tests/run_tests.sh` against a PostgreSQL 16 service successfully.
- The repository has no `npm test` script; do not claim an npm unit-test suite was run from that command.
- The SQL security suite is present under `supabase/tests/`, including blocking, reactions, anonymity, media, approved-writer, contribution, notifications, moderation and account-lifecycle coverage.
- The current Mac verification environment has no local `psql`, Docker, or Supabase CLI, but the SQL suite was re-executed successfully in GitHub Actions CI on the exact draft-PR head above.
- Independent AIOS Reviewer/QA certification of the Sep 9 additions is still pending. Codex Replay failed to connect; the local Claude runner is incompatible/unauthenticated. Codex Security is being pursued as a partial independent security review but does not replace full Reviewer + QA certification.
- Physical iOS/Android interaction QA and hosted Supabase interoperability are still open.

## Newly completed / materially advanced since the 42% handoff

### Core social/discovery
- Discover search results open a person's Wall before friendship, restoring discover → visit → follow.
- Person follower/following counts open real social lists.
- Profile and social counts are wired to the follow backend.
- Onboarding “Open my Wall” now routes to My Wall rather than Home.

### Shared Walls
- Public and private Shared-Wall creation use the existing server authorization model.
- Private walls use real `wall_members` membership and accepted-member access; no cosmetic privacy toggle.
- Owner can search handles, invite members, see pending/accepted members, revoke/remove access.
- Invite recipient can see and accept Shared-Wall invitations from Alerts.
- Walls hub shows both owned and joined Shared Walls.
- Accepted members can leave a Shared Wall.
- Owner can transfer ownership through the hardened `transfer_shared_wall_ownership` RPC.
- Owner can permanently delete a Shared Wall with explicit destructive confirmation.
- New Shared-Wall share links enter through `thewall://s/<id>` and preserve the intended destination across sign-in/onboarding.

### Settings, account lifecycle and safety
- Profile now has a dedicated Settings entry instead of mixing account controls into the profile surface.
- Recoverable account deactivation is exposed to the user.
- Deactivated users are routed to a recovery screen and can reactivate.
- Suspended accounts cannot enter the normal app.
- Person profiles now expose Block/Unblock using the existing directional block contract.
- Blocking relies on backend cleanup of social relationships rather than client-only hiding.
- Person profiles expose a structured Report flow using the moderation reason vocabulary and real `reports` records.
- Product copy is aligned on **Alerts** rather than mixing Alerts/Notifications at user-facing entry points.

### Protected media
- C5a protected-reader source remains independently approved from the prior handoff.
- Protected Photo/Voice/Video read presentation, bounded cache/retry behavior and fail-closed lifecycle are present in source.
- Hosted signing/RLS interoperability and physical-device media behavior remain unverified and therefore are not counted as Done.

## Progress model

| Workstream | Weight | Completion | Weighted contribution |
|---|---:|---:|---:|
| Product, UX contract and architecture | 10% | 100% | 10.0% |
| App foundation, auth and onboarding | 10% | 70% | 7.0% |
| Core backend and permission security | 20% | 75% | 15.0% |
| Core Wall and Mark client journeys | 15% | 50% | 7.5% |
| Friends, followers and Shared Walls | 15% | 50% | 7.5% |
| Protected media end to end | 10% | 25% | 2.5% |
| Alerts, settings, safety and deep links | 10% | 50% | 5.0% |
| Device QA, accessibility, performance and release | 10% | 10% | 1.0% |
| **Engineering estimate — production-ready MVP** | **100%** |  | **55.5%** |

The total is intentionally conservative and is **not AIOS-certified yet**. Source-existing screens are not counted as complete merely because they render or compile.

## AIOS certification state

- **Prior exact-version approvals remain valid only for the versions they originally reviewed.**
- Sep 9 additions listed above are currently **implemented / author-verified with green CI**, not fully AIOS-certified.
- Required gate: independent Reviewer issues APPROVE on one exact commit → independent QA executes acceptance behavior on that same approved version (or a version re-reviewed after any fix) → only then recalculate and label current progress AIOS-certified.
- Any application-code change after Reviewer APPROVE invalidates that approval until re-review.
- Draft PR #21 exists solely to provide mechanical CI/review evidence. It must not be merged or used to deploy without the appropriate Founder gate.

## Active critical path from ~55% toward beta readiness

1. Complete independent AIOS Reviewer → QA certification of the current Sep 9 additions.
2. Run/extend the protected-media runtime and race suites as required and reconcile all failures.
3. Verify protected-media API/worker and signed reads against hosted Supabase without weakening the reviewed contract.
4. Finish and device-test the integrated text/photo/voice/video composer and protected media playback on physical iOS/Android.
5. Finish remaining Personal-Wall owner controls, approved-writer management and edge/error states.
6. Complete Alerts routing coverage for every backend notification kind and verify real trigger-generated rows end to end.
7. Complete account deletion/purge job integration and moderation/admin operational UI where required for beta.
8. Implement/verify HTTPS Universal Links + Android App Links and store fallback; current custom-scheme links are in-app only.
9. Run accessibility, large-text, compact/large viewport, offline/network-expiry, background/resume and performance QA.
10. Validate EAS/TestFlight/Play internal builds against hosted environment configuration.
11. Obtain the Founder ship gate before any public release or irreversible hosted-production operation.

## Verification boundary

**Verified now (mechanically):** current source typechecks; full-repo lint has zero errors; iOS and Android Expo exports succeeded at the current functional branch head; GitHub Actions CI run 123 passed both Type-check/Lint and the PostgreSQL 16 DB security suite on exact commit `f1a22a19c21cf9b6b46b69054fc4e39d801e697c`.

**Independently verified from prior exact versions:** previously recorded P0 authorization/security and protected-media source-review evidence only. Do not extend those Reviewer approvals to newer code without exact-version review.

**Still pending:** independent Reviewer/QA on the Sep 9 additions, hosted Supabase migrations/runtime, physical-device interaction and media QA, accessibility, push delivery, HTTPS universal/app links, production cleanup jobs, release signing/distribution and public-release approval.

## Founder / production gates

Continue autonomous implementation, review and local/CI verification without routine founder interruption.
Stop for explicit founder approval before production migrations, destructive hosted-data operations, irreversible product-policy decisions, public release, or equivalent ship gates.
