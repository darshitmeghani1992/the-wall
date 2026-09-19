# Frontend Handoff: Alert Receipt Reliability

**Date:** 2026-09-17
**Slice:** ALT-001
**State:** Author-side verified; draft-PR CI pending

## Delivered

- Alert loads and receipts now preflight the expected authenticated recipient.
- Single receipts filter by both Alert ID and recipient and require the exact updated row.
- Mark-all receipts return exact affected IDs; zero unread rows remains a valid no-op.
- Visible unread dots reconcile immediately from the returned IDs.
- Account-switch fences suppress stale updates and destination navigation.
- Future and invalid timestamps render safe, non-negative labels.
- The empty Alerts state now offers direct forward actions to My Wall and Discover, so it no
  longer violates the approved no-dead-ends requirement.

## Evidence

- TypeScript: pass
- ESLint: pass with zero errors and zero warnings
- Client/contract tests: 73/73 pass on the latest local candidate
- Expo public config: pass
- iOS and Android production exports: pass on the preceding exact head; fresh candidate exports
  are delegated to draft-PR CI
- `git diff --check`: pass

## Boundary

No notification rows are invented. No schema, migration, RLS, dependency, hosted environment,
merge, or deployment changed. Push delivery and tab badges remain outside this slice.
