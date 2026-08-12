# QA Behavioral Verification — MVP Batch C2 (Backend Security)

**Role:** QA (QA Charter v2.1 / QA Playbook v2.1, under AIOS Constitution v1.1)
**Bound to commit:** `4626bb6` (branch `claude/mvp-batch-c-secure`)
**Reviewer status entering QA:** APPROVE (independent Reviewer, same commit)
**Test Depth Classification:** **Two-Key** (migrations + permissions + security-sensitive logic) → Verified-only gate applies (Playbook §3, §4)
**Date:** 2026-08-12

---

## VERDICT: PASS — bound to 4626bb6

Zero outstanding Production-risk or Two-Key-critical findings. Every claim below is **Verified** — actually executed against the running PostgreSQL 16 database as the real end-user roles under RLS, and the result directly observed. This is a database-authorization-layer verdict on local PG16 (see Scope note).

---

## 1. Vendored harness — `bash supabase/tests/run_tests.sh` (run twice)

| Run | Result | Exit code |
|---|---|---|
| 1 | ALL ASSERTIONS PASSED — SEC-001 10–50 + C2 60–90 (incl. both F-B1 assertions) | **0** |
| 2 | ALL ASSERTIONS PASSED — identical output, deterministic (DB dropped/recreated each run) | **0** |

Both runs green including SEC-001 regression suite (10_friendships … 50_storage) — **no SEC-001 regression** — and the C2 areas 60_secret_marks, 70_wall_members (incl. `70 (F-B1 role self-escalation)` and `70 (F-B1 wall_id self-grant)`), 80_notifications, 90_profile_links.

The harness uses broad exception catches in places, so it was **not** relied on alone. All negative cases below were independently re-driven with `VERBOSITY verbose` to capture the **actual SQLSTATE**, not merely "an error was raised."

---

## 2. Independent behavioral scenarios (my own, not the vendored harness)

Method: fresh throwaway DB `qa_c2_indep` loaded with the identical stack (shim → 0001–0007 → seed). Each scenario drives the genuine end-user role (`SET LOCAL ROLE authenticated|anon|service_role` + `SET LOCAL test.uid`) under RLS. Negative cases captured with verbose SQLSTATE. Base-table inspection performed as the table owner (superuser), never conflated with the role under test.

### Area A — Secret Marks (0004)

| # | Scenario (driven as end-user role) | Observed | Verdict |
|---|---|---|---|
| S1 | Authenticated **non-owner** (alice) posts `type=secret` on Olivia's wall | base `marks.text` = **NULL**; content in `mark_secrets` | PASS |
| S2 | **Non-recipient** authenticated (bob) reads base `marks.text` | `<NULL>` | PASS |
| S3 | Non-recipient (bob) reads `mark_secrets` | **0 rows** (RLS hides it) | PASS |
| S4 | **Wall owner** (olivia) reads `mark_secrets.content` | `TOP-SECRET-ALICE` (recipient sees it) | PASS |
| S5 | `service_role` reads `mark_secrets.content` | `TOP-SECRET-ALICE` (moderation path via explicit grant) | PASS |
| S6 | Publication exclusion | `mark_secrets` **NOT** in `supabase_realtime`; `marks` **IS** | PASS |
| S7 | **Author** (alice) `UPDATE marks SET text=…` on the secret | **REJECTED — SQLSTATE 23514** `check_violation` (constraint `marks_secret_text_null`) | PASS |
| S8 | **Owner** (olivia) `UPDATE marks SET text=…` on the secret | **REJECTED — SQLSTATE 23514** `check_violation` | PASS |
| S9 | Base text after rejected updates (owner inspection) | still `<NULL>` — content cannot be repopulated/rebroadcast | PASS |
| S10/S11 | Anon **+** secret mark: author recoverable via secret path? | `mark_secrets` has **0** author columns; base `author_id`=NULL; owner reads content only (`ANON-SECRET-CONTENT`), never the author | PASS |

Client grant surface on `mark_secrets`: `authenticated` = SELECT only (RLS-narrowed to owner); `anon` = **no grant at all**. Verified directly.

### Area B — Wall Members (0005)

| # | Scenario | Observed | Verdict |
|---|---|---|---|
| W1/W2 | Private-shared **non-member** (grace) view/contribute | `can_view_wall`=false, `can_contribute`=false; sees **0** marks on W_PS | PASS |
| W3 | **Accepted member** (bob) | `can_view_wall`=true, `can_contribute`=true; sees the owner's mark | PASS |
| **W4** | **F-B1** — bob self-moves membership `wall_id` → other private wall, **status unchanged** | **REJECTED — SQLSTATE P0001** (`C2_MEMBER: cannot reassign or re-role a membership`) | PASS |
| **W5** | **F-B1** — bob self-escalates `role`→owner, status unchanged | **REJECTED — SQLSTATE P0001** | PASS |
| **W6** | **F-B1** — bob self-changes `user_id`, status unchanged | **REJECTED — SQLSTATE P0001** | PASS |
| W7 | Residual state after F-B1 attacks (rolled back) | bob still `member/accepted` on W_PS; **0** rows on the target wall — no cross-wall membership self-grant | PASS |
| W8 | Third-party (grace) accepts frank's invite | **0 rows** updated (RLS `user_id=auth.uid()`) | PASS |
| W9 | Owner (olivia) accepts frank's invite (invitee-only) | **0 rows** updated | PASS |
| W10 | Invitee (frank) accepts his OWN invite | success, pending→**accepted** | PASS |
| W11 | Backward transition: bob accepted→pending | **REJECTED — SQLSTATE P0001** (`cannot move a membership back to pending`) | PASS |
| W12 | Non-owner (grace) self-invite INSERT | **REJECTED — SQLSTATE 42501** (RLS insert policy) | PASS |
| W13 | Owner INSERT-as-accepted escalation | **REJECTED — SQLSTATE 42501** (must start pending/member) | PASS |
| W14 | Public/personal unchanged | grace views + contributes to public wall (true/true) | PASS |

**F-B1 is CLOSED and Verified**: the identity/role immutability check fires *before* the status-unchanged early return, so a status-static UPDATE that mutates `wall_id`/`user_id`/`role` cannot slip past — demonstrated on all three vectors with the actual P0001 raise, and confirmed no membership row leaked cross-wall.

### Area C — Notifications (0006)

| # | Trigger / rule | Observed (recipient / actor / kind) | Verdict |
|---|---|---|---|
| N1 | Plain authenticated (grace) **forges** a notification | **REJECTED — SQLSTATE 42501** (no client INSERT policy; verified 0 INSERT policies exist) | PASS |
| N2 | `shared_wall_mark` (bob posts on shared W_PS) | owner / bob / `shared_wall_mark` | PASS |
| N3 | Skip-self (owner posts on own wall) | **0** notifications | PASS |
| N4 | Anon mark (public wall) | owner / **actor NULL** / `shared_wall_mark`; base `author_id`=NULL — no de-anon | PASS |
| N5 | Reaction on **anon** mark (olivia reacts) | **true author (bob)** / olivia / `reaction`; base row still anonymous (`author_id` NULL) | PASS |
| N6 | Reaction skip-self (bob reacts to own mark) | **0** reaction notifications | PASS |
| N7 | `friend_request` (carol→bob) | bob / carol / `friend_request` | PASS |
| N8 | `friend_accepted` (bob accepts carol) | carol / bob / `friend_accepted` | PASS |
| N9 | `shared_wall_invite` (owner invites grace) | grace / owner / `shared_wall_invite` | PASS |
| N10 | Unknown kind | **REJECTED — SQLSTATE 23514** `check_violation` (`notifications_kind_ck`) | PASS |
| N11 | Structural no-leak | `notifications` has **0** content/text/body/message columns | PASS |

All 5 trigger kinds route to the correct recipient with the correct actor, skip self, and leak neither secret content (no content column) nor anonymous authorship (actor NULL / true-author-only). Forge-resistance verified behaviorally (42501) and structurally (no INSERT policy).

### Area D — Profile Links (0007)

| # | Scenario | Observed | Verdict |
|---|---|---|---|
| P1 | Self-update persists all 5 columns (alice) | `instagram,tiktok,youtube,x,website` all persisted | PASS |
| P2 | Cross-user update (alice writes bob's links) | **0 rows**; bob's `instagram` unchanged (`<NULL>`) | PASS |
| P3 | World-readable (anon reads alice's links) | anon reads `ig_a` | PASS |

### Honest paths / no acceptance criterion weakened
- Accepted member view+contribute (W3), invitee self-accept (W10), owner invite path, public-wall view+contribute by an unrelated non-blocked user (grace, W14), and non-secret mark edits all still work. `carol_can_contribute_public=false` is **correct** (Olivia blocks Carol — block override intact), not a regression.
- SEC-001 suite (10–50) green on both runs — anonymity, blocking, moderation, storage all still pass.

---

## 3. Grant / publication design confirmations (Verified on local PG16)
- `service_role` explicit grants: `mark_secrets` = SELECT granted (moderation read works); `marks`/`notifications` = **no** grant → reinforces "BYPASSRLS is not a table GRANT" and keeps the moderation-grant assertion meaningful. **On hosted Supabase service_role customarily carries broad default grants — Founder must confirm the hosted grant posture (below).**
- Realtime publication contains `marks, mark_reactions, comments, notifications`; `mark_secrets` **excluded**. Secret content never streamed.

---

## 4. Scope & Confidence (honest labeling)
- **Verified:** the database authorization layer (RLS policies, triggers, CHECK constraints, grants, publication membership) on **local PostgreSQL 16** with the Supabase-compat shim, driven as `anon`/`authenticated`/`service_role`.
- **Believed-likely (NOT run here):** the hosted Supabase project and the live application. The shim faithfully emulates the platform surface but is not the platform. The **final proof is the Founder applying migrations 0004–0007 to the hosted project** and confirming behavior there.
- Per the task brief, these are noted and explicitly **not** grounds for FAIL: F-1 (a Founder product decision), the 0002 friendships same-pattern finding (separate escalation), and the `"walls view"` membership-disjunct gap (accepted fail-closed follow-up).

---

## 5. Founder pre-deploy verification list
1. **Apply 0004–0007 to the hosted Supabase project in a single transaction** (they are additive/idempotent; a partial apply is the main risk) and confirm each loads without the hosted `42501 must be owner of table objects` class of error.
2. **Confirm `service_role` grants / default privileges on hosted** — specifically that the moderation read path on `mark_secrets` works and that no unintended blanket grant re-exposes side tables; the local shim deliberately withholds blanket service_role grants, so hosted parity must be checked explicitly.
3. **Confirm `mark_secrets` is NOT in the hosted `supabase_realtime` publication** (and that `marks` still is) so secret content is never broadcast.
4. **Decide F-1** (Founder product decision — out of QA scope).
5. **Decide the 0002 friendships hardening** (same-pattern finding — separate escalation).

---

## 6. Routing
PASS → hand back to the **Founder Gate**. No behavioral defect to route to an implementation Role. Migrations 0004–0007 are code-complete and behaviorally verified at the DB layer for 4626bb6; deployment to hosted remains a Founder Gate (schema/migration change) with the checklist above.
