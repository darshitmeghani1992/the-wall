# ADR-013: Durable, account-bound deferred destination

**Status:** Proposed — pending independent architecture review  
**Date:** 2026-09-16  
**Fast Lane:** High-Risk / Architectural  
**Reversibility:** Two-way door before release; client rollback must purge the durable key.  
**Product authority:** `docs/product/PRD-DL-001-deferred-destination-recovery.md`, SHA-256
`bdd38bcedf3d97daef30ed5b1e8c3b98a686e0f02c0f0cc4981d5839987514db`; and
`docs/PRODUCT_ASSUMPTIONS_REGISTER.md`, SHA-256
`0794d06704eb2e17b7c926e6110f80d063f0f8c51c72ea37a858d2dfe077da24`.  
**Feature Plan:** [FP-DL-001](./FP-DL-001-deferred-destination-recovery.md)

## Context

The existing `src/lib/pendingLink.ts` stores one raw href in process memory and clears it as soon
as the auth gate or walkthrough reads it. A cold process kill loses the social destination, while
consume-on-read loses it if navigation is interrupted before the destination becomes visible.

Durable recovery touches privacy and authentication boundaries. An unbound signed-out intent may
be claimed by the next account, but once bound it must never be restored into another account.
Account recovery, onboarding, deactivation, suspension, and unavailable routes remain
authoritative. Recovery cannot weaken target authorization or persist arbitrary URLs, callback
credentials, Secret state/content, media, or display data.

## Decision

### One typed local record

Store at most one versioned `StoredDeferredDestinationV1` record in existing `AsyncStorage` under
`the-wall:deferred-destination:v1`. It contains only:

- one strict destination union made from normalized handle/UUID identifiers;
- immutable capture time;
- nullable bound Supabase subject; and
- schema version.

Never persist a raw href or query object. A pure parser accepts only the Product-approved custom
scheme destination families and rejects all other routes, queries, callbacks, URLs, malformed
identifiers, fragments, credentials, and unknown fields.

The parser canonicalizes custom-scheme routing as URL hostname followed by pathname segments,
performs raw control/backslash/encoded-separator/percent-decoding prechecks, allows at most one
query entry, and rejects native intents above 8 KiB. External handle parsing lowercases, removes at
most one leading `@`, requires at least three characters, and rejects any remaining character
outside `[a-z0-9_]`; it never strips invalid characters into a different valid handle. There is no
invented handle-specific maximum. The 8 KiB raw-intent resource ceiling can exclude a pathological existing
handle because the current Product/database model has no maximum; that is an explicit existing
limitation, not a new account eligibility rule.

### Native-intent boundary, not a parallel listener

Expo Router already consumes initial and runtime native URLs. `app/+native-intent.ts` is therefore
the sole interception boundary. It recognizes but never persists the auth callback, validates and
queues supported product capture before returning `/`, and routes rejected/uncertain intents to
`/`. `AuthProvider` does not add `Linking.getInitialURL()` or a `Linking` event listener. This avoids
a race in which the Router and auth provider separately consume/navigate the same URL.

### AsyncStorage rather than SecureStore or server state

`AsyncStorage` is already used by the app and is sufficient for the Product-approved minimal
identifier record. SecureStore does not provide authorization and introduces keychain/backup
lifecycle behavior for a record that must expire predictably. Server persistence would add schema,
network availability, cleanup, and hosted operations without improving the MVP's one-device
intent. Authorization remains server/RLS-owned when the target loads.

### Non-sliding 24-hour retention

Only a newly accepted link-open writes `capturedAtMs`. Binding, reads, account bootstrap, failed
resume, process restart, token refresh, and same-account reauthentication never change it. The
record expires at 24 hours according to the device wall clock. Missing, malformed, unsafe, or
future time is terminally unavailable rather than repaired or extended.

A client-only record cannot reliably detect a smaller backward clock change that leaves the stored
capture time in the apparent past after restart; this can extend real-world retention. A monotonic
clock cannot bridge process/device restarts and trusted server time is outside this client-only
slice. The TTL is therefore not tamper-proof. Minimal retained identifiers, account binding, and
server reauthorization limit the consequence.

### Unbound-to-bound ownership

A signed-out capture is unbound. The first authenticated subject claims it before destination
metadata can be returned. A capture made with a session binds immediately. Same-subject refreshes
preserve it. Temporary automatic session expiry preserves a bound record for reauthentication by
the same subject. A different subject causes a purge before account or destination exposure.

Ownership mismatch is fail-closed: it returns no destination value or metadata to the new subject.

Subject state is an explicit union of `unknown`, `signed_out`, and `authenticated(userId)`.
Unknown is never treated as signed out. Capture/reconcile/read/bind/remove operations share one
serialized mutation queue. During A→B, A's visible state is fenced/cleared, reconciliation finishes
while B remains unexposed, and only then may `setSession(B)` and B's account bootstrap run.

Explicit sign-out immediately enters process-local quarantine, invalidates all attempt tokens,
tries a scrub before sign-out, proceeds with Supabase sign-out even if the scrub fails, and retries
the scrub afterward. Any AsyncStorage read/write/clear uncertainty disables durable resume for the
remainder of the process. User security/control wins over making storage cleanup a prerequisite to
signing out.

If durable deletion fails and the process later restarts, a same-account re-login could see the
stale bound record once storage becomes healthy. Client-only storage cannot eliminate that residual
case. This limitation is accepted explicitly. A different account still fails closed because the
readable record is bound to the prior subject and must be purged before B is exposed.

### Account-route authority

The client asks for recovery only after the server-backed `accountRoute` is `ready`. Missing
profile, onboarding, walkthrough, deactivated, suspended, and unavailable routes always win.
Every supported direct destination also enforces the account-ready boundary so an external route
cannot bypass the root gate.

### Terminal acknowledgement, not consume-on-read

Reading creates a process-local active attempt with an opaque, unguessable token but leaves the
persisted record intact. `prepare` also creates a separate random, one-use process-local navigation
reference mapped to the token and embeds only that reference in the internal Expo Router href as
the reserved `__deferred_ref` search parameter.
`app/index.tsx` uses the returned href verbatim and never reads the token. The exact destination
screen reads the reference from its own navigation parameters and exchanges it once against its
normalized screen identity and authenticated subject to capture the token for that load invocation.
The external URL parser rejects `__deferred_ref`, so it can never be supplied or
claimed by an incoming link.

Every handle-resolution, unavailable transfer, retry, and acknowledgement transition requires the
captured token; there are no no-argument state-changing APIs. A screen must retain the token in the
local asynchronous closure for that exact navigation, not read a mutable global current token. A
same-route replacement starts a new invocation/reference while the stale closure retains invalid
token A and cannot act on B.

Handle resolution invalidates its entry reference and returns a new final-screen href/reference
mapped to the same attempt. Terminal routing invalidates the destination reference and returns a
new unavailable-screen href/reference. Replacement before either receiving screen exchanges its
reference invalidates the whole mapping. Tokens and references are never persisted, logged, sent
to analytics, accepted externally, exposed through public auth state, or used as authorization.
The token remains bound to exact record snapshot + subject + attempt generation and becomes invalid
on replacement, identity change, sign-out, or quarantine.

The exact record snapshot is removed only after the authorized destination has rendered or the
generic terminal unavailable state has rendered. Offline, timeout, and server failures preserve
the record and allow retry. AsyncStorage uncertainty instead quarantines the process because record
ownership can no longer be established safely.

The active attempt compares its token and exact serialized record before removal. A stale screen
therefore cannot resolve, declare, retry, or clear a newer capture. A process-local one-navigation
guard prevents Strict Mode and account refresh duplication without persisting an early-consumption
bit: the first prepare result is `navigate`, and repeated prepares for that attempt return explicit
`in_flight`. A crash after render but before acknowledgement may reopen the same destination once.

### Recovery-safe resolver boundary

Terminal absence and retryable failure must be distinguishable in real source, not only prose.
`getProfileByHandle`, `getPersonalWall`, `getWallMarks`, and author hydration must stop suppressing
Supabase errors. A small dependency-injected resolver contract classifies typed null/unavailable as
terminal and thrown transport/server failure as retryable for handle, Personal Wall, Shared Wall,
invitation, and focused Mark. Injected-failure tests bind this behavior.

### Privacy-safe unavailability

Expired, malformed, nonexistent, inaccessible, deleted, and unauthorized terminal outcomes show
one generic state: “This isn't available anymore.” with My Wall and Discover actions. No object
name, owner, type, access reason, or stored identifier is displayed. Retryable transport/server
failures use a retry state and do not consume the record; storage health uncertainty instead
quarantines durable resume for the process.

### Preserve protected-media/session boundaries

Deferred-destination reconciliation is additive to `AuthProvider`. It does not change the existing
same-subject token-refresh early return, protected-media cache purge, upload reset, local session
generation, signed URL lifetime, or media resume identity. Destination identifiers are never media
credentials and never enter protected-media storage/cache keys.

## Consequences

### Positive

- Supported intents survive cold process termination.
- One strict record keeps retention, cleanup, and reasoning bounded.
- Account switches fail closed before navigation metadata is returned.
- Authorization remains on existing server/RLS paths.
- No schema, hosted migration, backend service, dependency, or native configuration is required.
- Exact-snapshot acknowledgement prevents stale cleanup races.
- The design is reversible through a client release.

### Costs and limitations

- Several destination screens must participate in terminal acknowledgement.
- Storage uncertainty disables durable resume for the process and may leave a record physically
  present until a later successful scrub.
- After failed sign-out deletion plus a full restart, the same account can potentially recover the
  stale record; a different account remains fail-closed.
- Device-clock rollback cannot always be detected after restart, so real-world TTL is not
  tamper-proof.
- A crash in the narrow post-render/pre-ack window may reopen the same destination once.
- There is no remote kill switch; disabling durable recovery requires another client release.
- Universal links, store fallback, install attribution, push, and multiple intents remain out of
  scope.

## Alternatives Considered

### Keep process memory only

Rejected because it cannot satisfy cold-process recovery.

### Persist the raw href

Rejected because arbitrary or future route/query data could become retained and navigable, and
validation would be distributed across consumers.

### Use SecureStore

Rejected for MVP because it adds keychain lifecycle complexity without replacing authorization.
The accepted record intentionally contains only minimal public/object identifiers.

### Store the intent in Supabase

Rejected because it requires schema, hosted operations, network access, and server cleanup for a
single device-local intent. It also cannot represent a signed-out owner without additional
tracking.

### Clear immediately after route selection

Rejected because a read or interrupted redirect would destroy the only durable intent before the
user sees a terminal outcome.

## Rollback

A rollback release must remove `the-wall:deferred-destination:v1`, disable durable capture/read,
and restore a strictly normalized process-memory fallback. Merely ceasing to read the durable key
is not sufficient because it could retain data past the approved lifetime.

## Review and Implementation Gate

This ADR is **Proposed**. Founder authorization covers reversible local/draft implementation, but
AIOS requires an independent architecture review because the decision crosses authentication and
privacy boundaries. Frontend implementation may begin only after the plan and this ADR receive an
independent **APPROVE** verdict. No application code, hosted system, merge, deployment, commit, or
push is authorized by this ADR.

## Calibrated Confidence

- **Verified:** existing process-memory behavior, installed dependencies, account-route contract,
  source-level feasibility, and lack of schema need.
- **Believed-likely:** the one-record approach is the least costly implementation satisfying every
  approved requirement.
- **Inferred:** the production conversion benefit until beta traffic exists.
