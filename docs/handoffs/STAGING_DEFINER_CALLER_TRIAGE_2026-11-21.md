# BETA-P0-04 — Staging SECURITY DEFINER caller inventory

**ROLE: BACKEND read-only evidence → ARCHITECT risk triage, 21 Nov 2026.**
**Environment:** `ewintxgdxdvschiqodkq` (staging **only**). Original `wfsfafmgvxevpzrurofz` was **not queried or changed**.
**Confidence:** **Verified** for live catalog metadata and migration inventory as returned by the connected Supabase SQL/migrations reader. **Not verified** for full caller semantics, hostile JWT/HTTP tests, three authenticated actors, or independent Reviewer/QA approval.

## Exact results from read-only catalog SQL

| Query dimension | Count | Interpretation |
|---|---:|---|
| `public` security-definer functions | **113** | Includes internal helpers and trigger functions; not 113 externally callable RPCs |
| Executable by `anon` (effective privilege) | **0** | Catalog grants check only, not HTTP proof |
| Executable by `authenticated` (effective privilege) | **59** | 33 direct functions + 26 trigger functions |
| Direct `authenticated` functions (non-trigger) | **33** | Actual caller-by-caller audit queue below |
| Trigger-returning functions executable by `authenticated` | **26** | Trigger function SQL cannot be invoked as an ordinary SQL function; grants still merit least-privilege review, no automatic revoke |
| Functions executable by neither `anon` nor `authenticated` | **54** | Internal/service call pathways require separate review |
| Functions without explicit `search_path` in `proconfig` | **0** | Setting presence does not prove all resolved names are safe |
| Direct authenticated functions with textual `auth.uid()` reference | **33/33** | Textual presence **does not prove** correct authorization checks or actor binding |

**Staging integrity at inspection:** migration records `0001`–`0030`, `0032`–`0034` present; `0031` absent. `auth.users=0`, `public.walls=0`, `public.marks=0`, `storage.objects` in `mark-media=0`. Private `mark-media` bucket exists; `pg_cron` extension absent. These counts are point-in-time read-only observations, **not** a tested cleanup procedure.

## The 33 directly executable definer functions (review one by one)

**Administrative (3):** `admin_remove_mark`, `admin_resolve_report`, `admin_suspend_account`.
**Auth/identity and account (6):** `current_user_is_active_account`, `current_user_is_admin`, `get_current_account_route`, `deactivate_account`, `reactivate_account`, `list_my_blocked_users`.
**Wall, membership, privacy and capabilities (14):** `current_user_can_contribute`, `current_user_can_see_wall_member`, `current_user_can_view_profile`, `current_user_can_view_wall`, `delete_shared_wall`, `get_my_pending_shared_wall_invite`, `get_wall_capabilities`, `invite_shared_wall_member`, `join_shared_wall`, `leave_shared_wall`, `list_removed_shared_wall_members`, `remove_shared_wall_member`, `respond_shared_wall_invite`, `transfer_shared_wall_ownership`.
**Wall/Mark/media (10):** `begin_media_upload`, `cancel_media_upload`, `create_mark`, `current_user_can_react`, `current_user_can_upload_mark_media_path`, `current_user_is_mark_author`, `get_media_upload_status`, `mark_media_uploaded`, `reveal_secret`, `update_shared_wall_settings`.

This grouping is a triage aid, not a claim of source approval; note that `update_shared_wall_settings` belongs functionally with Wall settings. Every listed routine references `auth.uid()` in its source text, but the meaning/placement of each check and table/trigger side effects remain unverified.

## How to reproduce counts safely

Read-only SQL against **staging only**; never issue DDL or `SET ROLE` against hosted data as a substitute for authenticated HTTP assertions.

```sql
WITH s AS (
 SELECT p.oid, p.prosrc, p.proconfig,
        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
        p.prorettype = 'pg_catalog.trigger'::regtype AS is_trigger
 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
)
SELECT count(*) AS total_definer,
       count(*) FILTER (WHERE anon_exec) AS anon_executable,
       count(*) FILTER (WHERE auth_exec) AS auth_executable,
       count(*) FILTER (WHERE auth_exec AND NOT is_trigger) AS auth_direct_functions,
       count(*) FILTER (WHERE auth_exec AND is_trigger) AS auth_trigger_functions,
       count(*) FILTER (WHERE NOT anon_exec AND NOT auth_exec) AS internal_only,
       count(*) FILTER (WHERE coalesce(array_to_string(proconfig, ''), '') NOT LIKE '%search_path=%') AS no_fixed_search_path,
       count(*) FILTER (WHERE auth_exec AND NOT is_trigger AND prosrc ~* 'auth[.]uid[[:space:]]*[(]') AS auth_direct_with_uid_reference
FROM s;
```

## Required security verification not completed by this catalog pass

1. **BACKEND:** compare each of the 33 function bodies with checked-in migrations and actual call sites; confirm *where* `auth.uid()` is tested, actor equality, blocked/removed member/owner behavior, `search_path` object qualification, and `SECURITY DEFINER` least privilege. Highlight stale/mismatched overloads.
2. **BACKEND:** separately examine the 26 trigger functions' effective grants, trigger linkage, and sensitivity; do **not** blanket-revoke or change public API without a tested migration and Reviewer approval.
3. **QA independent:** test genuine hosted HTTP with three distinct authenticated JWTs (new, member/friend, unrelated/blocked) for private Personal/Shared Wall, Mark operations, admin access denial, Secret visibility, direct table denial and Shared Wall `INSERT RETURNING`. SQL role simulations are separate evidence.
4. **Reviewer independent:** inspect any security-critical changes on immutable candidate SHA before merge. Media, Secret and deletion remain disabled/withheld until their runtime-specific security/cleanup and legal gates.

**Next unblocked engineering action:** source-level authorization trace for the three admin RPCs and `reveal_secret`, then add adversarial regression tests on an isolated BACKEND branch if a real weakness is demonstrated. No hosted write, setting change, secret material, migration, deployment or production access occurred.

## First four routine traces (read-only catalog + migration source)

Inspected current staging function signatures and token-level control-flow markers; cross-referenced `supabase/migrations/0030_actor_bound_admin_moderation.sql`, `0010_secret_reveal_lifecycle.sql`, `0012_mark_lifecycle.sql`, and actual `marks` trigger inventory:

| Routine | Observed hosted properties | Status |
|---|---|---|
| `admin_remove_mark(p_expected_actor_id,...)` | `authenticated` EXECUTE; exact actor comparison to `auth.uid()`; `is_admin` branch; `FOR UPDATE` row lock; moderation audit insert | **Source/catalog guard present**; JWT negative cases still needed |
| `admin_suspend_account(p_expected_actor_id,...)` | Same four checks and audit insertion | **Source/catalog guard present**; JWT negative cases still needed |
| `admin_resolve_report(p_expected_actor_id,...)` | Same four checks and audit insertion | **Source/catalog guard present**; JWT negative cases still needed |
| `reveal_secret(p_mark_id)` | Owner ID `auth.uid()` gate; `opened_at IS NULL` and expiry guard; **no Mark status check** in hosted routine | **Potential soft-removal disclosure** under review in [issue #66](https://github.com/darshitmeghani1992/the-wall/issues/66); no actual exploit executed |

The three legacy admin overloads without `p_expected_actor_id` still exist but show `authenticated_exec=false` and `anon_exec=false` in live catalog. No permission changes requested as part of this audit. The source-level Secret risk concerns a Mark that is soft-removed (`marks.status='removed'`) while its payload remains in `mark_secrets`; the update trigger catalog did not show removal-time purging. The intended post-removal contract requires PRODUCT/ARCHITECT resolution before any reviewed migration, and no hosted actors exist for a safe live test today.

**Separate C3 defensive implementation:** [PR #65](https://github.com/darshitmeghani1992/the-wall/pull/65) adds IPv4-compatible, NAT64, 6to4 and Teredo IPv6 destination blocking plus mocked-resolver tests. Exact source `d3396bfd72ac58c926245ed9b5905d7c67673e48`, [CI #231](https://github.com/darshitmeghani1992/the-wall/actions/runs/44881521179) **4/4 SUCCESS**. This is a sibling of documentation [PR #64](https://github.com/darshitmeghani1992/the-wall/pull/64), not a merged integration. Egress ACL, live redirect/DNS rebound behavior and independent Reviewer/QA still unmet.

## Account and identity routines · source trace

**Verified from source at** `cb27cc65b91e4c1249953020ba5c592fab4296bb`. The staging comparison uses the previously recorded migration inventory. No hosted execution occurred during this pass. Each listed definition pins its search path and grants its public signature to authenticated callers.

| Signature | Identity and caller trace | Existing local-suite coverage |
|---|---|---|
| `current_user_is_active_account()` | Migration 0026 derives the actor from `auth.uid()`; Shared Wall policies in 0026 and 0033 use the self check. | Test 73 exercises owner access with active, deactivated and suspended fixtures. |
| `current_user_is_admin()` | Migration 0018 derives the actor from `auth.uid()` and calls the internal `public.is_admin` predicate. Report and moderation-audit policies use this wrapper. | Moderation coverage is in tests 85 and 98. |
| `get_current_account_route()` | Migration 0025 returns unavailable for a missing identity and reads only `profiles.id = auth.uid()`; `src/lib/account.ts` sends no actor argument. | Test 58 exercises account route states. |
| `list_my_blocked_users(uuid,timestamptz,uuid)` | Migration 0028 rejects a missing or mismatched actor before queries and scopes rows to the caller's outgoing blocks. `src/lib/blocks.ts` passes the expected actor. | Test 22 covers mismatched actors, scoping, paging and inactive accounts. |
| `deactivate_account(uuid)` | Migration 0027 rejects missing and mismatched actors, locks that actor's profile and permits only active/deactivated transitions. `src/lib/account.ts` passes the expected actor. | Test 96 and its race harness exercise actor mismatch and concurrent state changes. |
| `reactivate_account(uuid)` | Migration 0029 rejects missing or mismatched actors and locks their profile before permitting active/deactivated transitions. The repository's withheld 0031 replacement additionally checks the deletion deadline and cancels that actor's eligible deletion request. `src/lib/account.ts` passes the expected actor. | Test 97 covers the actor-bound signature. Tests 99 cover the 0031 deletion path in disposable PostgreSQL. |

Independent review and genuine staging actor verification remain open. Continue with the Wall and member routines and trace both client RPCs and policy callers before assessing changes to grants.
