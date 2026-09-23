# Feature Plan: Complete Wall Mark History

**Status:** Revised client-only proposal pending independent architecture rereview
**Product input:** `docs/product/PRD-MARK-001-complete-wall-history.md`
**Tier:** Medium; client read and navigation contract, three Wall screens
**Complexity estimate:** Several focused Frontend sessions plus independent Reviewer and device QA
**Reversibility:** Client-only design is reversible before release. No migration proposed.

## Repository evidence

- `src/lib/marks.ts` reads all active rows for a Wall with `pinned DESC, created_at DESC`, with no cursor, tie-breaker, or page limit.
- `src/lib/deferred-destination-resolver.ts` receives `wallMarks(wallId)` and treats absence from that array as terminal. All three Wall screens pass their full-list promise and focus by searching its result.
- `src/lib/created-at-pagination.ts` already validates semantic timestamps and UUIDs for raw PostgREST cursor expressions. Alerts uses a 50+1 lookahead with an ID tie-breaker.
- `Masonry` lays out the supplied array in memory. Reactions and realtime arrivals currently operate over that loaded array.
- The initial schema has `marks_wall_created_idx` on `(wall_id, created_at DESC)`; it lacks a pinned-first composite index. Query plans and actual hosted table sizes have not been measured.

## Proposed read contract

1. Introduce `listWallMarks(wallId, cursor?)` with a 50-item visible page in `(pinned DESC, created_at DESC, id DESC)` order, active status, Wall ID filter, and existing RLS. Its cursor holds the last emitted row's `pinned`, `created_at`, and `id`. Validate the pinned boolean, semantic timestamp, and UUID before any raw PostgREST expression. Avoid a nested pinned-boundary predicate: query `pinned=true` first, with a 50+1 lookahead and the existing `(created_at,id)` predicate only if resuming within that phase. If the pinned phase emits fewer than 50, query `pinned=false` for the remaining slots plus one lookahead, starting from its beginning. If the pinned phase emits **exactly 50 with no pinned lookahead**, issue an RLS-filtered `pinned=false` existence probe (`limit(1)`); an unpinned result means `hasMore=true` and the next cursor remains the last pinned row. When resuming from a `pinned=false` cursor, query only that phase with the validated timestamp/ID predicate. Every phase and probe uses the same wall/status filters and deterministic two-column order for pages. A pinned lookahead means the next cursor is pinned; otherwise, an unpinned lookahead means it is unpinned. If either read or the existence probe fails, fail the entire page and leave the previous list/cursor unchanged.
2. Add a separate `getWallMark(wallId, markId)` exact read with `wall_id`, `id`, and `status=active` predicates under existing RLS. A typed null means terminal unavailability; query or hydration failures throw and remain retryable. The deferred resolver accepts an exact-Mark operation instead of checking membership in a list.
3. On each Wall screen, fetch the first page and the exact target independently when `focusMark` exists. Keep an exact target outside the loaded page in a separate focused presentation above the grid. Render a Secret via `MarkView` so only the locked shell and existing one-time reveal flow appears, even if it is already in the first page; suppress that same ID from the grid while its focused shell is shown. Render a non-Secret via the existing detail and card path. Include the exact target in the deduplicated `useWallReactions` input when outside the grid, so reactions load and remain actionable. If a later page includes it, deduplicate the presentation while retaining detail/reveal state. Fence all page, focus, and reaction results to the current account, Wall, navigation target, and refresh generation; reset reaction summaries/IDs when the account changes. Append page items by unique ID, retaining the cursor after a failed load.
4. Keep live inserts visible once, placed according to pinned-first sort. When a pin/unpin, removal, refresh, or another known sort-changing action occurs, invalidate and discard **all** accumulated pages and their cursor, then fetch the first page again; separately fetched exact focus remains until revalidated. Realtime arrivals during paging cannot offer a transactional snapshot: deduplicate them and refresh the list when the live event changes established ordering. For mutations elsewhere or concurrent changes that cannot be observed, the cursor guarantee is only for a stable dataset; a user refresh reconciles the current Wall. Filter only the loaded grid; the older-page action remains available even when a filter has no loaded matches.
5. Label the header with the loaded grid count, not the Wall total, while `nextCursor` exists. Once the final page is reached, the count may be presented as the total of the now-loaded visible rows. The separately focused target is excluded until it joins a loaded page. No extra count query or new authorization surface is needed.

## Design questions before build

- Verify both query phases and the transition with a local Supabase/PostgREST fixture or an authorized test environment before calling behavior QA complete; no unverified nested pinned-boundary expression is proposed.
- Measure `EXPLAIN` and actual data volume before deciding whether a new index is needed. A migration would be a separate Founder gate and independent architecture review. The client-only bounded read can be reviewed independently of a possible later performance index.
- Check existing reactions/account switching and sorting of realtime inserts and pin actions in implementation; these are in scope for preserving the current behavior.

## Verification and handoff

Pure cursor and append tests should cover malformed values, equal timestamps, exactly 0/49/50/51 pinned rows with unpinned lookahead, pinned boundary, duplicates, and reordered live arrivals. Source/integration tests should cover exact read rather than list membership, each Wall's account/navigation fence, loaded-count copy, filtering, cursor invalidation, Secret shell and reaction data for an out-of-page focus, and retry. Device QA must cover older exact links for ordinary/Anonymous/Secret Marks, authorization outcomes, page failures, and long Personal/Shared Walls. Reviewer inspects the exact tree and RLS-preserving query shapes. No hosted state, merge, or deployment is part of this proposal.

**Build readiness:** Pending independent rereview of the exact-50-pinned existence probe. Once accepted, the client-only implementation can begin; the local PostgREST fixture and device QA remain verification gates before behavior can be called complete. A database index decision requires separate measurement and authorization; this slice does not include a migration.
