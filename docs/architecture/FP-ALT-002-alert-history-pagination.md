# Feature Plan: Complete Alert History

## Classification

- **Tier:** Small
- **Database/API impact:** None; existing `notifications` RLS and index remain authoritative
- **Risk:** Moderate client privacy/race surface, low operational blast radius

## Design

`src/lib/created-at-pagination.ts` owns the shared descending `(created_at, id)` cursor validator
and PostgREST predicate used by Alerts and moderation history. It accepts only a semantic ISO
timestamp and canonical PostgreSQL UUID before producing the raw nested `or/and` filter.

`listNotifications(expectedActorId, cursor?)` continues to preflight the authenticated recipient,
then reads 51 rows ordered by `created_at DESC, id DESC`. It returns 50 visible rows and uses the
last visible row as the next cursor only when the lookahead row exists.

Actor profiles and Wall routing metadata are optional enrichment queries. Their failures do not
erase successfully loaded recipient-owned Alert rows. Missing enrichment produces neutral actor
copy and the existing Alerts route fallback; the screen names that details are incomplete.

The Alerts screen owns an independent older-page token. Full refresh, navigation, blur, sign-out,
or account switch invalidates it. Successful pages append through an ID-deduplicating pure helper;
failed pages keep the current list and cursor so the same page can be retried.

## Preserved boundaries

- The existing screen-open mark-all receipt contract remains exact-ID reconciled and actor-bound.
- Opening an unread Alert still attempts its single exact receipt without blocking navigation.
- Notification creation, vocabulary, RLS, Anonymous provenance, Secret content, and routing rules
  do not change.
- No schema, migration, RPC, dependency, native configuration, hosted environment, or production
  state changes.

## Verification

- Pure cursor tests: exact predicate, impossible timestamp, malformed UUID, and injection attempts.
- Pure append test: boundary duplicates are suppressed without reordering.
- Static integration tests: two-column order, 50+1 lookahead, cursor filter, load-older action,
  partial-details message, expected-actor and exact-receipt contracts.
- Full client, Expo, export, and worker regression gates before publication.
