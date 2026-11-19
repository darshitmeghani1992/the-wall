# The-Wall · Hosted Supabase baseline reconciliation — 19 November 2026

**Role:** ARCHITECT · Discovery / staged migration design, **not deployment authorization**.
**Evidence status:** Verified read-only Supabase catalog inspection and exact repository migrations; remaining migration equivalence is Believed-likely pending complete structural diff.

## Correct production boundary

- Connected project `wfsfafmgvxevpzrurofz` (`The Wall`, Free, US West, `ACTIVE_HEALTHY`) is the **existing hosted project**, not a newly created disposable sandbox.
- Supabase migration history is empty. **Do not infer that the first nine migrations are marked applied.**
- Hosted database has 13 public tables with RLS enabled, 18 public functions, and 39 observed table/storage policies. Existing data: 2 Auth identities, 1 profile, 1 Wall, 0 Marks, 0 Storage objects. Preserve those existing records.
- Hosted `mark_secrets` has only `mark_id`, `content`, `created_at` and the `mark_secrets read owner` policy. `reveal_secret` / `expire_secret_marks` do not exist.
- Hosted `friendships_guard_transition()` contains the pair-reassignment guard introduced in 0008; hosted `walls view` policy includes private Shared-Wall membership introduced in 0009. This supports **approximately migration 0009 behavior**, but a full object-level equivalence audit remains mandatory.
- `follows` and later tables are absent. No Edge Functions are deployed. There is no `mark-media` bucket.
- `attachments` exists and is **public by design in legacy migration 0003**. Migration 0020 creates a **separate private `mark-media` bucket** and scopes legacy `attachments` operations to non-Mark/avatars. Do not blindly toggle the whole `attachments` bucket private, which could break avatar reads; verify all legacy Mark paths are closed and no public Mark object remains. Current Storage object count is zero.
- Supabase security advisors flagged old mutable function search path and many anonymously executable security-definer functions. Review exposure in planned later migrations rather than assuming later source-level security fixes are already hosted.

## Migration readiness: NOT READY for hosted writes

| Source batch | Hosted evidence | Execution gate |
|---|---|---|
| 0001–0007 foundation | Tables, social-link columns, initial RLS and notifications appear present | Diff object definitions, constraints, privileges and triggers; confirm a historical baseline without rerunning blindly |
| 0008 friendship transition | Hardening function body matches the decisive pair-immutability guard | Compare full trigger & permissions; record equivalence |
| 0009 Wall membership read | Hosted policy includes the exact private Shared-Wall membership disjunct | Compare role grants and dependencies; record equivalence |
| 0010 Secret reveal | `opened_at`, `expires_at`, `reveal_secret`, `expire_secret_marks` **absent** | First likely forward migration after baseline proof, with RLS regression |
| 0011–0019 model/account/social/safety | Distinct later columns and tables/functions missing, e.g. `follows` | Ordered gated trial on disposable isolated Supabase staging |
| 0020–0024 private-media cutover | Private `mark-media` bucket and supporting tables/functions absent | Worker credentials and protected read/cleanup negative tests before enabled clients |
| 0025–0030 activation, Shared Walls, actor-bound safety | Source migration contracts absent in hosted inventory | Independent Two-Key review and real three-actor end-to-end tests |
| 0031 recoverable deletion | Deliberately withheld with irreversible Auth Admin worker/scheduler | **Separate Founder approval**, legal retention policy, staging lifecycle and rollback proof |

## Approved engineering sequence to *propose* to Founder

1. **Freeze evidence:** export a schema-only dump and a verified logical backup of the live database/Auth and Storage metadata using secure project tools; do not log secrets or PII. Establish a restore test or rollback contract. Record migration checksums and source PR SHA.
2. **Independent structural diff:** compare live definitions with SQL expected after exactly 0001–0009 (tables, enum labels, columns/defaults, constraints, indexes, policies, function bodies/search_path, grants, triggers, bucket settings). Only after a reviewed exact match may 0001–0009 be treated as a historical baseline. If mismatched, generate explicit corrective migration; never mark history retroactively by assumption.
3. **Isolate staging:** use a separate expressly authorized test project or database with no existing real accounts; obtain project-creation/cost approval where required. Never treat the restored named project as disposable.
4. **Trial ordered 0010–0030** in staging with preflight/postflight diff and replay checks. Audit 0019 exclusion cleanup and 0020 private-media policies before any hosted execution. Keep 0031 excluded until its distinct approval.
5. **Hosted security regression:** Auth owner, eligible contributor and blocked/unrelated user; verify private Wall/Secret/Anonymous Mark reads and writes, bypass attempts, object URL access, blocked-account races, signed-media expiry/cleanup, Alerts, Shared Wall membership and invite flows. No unverified “PASS.”
6. **Operational integration:** configure service-role secrets only in server runtimes, Edge Functions/worker, logs/retries, alerting, backups and failure rollback. Do not expose service-role keys in Expo EAS public variables.
7. **Point signed preview APK at verified staging**, perform physical-device QA and separate independent Reviewer/QA exact-tree certification before beta invitations.

## Executable read-only preflight queries

```sql
select to_regclass('public.follows') as follows,
       to_regclass('public.mark_media') as mark_media,
       to_regclass('public.account_deletion_requests') as deletion;
select name, public from storage.buckets order by name;
select count(*) as auth_user_count from auth.users;
select count(*) as object_count from storage.objects;
select column_name from information_schema.columns
 where table_schema='public' and table_name='mark_secrets'
 order by ordinal_position;
```

**Founder Gate outstanding:** Staging infrastructure/provisioning, hosted migration or bucket policy changes, 0031/worker, and production merge/release each require their applicable AIOS authorization; this document authorizes none. **No hosted mutations were performed as part of this audit.**
