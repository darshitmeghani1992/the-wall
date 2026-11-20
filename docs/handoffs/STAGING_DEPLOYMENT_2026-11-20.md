# The-Wall · Staging backend deployment verification · 20 November 2026

**Role:** BACKEND/DevOps implementation-state handoff; Reviewer and QA are **independent and pending**.  
**Source:** immutable GitHub SHA `7d7c0d8e918f0c51597f007205ff2856887d5d07`, draft PR #41 (stacked on #40 and #38).  
**Runtime:** Supabase staging project `ewintxgdxdvschiqodkq` (`The Wall - Staging`, US West).  
**Protected original:** `wfsfafmgvxevpzrurofz` (`The Wall`), unchanged.  
**Confidence:** Database and configuration items below **Verified**; multi-user behavior **not verified**.

## Completed: source-ordered SQL migration deployment

- Applied source migration files **0001–0030** sequentially with Supabase migration tool, and verified `list_migrations` records **all 30 in order**.
- Staging began empty; `0024_mark_creation_cutover.sql` was gated on actual zero legacy inventory: zero Auth users, zero Marks, zero Storage objects and zero media uploads. A guarded staging-only zero-item reconciliation update recorded that evidence before the migration succeeded. This **must not** be copied to a live instance without complete inventory/reconciliation.
- **0031_recoverable_account_deletion.sql was not applied.** Keep its deletion scheduler/worker and any irreversible lifecycle action behind a distinct Founder approval and legal retention check.

## Verified post-migration state

| Invariant | Evidence |
|---|---|
| Public tables | 34; **zero** without RLS enabled |
| Private Mark bucket | `mark-media`: `public=false`, 50 MiB per-object limit, specific media MIME allowlist |
| Legacy avatar bucket | `attachments`: intentionally public; no objects |
| Media kind kill switches | Photo, Video and Voice all have reservation/upload/processing/creation flags **false** |
| Protected tables | `anon` and `authenticated` lack direct SELECT grants to `mark_media`, `media_uploads`, `mark_secrets`, `anonymous_mark_authors` |
| Data preservation | Staging 0 Auth users, 0 profiles, 0 walls, 0 Marks, 0 Storage objects |
| Required SQL RPCs | `create_mark`, `begin_media_upload`, `reveal_secret` present |
| Supabase health advisor | No health notices |
| Supabase security advisor | 21 INFO `rls_enabled_no_policy`; 60 WARN `authenticated_security_definer_function_executable`; **each requires role/argument review**, not automatically a vulnerability |

## Expo cloud preview

- Corrected **preview** and **development** `EXPO_PUBLIC_SUPABASE_URL` to the staging origin and set the **matching staging public anon key**; no credentials in source, logs or handoff. Verified both configurations by re-pulling Expo environment values and checking host/path/key-ref without outputting keys.
- On the new build source, **all 10 dedicated preflight/guard tests passed**; real read-only staging checks returned HTTP 200 for Auth, Profiles, Marks, Follows (**4/4**). Earlier Preview/Development settings incorrectly ended in `/rest/v1/`, now corrected.
- Submitted new Android internal preview APK cloud build `d37a28ec-86fd-4338-90b0-49d22ee6ccef`: https://expo.dev/accounts/darsh9899/projects/the-wall/builds/d37a28ec-86fd-4338-90b0-49d22ee6ccef (initial status `IN_PROGRESS`; verify final status/artifact independently).
- EAS hook in PR #41 aborts a future build on malformed backend public URL. **No production EAS environment was changed.**

## Edge runtime

- Deployed only `mark-media` Edge Function v1 to staging from the pinned source files (entrypoint and three `_shared` modules), with **`verify_jwt=true`**. Supabase lists it `ACTIVE`; anonymous request received HTTP **401**.
- Did **not** deploy `mark-media-worker`, `mark-media-ops` or `account-deletion-worker`. Media workers require audited scheduler/gateway secrets, signed dispatch keys, external processor runtime and isolation/observability; the repository's `workers/media-processor/README.md` explicitly says its container entrypoint fails closed until external gateway adapters are supplied.
- No media-kind switches enabled. Photo/voice/video processing is **not operational**. Do not present protected-media upload as beta-ready.

## Release gates still open

1. **Security**: independently review 60 authenticated SECURITY DEFINER RPC warnings against actor binding, function grants, `search_path`, ownership, and GET/POST negative tests. Review 21 informational no-policy findings for intentional fail-closed design.
2. **Auth/QA**: construct 3 actual staging Auth identities and run device-level owner/contributor/unrelated/blocked tests. Confirm authenticated login/sign-up, wall creation, follow/friends, Secret/Anonymous marks, alerts, privacy, account settings, moderation and negative authorization cases. PostgreSQL/CI-only tests are not substitutes.
3. **Media**: implement/deploy approved gateway worker stack, secrets, response policy, expiry/scheduler and actual ffmpeg runtime; verify private download, rate/quota, race and cleanup with independent QA before enabling kinds.
4. **Account deletion**: explicit Founder gate for 0031, data retention and irreversible purge behavior; no deployment until then.
5. **Reviewer → QA**: exact SHA/tree and runtime config, fresh CI and independent roles, then staged beta decision. Do not self-certify.
6. **iPhone/App Store**: Apple Developer membership/signing status and iOS device testing remain separate gates.

## Scope protection

This document does **not** certify release readiness, authorize live migration, merge or deployment, or assert that the new APK passed device QA. The original Supabase project, its users and its data have been preserved.
