# Implementation state: recoverable account deletion

## Current state

Draft implementation is present on PR #22. Nothing has been applied to hosted Supabase, merged, scheduled, or deployed.

## Implemented source

- Founder-approved product contract, Feature Plan, and ADR.
- Migration `0031` with private request state, exact actor-bound scheduling, Shared-Wall ownership gate, immutable server deadline, current-actor status, deadline-aware recovery cancellation, bounded service-only due-work discovery, and service-only purge preparation for subsequent Auth Admin deletion.
- Active-account gating for new/replaced avatar objects after deactivation.
- Dedicated typed-`DELETE` screen and Settings entry.
- Recovery screen distinguishes scheduled versus server-expired deletion, names the exact localized deadline including time zone, and fails closed during loading/errors so restoration is offered only after an authoritative restorable status.
- Strict client response parsers and account-switch fences.
- SQL and dependency-free client tests for the lifecycle and privilege boundaries.
- Authenticated, bounded deletion-worker source plus hosted operations runbook.
- Transactional pre-application rollback, rollback/refusal/reapply tests, and physical two-session lifecycle and rollback/request races.

## Verification

- **Verified:** TypeScript passes locally.
- **Verified:** ESLint passes locally with zero errors and zero warnings.
- **Verified:** all 72 dependency-free client/contract tests pass locally.
- **Verified:** Expo Doctor passes all 17 checks.
- **Unverified locally:** PostgreSQL suite; this environment has no `psql` binary.
- **Superseded evidence:** CI run `163` (`35428360456`) passed tree `46ea703c...`; independent review found issues that the newer source remediates, so that run is not certification evidence for the new tree.
- **Certification rule:** the latest PR head must receive fresh PostgreSQL/Edge/worker CI, independent Reviewer approval, and independent QA pass without changing afterward.

## Backend Contract Compliance Check

| Approved contract | Implementation | Evidence | Result |
|---|---|---|---|
| Actor-bound exact confirmation | `request_account_deletion(uuid,text)` | SQL test 99 mismatch/confirmation cases | Requires green CI on the certified exact head; live result on PR #22 |
| Server-owned immutable 30-day deadline | request table CHECK + idempotent retry | SQL test 99 schedule/retry | Requires green CI on the certified exact head; live result on PR #22 |
| Zero owned Shared Walls at schedule and purge | initial count + locked purge recheck | initial and late-ownership tests | Requires green CI on the certified exact head; live result on PR #22 |
| Delete every authored Mark | normal author plus private Anonymous-author side table | normal/Anonymous purge assertions | Requires green CI on the certified exact head; live result on PR #22 |
| Deadline-safe recovery | locked profile/request transaction | expired status/recovery and near-deadline two-session race | Requires green CI on the certified exact head; live result on PR #22 |
| Service-only bounded finalization | exact grants, pinned search paths, worker secret | ACL/search-path tests + Edge tests | Requires green CI on the certified exact head; live result on PR #22 |
| Avatar cleanup before identity deletion | Storage list/delete/re-list then prepare | worker operation-order tests | Requires green CI on the certified exact head; live result on PR #22 |
| Reversibility before use | transactional guarded rollback + clean reapply | rollback/request race, refusal, and reapply assertions | Requires green CI on the certified exact head; live result on PR #22 |

## Frontend Consumption Compliance Check

| Server result | Client behavior | Result |
|---|---|---|
| `scheduled` | exact time/time-zone shown; restoration offered | Verified by contract/source tests; physical device unverified |
| loading/error | no restoration; progress or retry/sign-out only | Verified by contract/source tests; physical device unverified |
| `expired` | authoritative non-restorable state; sign-out only | Verified by contract/source tests; physical device unverified |
| `owner_action_required` | count-only ownership guidance | Verified by existing tests |
| committed mutation + refresh failure | states deletion is scheduled; reconciliation guidance | Verified by behavioral dependency-free test |
| actor/session switch | stale navigation and result suppressed | Verified by fence tests |

## Product Quality Bar Check

- **Verified:** exact typed `DELETE` confirmation and destructive-scope copy exist.
- **Verified:** no post-commit failure path tells the user scheduling failed.
- **Verified:** exact server deadline is rendered with time-zone context.
- **Believed-likely:** screen hierarchy and copy remain understandable on supported phones.
- **Unverified:** physical-device keyboard, focus, large-text, VoiceOver/TalkBack, and small-screen behavior.

## Accessibility and environment matrix

| Surface | Static/source | Bundle | Physical behavior |
|---|---|---|---|
| iOS | Required on the certified exact head | Local production export passed | Unverified |
| Android | Required on the certified exact head | Local production export passed | Unverified |
| VoiceOver/TalkBack | Labels/roles present | N/A | Unverified |
| Large text/keyboard/focus | Layout designed to scroll where destructive form needs it | N/A | Unverified |

## Handoff

Keep the remediation on draft PR `#22` and require green CI, independent Reviewer approval, and QA pass on one unchanged exact head. Do not apply migration `0031`, configure the hosted scheduler, merge, or deploy before those gates and a new Founder authorization.
