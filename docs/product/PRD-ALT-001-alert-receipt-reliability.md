# PRD-ALT-001: Alert Receipt Reliability

**Status:** Approved from existing Alerts and account-isolation requirements
**AIOS lane:** Small reliability/privacy slice
**Scope owner:** Product

## Goal

Make in-app Alerts behave truthfully and safely: only the currently authenticated recipient may
load or acknowledge their Alerts, visible unread indicators must immediately match successful read
receipts, and malformed/future timestamps must never render confusing negative time labels.

## Acceptance criteria

- Alert list and read operations require the expected authenticated account before querying.
- A single read receipt is constrained by both Alert ID and recipient ID and requires an exact
  returned row before reporting success.
- Mark-all-read returns the exact affected IDs; zero unread Alerts is a valid no-op.
- After mark-all succeeds, only those returned Alerts become read in the visible list.
- Opening an unread Alert reconciles that exact row locally after its receipt succeeds.
- Read-receipt failures never block useful destination navigation.
- Account switches invalidate stale loads, receipts, local state updates, and navigation.
- Future timestamps clamp to “just now”; invalid timestamps use a neutral fallback.

## Non-goals

- Push notifications, background delivery, unread tab badges, schema/RLS changes, hosted changes,
  merge, or deployment.
- Inventing or seeding notification rows.

## Success evidence

- Pure behavior tests cover exact local reconciliation and time boundaries.
- Source-contract tests cover actor/recipient binding and stale-account fences.
- TypeScript, lint, full client tests, Expo config, both platform exports, and draft-PR CI pass.

