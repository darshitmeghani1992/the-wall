# Feature Plan: Deferred Destination Recovery

**Status:** Proposed — pending independent architecture review  
**Date:** 2026-09-16  
**Product authority:** `docs/product/PRD-DL-001-deferred-destination-recovery.md`, SHA-256
`bdd38bcedf3d97daef30ed5b1e8c3b98a686e0f02c0f0cc4981d5839987514db`; and
`docs/PRODUCT_ASSUMPTIONS_REGISTER.md`, SHA-256
`0794d06704eb2e17b7c926e6110f80d063f0f8c51c72ea37a858d2dfe077da24`.  
**Founder gate:** Approved for reversible local/draft implementation only. No schema, hosted
migration, external integration, merge, deploy, commit, or push is authorized.  
**Fast Lane tier:** High-Risk / Architectural  
**Complexity:** Complex  
**Reversibility:** Two-way door before release. A later client change can purge the one durable
key and restore the process-memory fallback.  

## Executive Summary

The feature is feasible as a client-only change. The smallest safe design is one strictly
validated, versioned record in existing `AsyncStorage`, one process-local routing-attempt
coordinator, and Expo Router's native-intent interception boundary. It requires no database
change, hosted migration, backend endpoint, new dependency, or external integration.

It is High-Risk because it crosses authentication, account switching, onboarding, navigation,
privacy-sensitive persistent state, and terminal authorization outcomes. Independent architecture
review is required before implementation under the AIOS Two-Key rule.

**Estimated implementation:** one to two focused Frontend sessions, followed by independent
Reviewer and QA passes.  
**Database impact:** None.  
**Dependency risk:** Low; `@react-native-async-storage/async-storage` and `expo-linking` already
exist in the project.  
**Operational risk:** Medium before the specified regression tests pass; low after independent
review and QA.  
**Approximate AI session count:** one Frontend contract/persistence session, one integration/polish
session, one independent implementation review, and one QA session.

## Goal

Reliably recover one supported Wall, invitation, or focused-Mark destination after sign-in,
onboarding, or a cold process restart, without ever restoring it into a different account,
extending its 24-hour retention window, bypassing the authoritative account route, or consuming it
before the user sees a terminal outcome.

## User Story

As someone opening a The-Wall link before authentication or onboarding is complete, I want the app
to remember why I arrived so that I reach that object after my account is ready without another
account inheriting the destination.

## Repository Discovery

- `src/lib/pendingLink.ts` is process-memory-only and consumes its raw href on read.
- `app/index.tsx` and `app/(onboarding)/walkthrough.tsx` consume the current href before terminal
  arrival.
- `src/lib/onboarding.ts` already demonstrates serialized `AsyncStorage` mutations.
- `src/lib/auth.tsx` owns Supabase session changes, authoritative account-route loading, protected
  media cleanup, and session-generation rotation.
- `src/lib/onboarding-contract.ts` makes the server-returned `accountRoute` authoritative.
- Expo Router already consumes native initial/runtime URLs. A parallel `Linking` listener in
  `AuthProvider` would race and duplicate that navigation; interception must happen in
  `app/+native-intent.ts` before Expo Router selects a screen.
- `app/u/[handle].tsx` and `app/s/[id].tsx` currently capture the in-memory href and enforce the
  account gate. Direct person, Shared-Wall, and invitation routes need the same account-ready
  boundary for external entry.
- `getProfileByHandle`, `getPersonalWall`, `getWallMarks`, and author hydration currently suppress
  some Supabase errors. Recovery cannot distinguish retryable transport failure from terminal
  absence until these helpers propagate errors.
- Personal, Shared, and My Wall screens already understand `focusMark`; the requested Mark must
  still be proven visible through their existing authorized reads.
- `app.json` registers only the `thewall` custom scheme. Universal HTTPS/App Links and store
  fallback remain outside this slice.
- No existing ADR covers durable deferred-destination ownership.
- No `docs/TECHNICAL_DEBT_REGISTER.md` currently exists. This feature introduces no intentional
  debt if implemented as specified.

## Recommended Build Order

1. Independent Reviewer approves or blocks this Feature Plan and ADR-013.
2. Frontend implements the pure destination and persisted-record contract with exhaustive tests.
3. Frontend adds serialized persistence, tri-state ownership reconciliation, opaque attempt
   tokens, and process-local quarantine.
4. Frontend intercepts initial/runtime links in `app/+native-intent.ts`, then integrates identity
   boundaries into `AuthProvider` without adding a second `Linking` listener or changing current
   protected-media effects.
5. Frontend replaces early consumption with ready-gated resume and terminal acknowledgement.
6. Independent Reviewer inspects the exact implementation tree.
7. QA executes contract, lifecycle, export, simulator, and account-switch verification.

## Binding Data Contract

Persist only this strict shape under the single key
`the-wall:deferred-destination:v1`:

```ts
type DeferredDestination =
  | { kind: "personal_handle"; handle: string }
  | { kind: "personal_user"; userId: string }
  | { kind: "shared_wall"; wallId: string }
  | { kind: "shared_invite"; wallId: string }
  | {
      kind: "mark";
      markId: string;
      container:
        | { kind: "personal"; ownerId: string }
        | { kind: "shared"; wallId: string };
    };

type StoredDeferredDestinationV1 = {
  version: 1;
  capturedAtMs: number;
  boundSubject: string | null;
  destination: DeferredDestination;
};
```

No raw URL, query object, route string, display name, content, Secret state, authentication value,
media value, signed URL, or server response may be persisted. Persisted JSON must have exact keys
recursively; unknown keys invalidate it.

## Strict URL Allowlist and Normalization

| External form | Normalized destination |
|---|---|
| `thewall://u/<handle>` | `personal_handle` |
| `thewall://person/<uuid>` | `personal_user` |
| `thewall://s/<uuid>` or `thewall://shared/<uuid>` | `shared_wall` |
| `thewall://shared/invite/<uuid>` | `shared_invite` |
| Personal or Shared route with exactly one `focusMark=<uuid>` | `mark` with its container |

Rules:

- Scheme is exactly `thewall`, compared case-insensitively and normalized.
- Reject credentials, ports, fragments, empty or extra path segments, malformed percent encoding,
  unknown routes, and arbitrary URLs.
- Reject every query key except one `focusMark` on a supported Personal/Shared container.
- Reject duplicate `focusMark` values.
- Authentication callbacks are always rejected and never persisted.
- HTTP/HTTPS links are rejected in this slice.
- UUIDs use the canonical PostgreSQL-compatible `8-4-4-4-12` shape and normalize to lowercase.
- External handle parsing lowercases, removes at most one leading `@`, then requires at least three
  characters and rejects the value if any remaining character is outside `[a-z0-9_]`. It must not
  strip arbitrary invalid characters and alias a malformed link such as `ma*ya` to `maya`. It does
  not invent a handle-specific maximum because current Product/database behavior has none.
- Before URL construction, reject an empty/non-string value, NUL/ASCII controls, backslashes,
  encoded `/` or `\\`, invalid percent encoding, more than one query entry, and raw native intents
  above 8 KiB. The 8 KiB ceiling is a transport/parser resource bound, not a new account-handle
  eligibility rule. Consequently, an existing pathological handle that makes a native intent
  exceed 8 KiB is not recoverable by this slice; this is an explicit existing product/data-model
  limitation rather than a silent handle rule.
- Parse custom-scheme routes from the canonical sequence of URL hostname followed by pathname
  segments. This is required because `thewall://u/maya` represents `u` as the hostname, while
  slash-prefixed paths have no hostname. Decode each accepted component exactly once after encoded
  separator checks.
- Rejected input is never persisted and never produces deferred navigation.

### Native-intent interception

`app/+native-intent.ts` is the only initial/runtime native URL interception boundary. Its
`redirectSystemPath` implementation may be asynchronous and must:

1. recognize and pass the auth callback to its existing callback screen without persisting it;
2. classify a supported product link through the pure parser;
3. resolve the current session to the tri-state subject contract;
4. enqueue capture before returning `/` so Expo Router cannot expose or race the destination;
5. return `/` for rejected/unsupported product intents rather than navigating them; and
6. fail safely to `/` if parsing, session resolution, or persistence is uncertain.

`AuthProvider` must not add `Linking.getInitialURL()` or a `Linking` event subscription. Ordinary
internal `router.push/replace` calls do not pass through `+native-intent` and are not captured.

## Persistence Interface

The implementation must expose an equivalent typed contract. Subjects are tri-state so bootstrap
uncertainty can never be treated as signed out:

```ts
type DeferredSubject =
  | { status: "unknown" }
  | { status: "signed_out" }
  | { status: "authenticated"; userId: string };

type DeferredScreenIdentity =
  | { kind: "handle"; handle: string }
  | { kind: "personal"; ownerId: string; focusMarkId: string | null }
  | { kind: "shared"; wallId: string; focusMarkId: string | null }
  | { kind: "shared_invite"; wallId: string }
  | { kind: "unavailable" };

declare const attemptTokenBrand: unique symbol;
type DeferredAttemptToken = string & { readonly [attemptTokenBrand]: true };
declare const navigationRefBrand: unique symbol;
type DeferredNavigationRef = string & { readonly [navigationRefBrand]: true };

captureDeferredDestinationUrl(
  rawUrl: string,
  currentSubject: DeferredSubject,
  nowMs?: number,
): Promise<"captured" | "rejected">;

prepareDeferredDestinationResume(
  subject: string,
  nowMs?: number,
): Promise<
  | { status: "none" }
  | { status: "navigate"; href: string; navigationRef: DeferredNavigationRef }
  | { status: "terminal_unavailable"; href: string; navigationRef: DeferredNavigationRef }
  | { status: "durable_disabled" }
  | { status: "in_flight" }
>;

reconcileDeferredDestinationIdentity(
  previousSubject: DeferredSubject,
  nextSubject: DeferredSubject,
): Promise<void>;

clearDeferredDestinationForExplicitSignOut(): Promise<void>;
claimDeferredAttemptReference(
  navigationRef: DeferredNavigationRef,
  exactScreen: DeferredScreenIdentity,
  subject: string,
): DeferredAttemptToken | null;
transferDeferredHandleTarget(
  token: DeferredAttemptToken,
  exactTarget: DeferredScreenIdentity,
): { href: string; navigationRef: DeferredNavigationRef } | null;
transferDeferredAttemptToUnavailable(
  token: DeferredAttemptToken,
): { href: string; navigationRef: DeferredNavigationRef } | null;
acknowledgeDeferredArrival(token: DeferredAttemptToken): Promise<boolean>;
acknowledgeDeferredUnavailable(token: DeferredAttemptToken): Promise<boolean>;
retryDeferredDestination(token: DeferredAttemptToken): Promise<boolean>;
```

Names may vary only if their meaning remains equally explicit. There may be no no-argument
transition, terminal, retry, transfer, or acknowledgement API.

`prepareDeferredDestinationResume` creates the opaque token inside the coordinator and a separate,
random, one-use process-local navigation reference mapped to that token. The returned internal href
contains the reserved reference as the `__deferred_ref` Expo Router search parameter. `app/index.tsx` navigates with
that exact returned href; it never reads or stores the token. The destination screen reads the
reference from its own navigation parameters, validates it with its exact normalized screen
identity and authenticated subject, and exchanges it once through
`claimDeferredAttemptReference`. The external parser always rejects `__deferred_ref`, so an
incoming URL can never supply or claim an internal reference.

The screen captures the returned token in the local load/effect invocation created for that exact
navigation. It must not read a mutable global “current token” or dereference a shared token ref when
an asynchronous result completes. If the same mounted route receives a later reference, it starts
a new local invocation for B; the older A closure retains token A, which replacement has already
invalidated. Tokens and references are process-only: never persisted, logged, sent to analytics,
used for authorization, accepted from an external intent, or exposed through public `AuthState`.

Handle resolution transfers token ownership through `transferDeferredHandleTarget`, invalidates
the handle reference, and returns a new one-use reference embedded in the exact final-screen href.
Terminal missing/inaccessible/expired routing similarly uses
`transferDeferredAttemptToUnavailable`; the unavailable screen must exchange that new reference
before acknowledgement. A replacement between either transfer and screen claim invalidates the
reference and token, so stale UI cannot act on the replacement.

Tokens are bound to exact serialized record + subject + attempt generation and invalidated by
replacement, sign-out, account change, or quarantine.

Storage reads, writes, replacements, binding, reconciliation, and removals must run through one
serialized queue. A stale token cannot mutate active state. A valid acknowledgement additionally
compares the exact serialized record snapshot before deletion, so it cannot erase a newer link.

The stored string is rejected before `JSON.parse` if it exceeds 16 KiB. Every record produced by an
accepted 8-KiB-or-smaller native intent is below that ceiling. This bounds corrupt-storage parsing
without adding a handle-specific product maximum.

## Retention Contract

- Each accepted link-open replaces the old record, including another opening of the same object.
- `capturedAtMs` changes only on a real accepted link-open event.
- Reads, binding, restarts, retries, token refresh, account bootstrap, and reauthentication never
  modify the timestamp.
- The record expires at `capturedAtMs + 86_400_000` milliseconds. Equality is expired.
- Missing, malformed, non-integer, unsafe, negative, future-dated, or otherwise untrustworthy time
  produces terminal unavailability, never a new timestamp.
- Expired/malformed records remain only until the generic unavailable screen renders and
  acknowledges the outcome.
- A normal destination/server failure is retryable and cannot delete or replace a valid record.
- Any `AsyncStorage` read/write/clear uncertainty marks storage unhealthy, enters process-local
  quarantine, invalidates every active token, and disables durable resume for the rest of that
  process. This is stricter than an ordinary retryable network failure because ownership can no
  longer be established safely.

## Identity and Account-Boundary Contract

| Previous subject | Next subject | Required action |
|---|---|---|
| signed out | A | Bind unbound to A; preserve bound A; purge one bound elsewhere |
| A | A | Preserve unchanged |
| A | signed out, automatic session expiry | Preserve bound A for same-account reauthentication |
| A | signed out, explicit sign-out | Quarantine, scrub before/after sign-out, never block sign-out |
| A | B | Purge before B's account route or destination can be exposed |
| signed out | B after A expiry | Preserve only bound B; otherwise purge before exposure |
| unknown | any | Do not expose or resume; quarantine until the process restarts |

An ownership mismatch returns no destination or destination metadata to the new account.

Explicit sign-out follows this binding sequence: enter process-local quarantine immediately,
invalidate attempts, attempt a queued scrub, proceed with Supabase sign-out regardless of scrub
success, and retry the scrub after sign-out. User security/control takes precedence over making
local cleanup a prerequisite to leaving the account.

If both scrub attempts fail, durable resume stays disabled for the process. After a full process
restart, a same-account login could recover that stale bound record if storage becomes readable;
client-only storage cannot eliminate that residual case after failed durable deletion. This is an
accepted, explicit limitation. A different account still fails closed because the readable record
is bound to the prior subject and must be purged before exposure.

### `AuthProvider` ordering

1. `app/+native-intent.ts` captures supported native intents before returning `/` to Expo Router.
2. Initial auth boot obtains the Supabase session and reconciles the tri-state subject before
   exposing session/account state.
3. Runtime native intents use the same `+native-intent` boundary and serialized queue.
4. On A→B, fence and clear A's visible account state synchronously, reconcile/purge while B
   remains unexposed, and only then call `setSession(B)` and load B's account route.
5. Existing protected-media cache clearing, upload reset, and session-generation behavior remain
   unchanged.
6. Same-subject `TOKEN_REFRESHED`/`USER_UPDATED` retains its existing session-only early return.
7. Generic `SIGNED_OUT` does not clear a bound destination; only explicit `signOut()` clears it.
8. Resume is queried only after `accountRoute === "ready"`.
9. `deactivated`, `suspended`, `unavailable`, onboarding, and walkthrough always override recovery.

No destination value may be placed in public `AuthState`, logged, used as an authorization
decision, or exposed before the ready gate.

## Recovery-Safe Resolver Contract

`src/lib/deferred-destination-resolver.ts` owns the classification boundary and accepts injected
operations so failure behavior is testable without a live Supabase project. It returns only:

```ts
type DeferredResolution =
  | { status: "available"; href: string }
  | { status: "terminal_unavailable" }
  | { status: "retryable_failure" };
```

Typed `null`, a strict RPC `{status:"unavailable"}`, an authorized container without the requested
Mark, deletion, or authorization denial is terminal. A thrown Supabase/network/server error is
retryable. It must not turn a caught exception into absence.

To make that distinction real, `src/lib/profiles.ts` must propagate errors from
`getProfileByHandle` and `getPersonalWall`; `src/lib/marks.ts` must propagate errors from
`getWallMarks` and author hydration. Existing callers may keep their presentation behavior, but
the underlying helpers cannot return `null`/empty solely because a query failed. Shared-Wall and
invitation helpers already throw query/RPC errors and preserve typed unavailable outcomes.

## Terminal Acknowledgement Contract

Reading is not consumption. A process-local active-attempt object retains the exact record
snapshot, subject, generation, opaque token, and expected terminal route; it is never persisted.

Arrival is acknowledged only after:

- Personal Wall/Profile: the authorized Wall state has rendered.
- Shared Wall: the authorized Wall/capability state has rendered.
- Invitation: the available invitation decision surface has rendered.
- Mark: its authorized container and requested Mark have rendered/opened.
- Unavailable: the generic unavailable screen has rendered.

For a handle, `/u/[handle]` exchanges its exact navigation reference once, then uses
`transferDeferredHandleTarget(token, exactTarget)` to obtain a new final-screen href/reference. It
may not clear the record. The final Personal Wall screen must exchange the transferred reference
to capture that exact token before it can acknowledge.

Missing, deleted, inaccessible, or unauthorized objects transfer their captured token to a new
one-use unavailable-screen reference and route with the returned internal href. The unavailable
screen exchanges that reference before it can acknowledge. It exposes no destination metadata and
displays exactly the approved outcome, “This isn't available anymore.”, with **My Wall** and
**Discover** actions. It acknowledges after first render.

Offline, timeout, and server failures are retryable. They preserve the record and offer Retry.
Storage uncertainty quarantines durable resume for the process. A crash after rendering but before
acknowledgement may reopen the same destination once.

## Redirect Deduplication

- Maintain one process-local active attempt per exact persisted-record snapshot.
- `prepareDeferredDestinationResume` yields `navigate` once. Every second Strict Mode/bootstrap
  call for the same active attempt returns explicit `in_flight`, never another navigation and never
  `none`.
- A new accepted external link replaces the record and invalidates the earlier active attempt.
- Do not persist an “already redirected” flag because that would consume intent before arrival.
- A process restart resets the in-memory routing guard but retains the durable intent.

## Functional Requirements

1. Capture only actual native custom-scheme link events through `+native-intent`, not ordinary
   internal navigation.
2. Persist at most one typed destination.
3. Preserve it across a cold process restart for the original non-sliding 24-hour window.
4. Bind an unbound destination to the first authenticated account.
5. Purge before a different account can observe metadata or navigation.
6. Preserve through same-account refresh and temporary expiry/reauthentication.
7. Respect the server account-route authority before destination processing.
8. Re-run existing server/RLS authorization at the target screen.
9. Clear only after terminal rendering or explicit sign-out.
10. Provide one generic, privacy-safe unavailable state.

## Non-Functional Requirements

- No new dependency or platform configuration.
- No destination identifiers in logs, analytics, crash copy, or public auth context.
- One bounded `AsyncStorage` read/write record; no list or unbounded work.
- Storage/parser/resolver code remains framework-independent and directly testable through
  injected clock, storage, subject, and resolver adapters.
- No change to protected-media cache identity, session generation, upload resume, or signed-read
  boundaries.
- The unavailable state must expose an accessible alert and accessible My Wall/Discover actions.

## Exact Implementation Files

### New

- `src/lib/deferred-destination-contract.ts`
- `src/lib/deferred-destination.ts`
- `src/lib/deferred-destination-resolver.ts`
- `src/lib/deferred-destination-contract.test.ts`
- `src/lib/deferred-destination.test.ts`
- `src/lib/deferred-destination-resolver.test.ts`
- `app/+native-intent.ts`
- `app/deferred-destination-unavailable.tsx`
- `tests/frontend-deferred-destination.test.mjs`
- `docs/handoffs/FRONTEND_DEFERRED_DESTINATION_2026-09-16.md` during implementation handoff

### Modify

- `src/lib/auth.tsx`
- `app/index.tsx`
- `app/_layout.tsx`
- `app/(onboarding)/walkthrough.tsx`
- `src/lib/onboarding-contract.ts`
- `app/u/[handle].tsx`
- `app/s/[id].tsx`
- `app/person/[id].tsx`
- `app/shared/[id].tsx`
- `app/shared/invite/[id].tsx`
- `app/(tabs)/home.tsx`
- `src/lib/profiles.ts`
- `src/lib/marks.ts`

### Remove after all consumers migrate

- `src/lib/pendingLink.ts`

No change is permitted to schema, migrations, Supabase functions, `app.json`, protected-media
modules, hosted infrastructure, or external services.

## Test Matrix

### Pure parser and record contract

- Every allowed destination and both accepted Shared aliases.
- Personal and Shared focused-Mark destinations.
- Canonical hostname+pathname parsing for both `thewall://u/maya` and slash-path inputs.
- Raw control/backslash/encoded-separator/percent-decoding/query-count/8-KiB bounds.
- External handle lowercase/one-leading-`@` normalization, minimum three, no handle-specific
  maximum, and rejection (not stripping) of every remaining invalid character.
- UUID normalization.
- Exact-key parsing at every nesting level.
- Auth callback, HTTPS, unknown route, fragment, credentials, port, malformed encoding.
- Extra/duplicate query keys.
- Invalid or missing container/identifier.
- Malformed version, time, owner, and destination.
- Stored serialized input above 16 KiB is rejected before JSON parsing.
- Exact 24-hour boundary, over-boundary, future time, and non-sliding reads.

### Lifecycle and privacy

- Cold-process recovery.
- Newest destination wins, including same-object recapture.
- Unbound to first authenticated account.
- Bound A to automatic expiry to A reauthentication.
- Bound A to B purges without returning destination data.
- Direct A to B switch purge.
- Same-user token refresh preserves.
- Explicit sign-out quarantines, scrubs before/after, and proceeds when both scrubs fail.
- Injected `getItem`, `setItem`, and `removeItem` failures each quarantine the process and disable
  durable resume.
- After injected clear failure, same-process resume stays disabled for every subject.
- A readable stale bound record after simulated process restart still rejects a different subject.
- Account-route states override recovery.
- Read does not clear.
- Successful render clears.
- Generic unavailable render clears.
- Retryable failure preserves.
- Stale acknowledgement cannot clear a newer record.
- Strict Mode and repeated bootstrap yield one `navigate` followed by `in_flight`.
- Crash-before-ack permits one same-destination reopen.
- Stale token A cannot resolve, declare, retry, or acknowledge replacement attempt B.
- Same-route replacement creates reference B; a still-mounted screen/closure holding reference or
  token A cannot claim, transition, or acknowledge B.
- Handle attempt A transferred toward a final Personal Wall becomes inert when handle attempt B
  replaces it before final-screen claim; neither A's old handle reference nor transferred reference
  can claim B.
- Unavailable transfer A becomes inert when replacement B arrives before the unavailable screen
  claims it; stale unavailable UI cannot acknowledge or clear B.
- Externally supplied `__deferred_ref` is rejected and never matched against the process
  coordinator.
- Resolver injection proves null/typed unavailable is terminal while thrown Supabase/network
  errors are retryable for handle, Personal Wall, Shared Wall, invitation, and Mark lookup.
- Source-wiring tests prove `getProfileByHandle`, `getPersonalWall`, `getWallMarks`, and author
  hydration no longer suppress Supabase errors.

### Integration verification

- TypeScript.
- Lint with no new errors.
- All existing client contract tests.
- Expo configuration resolution.
- iOS and Android production exports.
- Simulator checks for cold kill, account switch, same-account reauthentication, offline retry,
  and malformed URL.
- Independent Reviewer approval of the exact tree.
- Independent QA, with physical-device behavior unclaimed unless actually exercised.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Cross-account restoration | Critical | Bound subject, reconcile before exposure, fail-closed mismatch purge |
| Raw URL/auth callback persistence | High | Pure exact allowlist; typed record only |
| Premature consumption | High | Exact-snapshot terminal acknowledgement |
| Redirect loop/duplicate navigation | High | One process attempt and exact-record dedupe |
| Offline classified as missing | Medium | Explicit retryable versus terminal outcomes |
| New link erased by stale screen | High | Compare exact serialized snapshot before removal |
| Account gate bypass through direct route | High | Ready gate on every supported destination |
| Protected-media regression | High | Additive auth integration; preserve current media effects |
| AsyncStorage failure | High | Process quarantine; invalidate tokens; disable resume; retry sign-out scrub |
| Failed sign-out deletion survives restart | Medium | Accept same-account residual; cross-account mismatch still purges before exposure |
| Clock movement | Medium | Detect future timestamps; document client-clock limitation honestly |

## Hidden Dependencies

- Existing custom scheme: building against now.
- Existing authoritative account route: reused unchanged.
- Existing RLS and target authorization: reused; client recovery never grants access.
- Universal HTTPS/App Links and domain verification: deferred.
- Store fallback/install attribution: deferred.
- Push notifications: deferred.
- Multiple pending destinations/inbox: deferred.
- Remote kill switch: deferred; rollback requires a client release.
- Production analytics: deferred; Product has not approved new tracking.

## Clock Limitation

The record uses the device wall clock. It detects a stored timestamp that is now in the future and
expires early if the clock jumps forward. A client-only record cannot reliably detect a smaller
backward clock change that still leaves `capturedAtMs` in the apparent past after a process restart;
such a change can extend real-world retention. A monotonic clock cannot bridge process/device
restarts, and trusted server time would add an external dependency. The 24-hour TTL is therefore
not tamper-proof. This explicit limitation is mitigated by the minimal identifier-only record,
account binding, and server reauthorization before content display.

## Alternatives Considered

1. **Keep process memory only:** smallest code, but fails the approved cold-process requirement.
2. **Persist a raw href:** fewer types, but retains arbitrary input and makes allowlist enforcement
   and future migrations unsafe.
3. **Use SecureStore:** already installed but adds keychain/backup lifecycle complexity without
   replacing server authorization; the approved record contains only minimal identifiers.
4. **Store destinations server-side:** adds schema, hosted migration, cleanup, account-binding, and
   network availability for an MVP intent that is local to one device.
5. **Consume on read:** simple but loses intent on interrupted navigation and contradicts the PRD.

The selected one-record AsyncStorage contract is the smallest design that satisfies cold recovery,
privacy, account isolation, and terminal acknowledgement.

## Rollback Plan

1. Ship a client change that removes `the-wall:deferred-destination:v1`.
2. Disable durable reads and captures.
3. Restore a strictly normalized process-memory-only pending destination.
4. Leave account-route and protected-media behavior unchanged.
5. Re-run auth, account-switch, and supported-link regression tests.

Stopping reads without deleting the durable key is not an acceptable rollback because it would
leave retained intent beyond the approved lifecycle.

## Multi-Agent Orchestration

| Unit | Owning Role | Depends on | Parallel work |
|---|---|---|---|
| Architecture/privacy-security review | Independent Reviewer | This plan and ADR-013 | None |
| Client contract, persistence, auth wiring, and acknowledgement | Frontend | Architecture APPROVE | None; one owner avoids shared-file conflicts |
| Exact-tree implementation review | Independent Reviewer | Frontend handoff | None |
| Behavioral regression and simulator QA | QA | Reviewer APPROVE | Documentation status update only after exact-tree evidence |

A Backend unit is not justified.

## Success Metrics

- All supported signed-out links reach the intended authorized destination or generic terminal
  unavailable state in controlled tests.
- Zero cross-account restorations in switch and reauthentication tests.
- Zero duplicate navigation or redirect loops in cold launch, Strict Mode, walkthrough completion,
  and token-refresh tests.
- No retained record contains data outside the exact contract.

## Future Extensions

- Universal HTTPS/App Links may feed the same strict parser after separate native/domain approval.
- Additional destination families may extend the union one reviewed case at a time.
- A remote kill switch may later choose between durable and process-memory adapters.
- Multiple destinations remain excluded until real usage disproves DL-A1.

## Build Readiness

**Status: NOT READY — pending independent architecture review.**

Repository discovery, dependencies, interfaces, files, failure states, rollback, and tests are
defined. Founder authorization exists for reversible local/draft work. Because the design is
High-Risk auth/privacy architecture, AIOS requires an independent second review before Frontend
implementation begins.

After that review returns **APPROVE**, the slice is **READY** with no further Founder decision
required for local/draft implementation. Hosted changes, merge, deployment, commit, and push remain
outside the current authorization.

## Calibrated Confidence

- **Verified:** Product artifact hashes, current repository behavior, existing dependencies,
  account-route authority, source-level feasibility, and absence of schema need.
- **Believed-likely:** one to two Frontend implementation sessions.
- **Inferred:** production invite-conversion improvement; no production traffic exists yet.
