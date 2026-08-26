# Implementation State: Mark Detail and Permission-Aware Actions

## Role and baseline

- Role: Frontend
- Local branch: `codex/checkpoint4-frontend-alpha`
- Baseline: `origin/claude/kickoff-execution-chx2mh` at `048ffab`
- Governance: Frontend Charter v2.0 / Frontend Playbook v2.0
- Classification: Two-Key-adjacent because the UI exposes permission-sensitive edit, delete, owner-removal, and reporting actions.
- No commit, push, merge, migration, or deployment was performed.

## Built

- `src/components/marks/MarkDetailModal.tsx`
  - Reusable full Mark detail sheet for Personal, Person, and Shared Walls.
  - Reuses the canonical Mark renderer and reaction state.
  - Sender edit/delete actions appear only inside the client-side 10-minute UX window; the server remains authoritative.
  - Owner standard removal shows the rolling 30-day allowance before confirmation.
  - Report reason selection, optional details, and owner `report + safety removal` path use the shipped moderation contracts.
  - Partial failure copy distinguishes a submitted report from a failed follow-up removal.
- `app/wall.tsx`, `app/person/[id].tsx`, `app/shared/[id].tsx`
  - Tapping a non-Secret Mark opens details.
  - Successful edit/removal reconciles the local wall without losing the user's wall context.
  - Secret Marks keep their separate one-time reveal flow and never open ordinary details.
- `src/lib/marks.ts`
  - Added the thin client call for the shipped sender-delete policy.
  - Edit, delete, and removal calls now verify the exact affected-row count, preventing a zero-row RLS result from being presented as success without requiring removed rows to remain readable.
- `src/components/Fastener.tsx`, `src/components/MarkCard.tsx`, `src/theme/tokens.ts`
  - Every Mark now uses a genuinely circular pin.
  - Pin color is bright, deterministic per Mark, and sourced from design tokens.
  - Tappable Mark cards expose an accessibility role and useful label.
- `src/components/marks/MarkView.tsx`
  - Photo and video frames are both 180 logical pixels high.
  - Photos use `contain`, preserving the full image instead of center-cropping it.
  - Non-Secret Marks opt into the reusable detail action.

## Tested

- **Verified:** `git diff --check` passes; the working diff contains no whitespace errors.
- **Verified:** Consumption Compliance was checked directly against `src/lib/marks.ts`, `src/lib/reports.ts`, `src/lib/reactions.ts`, and migration `0012_mark_lifecycle.sql`.
- **Believed-likely:** Type correctness and lint cleanliness based on manual inspection. This workspace has no installed `node_modules`; the environment interrupted `npm run typecheck` / `npm run lint` before execution.
- **Inferred, not verified:** iOS, Android, web rendering; modal keyboard behavior; reduced-motion interaction; screen-reader announcements; live Supabase success and failure paths.

## Consumption Compliance

**PASS, with verification pending at runtime.**

- Uses existing `editMarkText`, `removeMark`, `remainingNormalRemovals`, `createReport`, and reaction APIs.
- Sender delete consumes the existing `marks delete author within window` RLS policy; it does not introduce a new backend contract.
- Normal vs safety removal values match the shipped database trigger vocabulary.
- Report reasons exactly match `REPORT_REASONS`.
- UI permission checks are UX-only. RLS and lifecycle triggers remain authoritative.

## Quality Bar Check

**GAPS FOUND — not ready to merge.**

- The flow is designed to keep ordinary reading friction low and place confirmation only on destructive/safety actions.
- Copy explains the removal allowance and distinguishes normal from safety removal.
- Visual hierarchy uses the locked paper/ink/bright-accent system and the approved round-pin direction.
- Actual rendering and interaction quality have not yet been observed on a target device, so no "looks right" claim is made.

## Accessibility

- Implemented: named controls, button/radio roles, selected state, alert semantics, 44-pixel minimum primary touch targets, non-color selected text.
- Not verified: VoiceOver/TalkBack, keyboard traversal, focus restoration after closing the modal, dynamic type, contrast in rendered native output.

## Left To Do

1. Install the locked dependencies and run `npm run typecheck` plus `npm run lint`.
2. Render on iOS and Android at compact and large text sizes; repair any layout or keyboard issues.
3. Exercise live edit/delete expiry, normal-removal quota, report, safety-removal, and partial-failure scenarios.
4. Verify VoiceOver/TalkBack and focus return to the originating Mark.
5. Independent Reviewer code review.
6. Mandatory QA pass before merge because this is permission-sensitive UI.

## Technical Debt / Gaps Flagged

- The repository currently has no component-test or visual-regression harness; none was invented inside this permission-sensitive slice.
- The existing glyph-based `Icon` placeholder remains outside this slice and still needs the approved custom icon system.
- The report flow supports Mark reporting. The separately approved optional `Block user` follow-on belongs to the broader blocking/account safety screen and remains outstanding.
- A submitted report followed by a failed safety removal is reported honestly and can retry removal without creating a duplicate report.
