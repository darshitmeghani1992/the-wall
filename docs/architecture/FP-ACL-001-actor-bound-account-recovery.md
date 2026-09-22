# FP-ACL-001 · Actor-bound account recovery

## Contract

`reactivate_account(uuid)` is the only API-callable recovery mutation. It checks actor identity first, locks the caller's profile, and permits exactly two retry-safe states: `deactivated` transitions to `active`, while `active` remains unchanged. `suspended`, missing, unknown, mismatched, and unauthenticated states fail closed.

## Client sequence

1. Capture the signed-in user and begin an `AccountRouteFence` token.
2. Preflight the current authenticated user and pass that exact ID to the RPC.
3. Map the server's exact `42501 ACTOR_MISMATCH` to the session-changed message.
4. Check the same fence after the RPC and after refreshing the canonical account route.
5. Navigate and release busy state only while that token remains current.

The lifecycle invalidation effect depends on the user ID, not `accountRoute`. This prevents a valid route refresh from invalidating its own recovery operation while still fencing account switches and unmounts.

## Verification

- SQL contract coverage: ACL, execution mode, mismatch precedence, null actor, success, retry, suspended state, and missing profile.
- Node behavior coverage: delayed actor switch, RPC actor propagation, post-RPC switch, post-refresh switch, ordered success, and source wiring.
- Standard typecheck, lint, Expo configuration, and platform exports.
