# Architect Handoff — Protected private Mark media (Package C)

**Role:** Architect
**Base:** `ab5539592e405c23cee49dbf02aeff1aa7e0dd0e`
**Date:** 2026-08-27
**Scope:** Documentation/design only; no production code, test, config, commit, push, merge, hosted change, or deployment

## Executive summary

Package C now has a developer-executable High-Risk architecture:

- [ADR-012](../architecture/ADR-012-protected-mark-media.md) chooses a private, staged,
  server-validated pipeline and supersedes public Mark media without changing public avatars.
- [FP-MEDIA-001](../architecture/FP-MEDIA-001-protected-mark-media.md) defines the DB, API, Storage,
  processor, client, migration, test, rollback, observability, and orchestration contracts.

The design preserves the approved product: Text/Photo/Voice/Video only; 1–5 full-frame photos; one
Voice `<=60s`; one Video `<=30s`; Secret media rejected. It reconciles the actual `0018/0019`
cutover, existing Anonymous/Secret/Alert triggers, single-media client, legacy public bucket, and
the task-supplied 135-check green security base (not re-run in this docs-only pass).

This revision closes the first and second independent re-review blockers; it is still **NOT READY**
until the reviewer approves this exact document version.

## Key decisions

1. `mark-media` is private; public `attachments` remains for avatars only.
2. `media_uploads` is the server-owned reservation/job state machine; `mark_media` is immutable,
   ordered canonical metadata; signed URLs are never persisted.
3. Ordinary client uploads use the user JWT so Storage RLS is checked at upload time. Photo uses
   standard upload; larger/unreliable Voice/Video uses TUS/resumable upload.
4. A portable, locked-down OCI worker uses expiring one-use dispatch/completion envelopes, exact
   URL allowlists, redirects-off SSRF controls, pinned decoders, and explicit resource/AV limits.
5. `create_mark` has a versioned canonical fingerprint and exact pending/completed/deleted locking
   semantics; it is the sole creator after `0021` and cannot recreate a deleted retry tombstone.
6. `0020` adds default-off per-kind server switches, atomic quota/TUS accounting, exact nullable
   FKs plus tombstones, and a durable exact-path object-deletion outbox. Rollback disables server
   boundaries before client flags.
7. A JWT-verifying Edge route calls a service-role-only resolver; direct Data API path resolution
   is denied and missing/inaccessible are indistinguishable. URLs live 60 seconds, object cache is
   HEAD-proven `<=60`, and the JSON is `private,no-store`; transactional linearization bounds the
   documented residual window to approximately 120 seconds.
8. Legacy migration is ledgered: inventory → private byte checksum → process → link/null → access
   proof → public delete → CDN purge/wait → fresh unauthenticated denial proof. A reconciliation
   singleton mechanically blocks public media creation and `0021` until counts/evidence complete.
9. The private bucket ceiling is exactly 52,428,800 bytes (50 MiB), while untrusted Video input
   reservation, transition, and processing remain capped at 41,943,040 bytes (40 MiB).
10. Mark deletion blocks future resolver calls immediately at their linearization point, but an
    already-resolved/in-flight URL may survive the bounded signed/cache window until async object/
    CDN deletion; no immediate dead URL is promised.
11. Every inventoried legacy URL—including quarantine—needs fresh unauthenticated denial evidence.
    A reachable quarantine blocks creation, `0021`, and the privacy claim unless the Founder
    separately accepts a documented residual privacy exception.

## Verification

Exact documents submitted for re-review:

- ADR-012 SHA-256: `dc2bddb12b29948d0e6dbbca5fdb404380c334415503dabda18d881fd8690748`
- FP-MEDIA-001 SHA-256: `b726a96c0aa6350321409a5598667e4bc9f287bf3723274740fbbe5da651867b`

- **Verified:** exact clean base; migrations end at `0019`; `0018` currently blocks Mark media and
  leaves text compatibility; actual composer/upload/read types; existing trigger/policy boundaries.
- **Verified:** official Supabase docs for private buckets/RLS, current `owner_id` ownership,
  JWT-verifying Edge functions, standard/TUS uploads (including 24-hour resumable URL lifetime),
  signed reads, CDN cache/purge, Edge limits, background tasks, and Cron.
- **Believed-likely:** the staged state machine and OCI worker are the smallest safe implementation
  that satisfies the approved contract.
- **Inferred/unverified:** hosted media count, plan/CDN purge access, OCI provider/cost, processor
  throughput, and exact Expo TUS/device behavior.

## Build readiness

**Overall: NOT READY.** Independent re-review returned three final narrow blockers; these documents
now correct all three but require approval of this exact revision before implementation.
OCI hosting and hosted inventory/config also remain deployment blockers.

After independent design approval, these can start separately:

1. Backend C1: `0020` DB/RLS/RPC foundation + SQL adversarial tests.
2. Backend/DevOps C3: local OCI processor prototype + hostile media corpus.

Do not enable Photo/Voice/Video, create `0021`, migrate/delete public media, or deploy infrastructure
until the gates in FP-MEDIA-001 pass.

## Exact next Role

**Independent Security/Architect Reviewer**: review both documents as one version. Specifically try
to break:

- server kill switches at reservation/upload/claim/create and safe rollback order;
- `owner_id`, atomic quota/TUS sessions, exact FKs/tombstones, and deletion outbox ordering;
- one-use worker envelopes, key rotation/replay, URL/SSRF controls, sandbox and AV limits;
- service-only resolver grants, indistinguishable denial, signer rate limit, cache proof, and race;
- versioned idempotency fingerprint/locking, rollback, concurrency, and post-delete behavior;
- legacy reconciliation gate, checksum/delete/CDN proof, and no-public rollback;
- exact 50 MiB bucket versus 40 MiB input boundary, deletion/signing race truth, and denial proof
  for every quarantined legacy URL;
- feasibility of the exact `0020 → client/worker/legacy → 0021` sequence.

Review outcome must be bound to the exact diff/doc version and be `APPROVE` or `REQUEST CHANGES`.

## Founder action required

None for routine local review. Founder/DevOps approval is required later only for selecting/spending
on OCI infrastructure, hosted Supabase changes, public-object deletion/cache purge, and deployment.

## Technical debt register delta

None introduced. The processor provider is an explicit readiness blocker, not accepted debt. The
stale operational `CURRENT.md`/`BUILD_STATUS.md` is assigned to downstream C9 after implementation
evidence exists; this Architect pass does not rewrite operational truth prematurely.
