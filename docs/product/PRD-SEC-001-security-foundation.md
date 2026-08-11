# PRD: SEC-001 — Security Foundation

## Validation Tier
Spec-Ready (Playbook §7). The security decisions (A–E) are Founder pre-approved; this PRD
crystallizes them into testable acceptance criteria and hands off to Architect for design.
Architect's Complexity Estimate is not yet consulted — see Open Questions.

## Problem
Before we build Friends, the Friend Wall, the recipient picker, or Shared Walls, the
authorization foundation those features stand on must be trustworthy. A concrete audit of the
initial schema (`supabase/migrations/0001_init.sql`) found that the current row-level security
does not enforce the social guarantees those upcoming features assume: a friendship requester
can accept their own request, contradictory reverse-duplicate friendships can exist, "blocked"
is a status that nothing enforces, anonymous marks leak the author's identity through normal
reads, mark authors can pin/approve/moderate their own marks, and the storage-bucket
authorization is not reproducible from the repo. Building social features on top of this would
multiply the blast radius of each hole. **Why now:** these are foundational invariants — cheaper
and safer to close before dependent features exist than to retrofit after users and data arrive.

## Evidence
Verified findings against `supabase/migrations/0001_init.sql` (Confidence: **Verified** — read
directly from the committed migration):
- **F1** `friendships update party` policy uses `using (requester_id = auth.uid() or
  addressee_id = auth.uid())` with no `WITH CHECK` and no addressee-only guard on acceptance →
  a requester can set `status='accepted'` on their own request. (0001_init.sql:327-329)
- **F2** friendships PK is `(requester_id, addressee_id)` → both (A,B) and (B,A) rows can exist →
  contradictory reverse duplicates for one social pair. (0001_init.sql:103-110)
- **F3** `friendship_status` includes `'blocked'`, but `are_friends`, `can_view_wall`, and
  `can_contribute` only test `'accepted'` → a block changes no authorization outcome.
  (0001_init.sql:135-171)
- **F4** `marks view` returns full rows including `author_id`; anonymity is client-side masking
  only → an ordinary consumer can read the true author of an anonymous mark. (0001_init.sql:252-261)
- **F5** `marks update author or owner` has no column guard → an author can update `pinned` and
  `status` on their own mark (self-pin, self-approve). (0001_init.sql:266-271)
- **F6** No storage bucket/policy migration exists in the repo → the `attachments` bucket's
  authorization cannot be reproduced or verified from source control. (Confidence: **Verified** —
  absence confirmed; no storage policy migration present.)

## Security Guarantees (testable requirements, one per Founder-approved decision A–E)

> These restate the Founder-approved decisions as WHAT must be true. HOW (SQL, RLS, `WITH CHECK`,
> constraints, storage policies, moderation surface) is Architect/Backend territory — this PRD
> names the guarantee and the observable outcome, never the mechanism.

- **G-A — Moderated anonymity (decision A).** For a mark marked anonymous, no recipient, no
  ordinary user, and no normal client or API read path may obtain the author's identity. A
  protected platform-moderation path MAY retain and access author identity for abuse, safety, or
  legal need. Anonymity is enforced at the data-access boundary, not by client-side masking.
  Irreversible cryptographic anonymity is explicitly **not** to be built (it would defeat the
  moderation carve-out).

- **G-B — Blocking is a hard interaction boundary (decision B).** When a block exists between two
  users, the boundary must deny, in both directions where applicable: sending/receiving friendship
  requests, contributing a Mark to the other's wall, contribution eligibility, recipient
  eligibility, and interaction/notification flow between the pair. A block must also override any
  pre-existing `accepted` friendship for interaction purposes. (Public-content visibility under a
  block is the one open product question — see Open Questions.)

- **G-C — Friendship transitions are role-correct (decision C).** Only the requester may create a
  request and cancel it while pending. Only the addressee may accept or decline a pending request.
  Either party may unfriend an existing accepted relationship. A requester may **never** move their
  own request to accepted.

- **G-D — One logical friendship per pair (decision D).** For any unordered pair of users, at most
  one logical friendship may exist. The system must prevent contradictory reverse duplicates — the
  data model cannot represent both directions of the same pair as two independent relationships.

- **G-E — Server-side Mark moderation authority (decision E).** Owner-only operations on a mark —
  pinning, approval, moderation, status changes — must be enforced server-side and available only
  to the wall owner (and the protected moderation path). A mark's author, acting on their own mark,
  may not grant themselves any owner-only moderation outcome. UI hiding is not sufficient.

## Non-Goals
This cycle deliberately does **not** deliver (each is out of scope even though adjacent):
- Friends UI, friend-request screens, or any friend-management surface.
- The Friend Wall, Shared Walls, or any new wall type or wall-sharing behavior.
- The recipient picker.
- Games, new Mark types, reactions/comments/poll changes beyond what the guarantees above touch.
- Notifications UI or new notification kinds (only the block-suppression *rule* is in scope, not
  a notifications feature).
- Building the moderation console/tooling UI (the guarantee requires that a protected path *can*
  access author identity and perform owner-only ops; it does not require shipping an admin UI this
  cycle).
- Any unrelated performance, indexing, or refactor work not required by a guarantee above.
- Irreversible cryptographic anonymity (explicitly excluded by decision A).

## User Story
As a person using The Wall, I want the platform's social rules — who is really my friend, who is
blocked, who wrote an anonymous mark, and who can moderate a wall — to be enforced by the system
itself, so that no other user can bypass them by calling the API directly, and so that the
features built on top of these rules are trustworthy.

## Acceptance Criteria

Each criterion is behavioral and must be verifiable by QA against a running Postgres with RLS
active, exercised as the relevant end-user role (not as a superuser/service role that bypasses
RLS). "Denied" means the operation fails or returns no rows under the acting user's privileges,
not merely that a UI hides it. Criteria map 1:1 to the required security-suite proofs and must not
be weakened to accommodate current unsafe behavior.

| ID | Given | When | Then |
|---|---|---|---|
| **AC-S1** | A pending friendship request exists that user A sent to user B | A (the requester) attempts to move that request to `accepted` | The operation is denied; the request remains pending. Maps to F1, guarantee G-C. |
| **AC-S2** | A pending friendship request exists that user A sent to user B | B (the addressee) accepts the request | The operation succeeds; the pair is now an accepted friendship. Maps to G-C. |
| **AC-S3** | A friendship (in any status) already exists for the unordered pair {A,B} | Any user attempts to create a second, reverse relationship for the same pair (e.g. B→A) | The system prevents it; only one logical friendship for the pair can exist. Maps to F2, guarantee G-D. |
| **AC-S4** | A block exists between users A and B | The blocked user attempts to contribute a Mark to the other user's wall | Contribution is denied. Maps to F3, guarantee G-B. |
| **AC-S5** | A block exists between users A and B | The system evaluates interaction eligibility between them (friend request, contribution eligibility, recipient eligibility, notification/interaction flow) | Each such eligibility check returns denied/ineligible for the blocked pair. Maps to F3, guarantee G-B. |
| **AC-S6** | A mark was created as anonymous | A recipient / ordinary user reads that mark through the normal client or API read path | The author's identity is not retrievable through that path. Maps to F4, guarantee G-A. |
| **AC-S7** | User A is the author of a mark on a wall A does not own | A attempts to set `pinned = true` on their own mark | The operation is denied; the mark is not pinned by its author. Maps to F5, guarantee G-E. |
| **AC-S8** | User A is the author of a mark that is `pending` on a wall A does not own | A attempts to change that mark's status to approve/moderate it (e.g. to `active`) | The operation is denied; the author cannot self-approve or self-moderate. Maps to F5, guarantee G-E. |
| **AC-S9** | A mark exists that was authored by user A on user O's wall | An unrelated user C (not the author, not the wall owner) attempts to modify that mark | The operation is denied. Maps to guarantee G-E. |
| **AC-S10** | User O owns a wall containing a mark authored by someone else | O performs a valid owner moderation action (pin, approve, change status, hide) | The operation succeeds. This is the positive-path guard that the fixes did not over-restrict legitimate owner moderation. Maps to G-E. |

Additional non-numbered acceptance requirement (guarantee G-A moderation carve-out + F6):
- The Storage authorization for the `attachments` bucket must be reproducible from source control
  (i.e. defined in a committed migration/policy, not configured only in a live dashboard), so QA
  can stand up an equivalent environment and verify attachment access rules. Confidence:
  **Believed-likely** that this belongs in SEC-001 scope as stated; Architect confirms the exact
  reproducible artifact.

## Edge Cases
- A block created *after* an accepted friendship already exists: the block must take precedence for
  interaction (G-B), not be silently ignored because the pair was previously friends.
- A pending request where the requester tries to decline vs. cancel: cancel (by requester) is
  allowed; "decline" is the addressee's action — Architect to model the transition table so these
  don't collapse into one ambiguous update.
- An anonymous mark whose author later deletes their account (`author_id` is `on delete set null`):
  anonymity must not regress to exposing a stale identity; the null case must still read as
  authorless to ordinary consumers.
- Owner-only moderation when the owner is *also* the author of their own mark: the owner path must
  still work (they legitimately own the wall) — the restriction targets non-owner authors.
- Self-block or block of a non-existent relationship: should be a no-op or rejected cleanly, never
  an error path that leaves partial state.

## Success Metrics
- 10/10 acceptance criteria (AC-S1…AC-S10) pass against a running Postgres with RLS enforced, plus
  the reproducible-Storage requirement verified — this is the primary, binary success measure.
- Zero of the six verified findings (F1–F6) remain reproducible after the cycle: each previously
  unsafe behavior, re-attempted as an ordinary user, is now denied.
- The security-test suite is committed and re-runnable, so these invariants stay proven as later
  features (Friends, Friend Wall, recipient picker, Shared Walls) are built on top.

## Failure / Kill Criteria
This is a foundational security cycle, so the "kill" framing is a **stop-and-escalate** bar, not a
"pull the feature" bar:
- If closing any guarantee (A–E) as specified would require breaking a Founder-approved decision
  or a currently-shipping legitimate behavior that cannot be preserved, stop and escalate to the
  Founder rather than weakening the acceptance criterion.
- If Architect's design shows a guarantee cannot be enforced server-side at the data layer and
  would require trusting the client, that is a stop-and-escalate condition, not an acceptable
  fallback — client-trusted enforcement fails the intent of SEC-001.

## Product Quality Bar
- **Emotional outcome:** users (and the Founder) trust that "blocked means blocked" and "anonymous
  means anonymous" are real, not cosmetic. The invisible correctness is the feature.
- **Perceived quality:** a legitimate wall owner moderating their wall, or a normal user accepting
  a friend request, notices nothing new — the guarantees tighten abuse paths without adding friction
  to honest flows (AC-S2 and AC-S10 protect this).
- **Friction tolerance:** high friction is acceptable on the abuse paths (self-accept, self-pin,
  identity de-anonymization) — those should be flatly impossible. Near-zero added friction is the
  bar for honest paths.

## Assumptions
- **ASSUMPTION-S1** (Confidence: **Verified**): Findings F1–F6 accurately describe the committed
  schema's behavior — read directly from `0001_init.sql`. What would break it: a later migration
  already altering these policies (none observed in scope).
- **ASSUMPTION-S2** (Confidence: **Believed-likely**): Enforcing all ten criteria server-side is
  achievable within RLS + constraints + a protected path without redesigning the domain model.
  Architect confirms via Complexity Estimate. If broken: scope or sequencing of dependent social
  features shifts.
- **ASSUMPTION-S3** (Confidence: **Inferred**): The `attachments` storage authorization can be
  expressed in a committed migration/policy so it is reproducible. If broken: the reproducibility
  requirement may need a different artifact (documented config-as-code), to be resolved by Architect.
- **ASSUMPTION-S4** (Confidence: **Believed-likely**): A "protected moderation path" (service
  role / privileged path) is an acceptable mechanism for the anonymity carve-out and owner-only
  ops, consistent with decision A. If broken: guarantee G-A's carve-out needs a different design.

## Complexity Estimate (from Architect)
Not yet consulted. Required before this PRD is Build-Ready (Playbook §15). Handed to Architect with
this PRD.

## Open Questions for Architect / possible Founder Gate

1. **Does a block also hide the blocker's PUBLIC wall/marks from the blocked user?** (The one
   genuinely-open product decision.) Public content is normally world-readable, so a hard block
   raises a real tension: does "hard interaction boundary" also remove read access to already-public
   content, or does it stop at social interaction (requests, contribution, eligibility, notifications)
   while public content stays publicly viewable?
   - **Product's recommendation:** the block should stop *interaction* and hide *private* content
     between the pair, but should **not** retroactively make already-public content invisible to the
     blocked user — unless the Founder explicitly wants full mutual invisibility. Rationale: retroactive
     public-content hiding is a larger, harder-to-reverse privacy-model change with anti-circumvention
     edge cases (logged-out viewing, alt accounts), and it exceeds the "interaction boundary" the
     Founder approved. Confidence: **Believed-likely** this matches Founder intent given decision B's
     wording centers on interaction.
   - **Routing:** flagged for **Architect to model** the public-content visibility implication of
     blocking (decision B already directs Architect to do this). Escalate to the **Founder only if
     Architect finds it genuinely unresolvable** or if the design forces a choice that changes the
     product's public-visibility model. If the Founder wants full mutual invisibility, that is a
     Founder decision and re-enters this PRD as a revised guarantee for G-B.

2. **Exact reproducible artifact for Storage (`attachments`) authorization (F6).** Product's
   requirement is "reproducible from source control and QA-verifiable"; the precise form (SQL
   migration on `storage.objects` policies vs. another config-as-code mechanism) is Architect's call.
   Not a Founder gate unless it forces a privacy-relevant change.

3. **Whether SEC-001 must ship the protected moderation *access path* itself, or only guarantee it
   is possible.** Product scoped the moderation *console/UI* as a non-goal but requires that
   author-identity retrieval and owner-only ops are reachable by a protected path. Architect to
   confirm the minimum needed this cycle so the anonymity carve-out (G-A) is real and not deferred
   into a gap.
