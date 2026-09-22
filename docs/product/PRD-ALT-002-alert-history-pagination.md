# PRD-ALT-002: Complete Alert History

**Status:** Approved from Master Build Spec §§45–46 and the existing Alerts requirements
**AIOS lane:** Small reliability/completeness slice
**Scope owner:** Product

## Goal

Keep the in-app Alerts surface useful as history grows. A recipient must be able to progressively
reach every available Alert without a silent newest-100 ceiling, while primary Alert rows remain
usable when optional actor or Wall enrichment is temporarily unavailable.

## Acceptance criteria

- Load Alerts newest first in deterministic `(created_at DESC, id DESC)` pages.
- Show 50 Alerts at a time and expose a clear load-older action only while more rows exist.
- Validate a page cursor before it enters the PostgREST boolean-expression filter.
- Append older pages without duplicating a boundary row.
- A failed older-page request preserves the visible list and offers a retry.
- Actor/Wall enrichment failure preserves the underlying Alert rows, names the partial state, and
  routes affected rows to the existing privacy-safe Alerts fallback.
- Account switch, sign-out, blur, or a newer operation invalidates delayed page results.
- Existing actor-bound reads, exact read receipts, Anonymous/Secret privacy, and destination rules
  remain unchanged.

## Non-goals

- Push delivery, unread tab badges, universal HTTPS links, public-domain selection, schema/index
  changes, hosted changes, merge, deployment, or release.
- Inventing, seeding, deleting, or changing the retention of Alert rows.

## Success evidence

- Executable tests cover exact cursor output, malformed/impossible/injectable cursors, duplicate
  append, and existing receipt behavior.
- Source-contract tests cover two-column order, 50+1 lookahead, account fencing, partial metadata,
  and load-older recovery.
- TypeScript, zero-warning lint, full contracts, Expo Doctor, both exports, worker regression, and
  exact diff checks pass before publication is requested.
