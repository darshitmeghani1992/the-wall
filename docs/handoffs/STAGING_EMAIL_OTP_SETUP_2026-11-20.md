# The Wall — staging email OTP launch runbook (20 November 2026)

**Status: BLOCKED ON FOUNDER-OWNED SENDER/SMTP SETUP.** Staging `ewintxgdxdvschiqodkq` is isolated from original The Wall `wfsfafmgvxevpzrurofz`. This document does not approve changes to the original project.

## Why this is the current beta critical path

The app's `SignIn` view calls `supabase.auth.signInWithOtp({email})` and expects a **six-digit code** to be entered with `verifyOtp({email,token,type:'email'})`. As verified from staging `/auth/v1/settings`, Email is enabled; Google and Apple are disabled.

Supabase's **default SMTP sender will only deliver to the project's preauthorized team email addresses**, not arbitrary beta testers. New Free-plan projects created after **3 June 2026** cannot customize auth email templates while using default SMTP. Separately, `signInWithOtp` sends a **Magic Link** rather than a code by default unless the **Magic Link email template** contains `{{ .Token }}`. Therefore the existing staging Auth configuration is not ready for an invited multi-user beta.

References:
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier
- https://resend.com/pricing
- https://resend.com/changelog/smtp-service

## Low-cost implementation path (Resend, not yet connected)

Resend's current Free plan lists **$0/month, 3,000 transactional emails/month and 100 emails/day** (verify current terms at account signup). The account owner must create and verify a sending domain/subdomain and configure its DNS records (SPF, DKIM and DMARC). Prefer a brand-specific sender such as `login@<verified-sending-domain>`; do **not** use an unverified Gmail/Yahoo address or expose transactional credentials to the Expo client.

Once Resend verifies ownership, generate a scoped API key for SMTP and configure **only the staging Supabase project** under Authentication → SMTP:

| Setting | Value |
|---|---|
| Enable Custom SMTP | On |
| SMTP host | `smtp.resend.com` |
| SMTP port | `465` (SSL/TLS) |
| SMTP username | `resend` |
| SMTP password | Resend API key (enter directly in Supabase dashboard, **never** in Git/chat/source) |
| Sender email | A verified sender on the domain |
| Sender name | `The Wall` |

Do not re-use the service-role key, share screenshots of secrets, or configure the original The Wall project in this step. Custom SMTP changes Supabase's email limits; verify the resulting Auth rate limits, use appropriate bot mitigation, and do not open public registration until verified.

## Six-digit code template

Once custom SMTP is configured, in staging Supabase go to **Authentication → Email Templates → Magic Link** and set the subject to **Your The Wall sign-in code**. Replace the template content with the exact repo file:

`supabase/auth-templates/magic-link-otp.html`

The important Supabase variable is `{{ .Token }}`. **Do not use only `{{ .ConfirmationURL }}`**, because that sends a Magic Link while the app asks for six digits. Ensure the email receives a code, not just a link, before asking testers to install the app.

## Native redirect configuration

Set Auth → URL Configuration's additional redirect allowlist to include the exact native callback **`thewall://auth/callback`**, matching `makeRedirectUri({scheme:'thewall',path:'auth/callback'})`. The Site URL should be a founder-approved owned domain when available. Future Google/Apple OAuth also need their separate provider credentials and device verification; currently both are intentionally hidden in draft PR #43 when disabled in Supabase Auth.

## Staging smoke test — QA must record actual evidence

1. Send sign-in code to at least **two authorized test email inboxes** (not public disposable inboxes). Verify real delivery, sender reputation, expected six-digit token and spam placement.
2. Verify the code through the Android app on a physical device; confirm persistent Auth session, profile onboarding and personal Wall creation.
3. A second test user follows/friends the first and attempts approved/denied writes to personal and shared Walls; confirm Alerts and block/privacy constraints in both directions.
4. Verify expired/incorrect OTP fails, sign-out clears session and private media, and a different test account cannot inherit deferred destinations.
5. Capture **no full JWT, OTP, email address or secrets** in shared logs. Use anonymized actor IDs and distinct evidence for API/CI/device.
6. Keep the original project and all 0031 account-deletion backend actions out of scope until separate Founder/AIOS gates.

**Owner action required:** verify/select the sending domain and supply SMTP credentials **directly to the provider and Supabase settings**. Engineering can then verify the configured outcome without handling the raw secret.
