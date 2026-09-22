# FP-MOD-001 · Admin moderation queue

## Flow

The Settings entry is visible only for `profile.is_admin`. On focus, the screen captures the signed-in actor and loads open reports through existing admin RLS. Every mutation preflights the same expected actor and passes it to an actor-bound RPC.

For target enforcement, the coordinator runs `remove Mark` or `suspend account`, checks the session fence, closes the report, checks again, and only then removes the card. Dismiss and resolve-without-action skip the target step. A failure at any stage leaves the report visible for retry.

## Server contract

- Expected actor mismatch is checked first and returns exact `42501 ACTOR_MISMATCH`.
- Admin authorization is checked server-side.
- Targets are locked before transition.
- Missing targets and attempts to suspend any administrator return `MODERATION_ACTION_NOT_ALLOWED`.
- Retry-safe no-ops do not add audit records.
- Legacy signatures have no API grants; new signatures are executable only by `authenticated`.

## Verification

Static and behavior tests cover admin gating, ordered target/report actions, failures, delayed account switches, actor propagation, and removal of legacy calls. PostgreSQL tests cover exact ACLs, mismatch precedence, non-admin rejection, retries, audit receipts, missing targets, and self-suspension.
