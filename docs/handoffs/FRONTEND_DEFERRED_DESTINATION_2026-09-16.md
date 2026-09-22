# Frontend Implementation State: Deferred Destination Recovery

**Date:** 2026-09-16  
**Role:** Frontend  
**Feature:** FP-DL-001  
**Scope:** Reversible client-only implementation. No schema, migration, hosted, dependency,
commit, push, merge, or deploy action was performed.

## Approved Inputs

- Product PRD SHA-256: `bdd38bcedf3d97daef30ed5b1e8c3b98a686e0f02c0f0cc4981d5839987514db`
- Product assumptions SHA-256: `0794d06704eb2e17b7c926e6110f80d063f0f8c51c72ea37a858d2dfe077da24`
- Feature Plan SHA-256: `0111f1c9409eac060a7d0d03ada883e4ff467d9e34457fc667b1a495d706ff1f`
- ADR-013 SHA-256: `a45160fa5348112562bf0179ebec0ca531fce463236855eadea5d17fea328d28`
- Independent architecture approval was supplied in the implementation assignment. The checked-in
plan/ADR files still carry their pre-review status text and were not modified by Frontend.

## Built

- `src/lib/deferred-destination-contract.ts`
  - strict five-family custom-scheme parser;
  - exact recursive stored-record parser;
  - 8-KiB native-intent and 16-KiB stored-string bounds;
  - canonical handle/UUID normalization and reserved-parameter rejection;
  - non-sliding 24-hour expiry contract.
- `src/lib/deferred-destination.ts`
  - one serialized AsyncStorage coordinator;
  - tri-state identity reconciliation and fail-closed cross-account purge;
  - process quarantine for storage uncertainty and explicit sign-out;
  - opaque CSPRNG attempt tokens plus separate one-use navigation references;
  - exact-screen claims, `in_flight` dedupe, handle/unavailable transfer, retry, and exact-snapshot
    terminal acknowledgement.
- `src/lib/deferred-destination-resolver.ts`
  - dependency-injected distinction between typed terminal absence and thrown retryable failure for
    all approved destination families.
- `app/+native-intent.ts`
  - sole Expo Router initial/runtime native-intent interception point;
  - auth callback pass-through without persistence;
  - capture-before-root routing; unsupported/uncertain input fails to `/`.
- `src/lib/auth.tsx`
  - reconciles durable ownership before exposing an initial/replacement identity;
  - preserves the same-subject token-refresh early return and existing protected-media effects;
  - explicit sign-out quarantines and scrubs before/after Supabase sign-out without making a failed
    scrub a prerequisite for leaving the account.
- `app/index.tsx`, onboarding walkthrough/contract
  - resume only after server `accountRoute === "ready"`;
  - use the coordinator's exact href without reading its token;
  - replace the process-memory consume-on-read behavior while preserving the Discover fallback.
- Exact destination screens
  - `/u/[handle]` exchanges the handle reference and transfers the same token to the resolved
    Personal Wall;
  - My Wall, person Wall, Shared Wall, and Shared invitation routes claim only their exact screen
    identity and authenticated subject;
  - same-route replacement blanks stale screen state before the new reference is claimed;
  - authorized terminal render acknowledges arrival; terminal absence transfers to the generic
    unavailable screen; transport/server failure preserves the record and offers Retry.
- `app/deferred-destination-unavailable.tsx`
  - privacy-safe alert with exactly the approved unavailable copy plus accessible My Wall and
    Discover actions; acknowledgement occurs after the terminal view commits.
- `src/lib/profiles.ts`, `src/lib/marks.ts`
  - profile, Personal Wall, Mark, and author-hydration query errors now propagate instead of being
    converted into false absence.
- `src/lib/pendingLink.ts`
  - removed after all consumers migrated.

## Component Discovery and Library API Verification

- **Verified:** existing `Screen`, `Text`, `Button`, Expo Router, `AuthProvider`, account-route
  fence, and design tokens were reused; no parallel UI component or visual token was created.
- **Verified:** installed Expo Router 3.5 type/source supports asynchronous
  `redirectSystemPath({path, initial})` in `app/+native-intent.ts` for both initial and runtime URLs.
- **Verified:** AsyncStorage 1.23 existing `getItem`/`setItem`/`removeItem` surface is consumed.
- **Verified:** `expo-crypto` 13.0.2 is already installed by the existing `expo-auth-session`
  dependency and exposes native `getRandomValues`; no package or native configuration changed.

## Consumption Compliance Check

| Surface consumed | Matches actual implementation? | Deviation | Resolution |
|---|---|---|---|
| Supabase `auth.getSession` / auth events | Yes | None | Existing client retained |
| Server-backed `accountRoute` | Yes | None | Recovery waits for exact `ready` result |
| Profile/Wall/Mark/Invite reads | Yes | Existing profile/mark helpers suppressed errors | Helpers now propagate actual query errors |
| Shared-Wall capability and invite typed absence | Yes | None | Existing strict response parsers retained |
| Protected-media/session effects | Yes | None | Existing cache, generation, upload reset, and same-subject refresh behavior retained |

**Result: PASS — Verified.** The client consumes the APIs actually present in source. Authorization
remains on existing Supabase/RLS/RPC reads; the coordinator never grants access.

## Acceptance-Criteria Verification

- **Verified (unit/source/build):** strict allowlist, exact persistence, cold coordinator restart,
  newest-wins replacement, exact expiry boundary, A/B isolation, same-account refresh/reauth,
  read-not-consume, terminal acknowledgement, retry preservation, stale token/reference rejection,
  duplicate prepare `in_flight`, storage quarantine, explicit-sign-out failure behavior, resolver
  classification, native-intent single-boundary wiring, and removal of `pendingLink`.
- **Verified (build):** TypeScript, lint with zero errors, Expo public config resolution, iOS
  production export, and Android production export.
- **Believed-likely:** rendered mobile layout and native accessibility semantics follow existing
  verified components and tokens, but were not exercised in a simulator or physical device by
  Frontend.
- **Inferred:** production invite-conversion benefit; no beta traffic exists.

## Product Quality Bar Check

- Emotional outcome: **Believed-likely PASS.** Recovery is quiet; no confirmation was added.
- User expectation: **Verified at contract/source level.** The original destination survives the
  auth gate and cannot cross a known account boundary.
- Perceived quality: **Verified at contract/source level.** Duplicate routing is explicit
  `in_flight`; retry and generic unavailable states are distinct; raw routes/errors are not shown.
- Friction tolerance: **Believed-likely PASS.** Retry appears only for retryable failure; terminal
  unavailability offers immediate safe exits.
- Honest gap: device rendering, screen-reader announcements, cold-kill lifecycle, and real account
  switching still require QA and are not claimed Verified here.

## Tests and Evidence

- `npm run typecheck` — **Verified PASS**.
- `npm run lint` — **Verified PASS**, 0 errors and the same 9 pre-existing warnings outside this
  implementation.
- Existing TypeScript client contract suites — **Verified PASS**.
- Existing frontend Node suites — **Verified PASS**, 22/22 tests.
- New deferred parser/coordinator/resolver suites — **Verified PASS**.
- `tests/frontend-deferred-destination.test.mjs` — **Verified PASS**, 6/6 tests.
- `npx expo config --type public` — **Verified PASS**.
- `npx expo export --platform ios` — **Verified PASS**.
- `npx expo export --platform android` — **Verified PASS**.
- `git diff --check` — **Verified PASS**.

## Failure Recovery

- Network/server exception: keep exact durable snapshot and token; show Retry.
- Typed nonexistent/inaccessible/unauthorized result: transfer captured token to generic
  unavailable and acknowledge only after render.
- Storage read/write/remove uncertainty: invalidate all attempts and disable recovery for the
  process.
- Explicit sign-out: quarantine immediately, scrub before and after, never expose the destination
  through public auth state.
- Stale async closure/reference/token: exact generation, subject, screen, token, and serialized
  snapshot checks make it inert against a replacement.

## Risks and Limitations

- Physical-device and simulator lifecycle behavior is **not verified** by Frontend.
- Screen-reader announcements and focus behavior are **not verified** on VoiceOver/TalkBack.
- The approved client-clock rollback and failed-sign-out/full-restart same-account stale-intent
  limitations remain unchanged.
- A crash after render but before acknowledgement can reopen the same destination once, as
  approved.
- Universal links, store fallback, push, multiple pending intents, and a remote kill switch remain
  out of scope.

## Recommended Next Role

1. Independent Reviewer: inspect the exact implementation tree, focusing on auth ordering,
   exact-screen token/reference ownership, stale-closure behavior, privacy, and resolver wiring.
2. QA after Reviewer approval: simulator/physical-device cold kill, Strict Mode, A→B switch,
   automatic expiry/A reauth, malformed URL/storage, offline retry, accessibility, and real custom
   scheme checks.

## Founder Action Required

None for local review/QA. Merge, deploy, and hosted actions remain unauthorized.

## Confidence

**Verified** for source contracts, automated tests, static checks, and production exportability.
Runtime device behavior remains **Believed-likely** until independent QA exercises it.
