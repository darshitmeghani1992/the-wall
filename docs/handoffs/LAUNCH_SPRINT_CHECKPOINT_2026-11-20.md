# The-Wall · November launch sprint / exact-source checkpoint

**Recorded:** 20 November 2026 · **Product:** Private text-Mark beta target 22–23 November.
**Roles:** PRODUCT → ARCHITECT → BACKEND/FRONTEND → independent REVIEWER → QA.
This checkpoint is an implementation/handoff statement, **NOT independent certification**.

## Source authority and branch

- GitHub repo: `darshitmeghani1992/the-wall`
- Current source continuation: `codex/launch-restart-checkpoint-2026-11`;
  resolve its remote PR/head/tree and fresh CI **from live GitHub**. This file
  must not claim its own final commit SHA before publication.
- Verified parent: draft PR **#51**, commit
  `3c04c543fce4e3be628e5562b1c5a2a93cbb1c74`, tree
  `40ef0b5e01ecc1efe55f7f0fcf592a51e636c587`. Four CI jobs
  (TypeScript/lint/contracts/native exports, Postgres DB security,
  Edge Function contracts, FFmpeg media processor) **passed on this parent SHA**.
- New continuation adds Secret composer default OFF until the server's
  one-hour expiry scheduler is live and verified. Fresh CI/Reviewer/QA on its
  actual published tree are still required.
- PRs **#38, #40, #41, #42, #43, #44, #46, #47, #48, #49, #50, #51** are
  stacked draft slices; **not merged**, no independent Reviewer APPROVE or QA PASS
  on the newest tree. Preserve the exact head for the Reviewer→QA gate.
- Canonical product authority: `THE_WALL_MASTER_BUILD_SPEC_v1.1.md`;
  locked AIOS governance: `docs/aios/`, not replaced by this checkpoint.

## Hosted environment boundary

| Environment | Reference | Status |
|---|---|---|
| Original The Wall | `wfsfafmgvxevpzrurofz` | ACTIVE_HEALTHY; existing 2 Auth users, 1 Profile, 1 Wall; never mutated by November launch sprint |
| The Wall - Staging | `ewintxgdxdvschiqodkq` | ACTIVE_HEALTHY; created at approved $0/month cost after Founder freed project capacity |

Staging has 34 public tables, all with RLS enabled. Source migrations 0001–0030,
0032 Secret expiry service-only ACL and **0033 Shared-Wall owner INSERT RETURNING
RLS** are applied and recorded. 0031 recoverable account deletion **NOT** applied.
Staging includes a private `mark-media` bucket. Legacy `attachments` remains public
for avatars, with public Mark-media paths forbidden. Media Photo/Voice/Video controls
remain OFF. Secret-Mark expiry pg_cron is **NOT activated** and the Secret composer is
therefore guarded OFF by default: prepared idempotent
operational scripts are in `supabase/operations/` pending its separate DevOps
runtime/monitoring security gate. Do not activate Secret feature as one-hour-retained
without this job running and independently tested.

A JWT-protected `mark-media` read Edge Function is deployed (unauth 401); other
media worker/ops functions and the isolated media processor container are NOT hosted.
Gateway and process-runtime *code* is present in draft PR #49 with 9 new unit tests,
but image/DNS/egress/secrets/FFmpeg/SBOM/CVE/resource limits remain unverified.

## Tests that actually ran

- 117/117 mobile/client contract tests (latest local source); TypeScript, lint, Expo Doctor 17/17,
  disposable native iOS prebuild, GitHub iOS/Android bundle exports, Edge contracts,
  complete GitHub Postgres security suite and FFmpeg processor CI green for stacked
  candidate source; `npm audit --omit=dev`: 0 critical, 27 high (Expo 51 major-update debt).
- Staging public Auth, Profiles, Marks and Follows endpoints: **4/4 HTTP 200** with
  correct EAS Preview/Development staging URL/anon key. Wrong-project public-key
  guard and malformed `/rest/v1/` URL guard are in EAS preinstall.
- Staging real PostgreSQL actor tests: each is `BEGIN` ... synthetic fake users,
  RLS checks ... `ROLLBACK`; final Auth/Profile/Wall/Mark/Storage object count 0.
  1) Personal owner/friend/stranger, idempotent text `create_mark`, Secret content
     side-table isolation, blocking.
  2) Private Shared Wall creation with actual `.INSERT RETURNING` row, private
     pending invite preview, accepted member post, unrelated actor denial, owner
     removal and revoked read/write. The original SELECT RLS failed `INSERT
     RETURNING` (42501); additive migration 0033 fixed it and passed both
     hosted actor suites without loosening read access to unrelated users.
- Supabase security advisor: 59 authenticated `SECURITY DEFINER` warnings, including
  intentionally exposed actor-bound functions; **not individually certified**.
  Security linter has 21 informational RLS-without-policy findings, mostly private
  internal tables. Detailed function/policy review and adversarial QA remain gates.

## Android build and external dependencies

- Expo internal Preview APK build **FINISHED** and artifact confirmed:
  https://expo.dev/accounts/darsh9899/projects/the-wall/builds/a1037ffa-c214-471b-8949-7796cbaeba81
- This build contains OAuth UI/PKCE correction (Google/Apple buttons hidden if
  providers disabled), media composer default OFF, account deletion default OFF,
  project/public-key validation, and a provisional custom native icon.
- No physical Android installation, notification behavior, App Store/iOS or
  actual multi-user login test is claimed.
- Domain/custom SMTP: staging Supabase default email sender restricts to Auth
  project-team addresses; **a domain verified with a transactional sender and
  Magic Link template containing `{{ .Token }}`** is required for six-digit OTP
  emails to general beta users. A copy-ready template/runbook is in PR #47.
- Apple Developer Program, TestFlight signing and app privacy/disclosure/store
  work await founder credentials/enrollment on 21 Nov.

## Immediate execution order

1. **Independence:** run Reviewer APPROVE, then QA PASS on **unchanged exact Git tree**
   including staged security migration 0033 and worker runtime; fix critical
   findings with a NEW SHA and re-run checks rather than carrying verdicts.
2. **External founder steps 21 Nov:** verified domain + SMTP, six-digit OTP
   delivery and redirect URL allowlist, Apple Developer account/signing.
3. **QA with actual devices:** 3 distinct real Auth users; signup, home/onboarding,
   private and Shared Walls, contributor permission, friend/follower separation,
   anonymous/secret behavior, alerts, block/report and recovery, direct API/URL
   negative cases. No user invitations without completed security gates.
4. **Secrets/operations:** select real approved isolated media processor host,
   deploy C2 worker/ops gateways, verify signatures/keys/rate limits/DNS, activate
   media kinds incrementally after independent QA. Cron Secret expiry before
   representing one-hour deletion guarantee. Hard deletion worker 0031 under
   distinct legal/Founder retention/purge gate.
5. **Release:** explicit Founder approval for merging/deploying; signed iPhone build
   and App Store/TestFlight documentation only after Apple access is active.

**Do not promise public launch by 23 Nov.** Text-only private beta remains a
conditional schedule goal; lack of email delivery, independent review and physical
QA is still a blocker despite source and hosted SQL readiness.
