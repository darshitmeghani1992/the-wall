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
