# The Wall — App Store privacy, retention and submission inventory

**Date:** 20 November 2026. **Status:** Code-derived draft for Founder/legal review on 21 November. This is NOT an Apple App Privacy questionnaire submission, a published privacy policy, or a guarantee of compliance. Source: current integrated app and staging database, not generic assumptions.

## Actual app-side data uses found in code

| Data class / Apple questionnaire topic | Current product flow | Evidence / remaining validation |
|---|---|---|
| Email address + user account ID | Email OTP sign-in via Supabase Auth; Auth user UUID used to enforce policies | `app/(onboarding)/sign-in.tsx`, `src/lib/auth.tsx`, `src/lib/supabase.ts`; delivery to non-team addresses awaits custom SMTP |
| Profile identity/content | Handle, display name, avatar URL, bio, interests; optional Instagram/TikTok/YouTube/X/website links | `src/lib/types.ts`, `src/lib/profiles.ts`, `app/(onboarding)/profile-setup.tsx`; visibility depends on RLS and privacy settings |
| User-generated content | Wall settings/names, text Marks, reactions and Shared Wall membership | `src/lib/types.ts`, `src/lib/marks.ts`, `src/lib/walls.ts`; private visibility is server-enforced and must be device-QA tested |
| Photo/video/voice content | App composer has protected upload code, image picker, microphone/camera requests | `app/create.tsx`, `src/lib/upload.ts`; **media creation disabled for beta** until worker runtime and privacy QA pass; do not claim media processing deployed |
| Social relationships | Friendships, follows, approved writers, blocks and invites | Supabase staged RLS migrations 0014–0030 and source relationship modules; need full authorized-user QA |
| Reports/moderation | Reports, moderation actions, account suspension and removal events | `public.reports`, `public.moderation_actions`; require retention and admin-access policy review |
| In-app Alerts | Stored rows in `public.notifications`; source reads and marks read state | `src/lib/notifications.ts`; no device push-token registration was found in the inspected app code; `expo-notifications` dependency alone does not prove push collection |
| Session/local storage | Supabase refresh/access session persists in React Native AsyncStorage; protected media resume metadata uses SecureStore | `src/lib/supabase.ts`, `src/lib/upload.ts`; assess local data-at-rest protection separately |
| Product analytics | Optional PostHog `capture`/`identify` when `EXPO_PUBLIC_POSTHOG_KEY` is configured | `src/lib/analytics.ts`; preview EAS env inspected earlier contained only public Supabase fields, but production must independently verify live analytics configuration before claiming no data sharing/tracking |

## Privacy claims not yet approved

- **Apple privacy labels** (which data is collected, linked to a user, used for tracking, shared with third parties, and for what purposes) must reflect the *actual deployed* integrations. Do not infer that an inactive build dependency is collecting data; do not infer that analytics is absent in production without inspecting production configuration and vendor SDK behavior.
- **Do not claim location/contacts collection or non-collection categorically** until every SDK and permission path has been audited. The currently inspected source had no explicit geolocation/contacts registration code.
- **Never claim permanent account deletion is operational**: migration `0031_recoverable_account_deletion.sql`, admin worker and schedule are withheld. The app's permanent-deletion UI is default-off; recoverable deactivation currently works. Apple App Store's in-app deletion requirement for account-creating apps therefore remains a separate release blocker. Decide and prove the lawful retention and irreversible deletion implementation before public App Store review.
- **Retention**: define actual periods for Auth accounts, Marks, reports/moderation, anonymous-author mappings, backups, avatar/media objects, session tokens, analytics and access logs. A successful 30-day deletion feature needs its entire server worker/rollback and legal review, not just the migration file.
- **Tracking/advertising**: assess PostHog configuration, analytics and any cross-app/device identifiers; do not mark 'tracking=false' or disable ATT prompts purely by assumption.

## What Apple/Founder must supply 21 November

- Organization/developer legal name; support contact email; domain owned and verified; **public Privacy Policy URL** and Support URL reachable without authentication.
- Decide privacy policy and terms governing age eligibility, UGC/license, harassment reporting, moderation/removal and secret/anonymous content. Verify legal advice for operating regions and minors.
- Apple Developer enrollment/team + export-compliance determination for `ITSAppUsesNonExemptEncryption` (EAS simulator preflight warned this is not yet declared); confirm cryptography/HTTPS use with relevant export guidance. Do not set a false answer in `Info.plist` without verification.
- Confirm App Store privacy questionnaire from this evidence and actual running builds; evaluate SDK manifests and vendor contracts. Expo SDK51 required-reason native privacy manifest is prepared in PR #54 but is **not** the same as the privacy questionnaire.
- Require signed iOS build, physical device QA, independent Reviewer→QA evidence and App Store Connect validation before upload.

## Platform environment boundary

- Original `The Wall` Supabase project: `wfsfafmgvxevpzrurofz`; must remain untouched by staging QA.
- Isolated staging project: `ewintxgdxdvschiqodkq`; migrations `0001–0030`, `0032–0034`, **not 0031**. Protected media and Secret Mark feature flags OFF. No real tester data has been created in the November synthetic smoke transactions (each rolled back).

**No real user emails, keys, secret tokens, or screenshots of private data are included in this inventory.**
