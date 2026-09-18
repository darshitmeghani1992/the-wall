# Implementation state: recoverable account deletion

## Current state

Draft implementation is present on PR #22. Nothing has been applied to hosted Supabase, merged, scheduled, or deployed.

## Implemented source

- Founder-approved product contract, Feature Plan, and ADR.
- Migration `0031` with private request state, exact actor-bound scheduling, Shared-Wall ownership gate, immutable server deadline, current-actor status, deadline-aware recovery cancellation, bounded service-only due-work discovery, and service-only purge preparation for subsequent Auth Admin deletion.
- Active-account gating for new/replaced avatar objects after deactivation.
- Dedicated typed-`DELETE` screen and Settings entry.
- Recovery screen distinguishes scheduled deletion and names the server deadline.
- Strict client response parsers and account-switch fences.
- SQL and dependency-free client tests for the lifecycle and privilege boundaries.
- Hosted operations runbook.

## Verification

- **Verified:** TypeScript passes locally.
- **Verified:** ESLint passes locally with zero errors and zero warnings.
- **Verified:** all 65 dependency-free client/contract tests pass locally.
- **Unverified locally:** PostgreSQL suite; this environment has no `psql` binary.
- **Verified:** draft PR CI run `152` (`35328074331`) passed migration load/replay, test `99`, type-check, and lint on exact tree `02b6fc6f...`.
- **Pending:** independent Reviewer, independent QA, hosted staging, and physical-device behavior.

## Handoff

Next: route exact tree `02b6fc6f...` to independent Reviewer and QA. Do not apply migration `0031` or configure the hosted worker before those gates and a new Founder authorization.
