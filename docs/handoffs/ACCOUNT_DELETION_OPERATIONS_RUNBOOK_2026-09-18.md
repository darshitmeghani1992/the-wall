# Account deletion operations runbook

**Status:** Executable draft worker source present — do not execute against hosted Supabase
**Migration:** `0031_recoverable_account_deletion.sql`
**Architecture:** `ADR-016` / `FP-ACL-002`

## Safety boundary

Do not apply migration `0031`, configure a scheduler, prepare or delete a hosted account, merge, or deploy without explicit Founder authorization plus independent Reviewer approval and QA evidence. Final identity deletion is intentionally irreversible.

## Hosted worker contract

Run from a private scheduled worker holding the Supabase service-role credential. Never expose that credential to the app.

The source implementation is `supabase/functions/account-deletion-worker/index.ts`. It requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a minimum-32-character `ACCOUNT_DELETION_SCHEDULER_SECRET`. The endpoint accepts only authenticated `POST /functions/v1/account-deletion-worker/run` with exact JSON `{ "limit": 1..50 }`.

1. Call `list_due_account_deletions(limit)` with a limit from 1 to 50.
2. For each returned `{user_id, requested_at, purge_after}`:
   - List every object in bucket `attachments` under `avatars/<user_id>/`, following Storage pagination until exhausted.
   - Delete those exact paths through the Supabase Storage API. Do not delete `storage.objects` with SQL.
   - Re-list the prefix and require an empty result.
   - Call `prepare_account_deletion_for_purge(user_id, requested_at)`.
   - Only after it returns `true`, call Supabase Auth Admin `deleteUser(user_id, false)` with the server-held service-role client.
3. Treat a successful Auth Admin deletion as finalized. Treat `false` preparation as a safe no-op requiring state re-check; never force-delete around it.

Storage deletion and preparation are retry-safe. A duplicate worker may see missing avatar objects or a missing request; both are expected. Auth Admin deletion is server-only and a missing user after a retry is terminal success when the request/profile are also gone. Once `purge_after` has passed, `reactivate_account` rejects recovery, so avatar cleanup cannot race a valid restoration.

## Finalization checks

The database refuses purge preparation unless all are true:

- the request still exists and its original `requested_at` matches;
- the server's `purge_after` deadline has passed;
- the profile is still deactivated;
- the account owns no Shared Wall;
- no avatar Storage row remains under the deterministic prefix.

It then deletes identified and Anonymous authored Marks first, clears the legacy report resolver reference, and removes any incomplete ownership-authorization row. The worker's subsequent Auth Admin deletion triggers existing cascades that remove the Personal Wall, content on that Wall, profile, relationships, memberships, notifications, and other identity-owned data. Existing Mark-media and unconsumed-upload triggers enqueue protected-object cleanup.

## Rollback boundary

- Before any request exists, execute `supabase/rollbacks/0031_recoverable_account_deletion_preapply.sql`; CI proves rollback followed by clean reapplication.
- Once a request exists, never drop the request table. Disable admission, preserve schedules, and ship a forward corrective migration.
- Never attempt rollback after any Auth Admin identity deletion; finalization is irreversible.

## Monitoring and failure handling

- Alert on repeated `false` preparations for the same request after avatar cleanup.
- Alert on Storage API failures; do not call purge preparation after an unverified deletion.
- Monitor protected-media deletion outbox failures separately; Auth identity deletion does not mean every protected object has already been physically removed.
- A suspended account remains blocked from purge preparation until an authorized moderation/legal process resolves it.
- Never log profile content, Mark content, service-role credentials, or signed Storage URLs.

## Staging verification required before production

1. Schedule deletion for a test account with no Shared Walls.
2. Confirm immediate invisibility/non-interaction and the exact 30-day timestamp.
3. Confirm retry does not extend the deadline.
4. Confirm restoration before the deadline cancels the request.
5. Time-shift only in disposable staging data, run the worker, and verify avatar, authored Marks, Personal Wall, auth identity, and social rows are gone.
6. Verify unrelated Shared Walls/users remain and protected-media cleanup reaches durable delete-or-missing evidence.
7. Repeat with concurrent worker invocations and adverse Storage failures.
