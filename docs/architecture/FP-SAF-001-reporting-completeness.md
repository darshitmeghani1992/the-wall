# Feature Plan: Reporting Completeness

## Complexity estimate

- **Tier:** Small (existing tables/RLS/services; new client flow only)
- **Complexity:** Moderate because reporting and blocking touch safety and account/target races
- **Database impact:** None
- **Dependencies:** Existing `reports`, `blocks`, `createReport`, and `blockUser` contracts
- **Operational risk:** Low for the draft source boundary; no hosted or irreversible action

## Goal and build order

Reuse the existing reporting primitives and add one pure flow coordinator before wiring two screens.
No new endpoint, schema, global state, or dependency is permitted.

1. Add a dependency-injected coordinator for report → optional block.
2. Add behavioral tests for order, partial failure, retry, and stale continuations.
3. Extend person reporting to consume the coordinator.
4. Add a Shared Wall reporting screen and non-owner entry point.
5. Register the route and run the complete verification boundary.

## Client contract

`runUserReportFlow` accepts an immutable snapshot of actor, target, reason, details, whether the
report was already submitted, and whether blocking is requested. It receives injected report/block
ports and lifecycle callbacks. The coordinator:

- stops before any side effect when `isCurrent()` is false;
- submits at most one report for a logical screen attempt;
- records report success before attempting a block;
- never attempts a block after report failure;
- routes block failure to a distinct callback so the screen can retry without duplicating the
  report;
- invokes final cleanup only for the still-current account and target.

The Shared Wall flow uses the already actor-bound `createReport(expectedActorId, { wallId, ... })`
service directly with `SessionFocusFence` and `TargetRouteFence`.

## Security and privacy

- Authorization remains server-side through existing RLS and actor checks.
- The client does not inspect moderation records, reveal anonymous authors, or infer enforcement.
- Report details remain bounded user input and are not placed in navigation parameters or logs.
- Owners are not offered a self-report action for their own Shared Wall.

## Edge and failure cases

- Double taps: one in-flight action.
- Account A → B or target X → Y during await: stale callbacks have no UI/navigation effect.
- Report succeeds, block fails: exact report is not retried; only block can be retried.
- Wall disappears before submit: database error is shown and the form remains available.
- Unknown or malicious route target: database constraints/RLS reject it; no success is shown.

## Files

- `src/lib/reporting-flow.ts` and `.test.ts`
- `app/report-user/[id].tsx`
- `app/report-wall/[id].tsx`
- `app/shared/[id].tsx`
- `app/_layout.tsx`
- `tests/frontend-reporting.test.mjs`

## Definition of done

All acceptance criteria are represented by executable tests; typecheck/lint/client suites and both
production exports pass; draft PR CI is green. Hosted migration, merge, and deploy remain excluded.

