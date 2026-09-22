# Implementation State: Protected Mark Media C2 Edge orchestration/read

**Role:** Backend  
**Date:** 2026-09-03  
**Architecture contract:** ADR-012 and FP-MEDIA-001 worker credential protocol v2  
**Implementation state:** Local implementation complete; independent code review, Deno, CI, and hosted verification pending

## Built

- `supabase/functions/mark-media/index.ts`
  - JWT-reverified `POST /functions/v1/mark-media/read` boundary.
  - Verified-subject binding to service-only `resolve_mark_media_for_signing`.
  - Exact 60-second, download-only signed manifests with all-or-nothing multi-object behavior.
  - C1.1 service adapters for job claim and exact credential/fence binding.
  - Deterministic Photo/Voice/Video destination construction and signed-output orchestration.
  - Required ordering: final signed-upload response, trusted timestamp capture, exact `+2h30m`
    output fence, durable bind, then Ed25519 dispatch signing.
- `supabase/functions/mark-media-worker/index.ts`
  - Dedicated custom-auth `verify_jwt=false` worker gateway.
  - Constant-time current/previous gateway-secret digest comparison with a maximum five-minute overlap.
  - Separate dispatch-JWS redemption and raw completion-token domains.
  - Exact callback schemas and C1.1 `redeem_media_validation_dispatch_nonce` /
    `finalize_media_validation_attempt` service adapters.
  - Fixed no-store `401`, `404`, `422`, and `204` responses.
- `supabase/functions/_shared/media-contract.ts`
  - Exact app manifest and worker-dispatch types and strict boundary parsers.
- `supabase/functions/_shared/worker-envelope.ts`
  - Native Web Crypto Ed25519 compact JWS; canonical JSON/base64url; exact header/payload validation.
  - Signature verification before JSON parsing by testing the bounded public-key allow-list.
  - Exact role/path/MIME/lifetime/callback/source/destination validation.
- `supabase/functions/_shared/url-policy.ts`
  - Exact HTTPS project origin, private bucket, operation, canonical decoded path, and query binding.
  - Rejects IP literals, alternate hosts/buckets, redirects, traversal, encoding ambiguity, userinfo,
    fragments, unsigned URLs, and read/write credential substitution.
- `supabase/functions/tests/{mark-media,mark-media-worker}.test.ts`
  - Dependency-free Node/Web API security tests.
- `supabase/config.toml`
  - `mark-media.verify_jwt=true`; `mark-media-worker.verify_jwt=false`.

## Tested

### Verified

- 20 local runtime/adversarial cases pass under Node 24.
- Exact FP-MEDIA-001 RFC 8032 Ed25519 compact-JWS vector passes byte-for-byte.
- Strict TypeScript 5.9 check with `noUnusedLocals` and `noUnusedParameters` passes.
- Function authentication-mode assertion passes.
- `git diff --check` passes.
- Reviewer interim defects are regression-covered:
  - signed-upload adapter consumes Supabase's documented `data.url` response field;
  - app reads reject signed upload/write credentials;
  - validly signed array values cannot be coerced into nonce, completion-token, or callback strings.

### Believed-likely

- Native Web Crypto, Request, Response, TextEncoder, and fetch behavior is portable to the target
  Supabase Deno Edge runtime. This has not been executed in Deno here.

### Inferred / unverified

- Hosted Supabase Storage signed-read and signed-upload behavior.
- Deployed gateway routing and custom-secret environment wiring.
- Target Deno Ed25519 execution.
- GitHub CI integration for these new Edge tests.

## Stubbed / Mocked

- Unit tests use deterministic Storage and database adapters; no hosted Supabase service was called.
- `createWorkerDispatches` is an exported orchestration unit, not attached to a scheduler or a new
  HTTP trigger because the approved contract does not specify that infrastructure boundary.
- No processor or cleanup worker is implemented by C2; those remain C3/C6 responsibilities.

## Contract Compliance Check

### Endpoints

| Endpoint / operation | Matches contract? | Deviation | Architect approval |
|---|---:|---|---|
| `POST /functions/v1/mark-media/read` | Yes | None in authorization, signing, failure, or header behavior | ADR-012 / FP-MEDIA-001 |
| `POST .../mark-media-worker/worker/redeem` | Yes | None | Worker protocol v2 |
| `POST .../mark-media-worker/worker/complete` | Yes | None | Worker protocol v2 |
| `POST .../mark-media-worker/worker/fail` | Yes | None | Worker protocol v2 |
| Internal dispatch orchestration | Yes | Trigger/scheduler intentionally not invented | Worker protocol v2 |

### C1.1 service contract

| RPC | Matches contract? | Deviation |
|---|---:|---|
| `bind_media_validation_attempt_credentials` | Yes | None; exact `returned_at + 2h30m` supplied |
| `redeem_media_validation_dispatch_nonce` | Yes | None |
| `finalize_media_validation_attempt` | Yes | None; one atomic success/failure call |

### Schema

C2 adds no database schema or migration.

### Result

**PASS for implemented C2 contracts.** Independent Reviewer and QA/Security remain required before merge.

## Left To Do

1. Independent Reviewer inspects the exact C2 diff and reruns its claims.
2. QA/Security runs target Deno, gateway-routing, replay, callback, and hosted Storage tests.
3. DevOps defines the approved scheduler/trigger and secret/public-key deployment wiring.
4. CI gains a Deno/Edge test job through the appropriate DevOps-owned change.
5. Hosted staging proves signed upload/read response shapes, redirect behavior, and object cache headers.

## Technical Debt Flagged

- `mark-media/index.ts` contains both app read and internal dispatch orchestration because the binding
  work-unit table names one implementation file. If Architect later approves another module, split the
  two responsibilities without changing behavior.

## Contract Clarification Flagged

FP-MEDIA-001 specifies metadata plus signed URLs but does not enumerate the app manifest's field names.
The current response is:

`{status:"ready",expires_at,items:[{position,media_type,url,preview_url?,mime_type,byte_size,width?,height?,duration_ms?,sha256}]}`

Frontend and Reviewer should treat this as the proposed exact read DTO until Architect records or adjusts it.

## No external mutation

C2 did not change the database, hosted Supabase, processor, client, CI configuration, Git history,
remote branch, pull request, merge state, deployment, or production data.
