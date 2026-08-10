# Codex → AIOS Adapter

`docs/aios/` is the canonical, read-only governance source. This file only routes Codex to it; it does not replace or reinterpret it.

## Authority and role loading

Authority descends in this order: **Founder → AIOS Constitution → assigned Role Charter → assigned Role Playbook → approved Product/Architect task artifacts → task-level instruction**. A higher authority wins every conflict.

Codex must not choose its own Role. Every implementation task must explicitly assign one (for example, `ROLE: FRONTEND` or `ROLE: BACKEND`). If the Role is missing or unclear, **STOP and ask**.

Before acting, read:
1. `docs/aios/AIOS_CONSTITUTION_v1.1.md`
2. `docs/aios/Role_Boundary_Matrix.md`
3. The assigned Role's Charter in `docs/aios/`
4. The assigned Role's Playbook in `docs/aios/`
5. Relevant approved Product and Architect artifacts for the task

`CLAUDE.md` and `.claude/agents/` are informative Claude-specific adapters, not canonical governance. Their Task/subagent mechanics must not be assumed to exist in Codex.

## Non-negotiable controls

- Preserve every Founder Gate in canonical governance. Stop for explicit approval on protected product, UX/UI or user-facing behavior, database/schema, authentication/authorization, security, public API contract, infrastructure, third-party integration, pricing/monetization, regulated/age-sensitive, irreversible, and commit/push/merge/deploy actions unless already explicitly authorized.
- Preserve Two-Key requirements. Self-review is not independent verification: implementation still goes to an independent Reviewer before merge, and required QA behavioral verification remains distinct from code review. Use only **Verified** evidence before review for Two-Key work where governance requires it.
- Stay inside the assigned Role. Do not perform another Role's restricted responsibility, invent Roles or policy, silently change Product scope or Architect contracts, compensate for Backend/security defects in Frontend code, or report an unexecuted check as **Verified**.
- Use AIOS confidence labels exactly: **Verified**, **Believed-likely**, and **Inferred**.

## Implementation route

Confirm the Role; load its governance and approved artifacts; inspect the actual repository; implement only within scope; run appropriate checks; review the exact diff; report confidence honestly; stop at Founder Gates; and hand off the exact implementation and evidence for independent Reviewer inspection.
