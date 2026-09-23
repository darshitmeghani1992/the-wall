# Integrated source candidate — 2026-09-23

## Scope and provenance

This draft branch combines approved source slices on top of draft PR #22 at
`29fa13a7c85ba6054a8b2477a17c7dcd502afe5a`. The remote branch/PR and CI
must be consulted for its final commit and tree; this file cannot embed its own
final SHA. No source slice has been merged into the main branch or deployed.

| Source draft | Contribution |
|---|---|
| #23 | Profile Friends count and one-use Discover People route hint |
| #25 | Complete Wall Mark history and focused old-Mark read |
| #26 | Alerts render independently of best-effort read receipts |
| #28 | Disposable PostgreSQL exact Mark-read RLS regression fixture, stacked on #25 |
| #29 | Discover People/Walls squared segmented control |

The #23 Discover route hint was applied after #29 because both edits affect
`app/(tabs)/discover.tsx`. Its account/focus reset logic and the #29 visual
switch are both retained. No changes to the existing API, migration set, or
authorization logic were made during integration.

## Verification boundary

Verified on the combined local tree: TypeScript, lint, 100/100 client/contract
tests, and Expo Doctor (17/17) passed. CI remains to be run. Earlier independent
reviews and QA apply only to the individual PR heads, not this combined tree.
Obtain fresh CI, independent Reviewer, then distinct QA on one unchanged
integrated commit/tree. The PostgreSQL test and mobile exports run in CI.

Integrated physical-device, real PostgREST/RLS, protected-media, account-switch,
accessibility, and multi-user behavior remain within issue #27. A green source
candidate is not a release verdict. No hosted migration, merge, deployment,
production-data change, or public release is authorized by this handoff.
