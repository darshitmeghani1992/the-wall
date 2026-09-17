# Feature Plan: Alert Receipt Reliability

## Classification

- **Tier:** Small
- **Database/API impact:** None; uses existing `notifications` table and RLS
- **Risk:** Moderate client privacy/race surface, low operational blast radius

## Design

`src/lib/notifications.ts` remains the single server-data adapter. Every exported read operation
accepts `expectedActorId`, resolves the live Supabase user, and rejects a mismatch before the query.
Mutation filters include `user_id = expectedActorId` even though RLS remains the final boundary.

- `listNotifications(expectedActorId)` returns at most the existing 100 newest rows.
- `markNotificationRead(expectedActorId, notificationId)` updates one recipient-bound row and
  requires that exact row in the response.
- `markAllNotificationsRead(expectedActorId)` updates unread rows and returns their IDs. An empty
  array is valid.

`src/lib/notification-ui.ts` owns pure presentation behavior: deterministic relative-time labels
and immutable reconciliation of returned receipt IDs. The Alerts screen applies results only while
its existing `SessionFocusFence` token remains current.

## Failure and race behavior

- Receipt failure: keep current visual state; navigation remains available.
- A→B account switch during any await: RLS prevents cross-account mutation and the screen fence
  suppresses stale local state/navigation.
- Missing/deleted single Alert: exact-row enforcement rejects the receipt; navigation may still use
  the already loaded safe route snapshot.
- Invalid/future timestamp: render `recently` / `just now`, never a negative interval.

## Files

- `src/lib/notifications.ts`
- `src/lib/notification-ui.ts` and `.test.ts`
- `app/(tabs)/alerts.tsx`
- `tests/frontend-alerts.test.mjs`

## Definition of done

All tests and exports pass, the exact remote tree passes PR CI, and no hosted, schema, merge, or
deployment boundary changes.

