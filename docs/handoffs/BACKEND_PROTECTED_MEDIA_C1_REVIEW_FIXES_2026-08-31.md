# Implementation State: Protected Mark Media C1 — Reviewer Corrections

**Role:** Backend
**Scope:** `0020` C1 database/RLS/RPC foundation only
**Authority:** `FP-MEDIA-001`, `ADR-012`, and the four explicit independent Reviewer blockers
**Status:** Ready for independent Reviewer re-review; not merged, deployed, or hosted-applied

## Built

### `supabase/migrations/0020_mark_media_foundation.sql`

- Split cleanup into `enqueue_media_upload_attempt_output_cleanup(...)` and
  `enqueue_media_upload_full_cleanup(...)`.
  - Superseded leases now enqueue only exact old-attempt canonical/preview candidates.
  - Source cleanup is never queued by a superseded lease; it remains available to the replacement
    attempt.
  - Terminal, expiry, and subject-deletion paths use full cleanup, which includes source.
- Made terminal `fail_media_validation(...)` queue source and every exact output candidate for the
  current attempt, including Photo JPEG/WebP alternatives and thumbnail candidate.
- Added `media_upload_cleanup_requirements`, `quota_reservation_released_at`, and
  `quota_session_released_at` to make ledger release evidence-bound and idempotent.
  - `record_media_object_deletion(...)` is service-only and accepts only exact-path
    `deleted`/`missing` evidence.
  - `release_media_upload_reservation_if_clean(...)` releases `reserved_bytes`,
    `reservation_count`, and any still-open session charge only after every linked deletion row is
    durably evidenced. `ingested_bytes` remains charged for abuse accounting.
- Added `lock_media_actor(...)`, acquired before the day lock and before all cross-day active,
  rolling-hour, and rolling-day reservation checks in `begin_media_upload(...)`.
- Aligned upload-transition and expiry lock order to actor → upload row → day ledger to avoid a
  reservation/cleanup deadlock.
- Scoped the inherited Storage UPDATE/DELETE policies to `attachments`; authenticated uploaders
  have INSERT-only access to their exact `mark-media/staging/.../source` reservation path.
- Matched hosted Supabase's `storage.objects.owner_id text` contract in the test shim, Storage
  INSERT policy (`auth.uid()::text`), and upload-transition ownership verification.
- Added a durable `not_before` cleanup-evidence fence. Account/Wall deletion terminalizes any
  claimed draft in the FK transaction, clears its lease/attempt/nonces, queues all exact paths,
  and delays missing evidence until the former worker lease plus the two-minute maximum envelope
  lifetime has elapsed.
- Bound every deletion/HEAD observation timestamp to its outbox row's `not_before`, with a
  five-minute future-clock-skew ceiling. Evidence captured before a fence can no longer be replayed
  after the fence to complete cleanup.
- Made ordinary expiry apply the same terminal credential invalidation and destination-write fence
  to an already claimed processing upload as subject deletion.
- Added control-row SHARE linearization across reservation, Storage insert, transition, processing,
  worker nonce/completion operations, and creation, with control → upload ordering where both are
  locked.

### Tests

- `51_private_mark_media.sql`: all four server kill switches at their actual boundaries; service
  resolver allow, missing deny, and blocked deny; app-role denial of new internal cleanup surface.
- `52_mark_media_races.sql`: replacement attempt keeps source out of superseded cleanup; terminal
  partial-output cleanup queues exact candidates; quota cannot release until every candidate has
  evidence.
- `53_media_quota_outbox.sql`: failed/expired uploads retain all reservation-ledger charges until
  durable source evidence; proof then releases exactly once while preserving `ingested_bytes`.
  It also rejects stale/future evidence and adversarially expires a claimed upload after both worker
  nonces were redeemed, simulates a late exact-path write, and accepts only fresh post-fence proof.
- `54_media_quota_concurrency.{sh,setup,a,b,midnight}.sql`: two physical `psql` sessions compete
  for one active-reservation slot, plus a cross-quota-day active-session boundary case; its
  committed media fixtures are removed before the next physical harness.
- `55_media_linearization*`: physical-session winner/loser tests for reservation, staging insert,
  upload transition, processing claim, Mark creation, and expiry/evidence. The transition baseline
  contains a real Storage object and each scenario asserts both winner and loser side effects.
- `run_tests.sh`: invokes both physical-session harnesses after the SQL suite.

## Tested

| Check | Result | Confidence |
|---|---|---|
| `git diff --check` | Passed | **Verified** |
| `bash -n supabase/tests/run_tests.sh supabase/tests/54_media_quota_concurrency.sh supabase/tests/55_media_linearization.sh` | Passed | **Verified** |
| `supabase/tests/run_tests.sh` | Not run: `psql`/PostgreSQL client is unavailable in this workspace | **Believed-likely** pending clean CI/Postgres execution |
| Two-session reservation/linearization races | Harnesses written, but not executable locally without `psql` | **Believed-likely** pending execution |
| Hosted Storage deletion/HEAD evidence | C2 worker responsibility; no hosted service touched | **Inferred** / not implemented in C1 |

## Stubbed / Mocked

- The C1 service-only evidence recorder persists trusted worker evidence; it does **not** delete
  Storage objects itself. Exact deletion, HEAD/missing proof, retries, leases, and dead-letter
  operation remain C2/C6 work.
- No image/audio/video decoding, signing Edge route, TUS endpoint configuration, legacy migration,
  client upload, or deployment work was changed.

## Contract Compliance Check: FP-MEDIA-001 / ADR-012 C1

| Contract boundary | Compliance | Notes |
|---|---|---|
| Superseded attempt must not delete source | PASS | Attempt-only helper is the trigger target; regression asserts no source outbox/cleanup requirement. |
| Terminal failure queues source + exact attempt outputs | PASS | Full helper handles source plus kind-specific canonical/preview candidates. |
| Expiry releases quota only after exact delete/missing evidence | PASS | Durable requirements link exact outbox rows before state becomes terminal; service-only evidence recorder gates release. |
| `reserved_bytes`, reservation/session counts reconcile exactly once | PASS | Upload-level release timestamps protect replay; test asserts all fields and retained abuse bytes. |
| Actor-wide lock before cross-day checks, then day lock | PASS | `begin_media_upload` uses actor → UTC-day order; physical two-session and cross-day harness added. |
| All four server switches fail closed | PASS | Reservation, transition, claim, and create boundaries are exercised directly. |
| Resolver service-only and generic no-row denial | PASS | Existing grant boundary retained; new allow/missing/blocked test coverage added. |
| Subject deletion fences an already-claimed worker | PASS | Attempt/lease/nonces are invalidated and missing evidence is time-fenced; adversarial late-path cleanup is asserted. |
| Hosted Storage ownership type matches | PASS | Test shim uses `owner_id text`; policy and transition compare it to `auth.uid()::text`. |
| Cleanup evidence is fresh and bounded | PASS | Every observation must be at/after `not_before` and no more than five minutes in the future. |
| Processing expiry fences a redeemed worker | PASS | Expiry clears lease/attempt/nonces/redemptions/key, delays cleanup, and tests a late exact-path write. |
| Storage owner cannot mutate/move/delete staging | PASS | Inherited owner policies are bucket-scoped and authenticated runtime attempts assert zero side effects. |
| Control operations have one physical serial order | PASS | `55` runs winner/loser transactions with enabled baselines and post-disable denial checks. |

**Result: PASS — no unapproved product, API, or architecture deviation identified.**

## Failure Recovery / Rollback

- A terminal upload retains its quota charge if the cleanup worker is unavailable, deliberately
  failing closed rather than admitting unlimited orphaned uploads.
- Deletion evidence is idempotent; replay cannot decrement the quota twice.
- A missing or malformed exact evidence payload is denied without changing outbox or ledger state.
- Reverting this unmerged local slice is a normal source-control rollback. Once a migration is
  applied, rollback remains an additive forward migration; no hosted action has occurred.

## Left To Do

1. Independent Reviewer must inspect this exact version and re-run the four adversarial paths.
2. Execute the full SQL suite—including `54` and `55`—on PostgreSQL 16/CI. Fix any runtime findings before
   QA/Security.
3. QA/Security must verify the exact reviewed revision independently.
4. C2/C3/C6 remain out of scope: actual Storage delete/HEAD worker, signer/Edge route, processor,
   legacy reconciliation, and hosted verification.

## Technical Debt / Contract Flaws

- **No new debt registered.** Local PostgreSQL absence is an execution-environment limitation, not
  a claim that this migration passed.
- **No contract flaw flagged.** `media_upload_cleanup_requirements` and per-upload release
  timestamps are implementation-level state required to fulfill the approved evidence-bound
  cleanup rule; they do not change the app-facing contract.

## Recommended Next Role

**Independent Reviewer**, followed by **QA/Security** only after the Reviewer approves the exact
post-fix hashes and a real PostgreSQL suite has passed.

## Founder Action Required

None for local implementation or review. Merge, hosted migration, Storage configuration, worker
credentials, and deployment remain outside this handoff.
