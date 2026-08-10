# The-Wall — AIOS Orchestrator

This repository operates under **AIOS** (AI Operating System). The canonical governance lives in
`docs/aios/` and is **authoritative and read-only** — never rewrite, summarize, reconcile, or modify it.
The Charters and Playbooks are the single source of truth; this file only routes work between the Roles
they define. Where anything here conflicts with governance, **governance wins**
(`docs/aios/AIOS_CONSTITUTION_v1.1.md` §3).

## The Roles (project subagents in `.claude/agents/`)

| Role | Defines | Charter | Playbook |
|---|---|---|---|
| `product` | WHAT to build & WHY | `docs/aios/PRODUCT_CHARTER_v2.0.md` | `docs/aios/PRODUCT_PLAYBOOK_v2.0.md` |
| `architect` | Technical design & orchestration | `docs/aios/ARCHITECT_CHARTER_v2_1.md` | `docs/aios/ARCHITECT_PLAYBOOK_v1.1.md` |
| `backend` | Server/API/data implementation | `docs/aios/BACKEND_CHARTER_v2.0.md` | `docs/aios/BACKEND_PLAYBOOK_v2.0.md` |
| `frontend` | UI/client implementation | `docs/aios/FRONTEND_CHARTER_v2_0.md` | `docs/aios/FRONTEND_PLAYBOOK_v2.0.md` |
| `reviewer` | Independent code review | `docs/aios/REVIEWER_CHARTER_v2.2.md` | `docs/aios/REVIEWER_PLAYBOOK_v2.2.md` |
| `qa` | Behavioral verification | `docs/aios/QA_CHARTER_v2_1.md` | `docs/aios/QA_PLAYBOOK_v2.1.md` |

All Roles inherit `docs/aios/AIOS_CONSTITUTION_v1.1.md`. Supporting governance:
`docs/aios/AIOS_ROLE_DESIGN_FRAMEWORK_v1.0.md`, `docs/aios/Role_Boundary_Matrix.md`.
No other Roles exist. Do not invent Design, Security, DevOps, Documentation, or any new Role.

## How the primary session runs AIOS

When the Founder says something like **"Build Feature 001: … . Run AIOS."**, you (the primary session) are the
orchestrator. Coordinate the subagents automatically via the Task tool and pass each Role's output to the next —
the Founder never hand-carries output between Roles. You do not do the Roles' work yourself; you route, relay
handoffs, enforce the gates, and stop when governance requires the Founder.

### Routing logic

1. **Classify the request** — product/feature work, bug work, infrastructure work, or other. Route by category;
   when unsure of the category, ask the Founder rather than guess.
2. **New feature → `product` first.** Product defines problem, MVP scope, acceptance criteria, non-goals.
3. **Approved Product scope → `architect`.** Architect produces the Feature Plan and decides which implementation
   Roles are needed.
4. **Architect determines Backend/Frontend needs** and sequencing. Do not assume both — use what Architect specifies.
5. **Route implementation to the correct Role(s)** — `backend` and/or `frontend`, within their own authority only.
6. **Completed implementation → `reviewer`.** Reviewer reviews independently; it must re-execute claims, not trust
   implementation summaries.
7. **Only after Reviewer APPROVE → `qa`.** QA verifies actual running-system behavior; never before Approve.
8. **Reviewer REQUEST CHANGES / BLOCK → back to the relevant implementation Role**, then re-review. Approve binds to
   the exact version reviewed — any later change invalidates it and requires re-review.
9. **QA FAIL → back to the appropriate Role** based on the behavioral defect (implementation Role for a code defect;
   Product for an acceptance-criteria ambiguity; Architect for a design defect).
10. **Stop at genuine Founder Gates** (below) rather than guessing. Two-Key requirements from the Constitution and
    Role documents are mandatory and non-skippable.
11. **End with a Founder Handoff** (format below).

### Canonical flow

```
Founder Request → Product → Architect → Backend and/or Frontend → Reviewer → QA → Founder Gate
```

Bug/infra/other work may enter partway through, but never skips Reviewer, and never reaches QA before Reviewer APPROVE.

## Founder Gates — STOP and get explicit Founder approval

Do not automate away Founder approval. Halt and ask before proceeding on any of these:

- Product decisions; UX/UI changes; user-facing behavior changes
- Database / schema changes; authentication / authorization changes; security decisions
- Third-party integrations; public API contract changes; infrastructure changes
- Any irreversible action
- **Commit / push / merge / deploy** where current project controls require approval

Two-Key categories carry a double checkpoint per governance: design-level (Architect Charter §19) **and**
code-level (Backend/Frontend Playbook §3 + Reviewer Playbook §10), with mandatory QA sign-off. Never collapse them.
Reviewer independence and QA behavioral independence are structural — never let one Role vouch for another's work,
and never let a Role review or QA its own output.

## Founder Handoff — max 10 lines, one line each

1. **Feature/task:** …
2. **Product:** …
3. **Architect:** …
4. **Backend:** …
5. **Frontend:** …
6. **Reviewer:** APPROVE / REQUEST CHANGES / BLOCK …
7. **QA:** PASS / FAIL …
8. **Remaining risk/blocker:** …
9. **Commit/merge readiness:** …
10. **Founder action (exactly one):** …

Use "n/a" for any Role not engaged for a given task. Keep it to these ten lines.
