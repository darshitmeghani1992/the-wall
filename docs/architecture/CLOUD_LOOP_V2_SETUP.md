# Cloud Execution Preparation — Continuous Engineering Loop v2.0

**Status: Prepared but intentionally DISABLED.** Founder approved selecting/preparing a cloud environment, explicitly requiring costs and account actions *before* activating paid services. This artifact is not a license to incur costs, submit credentials, enable cloud agents, merge or deploy.

## Recommended execution path

Use **ephemeral GitHub-hosted Ubuntu runners** as the worker computer (already integrated with this repository), an **approved managed coding-agent runtime** (candidate: OpenAI Agents API/Codex harness) once separately configured and priced, and GitHub PR/Actions webhooks as the wake-up source. A durable, idempotent coordinator must own leases and retries; do **not** use GitHub workflow concurrency groups as the sole cross-run global three-worker cap. Avoid any permanent cloud VM until the managed-runner limitations are verified.

- Public repo standard GitHub-hosted runner compute is free under GitHub policy at preparation time; confirm current account billable usage and policy before activation. If moved private, standard Ubuntu 2-core Linux is listed at **USD 0.006 per charged minute**, subject to included minutes and plan. Source: https://docs.github.com/en/billing/reference/actions-runner-pricing
- AI coding itself is **not free by virtue of GitHub Actions**. GitHub Copilot cloud coding agents use AI credits and Actions minutes, with published individual Pro **USD 10/month**, Pro+ **USD 39/month**, Max **USD 100/month** (plan suitability, included credits, usage limits and eligibility need account confirmation): https://github.com/features/copilot/plans
- OpenAI Agents API bills model tokens at selected API model rates and hosted sandbox/tools separately; actual spend depends on model choice and runtime/token footprint: https://developers.openai.com/api/docs/guides/agents-api/overview
- No fixed monthly estimate should be asserted before a measured pilot. Require account-side spending caps and usage alerts. Proposed pilot budget: **USD 25 ceiling, subject to Founder approval**, one worker initially, and expand to three only after dry-run and explicit billable activation approval. At zero budget approval, all agent requests remain disabled.

## Security posture, scope and architecture

- `config/engineering-cloud-v2.json` starts `enabled=false`, `coding_agent=unconfigured`, `financial_limit_usd=0`. No tool automatically activates it by editing this policy.
- Allow only explicit FRONTEND or BACKEND implementation role; load AGENTS/Constitution/Role Matrix/charter/playbook/task files per run; ARCHITECT sequences. Reviewer and behavioral QA are **separate, independently authenticated/verifiable** actors, not invented self-approvals.
- A worker uses a **read-only GitHub checkout + task-scoped least-privilege GitHub App**; create and push draft branches through approved permissions only. GitHub Actions `pull_request` jobs never receive an AI billing key or write token, particularly because public PR code is untrusted.
- Protect staging `ewintxgdxdvschiqodkq`, never pass production `wfsfafmgvxevpzrurofz` credentials or endpoint to a worker. Do not pass service-role keys for general code tasks. Postgres writes, migration 0031, Secret/media activation, domain/Apple/SMTP setup, independent GO decisions, main merges and deployment remain gated.
- Coordinator must atomically lease at most three tasks (durable store with TTL + fencing token); allocate immutable base SHA and unique owned worktree/branch; record event IDs and idempotent state; abandon stale tasks after lease loss; apply bounded worker execution/time/token budget and kill switch.
- CI `completed` event should trigger a coordinator **reconcile**, never unrestricted auto-dispatch from untrusted PR body or workflow YAML. Avoid event-loop recursion and any path where a PR controls AI instructions/credentials.
- Every run logs a checkpoint (SHA, tree, CI URLs, actual tests, review/QA separate verdicts, rollback and next eligible task). Automatically select another independent task if required gates block the current one. No promise of unlimited background execution from ChatGPT itself.

## Test-first activation sequence (not yet performed)

1. Confirm GitHub account billing, agent-provider plan, available quota, permitted GitHub App/OIDC settings and safe account-side budget cap. Do not expose API keys in chat.
2. Independent REVIEWER/DEVOPS security assessment of the coordinator design and PR stack ancestry.
3. Configure provider identity privately with minimal GitHub permissions; do not grant service-role Supabase access.
4. Build an idempotent webhook dispatcher, durable leased queue and cloud runner image that invokes an authenticated coding agent under the approved role/task; **dry-run with simulated agent** before any billable API call.
5. Run one real bounded end-to-end pilot: claim → isolated change → real tests → draft PR → exact CI → Reviewer/QA routing → checkpoint → dispatch next unblocked task. Capture run URLs, SHA, actual cost and duration.
6. Validate duplicate events, worker crash, stale SHA, simultaneous branch conflict, lease expiry, budget exhaustion and pause. Only then permit three concurrent workers; never equate source green tests with release readiness.

## Founder actions (only at activation)

- Choose or authorize the billable coding-agent provider/plan and a **monthly spending cap** (pilot suggestion USD 25).
- Connect/authorize the provider's GitHub integration or secure managed identity when prompted, using least privileges; configure billing privately with provider, not via chat.
- Approve enabling the cloud worker after verified agent invocation and security review. **No action needed to review this preparation PR.**

## Evidence boundary

The policy and unit tests are GitHub-runner-compatible; they cannot establish an authenticated cloud AI runtime, working GitHub event wakeup, durable lease store, real three-worker concurrency or AI billing status. Keep all false until independently demonstrated. The existing hourly ChatGPT automation remains fallback. First Enhanced Beta is still **NO-GO**.
