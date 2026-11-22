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


## 22 Nov 2026 — four additional Shared Wall definer RPCs traced (read-only)

**ARCHITECT** caller-policy sequencing → **BACKEND** source/catalog trace, based on **staging only** `ewintxgdxdvschiqodkq` and immutable checked-in `supabase/migrations/0026_shared_wall_lifecycle.sql`. These four are part of the original **33** authenticated-executable non-trigger SECURITY DEFINER functions; **do not add four to that count**. The hosted routines have the same actor/ownership guard structure as source; this is not an independent Reviewer verdict or multi-actor runtime proof.

| Direct RPC (exact published arguments) | Hosted read-only observations | Remaining negative tests |
|---|---|---|
| `get_my_pending_shared_wall_invite(p_wall_id uuid)` | Uses `auth.uid()`, requires active caller, restricts pending membership `wm.user_id=v_actor`, joins active owner and denies blocked pair, otherwise returns `unavailable` without revealing Wall metadata | Unrelated, revoked, previously removed, suspended, blocked and replayed user JWTs |
| `get_wall_capabilities(p_wall_id uuid)` | Checks caller `auth.uid()`, active status and `can_view_wall` before reading Wall/membership/tombstone; non-visible Wall returns `unavailable`; join capability only when public/open and actor/owner active, no blocked pair or tombstone | Private Wall outsider, owner vs member, pending/invited, removed tombstone and block transition |
| `invite_shared_wall_member(p_wall_id uuid,p_target_user_id uuid)` | Requires actor and distinct target, existing Shared Wall **owner**, locks Wall, both profiles/pair/member rows, active target/owner, non-blocked pair; only returns already-member/already-invited or inserts pending invite after checks | Non-owner, self-invite, blocked actor/target, deactivated target, concurrent invite/accept |
| `join_shared_wall(p_wall_id uuid)` | Requires actor not Wall owner, Shared Wall and active pair, locks Wall/profiles/pair/member rows, rejects blocked pair, non-open/public join, existing membership and removal tombstone; only then inserts accepted membership | Removed actor despite open_join, private Wall outsider, concurrent join/leave/invite, owner self-join |

**Catalog evidence:** all four signatures have `SECURITY DEFINER`, `authenticated EXECUTE=true`, `anon EXECUTE=false`, `SET search_path = pg_catalog,public`. `anon` and `authenticated` have no `CREATE` privilege on the public schema, reducing but not eliminating search-path risks. All checks are **static source/catalog traces**. They do *not* prove policies execute correctly through real PostgREST/Auth JWTs. Source migrations 0026 define these four functions; migration 0033 addresses Shared Wall owner INSERT RETURNING RLS, not these RPC signatures.

**Preliminary determination:** no obvious missing caller or owner gate identified in these four hosted routine bodies, but **no security approval**. Need independent Reviewer trace of actual helper function semantics (`can_view_wall`, `is_blocked`, `is_active_account`, lock helpers) and genuine owner/member/outsider/removed/blocked actor HTTP+SQL behavior. No authenticated users currently exist in staging, so these tests are **blocked**, not passed. Continue with other nine Wall/member routines, ten media/Mark and relevant trigger grants. Never blanket revoke permissions, deploy migration or enable Secret/media on this source inspection alone.

**Verified read-only baseline same run:** 35/35 public tables RLS, 0 Auth users/Walls/Marks, private `mark-media`, no `pg_cron`. Anonymous Mark authored identity was separately cross-checked: `marks_null_anon` BEFORE INSERT nulls public `marks.author_id` for anonymous Marks and `marks_record_anon` AFTER INSERT writes the protected author mapping; runtime actor redaction still requires QA. Original production `wfsfafmgvxevpzrurofz` was not queried; no hosted mutation, migrations, merges, deployment, invitations or held Apple/domain action. **Enhanced Beta NO-GO.**

## 23 Nov 2026 — seven additional Shared Wall RPC caller traces (ARCHITECT → BACKEND)

Staging **read-only** `pg_proc` query in approved `ewintxgdxdvschiqodkq` enumerated seven existing `SECURITY DEFINER` signatures. For each, effective `anon EXECUTE=false`, `authenticated EXECUTE=true`, and `proconfig search_path=pg_catalog, public`. Compared control-flow source against existing migration `0026_shared_wall_lifecycle.sql` from draft #179's exact parent ancestry; live catalog body starts contain actor `auth.uid()`, but whole hosted-body checksum equivalence, genuine HTTP semantics and independent review are **not** asserted. These are part of the previously counted **33** directly authenticated-callable routines; not 7 new routines.

| RPC | Source control flow / remaining hostile JWT checks |
|---|---|
| `respond_shared_wall_invite(uuid,boolean)` | Caller is the pending invitee; actor + owner must be active and unblocked; owner/member locks precede accept/decline and acceptance Alert. Verify non-invitee, blocked/suspended, accept/decline replay and concurrent revoke |
| `remove_shared_wall_member(uuid,uuid)` | Caller must be active Wall owner, cannot remove self; locks owner/target/member and blocks removal of blocked target. Pending revokes; accepted generates tombstone. **Current block-first denial is issue #177**, not a certified desired behavior |
| `leave_shared_wall(uuid)` | Caller must be accepted non-owner; owner gets `owner_action_required`, inactive/blocked owner-member pair denied. **Current blocked-owner leave denial is issue #177** |
| `transfer_shared_wall_ownership(uuid,uuid)` | Active owner only; target active accepted non-owner, no block/tombstone; locks pair/member; transient authorization record and deferred invariant; sends ownership-transfer Alert. Verify spoofed target/owner, race, blocked pair, and untrusted receiver |
| `list_removed_shared_wall_members(uuid)` | Dynamic `auth.uid()` must be active **current** owner; reads only that Wall's removal ledger. Test #75 exercises role-simulated non-owner & transfer-boundary results; still needs genuine hosted JWT |
| `update_shared_wall_settings(uuid,text,text,boolean,boolean)` | Owner-active and Wall-row lock; validates name/visibility/open-join/anonymous. Verify unauthorized owner, malformed combinations and settings/owner race |
| `delete_shared_wall(uuid,text)` | Active current owner, Wall-row lock, exact name confirmation; verify unauthorized, stale confirmation, queued media/alerts and race/rollback |

**Confidence:** catalog metadata **Verified**; migration source trace **Verified** as checked-in text; observed hosted actor-body opening only **Verified**; hosted caller equivalence and runtime safety **not proven**. No independent Reviewer/QA, no user/hosted mutation, no PR merge. Remaining direct SECURITY DEFINERs, trigger effects, JWT negative tests and operational cleanup still pending. A permission grant alone does not certify access control. [Draft #179](https://github.com/darshitmeghani1992/the-wall/pull/179) is a source-test child, not a security migration. Keep media/Secret/analytics off, deletion held and Enhanced Beta **NO-GO**.

---


## 23 Nov 2026 — BACKEND staging trigger linkage and grant inspection (read-only)

**Scope:** Approved staging `ewintxgdxdvschiqodkq` only. Read-only `pg_proc`/`pg_namespace`/`pg_trigger` joins, with `pg_get_triggerdef` on sensitive tables; no hosted mutation, production access, schema repair, dynamic invocation or any injected identity. This is a distinct structural check, not functional authorization certification.

**Verified catalog totals:** **34** public `SECURITY DEFINER` functions returning `trigger`; **0** effectively callable by `anon`, **26** with `authenticated` EXECUTE grants and **8** without; **0** lacked a linked non-internal `pg_trigger`; **0** are owned by a role other than `postgres`. There are 113 public definer functions overall (as previously inventoried); the 26 trigger-returning entries with `authenticated` EXECUTE must **not** be counted as 26 normal RPC endpoints. A trigger-returning routine cannot be invoked like an ordinary authenticated RPC, but the broad grants still need Reviewer least-privilege consideration rather than blind revocation.

**Sensitive trigger linkage observed:** `blocks` has pair guard and cleanup triggers; `marks` has expiry, tombstone, contribution, defaults, Secret extraction, anonymous author redaction/mapping and Mark Alert triggers; `wall_members` has pair guard, deferred invariant, invite Alert and transition guard triggers. Their trigger ordering and exact privileged side effects require source-level/manual review, and whether a blocked member may leave remains Product/Founder issue #177. No trigger-body equivalence hashes or authenticated inserted-row RETURNING responses were established in this pass.

**Remaining QA/Reviewer gates:** Three real staging JWT actors and negative HTTP/table/SQL checks, anonymous/Secret author redaction, Shared Wall INSERT RETURNING, cross-role trigger concurrency, private-media worker C2/C3 and expiry scheduler. Structural linkage says nothing about those results. Review the 34 trigger bodies against migration text and event ordering before approving the integrated candidate; do not treat the new catalog tests #182/#183 as behavior proof. **Enhanced Beta NO-GO.**

## 23 Nov 2026 — structural trigger binding regression (ARCHITECT → BACKEND)
Staging-only SELECT of `pg_proc`/`pg_trigger` found **34** public SECURITY DEFINER trigger-returning functions, each linked to an enabled named trigger (no orphan), owner `postgres`, none anon-executable. Function definitions for `marks_record_anonymous_author`, `marks_null_anonymous_author`, `notify_mark_left`, `notify_reaction`, `notify_wall_invite`, `guard_mark_contribution_pair`, `guard_shared_wall_create`, `guard_wall_member_pair_write` were inspected read-only. Existing `marks_record_anon` AFTER INSERT sorts before `zz_marks_notify` AFTER INSERT; `notify_mark_left` passes null public actor for an anonymous Mark. This is a static trust-boundary trace, **not** proof of 3-JWT/HTTP client behavior.

Isolated [draft #184](https://github.com/darshitmeghani1992/the-wall/pull/184) implements disposable regression `79_sensitive_trigger_bindings.sql` on parent #183 without any hosted writes or mutation. Source `76ec1e8de4779f714cf110624352cb2e8c4765cb`; CI check pending. Independent Reviewer/QA and runtime actor proof remain required. Protected media, Secret and analytics OFF, original production untouched. Next: verify exact CI; trace remaining effective trigger caller paths and event races without changing the hosted schema.
