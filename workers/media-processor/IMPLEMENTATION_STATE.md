# Implementation State: C3 trusted media worker foundation

## Built

- `src/contract.ts` implements the independently approved protocol-v2 native
  WebCrypto Ed25519 compact-JWS verifier. It verifies against the bounded
  current/prior raw-public-key list before parsing, requires canonical
  base64url/UTF-8/recursively sorted JSON, binds the authenticated `kid`, and
  enforces exact issuer/audience/purpose, lowercase UUIDs, 120-second lifetime,
  +10-second clock skew, distinct 32-byte credentials, destination roles,
  canonical paths, MIME types, and cache control.
- The gateway boundary is domain-separated: redemption receives only the signed
  compact JWS; completion receives only callback/upload/attempt/`kid`/completion
  token plus the result. It cannot receive the dispatch nonce or signed Storage
  URLs through its type.
- `src/url-policy.ts` enforces HTTPS/443, exact hosts, object paths and callback,
  encoding/traversal/IP-literal denial, public-DNS preflight, redirects disabled,
  and final-origin checks.
- `src/photo.ts` performs JPEG/PNG/WebP container checks, a true JPEG marker/scan
  parse that requires the first terminal EOI to be the final bytes, one-frame
  probing, byte/edge/pixel bounds, full decode, JPEG-or-WebP canonical output,
  metadata removal, full-frame/no-upscale behavior, and optional WebP thumbnail.
  Protocol-v2 Photo claims contain both exact full candidate destinations; the
  worker uploads only the output selected by decoded alpha state.
- `src/audio.ts` and `src/video.ts` enforce stream/channel/rate/duration/frame/
  dimension/byte limits and produce metadata-free AAC/M4A and fast-start
  H.264/AAC MP4 plus an optional WebP poster.
- `src/server.ts` enforces verify -> exact URL/DNS -> atomic redeem -> bounded
  download -> isolated processing -> exact no-upsert upload -> atomic completion.
  One absolute per-kind attempt deadline supplies the remaining budget to DNS,
  every gateway/network call through `AbortSignal`, and each subprocess.
  A rejected/replayed redeem cannot invoke failure with the separate completion
  token. Once success finalization starts, a lost response never switches to a
  contradictory failure outcome. Temporary files are removed in `finally`.
- Docker and declarative runtime-policy artifacts fail closed pending approved
  C2 gateway adapters and immutable deployment pins.

## Verification evidence

**Verified locally:** Node v24.19.0, TypeScript compilation, and 31 Node tests.

- The exact FP-MEDIA-001 RFC 8032 vector verifies, including both documented
  SHA-256 values.
- Hostile credential tests reject signature bit flips, padding/malformed compact
  forms, `alg`/`typ` confusion, removed/mismatched/duplicate keys, unknown and
  duplicate JSON keys, noncanonical serialization, wrong purpose, path/role/
  MIME/cache substitutions, +11-second future `iat`, and expiry at `now`.
- Sequencing tests prove no network/gateway effect before verification, no
  redemption for wrong callback/path, no completion use on replay, and no
  success-to-failure switch after a lost completion response. A never-settling
  Storage fetch is aborted by the single attempt deadline.
- Real FFmpeg/ffprobe 6.1.1 tests process Photo, Voice, and Video; verify canonical
  streams, decoded-alpha WebP selection, metadata removal, aspect preservation, no preview upscale, checksums,
  unexpected-stream rejection, nested-network denial, and rejection of a
  JPEG+ZIP payload with a forged final EOI.
- Subprocess timeout, stdout-cap and nonzero-exit regressions all return bounded
  `PROCESSING_FAILED`; a private stderr sentinel is never retained or exposed.
- `npm audit --package-lock-only --omit=optional --audit-level=high` reports zero
  vulnerabilities. Development-only lockfile licenses are Apache-2.0/MIT/MIT;
  the worker has no npm runtime dependency.
- `git diff --check` passes.

**Believed-likely:** Mandatory injected gateway interfaces and the narrow
completion authorization prevent accidental cross-use while C2 remains the
database-linearized authority for replay, rotation, revocation and receipts.

**Inferred / not verified:** hosted Storage transfers, gateway-secret behavior,
database redemption/finalization, exact callback retry in the C2 runtime,
production DNS/egress enforcement, throughput, and real-world hostile corpus.

## Stubbed / blocked

- `DispatchNonceRedeemer` and `CompletionReporter` are explicit interfaces; no
  live gateway fetch, secret, service key, or database code exists in C3.
- Docker deliberately has no runnable worker entrypoint until those C2 adapters
  and the selected hosting runtime are available.
- Container hardening is declarative only. The selected runtime must enforce
  read-only root, UID 10001, dropped capabilities, no-new-privileges, seccomp,
  PID/cgroup/tmpfs/wall-clock limits, and exact egress.

## Contract Compliance Check

| Contract area | Result | Evidence / remaining boundary |
|---|---|---|
| Native Ed25519 compact JWS v2 | PASS (Node) | Exact binding vector and hostile suite pass; target Deno verification belongs to C2 and remains separate evidence. |
| Credential domain separation | PASS (worker boundary) | Redeem sees compact JWS only; completion sees its distinct token only; DB/gateway behavior is outside C3. |
| Exact v2 claims/roles/paths/callback | PASS | Parser, URL policy and sequencing tests pass. |
| Photo/Voice/Video canonical processing | PARTIAL | Real FFmpeg tests pass; broader hostile/golden/device/resource corpus remains. |
| SSRF/redirect boundary | PARTIAL | URL and injected-DNS tests pass; runtime network sandbox/DNS pinning needs the hosting layer. |
| Container constraints | PARTIAL | Declarative policy and non-root scaffold exist; build, SBOM/CVE and runtime enforcement are unverified. |
| Structured safe logs | PASS (unit boundary) | Only IDs, kind, timing and bounded safe codes reach the logger interface. |

**Overall: VERIFIED local credential/processor foundation; C3 deployment gates
remain open.** It must not be described as production-ready or enabled.

## Remaining work

1. C2 supplies and verifies the dedicated gateway HTTP adapters, including
   custom gateway authentication and database-linearized redeem/finalize.
2. CI runs the same vector in target Deno as independent cross-runtime evidence.
3. Expand hostile/golden tests for alpha/color, exact duration boundaries,
   decompression/resource bombs, timeouts, OOM/PID/tmpfs and output caps.
4. DevOps selects a hosting provider, builds an immutable pinned image, produces
   SBOM/CVE evidence, and proves the container/network policy.
5. QA verifies canonical playback and visual results on supported iOS/Android.

## Dependency / legal flag

The local Ubuntu FFmpeg binary is GPL-enabled (`--enable-gpl`, including
`libx264`). Architecture requires FFmpeg, but final OCI redistribution notices,
source obligations and license compatibility require legal/DevOps review. No
legal conclusion is claimed.
