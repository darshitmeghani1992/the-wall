# CURRENT — Operational Handoff

> Operational state, not canonical governance. Product authority remains
> `THE_WALL_MASTER_BUILD_SPEC_v1.1.md`; AIOS authority remains `docs/aios/`.

## Current state — 2026-08-25

- Working branch: `codex/checkpoint4-frontend-alpha`, based on
  `origin/claude/kickoff-execution-chx2mh` at `048ffab`.
- Baseline contains migrations `0010`–`0017` and historical evidence of 117 passing local
  PostgreSQL security assertions plus prior independent review/QA for those exact commits.
- Current working tree contains an uncommitted Frontend Mark-detail/action slice. See
  `docs/handoffs/FRONTEND_MARK_DETAIL_2026-08-25.md`.
- Independent Product, Architect and QA audits classify the MVP **NOT READY** for external
  beta or production.
- No commit, push, merge, hosted migration or deployment has been performed by the current
  CTO/Frontend session.

## Active critical path

Further frontend expansion is paused behind the high-risk P0 contract corrections documented
in `docs/architecture/P0_SECURITY_CONTRACT_PLAN.md`:

1. global Personal-Wall block boundary;
2. Mark-aware reaction authorization;
3. member-only Shared-Wall posting;
4. no ordinary Personal-Wall owner self-posting;
5. protected private Mark media and upload authorization;
6. disabled comment/poll/retired-type client surfaces.

## Verified current blockers

- `can_view_wall` allows a blocked actor through the public Personal-Wall branch.
- reaction writes do not require access to the underlying Mark.
- public Shared Walls use `contribution_policy='everyone'` and allow non-members to post.
- Personal-Wall owners are permitted to create ordinary Marks through the backend.
- Mark media uses a permanently public bucket/URL model.
- current security tests contain stale assertions that require several of those old behaviors.
- client dependencies are not installed in this workspace; the current Frontend diff has not
  been typechecked, linted, rendered, independently reviewed or device-tested.
- hosted Supabase, native builds, universal links, accessibility and performance remain unverified.

## Founder gate

Approval is required before implementing the P0 RLS/schema/storage changes. The only immediate
product choice is blocked users who share an accepted Shared-Wall membership. Recommended:
preserve membership/group content while suppressing direct profiles, pair reactions,
invitations and direct Alerts.

## Exact next action

Founder approves the P0 package and blocked-co-member policy. Then:

`Architect design review → Backend Packages A/B → Reviewer → QA/Security → Protected-media ADR/package → Reviewer → QA/Security → Frontend resumes against server capabilities.`
