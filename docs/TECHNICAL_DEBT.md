# Technical Debt Register

_Last updated: 2026-09-22._

| ID | Item | Risk | Exit condition | Confidence |
|---|---|---|---|---|
| TD-001 | Hosted Supabase/Auth/RLS/Storage/Edge behavior is unverified | Production-risk | Non-production environment passes real multi-account acceptance and adverse/race tests | Verified gap |
| TD-002 | Physical iOS/Android, accessibility, lifecycle, offline, and performance QA is absent | Production-risk | Defined device matrix passes with evidence | Verified gap |
| TD-003 | Universal HTTPS links, store fallback, and install-intent restoration require the public domain | MVP gap | Founder supplies domain; associated-domain/intent files are hosted and device-tested | Verified gap |
| TD-004 | Expo SDK 51 dependency graph still reports npm advisories after pinning fixed `tar` 7.5.22; on 2026-09-22 `npm audit --omit=dev` reported 13 high, 32 moderate, 2 low, and 0 critical findings, largely in the Expo/React Native toolchain | Maintenance/security | Triage reachability, then use a planned Expo SDK upgrade to clear or formally accept remaining reachable advisories with regression evidence; do not force a major upgrade inside unrelated work | Verified gap |
| TD-005 | Account-deletion legal/retention policy is not approved | Regulated-domain blocker | Founder/legal records retention, deletion, and audit-evidence policy before hosted enablement | Verified gap |
| TD-006 | Account-deletion worker monitoring and scheduler are not configured | Operations blocker | Staging proves alerts, retries, duplicate workers, cleanup and Auth Admin finalization before production | Verified gap |

No item in this register authorizes hosted application, merge, deployment, or acceptance of risk by silence.
