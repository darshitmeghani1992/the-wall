# Poll Mark architecture and delivery plan

Status: proposed architecture for the Product acceptance in [PRD-MARK-002](../product/PRD-MARK-002-poll-marks.md). This is a planning artifact. No schema, authorization, UX, rollout, or hosted activity is approved by this draft.

## Existing constraints at #213

- `0001_init.sql` retains legacy enum values and a `poll_votes` table with one integer option per account and Mark. It cannot represent a multiple-choice ballot.
- `0019_disable_excluded_surfaces.sql` revokes all client access to the old poll vote table and rejects retired Mark types. `0023_mark_writer_contract.sql` also restricts the generic creation RPC to text/photo/voice/video.
- `src/lib/types.ts` exposes only those four Mark types. `app/create.tsx` derives type from media or text. Supporting poll reads and writes is new implementation.

## Proposed contract

- Keep legacy storage private and preserve all retired-type restrictions. Use additive forward migration and a dedicated, actor-bound poll operation. The generic text/media creation path must still reject polls and all other retired types. Review a narrowly scoped exception for poll-parent creation in the dedicated transaction without using an incidental privileged role as the only enforcement. No raw client insert, ballot table CRUD, or broad table grant.
- Store typed options in immutable order and model one ballot header per poll/account with a set of stable option IDs. Link selections to both the ballot and its poll's options. Enforce integrity in the database. Treat legacy rows as quarantined from new reads and voting until a separately approved data review.
- Bind requests to the active account and canonical parent Wall. Evaluate active account, current Wall visibility, contribution and accepted membership, blocking, Mark moderation status and close state from server authority. Recheck on every read/mutation. Lock the poll during vote, edit and close operations, and commit the complete ballot replacement atomically. Prevent retry from creating duplicate Mark or ballot state.
- Reuse the viewer-safe Mark read surface and existing Anonymous actor rules. Return only the poll definition, aggregate counts, server state and the current viewer's own ballot where allowed. Private tables, alerts, realtime and share links cannot expose identities, option state or totals outside the read contract. Keep author capabilities server-derived. Treat Secret behavior as pending the explicit Product decision.
- Verify how moderation, parent removal and account deletion affect reads, votes and aggregates. Prefer deriving totals from canonical ballots to avoid stale counters and handle foreign-key cleanup. Select deletion semantics together with existing retention approval.

## Implementation slices after approval

| Order | Role | Deliverable and exit evidence |
|---|---|---|
| 1 | Product then Architect | Resolve Secret compatibility, approve composer/vote/result UX, then approve additive schema and explicit authorization matrix. Record decisions before protected edits. |
| 2 | Backend | Implement isolated poll schema, validated creation, ballot replaces, close and restricted read. Local rollback and regression SQL verify legacy kinds are still rejected, actor/privacy matrix, concurrency, stale sessions, retry and account lifecycle. |
| 3 | Frontend | Extend the typed composer and Mark card/detail flow, use server eligibility/capabilities, preserve drafts/retry, render accessible choices and universal result totals. Leave existing text/media creation and rendering intact. |
| 4 | Reviewer and QA | Independently review authorization and migration on immutable head. In authorized staging, verify private Personal and Shared Walls with real distinct signed-in actors, HTTP denials, concurrency, logging/privacy, data lifecycle and both device builds. |
| 5 | Release owner | Keep poll creation/voting off until review, exact build/device evidence and approved staged rollout. Disable new writes first on rollback while preserving permitted reads and existing ballots. Use additive roll-forward fixes for persisted data and rehearse disable/recovery before public shipment. |

Parallel preparation can start from fixed Product acceptance and shared API shape. Public enablement requires independent verification before inclusion can count as delivered.
