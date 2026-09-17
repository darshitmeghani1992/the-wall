# PRD-SAF-001: Reporting Completeness

**Status:** Approved from existing Master Spec §§52–53; no new product decision
**AIOS lane:** Small safety/privacy slice
**Scope owner:** Product

## Goal

Complete the MVP reporting journey so a signed-in person can report a Shared Wall, and can choose
to block a person immediately after reporting them. Reports remain real moderation records; the UI
must never imply that review or enforcement already occurred.

## User stories

- As a viewer or member, I can report a Shared Wall with a fixed reason and optional details.
- As a person reporting another account, I can also block that account without submitting the
  report twice.
- As a person whose network or session changes mid-action, I do not see stale success or perform a
  follow-up action under a replacement account or target.

## Acceptance criteria

- Shared Wall screens expose **Report Shared Wall** to non-owners only.
- The report flow uses the existing reason vocabulary, optional details capped at 500 characters,
  a single in-flight submission, and a truthful confirmation.
- Person reporting offers an optional **Also block this person** choice.
- Report-and-block executes report first. If reporting fails, blocking is not attempted.
- If reporting succeeds but blocking fails, the report remains acknowledged and a retry performs
  only the block; it never creates a duplicate report.
- Every async continuation is fenced to the captured authenticated account and target route.
- Ordinary users gain no moderation/admin capability and no anonymous identity is exposed.

## Non-goals

- Admin moderation console, moderation policy, push notification, or enforcement SLA.
- New report reasons, schema, RPCs, RLS changes, dependencies, hosted migration, merge, or deploy.
- Reporting a Personal Wall separately from its owner; the existing person-report flow remains the
  MVP path for that case.

## Failure behavior

- Retryable report failure keeps the form and selection intact.
- A partial report-and-block failure says the report was received and that blocking still needs a
  retry.
- Account or target changes silently invalidate stale callbacks rather than navigating or showing
  success for the wrong subject.

## Success evidence

- Contract tests cover sequencing, partial failure, retry-without-duplicate, and stale-flow fences.
- TypeScript, lint, complete client tests, iOS export, Android export, and draft-PR CI pass.

