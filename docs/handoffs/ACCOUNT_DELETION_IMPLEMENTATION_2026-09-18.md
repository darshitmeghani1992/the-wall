# Implementation state: recoverable account deletion

## Current state

Draft implementation is present on PR #22. Nothing has been applied to hosted Supabase, merged, scheduled, or deployed.

## Implemented source

- Founder-approved product contract, Feature Plan, and ADR.
- Migration `0031` with private request state, exact actor-bound scheduling, Shared-Wall ownership gate, immutable server deadline, current-actor status, deadline-aware recovery cancellation, bounded service-only due-work discovery, and service-only purge preparation for subsequent Auth Admin deletion.
- Active-account gating for new/replaced avatar objects after deactivation.
- Dedicated typed-`DELETE` screen and Settings entry.
- Recovery screen distinguishes scheduled versus server-expired deletion, names the exact localized deadline including time zone, and never offers restoration after expiry.
- Strict client response parsers and account-switch fences.
- SQL and dependency-free client tests for the lifecycle and privilege boundaries.
- Authenticated, bounded deletion-worker source plus hosted operations runbook.
- Executable pre-application rollback, rollback/reapply test, and two-session lifecycle races.

## Verification

- **Verified:** TypeScript passes locally.
- **Verified:** ESLint passes locally with zero errors and zero warnings.
- **Verified:** all 70 dependency-free client/contract tests pass locally.
- **Verified:** all 36 Deno Edge-function tests and all 31 media-worker tests pass locally.
- **Verified:** Expo Doctor passes all 17 checks.
- **Unverified locally:** PostgreSQL suite; this environment has no `psql` binary.
- **Superseded evidence:** CI run `152` covered the pre-audit candidate and is not certification evidence for this corrected tree.
- **Pending:** corrected-tree PostgreSQL/Edge/worker CI, independent Reviewer, independent QA, hosted staging, and physical-device behavior.

## Backend Contract Compliance Check

| Approved contract | Implementation | Evidence | Result |
|---|---|---|---|
| Actor-bound exact confirmation | `request_account_deletion(uuid,text)` | SQL test 99 mismatch/confirmation cases | Verified locally by source; PostgreSQL CI pending |
| Server-owned immutable 30-day deadline | request table CHECK + idempotent retry | SQL test 99 schedule/retry | PostgreSQL CI pending |
| Zero owned Shared Walls at schedule and purge | initial count + locked purge recheck | initial and late-ownership tests | PostgreSQL CI pending |
| Delete every authored Mark | normal author plus private Anonymous-author side table | normal/Anonymous purge assertions | PostgreSQL CI pending |
| Deadline-safe recovery | locked profile/request transaction | expired status/recovery and two-session race | PostgreSQL CI pending |
| Service-only bounded finalization | exact grants, pinned search paths, worker secret | ACL/search-path tests + Edge tests | CI pending |
| Avatar cleanup before identity deletion | Storage list/delete/re-list then prepare | worker operation-order tests | CI pending |
| Reversibility before use | guarded rollback + clean reapply | rollback assertion in runner | PostgreSQL CI pending |

## Frontend Consumption Compliance Check

| Server result | Client behavior | Result |
|---|---|---|
| `scheduled` | exact time/time-zone shown; restoration offered | Verified by contract/source tests; device pending |
| `expired` | authoritative non-restorable state; sign-out only | Verified by contract/source tests; device pending |
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
| iOS | Pending corrected-tree CI | Local production export passed | Unverified |
| Android | Pending corrected-tree CI | Local production export passed | Unverified |
| VoiceOver/TalkBack | Labels/roles present | N/A | Unverified |
| Large text/keyboard/focus | Layout designed to scroll where destructive form needs it | N/A | Unverified |

## Handoff

Next: obtain green corrected-tree CI, route the unchanged exact tree to independent Reviewer, then QA. Do not apply migration `0031`, configure the hosted scheduler, merge, or deploy before those gates and a new Founder authorization.
