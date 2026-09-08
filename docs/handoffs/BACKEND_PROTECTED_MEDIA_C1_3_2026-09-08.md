# Implementation State: Protected Mark Media C1.3 Writer Contract

**Role:** Backend
**Date:** 2026-09-08
**Architecture contract:** ADR-012 and FP-MEDIA-001 C4 writer amendment
**State:** Local implementation awaiting exact-snapshot Reviewer approval; not committed, deployed, or PostgreSQL-executed

## Built

- `supabase/migrations/0023_mark_writer_contract.sql`
  - Adds cancellation timestamps and the requested-cancellation index without enabling any media kind.
  - Adds actor-bound, idempotent `cancel_media_upload(uuid)` with actor → upload → quota lock order,
    generic missing/foreign/consumed behavior, live-worker `cancelling`, durable `cancelled`, exact cleanup,
    source/TUS and worker-output fences, and evidence-gated quota release.
  - Omits consumed/missing/inaccessible IDs from status, derives cancellation states, and projects only the
    five approved worker failure codes.
  - Normalizes raw/unknown worker failures to `PROCESSING_FAILED` before receipt hashing or persistence.
  - Excludes cancellation from Storage transition, worker claim, active-reservation count, and creation.
  - Accepts optional normalized Photo/Voice/Video text up to 500 characters in `marks.text` and the request
    fingerprint; Secret media returns `invalid` before request/upload locks or side effects.
  - Keeps the `create_mark` signature stable and does not expose `rate_limited` as a creation result.
  - Extends expiry to terminalize a requested cancellation after the live worker lease expires.
- `supabase/migrations/0024_mark_creation_cutover.sql`
  - Aborts unless the legacy-reconciliation singleton contains complete count/deletion/denial evidence.
  - Removes direct authenticated/service Mark INSERT and its RLS policy; `create_mark` becomes the runtime path.
  - Makes null legacy `media_url`/`payload` mandatory for every newly inserted Mark, including privileged inserts.
  - Reasserts private workflow-table grants and the five actor-bound app RPCs.
  - Preserves the independently approved policy-only boolean helper required by private Storage INSERT RLS.
- Focused tests
  - SQL behavior/grant tests for caption boundaries, normalized idempotency, early Secret rejection across
    nonexistent/owned/foreign bindings with complete no-side-effect assertions,
    cancellation/status/quota behavior, and finalizer-level persistence/hash normalization for every allowed,
    unknown, malformed, lowercase, oversized, and diagnostic-bearing failure result, including exact retry
    acceptance and changed canonical callback rejection.
  - Node source-contract tests for early-rejection ordering, response union, redaction, and actor-only signature.
  - Physical-session create-first/cancel-first and finalize-first/cancel-first races, with deterministic latches,
    exact finalize-first cleanup-fence proof, complete FK-safe fixture cleanup, and an explicit end-state assertion
    that every media-kind control is disabled.
  - Final-cutover shell test proving incomplete reconciliation aborts before applying `0024`, followed by
    direct-write denial and canonical Text/Photo/Voice/Video RPC success.
  - `run_tests.sh` loads `0023`, runs the writer suites, and applies/tests `0024` last.

## Tested

### Verified

- Node source-contract tests: **5/5 passed**.
- Shell syntax for both new race/cutover runners and the full suite runner: passed.
- `git diff --check` plus per-file `git diff --no-index --check` for every untracked file: passed.
- No dependency was added.

### Believed-likely

- The migrations and SQL tests are syntactically and transactionally consistent with `0020`–`0022` and the
  existing Supabase compatibility harness. This is not labeled Verified because `psql` is unavailable here.

### Unverified

- PostgreSQL execution of `0023`/`0024`, all SQL assertions, and physical-session races.
- Migration reversibility. Applied migration rollback remains a reviewed additive forward migration; source
  reversion is available only while the files are unshipped.
- Hosted Supabase Storage/RLS/TUS behavior, processor callbacks, cleanup evidence, and legacy reconciliation.

## Stubbed / Mocked

- No media processor, client upload flow, legacy migration tooling, scheduler, hosted configuration, secret,
  or feature enablement is included.
- `0024` mechanically verifies the database reconciliation singleton. Minimum-client-version, hosted
  staging, processor, CDN, and device proof remain operational deployment gates outside this migration.
- The cutover test's synthetic reconciliation is source validation in its disposable CI database only. It is not
  evidence that hosted legacy reconciliation occurred and is not authorization to apply or deploy `0024`.

## Contract Compliance Check

| Contract item | Result | Note |
|---|---:|---|
| Stable `create_mark` signature and exact result union | PASS | No creation `rate_limited` result |
| Optional normalized media text ≤500 | PASS | `marks.text` + fingerprint only |
| Secret media rejected before protected lookup/side effect | PASS | Before advisory/request/upload work |
| Actor-bound idempotent cancellation | PASS | No actor/path/bucket/wildcard parameter |
| Cancel/create/finalize lock boundary | PASS | Shared upload-row linearization; race suite added |
| Evidence/fence-gated cleanup and quota release | PASS | Source expiry plus lease/signed-PUT output fence |
| Consumed-safe status and five failure codes | PASS | Consumed omitted; unknown worker code normalized |
| Default-off `0023` | PASS | No media control state changed |
| Reconciled `0024` cutover | PASS | Aborts on incomplete singleton; direct writer removed |
| Five app workflow RPCs plus policy-only boolean helper | PASS | Architect clarification preserved |

**Result: PASS against the approved source contract.** PostgreSQL runtime, independent Reviewer, CI, and QA
remain required before merge or deployment.

## Failure Recovery

- Cancellation retries return the same derived state and never select a foreign/consumed row into public output.
- A live worker is not invalidated beneath its lease. Finalization records an idempotency receipt but publishes no
  validation after cancellation; expiry terminalizes a lost worker.
- Source and attempt objects remain charged until exact missing/deletion evidence is fresh after every fence.
- Create-first protects consumed canonical media; cancel-first makes creation return `media_not_ready`.
- `0024` failure rolls back its transaction. Once applied, rollback is a new reviewed forward migration that
  preserves private media and does not restore direct inserts/public URLs.

## Left To Do

1. Independent Reviewer audits the exact uncommitted snapshot and reruns static evidence.
2. Backend fixes any blocking finding and returns a new exact digest for re-review.
3. CI executes both migrations, the full PostgreSQL suite, and the two-session race/cutover tests.
4. QA/Security independently verifies grants, oracles, cancellation races, failure projection, and rollback evidence.
5. DevOps/Founder later controls hosted migration, minimum-client enforcement, legacy reconciliation, feature
   switches, processor/storage configuration, and deployment.

## Technical Debt Flagged

- The final cutover has operational prerequisites that are intentionally not represented as new schema fields:
  minimum client version, processor readiness, hosted Storage proof, and device proof. DevOps must treat these as
  release gates before running `0024`; the database itself can mechanically assert only reconciliation evidence.

## Contract Flaws Flagged

- Resolved by Architect during implementation: authenticated EXECUTE on
  `current_user_can_upload_mark_media_path(text)` is preserved as the single policy-only, false-only actor-bound
  helper needed for private Storage INSERT RLS. It is additional to the five client-called workflow RPCs and is
  covered by hostile direct-call tests.

## No External Mutation

This slice changed no hosted Supabase environment, Storage object, production data, infrastructure, secret,
remote branch, pull request, merge state, or deployment state.
