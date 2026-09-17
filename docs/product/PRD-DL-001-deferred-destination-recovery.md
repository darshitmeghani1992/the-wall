# PRD-DL-001: Deferred Destination Recovery

## Validation Tier

**Spec-Ready**, pending independent privacy review and Architect complexity/feasibility review.

## Problem

Someone can open a valid The-Wall link while signed out or before onboarding is complete, but the
current in-memory handoff can be lost when the app process is interrupted. Dropping that person on
My Wall after sign-in breaks the social invitation loop and contradicts Master Build Spec §§34–35,
46, 59, 110–114. The smallest useful fix is reliable recovery of one safe destination without ever
carrying it into a different account.

## Evidence

- **Verified:** the Master Build Spec requires the original destination to survive auth/onboarding,
  route safely when valid, and fall back without crashing when unavailable.
- **Verified:** `src/lib/pendingLink.ts` is process-memory-only and explicitly loses the target on a
  cold kill.
- **Verified:** the app already supports Personal-Wall and Shared-Wall link entry surfaces and a
  central Alert destination contract.
- **Believed-likely:** reliable destination recovery will reduce failed invite journeys. There is no
  production traffic yet, so the size of that improvement is unmeasured.

## Product Decision

The MVP keeps at most **one** pending destination for **24 hours**. The newest valid link-open event
replaces the older one, including a newly opened link to the same object. The retention allowlist is:

- a Personal Wall identified only by normalized public handle;
- a person profile/Personal Wall identified only by user ID;
- a Shared Wall identified only by Wall ID;
- a Shared Wall invitation identified only by Wall ID; and
- a Mark focus identified only by Mark ID plus its Personal-Wall owner ID or Shared-Wall ID.

Handles and IDs are the only retained fields. Mark text/media, Secret state/content, actor identity,
display copy, authentication data, and arbitrary query values are never retained. The only query-like
semantic in scope is an allowlisted Mark ID used to focus the Mark within its containing Wall.
Unknown routes, credentials, arbitrary URLs, and unsupported query data are rejected.

Because a signed-out link cannot identify a person, the **next account to authenticate claims the
unbound destination**. This is an accepted shared-device trade-off: the destination contains only
the minimal identifiers above, and authorization is still re-evaluated before content is shown. A
destination captured while a session exists, including during incomplete onboarding, binds to that
account immediately. Binding itself must not expose destination metadata before the account gate is
ready.

The bound destination may survive onboarding, same-account token refresh, and temporary session
expiry followed by re-authentication to the same account. Explicit sign-out always clears it. A real
account switch or re-authentication as a different account purges it before any destination metadata
or navigation is exposed. It remains pending until the app reaches the intended destination or
presents a definitive safe unavailable state; reading it is not enough to destroy it.

Signing out must not be blocked by a local-storage failure. If durable clearing fails, the app must
quarantine recovery immediately for the rest of that process, continue sign-out, and retry the scrub.
The accepted client-only limitation is that a full process restart can erase that quarantine; if the
same account later signs in while the underlying storage record still could not be removed, the old
destination could become recoverable again. This is a stale-intent risk for the same account, not
permission to expose it to a different account. Cross-account mismatch still fails closed.

The 24-hour age begins at the latest valid link-open capture. Reads, process restarts, account
binding, token refresh, authentication completion, and failed resume attempts never extend it. If
the stored age is missing, malformed, future-dated, or cannot be established safely after a clock
change, the destination is treated as expired.

## Non-Goals

- Native push notifications or requesting OS notification permission.
- Universal HTTPS/App Links, domain association, store fallback, or install attribution.
- Retaining multiple destinations or showing a pending-link inbox.
- Destination families outside the five listed above, including settings, reports, account-status
  routes, arbitrary tab routes, and direct Secret Mark recovery.
- Restoring an unfinished Mark draft or replaying a mutation after authentication.
- Persisting Secret Mark content, authentication codes, provider callbacks, arbitrary URLs, or
  unrecognized query parameters.
- Changing destination authorization. Recovery never grants access the signed-in account lacks.

## User Story

As someone opening a link to a Wall or invitation, I want to finish sign-in and onboarding without
losing where I was going, so I arrive at the social object that brought me into The-Wall.

## User Journey

1. The person opens a supported The-Wall destination.
2. If authentication or onboarding is required, The-Wall remembers that destination and continues
   through the normal account journey.
3. After the account is ready, The-Wall returns to the remembered destination once.
4. If the destination expired, became unavailable, or is unauthorized, The-Wall explains that it is
   unavailable and offers My Wall and Discover.
5. A sign-out or account switch clears the remembered destination rather than exposing it to the
   next account.

## Acceptance Criteria

1. **Supported signed-out destination**
   - Given a supported destination is opened while signed out
   - When the next account authenticates and completes any required onboarding within 24 hours
   - Then the app opens that destination instead of generic Home.

2. **Cold-process recovery**
   - Given a supported destination was accepted before authentication completed
   - When the app process restarts within 24 hours and the claiming account completes the journey
   - Then the destination remains recoverable.

3. **Newest valid destination wins**
   - Given one destination is pending
   - When a different supported destination is opened before arrival
   - Then only the newer destination is resumed.

4. **Expiry**
   - Given a destination has been pending for more than 24 hours
   - When the app launches or authentication completes
   - Then the app shows the safe unavailable state with My Wall and Discover actions, clears the
     destination after showing that outcome, and does not enter a redirect loop.

5. **Account isolation**
   - Given a destination has become associated with account A
   - When A explicitly signs out, the session changes to B, or re-authentication completes as B
     before arrival
   - Then the destination is purged before B can observe its metadata or navigation.

6. **Same-account refresh**
   - Given a valid destination is pending for account A
   - When A's token refreshes without an identity change
   - Then the destination remains pending.

7. **Temporary session expiry**
   - Given a destination is bound to account A and the session temporarily expires
   - When A re-authenticates as A within the original 24-hour window
   - Then the destination remains recoverable without extending its expiry.

8. **Allowlist and normalization**
   - Given an unknown route, arbitrary external URL, authentication callback, malformed identifier,
     or unsupported query data
   - When it reaches the destination-recovery boundary
   - Then it is rejected and never persisted or navigated to.

9. **Terminal arrival, not read, consumes intent**
   - Given a valid destination is pending
   - When an intermediate gate reads it but navigation is interrupted
   - Then it remains recoverable; it is cleared only after the user can see the authorized
     destination or a definitive nonexistent, inaccessible, unauthorized, or expired outcome.
   - And a retryable offline, timeout, or server error preserves the destination and offers retry.

10. **Unavailable or unauthorized destination**
   - Given a resumed destination no longer exists or the account cannot access it
   - When resolution completes
   - Then the app shows “This isn't available anymore.” with My Wall and Discover actions, clears
     the destination, and does not reveal private metadata.

11. **Duplicate-launch safety**
    - Given lifecycle events or development Strict Mode trigger routing more than once
    - When the destination is resumed
    - Then the user observes one navigation outcome and no redirect loop.

12. **Retention window does not slide**
    - Given a valid destination was captured at time T
    - When it is read, bound, resumed after restart, refreshed under the same account, or fails with
      a retryable error
    - Then it still expires at T plus 24 hours.

13. **Sign-out remains available when local clearing fails**
    - Given a destination is bound to account A and local storage fails during explicit sign-out
    - When A signs out
    - Then sign-out still completes, recovery is disabled for the rest of that process, and the app
      retries removing the retained destination without exposing it to another account.

## Edge Cases

- The link arrives during OAuth completion: the provider callback completes auth but is never stored
  as a product destination.
- The user abandons sign-in: the unbound destination may remain until its 24-hour expiry.
- The account is inactive, suspended, or unavailable: account recovery/status routing wins; the
  destination cannot bypass the account gate.
- The linked object is deleted between capture and arrival: show the same privacy-safe unavailable
  outcome as a nonexistent or inaccessible object.
- A crash after destination rendering but before terminal acknowledgement may reopen that same
  destination once on restart. It must never open a different destination or loop repeatedly.
- The app clock moves or the stored timestamp is untrustworthy: treat the destination as expired and
  show the safe unavailable outcome rather than extending retention.
- Local storage fails during explicit sign-out: the current process quarantines recovery and retries
  the scrub. A later process restart cannot prove the earlier failure occurred; same-account stale
  recovery remains an accepted limitation, while a different account must still receive no result.

## Success Metrics

- In controlled acceptance testing, every supported signed-out link reaches either its intended
  destination or the explicit unavailable state after sign-in/onboarding; none silently lands on
  generic Home.
- Zero observed cross-account destination restorations in lifecycle and account-switch regression
  tests.
- Zero redirect loops across cold launch, Strict Mode, onboarding completion, and same-user token
  refresh tests.

## Release Blockers and Failure / Kill Criteria

**Before release:** any cross-account restoration, retention of non-allowlisted data, or redirect
loop blocks the slice. A single reproducible duplicate navigation also blocks that build until fixed,
but does not by itself invalidate the product direction.

**After release:** any confirmed cross-account restoration or non-allowlisted retention disables
durable recovery and returns to the process-memory fallback until corrected and independently
re-reviewed. A confirmed redirect loop disables durable recovery for the affected destination
family; isolated duplicate navigation is fixed through the normal defect process unless it creates
a loop or privacy exposure.

## Product Quality Bar

### Emotional Outcome

The user should feel that The-Wall remembered why they opened the app, without feeling tracked.

### User Expectation

A link opened before sign-in should still work after sign-in. Signing into a different account must
not inherit another account's activity.

### Perceived Quality

Landing on generic Home, bouncing between gates, opening the destination twice, or showing a
technical route/error would feel broken.

### Friction Tolerance

No additional confirmation is acceptable for normal recovery. A clear unavailable state is
acceptable when access cannot safely be established.

### Delight Opportunities

None in MVP. Correct, quiet recovery is the delight.

## Assumptions

- **DL-A1 — Believed-likely:** one pending destination is sufficient for MVP users. The Master Build
  Spec verifies only that a queue is not required by scope.
- **DL-A2 — Believed-likely:** 24 hours is long enough for normal sign-in/onboarding completion while
  limiting stale-intent risk.
- **DL-A3 — Verified:** account recovery/status gates must override destination recovery.
- **DL-A4 — Believed-likely:** Personal Wall by handle/user ID, Shared Wall, Shared invite, and a
  privacy-safe Mark focus cover the highest-value MVP invite and Alert journeys; universal links and
  push can remain separate later slices.
- **DL-A5 — Believed-likely:** allowing sign-out to complete during a rare local-storage failure is
  safer for user control than trapping the user in a session; process quarantine and scrub retries
  sufficiently reduce same-account stale-intent risk for MVP.

## Complexity Estimate (from Architect)

Pending. Product recommends a client-only, reversible slice with no schema, hosted migration,
third-party service, or push dependency.

## Open Questions

None for Product. Architect must define the smallest safe persistence, enforcement, account-binding,
and arrival-acknowledgement contract for the Product-owned policy above before this becomes
Build-Ready.
