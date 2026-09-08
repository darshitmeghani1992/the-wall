# Implementation State: Protected Mark Media C3.1 Operations Control Plane

**Role:** Backend  
**Date:** 2026-09-08  
**Architecture contract:** ADR-012 and FP-MEDIA-001 C3.1  
**State:** Local implementation ready for exact-snapshot review; not committed, deployed, or PostgreSQL-executed

## Built

- `supabase/migrations/0022_media_operations.sql`
  - Durable exact-object deletion-attempt history.
  - Initial claim and expired-lease reclaim with a fresh attempt UUID and live five-minute lease.
  - Current-attempt/live-lease finalization; stale, expired, and superseded attempts return `false`
    before mutating evidence, quota, history, or current deletion state.
  - Exact C1 `not_before` and path-evidence validation retained behind the new attempt fence.
  - Inclusive terminal boundary: six completed/expired attempts **or** 24 hours of record age.
  - One private immutable terminal predicate shared by claim/finalization, with a frozen-clock regression
    for younger-than, exactly-at, and older-than 24 hours plus queue-integration diagnostics.
  - Legacy service-role access to the unfenced deletion-evidence RPC revoked.
  - No media-kind control changed and no scheduler/cutover installed.
- `supabase/functions/mark-media-ops/index.ts`
  - Dedicated scheduler authentication before method/path selection, body access/parsing, or privileged
    adapter construction.
  - One-shot delivery of the already-bound compact JWS as raw `application/jose` to the exact configured
    HTTPS OCI endpoint at `/v1/media-jobs`; redirects denied.
  - Supabase-origin, localhost, local-domain, IP-literal, non-HTTPS, alternate-path, port, userinfo,
    query, and fragment endpoints denied.
  - Only HTTP 202 with a strictly empty body is accepted. Response content is streamed, never aggregated;
    declared non-empty bodies and the first non-empty chunk are cancelled and rejected, and empty-chunk
    reads are capped.
  - Ambiguous/non-contract delivery is never immediately retried. The claimed database lease remains the
    only retry clock.
  - Cleanup deletes and HEAD-verifies exact canonical Storage paths only. Object and optional preview
    evidence are finalized atomically; partial work persists no partial evidence.
  - Fixed private/no-store scheduler responses and safe structured logging without URLs, credentials, JWS,
    object paths, or raw errors.
- `supabase/functions/tests/mark-media-ops.test.ts`
  - Eight focused Web API cases covering auth ordering, exact request validation, raw dispatch, empty-202,
    ambiguous delivery, hostile OCI origins, bounded large/chunked acknowledgements, exact cleanup, and
    multi-object all-or-nothing behavior.
- `supabase/tests/58_media_operations.sql`
  - Privilege/default-off assertions, live-lease non-reclaim, fresh reclaim identity, durable history,
    stale/expired callback immutability, exact evidence, and inclusive terminal boundaries.
- `supabase/tests/58_media_operations_races.sh`
  - Two-physical-session proof that concurrent schedulers cannot claim the same live deletion lease.
- `supabase/tests/run_tests.sh`
  - Loads `0022` and invokes both operations suites.

## Tested

### Verified

- Node 24 operations tests: **8/8 passed**.
- Root TypeScript `tsc --noEmit`: passed.
- Focused C3.1 ESLint: **0 errors, 0 warnings**.
- Shell syntax for the runner and two-session race test: passed.
- `git diff --check`: passed.
- Root lint: passed with pre-existing warnings outside C3.1.
- Reviewer preliminary transport findings have dedicated regression tests.

### Believed-likely

- The additive SQL is syntactically and transactionally consistent with migrations `0020`/`0021` and the
  existing Supabase test shim. No PostgreSQL parser/runtime exists in this workspace, so this is not labeled
  Verified.
- Web-standard streaming/cancellation behavior is portable to Supabase's target Deno runtime. It has been
  executed only under Node 24 here.

### Unverified

- Full PostgreSQL suite and two-session cleanup race: `psql` is not installed and no Docker/Podman runtime
  is available.
- Migration rollback: no rollback migration has been authored or executed. If `0022` is ever applied, rollback
  must be a separately reviewed forward migration; source-file reversion is sufficient only while unshipped.
- Hosted Edge gateway behavior, scheduler/Cron execution, secret rotation, OCI DNS/egress enforcement,
  Storage DELETE/HEAD behavior, and service-role RPC behavior.

## Stubbed / Mocked

- Node tests use deterministic database, Storage, and OCI fetch adapters; they do not call hosted services.
- No scheduler/Cron entry, Edge gateway override, secret, selected OCI provider, DNS resolution check, or
  infrastructure egress policy is included. Those are DevOps/Founder deployment decisions.
- The OCI processor itself is a separate C3 deliverable and is not implemented here.

## Contract Compliance Check

| C3.1 requirement | Implementation | Result |
|---|---|---:|
| Scheduler auth before parse/privilege/route behavior | Constant-time digest check is the first handler boundary | PASS |
| Exact raw OCI dispatch | One POST to configured HTTPS origin plus literal `/v1/media-jobs`, raw JWS, `application/jose` | PASS |
| No redirects; only empty 202 | `redirect: "error"`; zero-byte bounded stream verifier | PASS |
| No pre-lease ambiguity retry | One transport attempt; DB processing lease remains live after failure | PASS |
| Exact durable cleanup | Existing exact outbox plus append-only attempt records | PASS |
| Fresh claim/reclaim identity and live lease | New UUID and five-minute lease on each claim | PASS |
| Stale/expired/superseded denial | Finalizer rejects before mutation unless current attempt and lease match | PASS |
| Inclusive six-attempt OR 24-hour terminal boundary | Enforced in claim and failure finalization | PASS |
| Fence-safe, all-or-nothing evidence | Exact C1 evidence validator called only after object and preview proof | PASS |
| Default-off/no cutover | No control state, writer, C4, scheduler, or cutover change | PASS |
| Fixed responses/no secret or URL logs | Fixed 404/204 private responses; allow-listed log fields only | PASS |

**Result: PASS against the implemented source contract.** PostgreSQL runtime, rollback, hosted integration,
and independent final review remain required before merge or deployment.

## Left To Do

1. Reviewer inspects this exact snapshot and reruns the Node/static claims.
2. CI executes migration `0022`, the complete PostgreSQL regression suite, and the physical concurrency test.
3. Backend corrects any runtime SQL finding and supplies a new exact snapshot for review.
4. A rollback forward migration is designed and actually exercised before deployment readiness is claimed.
5. DevOps selects/provisions the OCI origin, configures the custom-auth Edge gateway and scheduler secret,
   installs Cron, constrains DNS/egress to the exact processor origin, and proves hosted behavior.
6. QA/Security independently exercises ambiguity, stale leases, redirects, oversized/chunked responses,
   exact cleanup, and secret/log redaction.

## Technical Debt Flagged

- The Edge handler's internal scheduler request schema is service-private because ADR-012/FP-MEDIA-001 bind
  behavior but do not enumerate that JSON shape. It must not be exposed as an app/public contract.
- DNS names are syntactically restricted and configured, not resolved by Edge code. DevOps must enforce the
  approved OCI destination through deployment-time DNS and network-egress controls.

## Contract Flaws Flagged

None. The preliminary Reviewer's same-origin and bounded-body findings were implementation defects and are
fixed without changing the approved contract.

## No External Mutation

This slice did not change hosted Supabase, OCI infrastructure, secrets, Cron, user data, Git history, a remote
branch, pull-request state, merge state, or deployment state.
