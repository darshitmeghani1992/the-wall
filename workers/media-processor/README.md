# Protected Mark media processor (C3 local prototype)

This package is the isolated decode/re-encode boundary from ADR-012 and
FP-MEDIA-001. It does not receive Supabase service credentials or a database
URL. C2 provides attempt-scoped signed object URLs, gateway implementations for
atomic nonce redemption and completion, and the approved current/prior public
key list.

## Local verification

Requirements: Node 22–24 plus `ffmpeg` and `ffprobe` with `libx264`, AAC, and
`libwebp` encoders.

```sh
npm ci --ignore-scripts
npm test
```

The integration tests create real Photo/Voice/Video inputs, execute the local
FFmpeg toolchain, probe canonical outputs, and reject a trailing-content image
polyglot. They are processor tests, not iOS/Android playback certification.

### Verify the worker's temporary filesystem

The worker runs as `10001:10001` and creates an isolated directory for each
job under `/tmp`. Mount a writable tmpfs owned by the same UID/GID with mode
`0700` and a 512 MiB limit. The restricted ARM64 proof used
`--tmpfs /tmp:rw,nosuid,nodev,noexec,size=512m,mode=0700,uid=10001,gid=10001`.
Keep these permissions when translating the policy to the selected host.
A mount owned by another account at mode `0700` prevents job workspace creation.

Before enabling ingress, run this check inside the candidate container, as its
configured user and with networking disabled:

```sh
set -eu
test "$(id -u):$(id -g)" = "10001:10001"
test "$(stat -c '%u:%g %a' /tmp)" = "10001:10001 700"
probe="$(mktemp -d /tmp/the-wall-media-preflight.XXXXXX)"
rmdir "$probe"
```

This check covers local workspace access. Record the selected image digest,
SBOM and vulnerability scan and verify the host's network policy separately.

## Security boundary

- `processEnvelope` verifies protocol-v2 Ed25519 compact JWS through native
  WebCrypto, validates canonical JSON and
  exact claims and URL bindings, resolves allowlisted hosts, redeems the
  dispatch nonce, downloads with byte limits and redirects disabled, processes
  inside a unique temporary directory, uploads only attempt-bound outputs, then
  reports completion.
- Temporary files are removed on every exit. Logs contain IDs, kind, elapsed
  time, and safe error codes only.
- `deploy/container-policy.yaml` is a declarative handoff, not a deployable
  production manifest. DevOps must enforce it in the selected runtime.
- The Docker build has no mutable base-image default and requires an exact
  FFmpeg package version. Its entrypoint deliberately fails closed until the
  C2 gateway adapters are supplied.

## C2 HTTP gateway implemented (not yet hosted or approved)

Credential protocol v2 is implemented exactly, including the binding RFC 8032
test vector, `kid` rules, strict time bounds, role/path shapes, and separate
dispatch/completion credentials. `DispatchNonceRedeemer` accepts only the
compact JWS. `CompletionReporter` accepts only completion authorization and the
safe result—never the dispatch nonce or signed Storage URLs. The isolated worker now includes `src/gateway.ts` for the C2 HTTP calls to
`mark-media-worker/worker/{redeem,complete,fail}` with a custom gateway Bearer
secret and domain-separated job token headers. `src/runtime.ts` implements a
bounded JWS-authenticated HTTP ingestion queue on `POST /v1/media-jobs`. It
passes an exact empty HTTP 202 to C2 only after JWS verification and admission,
then uses the existing safe processing and atomic gateway callback interfaces.

The image **still requires DevOps runtime approval** before deployment:
immutable base/FFmpeg pins, exact DNS/egress and ingress allowlists, read-only
container filesystem, PID/CPU/memory/tmpfs limits, security tests, SBOM/CVE,
and tested cancellation/retry. The runtime refuses to start unless explicitly
enabled and all credentials and keys pass validation. No Supabase service-role
key or DB credential may be supplied to this container.


## Runtime configuration — source-ready, not certified deployment

Inject these values ONLY from a managed secrets store into the isolated worker
runtime; none belong in EAS, `EXPO_PUBLIC_*`, Git, CI logs or a mobile client:

- `MARK_MEDIA_RUNTIME_ENABLED=true` — explicit fail-closed enablement gate
- `MARK_MEDIA_PROJECT_URL=https://<approved-staging-ref>.supabase.co` — base HTTPS origin only
- `MARK_MEDIA_WORKER_GATEWAY_SECRET=<32+ random character dedicated worker secret>` — matches the custom Bearer secret on the C2 `mark-media-worker` gateway, **not** a service key/JWT
- `MARK_MEDIA_WORKER_PUBLIC_KEYS={"key-id":"<raw-Ed25519-public-key-base64url>"}` — 1 current + optional prior signing key, never the private key
- `PORT=8080` and `MARK_MEDIA_LISTEN_HOST=127.0.0.1` by default; `0.0.0.0` is only permissible behind a DevOps-approved private ingress with TLS/auth and rate limits

The scheduler's `mark-media-ops` Edge function POSTs the signed compact JWS
with `Content-Type: application/jose` to `/v1/media-jobs`. On valid signature,
the ingress accepts one attempt (`202` empty, no-store) and processes it using
C2's durable database lease; malformed/forged requests return `404` and a full
worker returns `503` for retry. The C2 gateway redeems nonces and finalizes
results using a dedicated gateway Bearer secret separate from the JWS.

**Status:** local gateway/runtime code implemented and unit tested; hosted
runtime, worker Edge function deployment and media-kind enablement still blocked
until independent Two-Key Reviewer/QA passes and founder-approved DevOps rollout.
