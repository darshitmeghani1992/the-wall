# Implementation State: Shared-Wall Registered-User Lifecycle

**Role:** Frontend  
**Backend contract consumed:** migration `0026_shared_wall_lifecycle.sql`, commit `af27f776`  
**Frontend base:** `b3aec83`  
**Status:** Source complete; independent Reviewer and QA pending

## Built

- `src/lib/shared-wall-contract.ts` strictly parses the actor-bound capability,
  lifecycle action, settings, and private-invite-preview DTOs. Every successful
  response is bound to the exact requested Wall id.
- `src/lib/walls.ts` consumes only the `0026` RPC mutation surface. Direct
  membership writes are gone. It also provides bounded, literal-safe public-Wall
  search and RLS-filtered roster/profile hydration.
- `src/lib/mutation-guard.ts` prevents a rapid second press before React can
  render a busy state and rejects responses belonging to another resource.
- Discover now separates People and public Shared Walls, with an explicit create
  entry point.
- Shared-Wall creation defaults to private/invite-only, supports public Open Join
  and Anonymous settings, and cannot be dismissed or resubmitted while its write
  is unresolved.
- The Shared-Wall screen renders owner, member, invited, joinable,
  owner-approval-required, invite-required, unavailable, loading, error, empty,
  and focused-Mark-unavailable states.
- The member screen supports registered-user search/invite, accepted and pending
  rosters, revocation, durable removal, reinvitation, and ownership transfer.
- The settings screen supports name, privacy, Open Join, Anonymous Marks, and
  cross-platform exact-name deletion confirmation.
- Private invitations use only the minimal preview RPC before acceptance.
- Shared links are explicitly view-only; membership invitations are registered-
  user server actions.
- Alerts name and route invite-acceptance and ownership-transfer events.

## Tested

- **Verified:** TypeScript compilation and full repository lint complete with no
  errors. Existing unrelated warnings are reported separately in the milestone
  evidence.
- **Verified:** dependency-free client contract suites cover strict DTO keys,
  Wall-id mismatch rejection, removed-member join state, private-preview privacy,
  literal-safe search, rapid duplicate mutation rejection, session/focus races,
  and Alert routes.
- **Verified:** Expo production exports complete for iOS and Android.
- **Believed-likely:** native layout, touch behavior, and destructive confirmations
  match existing components and tokens. They have not been rendered on physical
  devices in this environment.

## Consumption Compliance Check

| Contract consumed | Actual `0026` shape | Client behavior | Result |
|---|---|---|---|
| `get_wall_capabilities` | Exact available/unavailable JSON with `join_state` | Strict parser; `can_join` must agree with `join_state` | PASS |
| `join_shared_wall` | joined / already_member / unavailable | Exact Wall id required; other results never shown as success | PASS |
| `invite_shared_wall_member` | invited / already_invited / already_member / unavailable | Server invitation only; refresh only after accepted/idempotent result | PASS |
| `respond_shared_wall_invite` | accepted / declined / unavailable | Uses projection-only preview before mutation | PASS |
| `remove_shared_wall_member` | removed / revoked / unavailable | Failure stays visible; no success-masking reload | PASS |
| `leave_shared_wall` | left / owner_action_required / unavailable | Only confirmed `left` navigates away | PASS |
| `update_shared_wall_settings` | exact updated / invalid_input / unavailable | All returned settings and Wall id validated | PASS |
| `delete_shared_wall` | deleted / confirmation_mismatch / unavailable | Exact-name confirmation; only `deleted` navigates away | PASS |
| `transfer_shared_wall_ownership` | boolean | Only literal `true` navigates to the transferred Wall | PASS |
| `list_removed_shared_wall_members` | user_id + removed_at rows | Owner-only hydration; unreadable profiles stay neutral | PASS |
| `get_my_pending_shared_wall_invite` | exact minimal preview / unavailable | Rejects extra keys and wrong Wall ids | PASS |

**Result:** PASS — the client consumes the approved Backend implementation without
documented deviation and does not compensate for authorization in UI code.

## Quality Bar Check

### Emotional outcome

**Believed-likely:** users can understand whether they are viewing, invited,
eligible to join, a member, removed, or the owner without learning technical
permission language.

### Friction tolerance

**Believed-likely:** frequent actions (search, join, invite acceptance) stay short;
irreversible or socially consequential actions (remove, transfer, leave, delete)
receive confirmation. Creation starts at the safest privacy setting.

### Honest gaps

- Physical-device rendering and touch ergonomics are unverified.
- Slow-network and offline behavior has source-level recovery but no device-level
  network-conditioning evidence.
- Universal HTTPS links and store fallback remain outside this milestone; the
  existing installed-app custom scheme is the only shared link.

## Accessibility

- **Verified in source:** interactive controls carry roles/labels/states, minimum
  target sizing follows existing components, selected tabs/radios expose state,
  busy/disabled controls expose state, and errors use alert semantics.
- **Believed-likely:** reading order and contrast follow established application
  components and tokens.
- **Not verified:** VoiceOver, TalkBack, Dynamic Type at maximum sizes, switch
  control, keyboard navigation, and physical-device focus restoration. These are
  mandatory QA/device gates before merge because this UI is permission-sensitive.

## Left To Do

1. Independent Reviewer inspection of the exact frontend diff.
2. CI execution of frontend checks and the complete PostgreSQL suite together.
3. QA behavioral testing with hosted Supabase roles and two real accounts.
4. iOS and Android physical-device, screen-reader, large-text, slow-network, and
   deep-link verification.
5. Founder milestone build review before any merge or deployment.

## Technical Debt / Gaps Flagged

- Client pure-contract tests are not currently part of GitHub CI and must be run
  explicitly until the workflow owns them.
- The repository has existing lint warnings outside this implementation.
- Final account-purge ownership handling, external invite tokens, universal HTTPS
  links, and store fallback remain out of the 60% milestone.

## Confidence

**Verified** for source contract consumption, static checks, pure tests, and native
bundle generation. **Believed-likely** for rendered experience. Hosted behavior,
device accessibility, and release readiness are explicitly unverified.
