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

## Deliberately external gateway boundary

Credential protocol v2 is implemented exactly, including the binding RFC 8032
test vector, `kid` rules, strict time bounds, role/path shapes, and separate
dispatch/completion credentials. `DispatchNonceRedeemer` accepts only the
compact JWS. `CompletionReporter` accepts only completion authorization and the
safe result—never the dispatch nonce or signed Storage URLs. The actual gateway
HTTP authentication and database-linearized redeem/finalize calls remain C2
interfaces. Until those adapters are supplied and independently verified, this
image is intentionally not runnable or deployable.
