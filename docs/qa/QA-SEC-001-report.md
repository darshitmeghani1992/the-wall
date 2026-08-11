# QA Decision: SEC-001 — Security Foundation

**Role:** QA (behavioral verification, the second Two-Key)
**Governs under:** QA Charter v2.1 / QA Playbook v2.1 / AIOS Constitution v1.1
**Under test:** branch `claude/sec-001-security-foundation`, commit `4452552`
**Entry precondition:** Reviewer APPROVE confirmed (first Two-Key). This is the mandatory QA sign-off.
**Test Depth Classification:** **Two-Key** (security-sensitive logic, migrations, permissions) — QA Playbook §4.
**Date:** 2026-08-11

---

## VERDICT: PASS

All ten acceptance criteria (AC-S1…AC-S10), the moderator-read carve-out, and the F6 storage
authorization were **executed against a live PostgreSQL 16 instance as the actual end-user roles**
(`authenticated` / `anon` under RLS, `service_role` for the moderation path) and behaved exactly as
the PRD requires. Every negative case was confirmed to fail **for the intended reason** (specific
SQLSTATE / message captured, not a broad catch). Every honest path still works. Zero Production-risk
or Two-Key-critical findings outstanding. This satisfies the QA Two-Key gate (Charter §7, §18).

**Confidence label:** DB authorization layer — **Verified (executed and observed)**. Deployed hosted
Supabase project and the live mobile client — **Believed-likely**, not exercised in this sandbox
(see Scope Note and Founder Manual Verification).

---

## 1. `run_tests.sh` — vendored harness (both runs)

Command: `bash supabase/tests/run_tests.sh` (resets a throwaway DB, loads shim → 0001 → 0002 → 0003
→ seed, runs all assertion files; every file uses `ON_ERROR_STOP`).

| Run | Exit code | Assertions |
|---|---|---|
| Run 1 | **0** | Every assertion **PASS** (AC-S1 both vectors, AC-S2, AC-S3, AC-S4, AC-S5 ×2, AC-S6 ×4, AC-S7, AC-S8, AC-S9, AC-S10, storage ×8) |
| Run 2 (idempotency) | **0** | Identical — every assertion **PASS** |

Both runs printed `✔ ALL SEC-001 ASSERTIONS PASSED`. Idempotent (the runner drops/recreates the DB;
all migrations are drop-if-exists / if-not-exists). This is the vendored suite; because it uses a
broad `exception when others` catch, I did **not** rely on it alone — see §2.

---

## 2. Independent behavioral scenarios (my own, denial cause captured)

I built independent scenarios on a separate DB (`qa_sec001`, freshly loaded shim + 0001/0002/0003 +
seed) that drive realistic end-user flows and capture the **actual SQLSTATE + message** for every
negative case, so a "denied" is provably the intended rule rather than an incidental error (the exact
gap the Reviewer flagged in the harness idiom). Scripts:
`scratchpad/qa_independent.sql`, `qa_storage.sql`, `qa_adversarial.sql` (temporary, not committed).

### Acceptance Criteria — all Verified

| AC | Scenario (as end-user role) | Observed result | Denial cause captured |
|---|---|---|---|
| **AC-S1** (via UPDATE) | A (requester) `UPDATE … status='accepted'` on own A→B request | Denied; request stays pending | `P0001` — `SEC001_TRANSITION: only the addressee may accept a friend request` (transition trigger) |
| **AC-S1** (via INSERT) | A inserts A→C row with `status='accepted'` | Denied; no accepted row | `42501` — `new row violates row-level security policy for table "friendships"` (INSERT WITH CHECK pins `status='pending'`) |
| **AC-S2** | B (addressee) accepts A→B | Succeeds → `accepted`; `are_friends(A,B)` becomes true (and was false while merely pending) | n/a (positive path) |
| **AC-S3** | B inserts reverse pair B→A while A→B exists | Prevented | `23505` — `duplicate key value violates unique constraint "friendships_pair_uniq"` (normalized unordered-pair index) |
| **AC-S4** | C (blocked by O) contributes a mark to O's `everyone` wall | Denied | `42501` — RLS on `marks` (`can_contribute` false due to `is_blocked`), even on an `everyone` wall |
| **AC-S5** | Eligibility for blocked pair O/C: `are_friends`=false (block overrides the seeded accepted O↔C friendship), `is_blocked`=true **in both directions**, `can_contribute`=false; and E (blocked by D) sends a friend request to D | All ineligible; blocked request denied | request: `42501` — RLS on `friendships` (`not is_blocked` in INSERT WITH CHECK) |
| **AC-S6** | A posts an anonymous mark **explicitly sending its own author_id**; ordinary reader B reads via normal `marks` path and attempts the side table; `service_role` reads the side table | base row `author_id` = NULL; realtime payload row (= base row) carries NULL; B sees `author_id` NULL; B cannot read side table; service_role reads true author = A | side-table read by B: `42501` — `permission denied for table anonymous_mark_authors` (revoked from authenticated) |
| **AC-S7** | A (author, not owner) self-pins own mark | Denied; not pinned | `P0001` — `SEC001_MODERATION: only the wall owner may pin/approve/change status` |
| **AC-S8** | A self-approves own pending mark (→active) | Denied; stays pending | `P0001` — `SEC001_MODERATION` (same guard) |
| **AC-S9** | C (unrelated) modifies A's mark | Denied; 0 rows affected, not pinned | RLS `USING (author or owner)` filters the row → `UPDATE` affects **0 rows** (no state change) |
| **AC-S10** | O (wall owner) pins, approves (pending→active), and hides marks authored by A | All succeed | n/a (positive path — fixes did not over-restrict legitimate owner moderation) |

### Storage (F6) — all Verified (`scratchpad/qa_storage.sql`)

| Case | Result | Cause captured |
|---|---|---|
| `attachments` bucket reproducible from source + public | PASS | defined in committed `0003_storage_attachments.sql` |
| anon public read | PASS (2 objects) | public bucket read policy |
| authenticated write to own `avatars/{uid}/…` | Allowed | path-scoped INSERT policy |
| authenticated write under `marks/…` | Allowed | `marks/` prefix branch (not uid-scoped by design — ADR-006) |
| write to another user's `avatars/{other-uid}/…` | Denied | `42501` — RLS on `storage.objects` |
| write under a non-scoped prefix (`other/…`) | Denied | `42501` — RLS on `storage.objects` |
| adversarial: `avatars/x.png` with **no uid segment** | Denied | `42501` — RLS on `storage.objects` |
| anon write | Denied | `42501` — `permission denied for table objects` (denied at the GRANT layer — stronger than policy) |
| delete-own-only (A deletes B's object; A deletes own) | B's untouched (0 rows), own deleted (1 row) | RLS `USING (owner = auth.uid())` |

### Additional adversarial + honest-path probes (`scratchpad/qa_adversarial.sql`)

| Probe | Result | Cause |
|---|---|---|
| ADV-1: A inserts non-anon mark claiming `author_id = B` (author spoofing) | Denied | `42501` — RLS on `marks` (`author_id = auth.uid()` required) |
| ADV-2: **owner** posts anonymously | base `author_id` NULL; side table records the **owner** as true author | write-boundary trigger + `auth.uid()` ownership derivation |
| ADV-3: addressee reverts an accepted friendship to pending | Denied | `P0001` — `SEC001_TRANSITION: cannot move a friendship back to pending` |
| ADV-4: author edits the **text** of own mark (non-moderation column) | Allowed (1 row) | honest path preserved — moderation guard only gates pinned/status/wall_id/author_id |
| ADV-5: requester cancels (deletes) own pending request | Allowed (1 row) | honest G-C path |
| ADV-6: self-block | Cleanly rejected, no partial state | `23514` — `check constraint "blocks_check"` (`blocker_id <> blocked_id`) |

---

## 3. No criterion weakened; honest flows intact

Confirmed behaviorally: the abuse paths (self-accept, self-pin/self-approve, de-anonymization,
author spoofing, cross-user storage writes, blocked interaction) are **flatly denied**, while the
honest paths (create pending request, addressee accept, requester cancel, owner moderation, author
editing own content, non-anonymous author still attributed) **still work**. This matches the Product
Quality Bar: high friction on abuse paths, near-zero added friction on honest paths (AC-S2 / AC-S10
positive guards both pass). No acceptance criterion was relaxed to accommodate unsafe behavior.

All six original findings F1–F6 are non-reproducible as an ordinary user after the cycle.

---

## 4. Reviewer advisories — observations, not defects (I concur)

- **Broad `exception when others` in the vendored harness.** Legitimate concern; addressed by my
  independent scenarios which pin each denial to its specific SQLSTATE/message. The harness's own
  outcome assertions (final-state checks) make a mis-attributed catch non-load-bearing anyway. Not a
  defect.
- **`postgres` in the moderation privilege guard** (`current_user in ('service_role','postgres')`).
  `postgres` is the superuser/admin connection, not a role any JWT-authenticated end user can assume
  via PostgREST. It cannot be reached by an ordinary client, so it does not widen the end-user attack
  surface. Not a defect; noted.

---

## 5. Scope Note — what was and was NOT exercised (honest labeling)

- **Verified (executed):** the **database authorization layer** — RLS policies, triggers,
  constraints, grants, and the storage-object policies — exercised as the real end-user roles against
  a live PostgreSQL 16 with RLS enforced. This is the real security boundary for SEC-001 and the
  closest local analog to the product's Postgres/PostgREST layer.
- **Believed-likely (NOT executed here):**
  - The **hosted Supabase project** itself — this sandbox uses a compat shim (`00_bootstrap.sql`) for
    `auth.uid()`, roles, default privileges, `storage.*`, and realtime publication. The shim mirrors
    Supabase defaults per the Architect's test-harness design, but the actual hosted project's role
    attributes and default grants were not observed.
  - The **live mobile client** and the **PostgREST/Realtime transport** — not run in this sandbox.
    The AC-S6 realtime assertion was verified at the DB layer (the base row that logical replication
    emits carries `author_id` NULL, because it is nulled at BEFORE INSERT). Commit `4452552`
    (`src/lib/marks.ts`) adds client-side defense-in-depth by not transmitting `author_id` for
    anonymous marks; that client path is not exercised here and is not required for the boundary to
    hold — my AC-S6 test explicitly transmitted `author_id` and the DB nulled it regardless.

I make no claim about device/OS matrix behavior of the app UI — SEC-001 is a data-layer security
cycle and its acceptance criteria are, by the PRD's own wording, verifiable against a running
Postgres with RLS. That matrix was exercised (the authorization boundary); the app-client matrix is
a separate deploy/device step.

---

## 6. Founder Manual Verification (needs the real Supabase/app to confirm)

These are outside this sandbox and should be confirmed on the actual project before/at deploy:

1. **Apply `0002_security_foundation.sql` and `0003_storage_attachments.sql` to the real Supabase
   project** and confirm they apply cleanly on top of the already-deployed `0001`.
2. **Confirm the production `service_role` grant assumption** — that BYPASSRLS is present but service_role
   has **no** blanket table grant that would re-expose `anonymous_mark_authors` beyond the explicit
   `grant select … to service_role` in 0002 (the shim asserts this; verify the live project matches).
3. **Confirm production default privileges** for `anon`/`authenticated` match the shim
   (`00_bootstrap.sql` §Default table privileges) — the storage anon-write denial relied partly on a
   GRANT-layer denial.
4. **Verify `storage.objects` RLS is actually enabled** on the hosted project (0003 enables it, but
   Supabase manages this table; confirm the policies attach as written).
5. **Exercise one end-to-end anonymous-mark flow through the live app + Realtime** to confirm the
   client never surfaces the author identity (DB layer already Verified; this closes the client leg).

---

## Routing

On PASS, hand back to the **Founder Gate**. SEC-001 is a security/migration Two-Key category:
merge/deploy requires explicit Founder approval (CLAUDE.md Founder Gates) — a QA Pass is necessary,
not sufficient. No routing back to an implementation Role is required (no defect found).
