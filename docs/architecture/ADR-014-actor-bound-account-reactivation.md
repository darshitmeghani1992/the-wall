# ADR-014 · Bind account reactivation to the expected actor

## Status

Accepted for draft PR #22; not applied to hosted Supabase.

## Context

The legacy `reactivate_account()` derives its target only from the request token. A client can verify user A, pause, switch to user B, and then invoke the parameterless function under B's token. Client checks reduce this window but cannot close it atomically.

## Decision

Replace the callable API with `reactivate_account(p_expected_actor_id uuid)`. The function checks the expected actor against `auth.uid()` before profile lookup, locks that profile, restores only `deactivated` accounts, treats `active` as an idempotent retry, and rejects suspended or missing profiles. All API roles lose execute access to the legacy no-argument signature; only `authenticated` receives the new signature.

The recovery screen uses one lifecycle fence across the RPC, account-route refresh, and navigation. User changes and unmounts invalidate the fence; account-route state changes do not, so a legitimate `deactivated` to `ready` refresh can complete.

## Consequences

- Session-switch safety is enforced in the mutation transaction rather than relying on timing in the client.
- Existing callers must pass the initiating user ID.
- Hosted rollout must apply migration `0029` before deploying this client build.
- Rollback requires restoring the legacy grant only after clients no longer depend on the UUID signature.
