# Frontend handoff: complete Wall Mark history

**Role:** Frontend
**Product authority:** PRD-MARK-001
**Architecture authority:** FP-MARK-001, independent architecture rereview of draft PR #25 head `19f67bc`
**Integration target:** draft PR #25 on top of PR #22; no schema, hosted change, merge, or deployment

## Implementation state

- My Wall, person Wall, and Shared Wall read active Marks in bounded pinned-first pages, expose Load older Marks with retry, and label the count as loaded until history is exhausted.
- Deferred exact-Mark recovery uses a wall-bound, active-only exact read under existing RLS. A target beyond the initial page is presented independently; Secret Marks use the existing locked shell and one-time server reveal, and normal Marks retain detail and reactions.
- A refresh or local removal discards prior pages/cursor. New arrivals are deduplicated in full timestamp precision. Realtime hydration is dropped after unsubscribe and checked against the current Wall and account before insertion. Account, Wall, focus target, blur, and reload fence delayed page results.
- Existing author hydration throws on failure. The reaction hook clears per-account state and releases IDs from an abandoned summary request so the next page render retries; late failures cannot erase a newer request's claim.

## Consumption compliance and verification

The actual `marks` table has non-null `pinned`, `created_at`, UUID `id`, active status, and existing RLS; `MarkView`, `MarkDetailModal`, and `useWallReactions` were inspected before integration. `MarkDetailModal` deliberately does not open Secret content, so the Secret focus uses `MarkView` with `isWallOwner` only for the recipient UI gate. The server remains the reveal authority.

**Verified locally:** `npm ci`; TypeScript; zero-warning lint; 100 contract tests (including 0/49/50/51 pinned boundary fixtures, equal timestamp page split, failed probe, delayed hydration switch, abandoned reaction request retry, and deferred exact read); Expo Doctor 17/17; iOS and Android exports; worker tests 31/31; whitespace check. Checks must be rerun on the final review tree after corrections.

**Not Verified:** no installed iOS/Android app or local PostgREST instance is available in this workspace. The actual phase predicates and RLS outcomes, long Wall behavior, Secret reveal, account switches, and device accessibility need QA in an authorized test environment. No hosted dataset or production query plan was inspected; index work remains a separately measured decision.

**Next roles:** independent Reviewer on the exact implementation tree; QA on a local PostgREST fixture and installed iOS/Android app. Keep this PR draft until both review and behavioral verification are complete.
