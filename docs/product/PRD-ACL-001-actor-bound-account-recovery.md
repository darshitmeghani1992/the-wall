# PRD-ACL-001 · Actor-bound account recovery

## Outcome

A returning user can restore a self-deactivated account, while a delayed request can never be reassigned to a different signed-in account.

## Acceptance criteria

- Restore submits the user ID captured when the action begins.
- The database compares that ID with `auth.uid()` before reading or changing account state.
- A mismatch or missing request subject returns `42501 ACTOR_MISMATCH` and changes no account.
- Only a self-deactivated account becomes active; a suspended or missing profile fails closed.
- Retrying an already successful restoration is safe.
- The client ignores stale success, error, refresh, navigation, and loading-state continuations after an account switch or unmount.
- The legacy parameterless reactivation RPC is not executable by API roles.

## Release boundary

This change supplies a source migration and tests only. Applying the migration to hosted Supabase, merging, and deploying remain separate authorized release actions.
