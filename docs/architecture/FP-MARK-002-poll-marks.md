# Poll Mark architecture and delivery plan

Status: proposed architecture for the Product acceptance in [PRD-MARK-002](../product/PRD-MARK-002-poll-marks.md). The Founder approved standard Poll Marks on 23 November 2026, with single and multiple selections and no Secret mode. Schema, authorization contract, UX, rollout and hosted activity remain subject to their separate approvals.

## Existing constraints at #213

- `0001_init.sql` retains legacy enum values and a `poll_votes` table with one integer option per account and Mark. It cannot represent a multiple-choice ballot.
- `0019_disable_excluded_surfaces.sql` revokes all client access to the old poll vote table and rejects retired Mark types. `0023_mark_writer_contract.sql` also restricts the generic creation RPC to text/photo/voice/video.
- `src/lib/types.ts` exposes only those four Mark types. `app/create.tsx` derives type from media or text. Supporting poll reads and writes is new implementation.

## Proposed contract

- Keep legacy storage private and preserve all retired-type restrictions. Use additive forward migration and a dedicated, actor-bound poll operation. The generic text/media creation path must still reject polls and all other retired types. Review a narrowly scoped exception for poll-parent creation in the dedicated transaction without using an incidental privileged role as the only enforcement. No raw client insert, ballot table CRUD, or broad table grant.
- Store typed options in immutable order and model one ballot header per poll/account with a set of stable option IDs. Link selections to both the ballot and its poll's options. Enforce integrity in the database. Treat legacy rows as quarantined from new reads and voting until a separately approved data review.
- Bind requests to the active account and canonical parent Wall. Evaluate active account, current Wall visibility, contribution and accepted membership, blocking, Mark moderation status and close state from server authority. Recheck on every read/mutation. Lock the poll during vote, edit and close operations, and commit the complete ballot replacement atomically. Prevent retry from creating duplicate Mark or ballot state.
- Reuse the viewer-safe Mark read surface and existing Anonymous actor rules. Return only the poll definition, aggregate counts, server state and the current viewer's own ballot where allowed. Private tables, alerts, realtime and share links cannot expose identities, option state or totals outside the read contract. Keep author capabilities server-derived. Reject Secret poll creation at the server boundary before any mutation. This poll-specific rule leaves existing Secret behavior for text/photo/voice/video unchanged.
- Verify how moderation, parent removal and account deletion affect reads, votes and aggregates. Prefer deriving totals from canonical ballots to avoid stale counters and handle foreign-key cleanup. Select deletion semantics together with existing retention approval.

## Implementation slices after approval

| Order | Role | Deliverable and exit evidence |
|---|---|---|
| 1 | Product then Architect | Confirm the proposed composer, voting, result, editing and close rules. Approve the additive schema and explicit authorization contract. The standard-polls decision already resolves Secret compatibility. |
| 2 | Backend | Implement isolated poll schema, validated creation, ballot replaces, close and restricted read. Local rollback and regression SQL verify legacy kinds are still rejected, actor/privacy matrix, concurrency, stale sessions, retry and account lifecycle. |
| 3 | Frontend | Extend the typed composer and Mark card/detail flow, use server eligibility/capabilities, preserve drafts/retry, render accessible choices and universal result totals. Leave existing text/media creation and rendering intact. |
| 4 | Reviewer and QA | Independently review authorization and migration on immutable head. In authorized staging, verify private Personal and Shared Walls with real distinct signed-in actors, HTTP denials, concurrency, logging/privacy, data lifecycle and both device builds. |
| 5 | Release owner | Keep poll creation/voting off until review, exact build/device evidence and approved staged rollout. Disable new writes first on rollback while preserving permitted reads and existing ballots. Use additive roll-forward fixes for persisted data and rehearse disable/recovery before public shipment. |

## First isolated unit and parallel preparation

The first Backend unit is a pure ballot-selection validator isolated from persistence. It takes the approved selection mode, the option identities for one poll, and the submitted selections. The unit needs no table, RPC, feature flag, credentials or hosted fixture. It does not choose option limits, eligible voters, result visibility, ballot-change policy or close behavior. Do not attach it to an app or database path before contract approval.

| Confirmed invariant | Backend unit or contract check | Parallel Frontend and QA preparation |
|---|---|---|
| Single-choice and multiple-choice have different selection cardinality | One valid selection is accepted in single-choice mode. Zero selections or two different choices are refused. An ordinary multiple-choice ballot accepts more than one valid selection. | Exercise one selection and replacement in single-choice mode, independent selections in multiple-choice mode, and both choice controls with accessibility tools. |
| Ballot choices must belong to the poll | Reject duplicate option identities, unknown IDs and IDs drawn from a different poll. A rejected set cannot be partially applied. | Exercise stale options and retry safely. Verify chosen options remain tied to the same account and Wall. |
| Standard variant only | Reject a request with Secret enabled before invoking storage or mutation. Confirm existing Secret tests on other types still pass. | Confirm a user cannot accidentally send a draft composed as Secret as a standard poll. Exercise option entry on both Personal and Shared Walls. |
| Use the existing privacy boundary | Parent Wall and poll authorization must pass before returning data or mutating a ballot. Wrong actor, lost membership, block or inaccessible Wall produces no side effects. | Prepare owner, member, outsider, account-switch and revoked-access scenarios. Vote eligibility within the visible audience remains a protected product detail. |
| Preserve existing Mark kinds and deny retired kinds | Poll submission belongs only to the narrow poll contract. The generic Mark API continues to handle the four existing types and rejects retired kinds. | Confirm text/media/Anonymous/Secret journeys and legacy card rendering do not regress. |

The two roles can prepare these units and scenarios in parallel. Wire the approved contract only after its protected decisions are recorded. Public enablement still requires independent review and installed-device verification.
