# Continuous Engineering Loop v2.0 — approved foundation (2026-11-21)

**ROLE: ARCHITECT.** Founder approved at most three simultaneous implementation workers, autonomous coding/testing/draft PRs, staging-only and all existing Founder/Reviewer/QA gates. The approval authorizes building the orchestration system; it is **not** approval to merge, deploy, activate unverified features, migrate 0031, invite testers, purchase domain, enroll Apple or write production.

## Status: foundation only — external runtime NOT VERIFIED

- Current isolated branch: `codex/continuous-loop-v2-foundation-20261121`, descendant of internal draft candidate PR #67 head `ebdf28c196a3f50e4b5218dd6038d12277d12953`. Do not modify #67 or claim it superseded.
- `scripts/engineering_loop_v2.py` parses **the existing** `docs/BUILD_STATUS.md` as canonical source, filters blocked or protected work, enforces a hard maximum of three explicit BACKEND/FRONTEND assignments, excludes Reviewer/QA self-approval, and produces **dry-run JSON only**.
- `scripts/tests/test_engineering_loop_v2.py` checks limit, active-lease exclusion, gated work and parsing. The isolated workflow `.github/workflows/engineering-loop-contracts.yml` runs these without external credentials, mutation, or privileged permissions.
- **Read-only environment probe:** Authorized Mac device `Darshits-MacBook-Pro.local` online, macOS **11.7.11**, Node **22.23.1**, repo at `/Users/Darshit/Projects/the-wall`, pre-existing current branch `codex/apple-submission-data-audit-2026-11` clean. No local branch was modified. `/usr/local/bin/claude --version` crashed at dynamic loader (`std::__1::basic_stringbuf` unavailable; CLI built for macOS 13). No `codex` or `gh` executable found on PATH. This cannot be called an operational coding worker. Do not install/upgrade software or attempt login without a separate safe setup path.
- No independent worker spawned, no scheduled or webhook-driven continuous execution verified. Existing hourly automation stays the fallback; no automation reschedule/disable implied.

## Required before activation

1. **DEVOPS/authorized infrastructure implementation**, on a separate branch: select a supported external coding-agent host compatible with its OS/runtime; connect through approved managed identity (never hardcode or print keys); prevent access to production Supabase; document costs and interruption behavior. The local Mac's broken CLI is not a viable worker.
2. Implement **durable leases with atomic claim and TTL**, idempotent GitHub webhook/poll handling, no concurrent branch edits, max-three active implementation workers, lock expiry and crash recovery. Avoid writing lease state to protected release branches or treating Markdown as a concurrent database.
3. Configure coding-agent worker invocation with an explicit task, role charter/playbook, isolated clone/worktree/branch, bounded budget and timeout, allowlisted changes, protected operations hard-failed, no automatic merges/deploys. **Do not assume the present dry-run script invokes an agent.**
4. Verify one real full cycle: select queue item → lease → code/test change → commit → draft PR → required CI → independent Reviewer and behavioral QA routing → evidence checkpoint → automatically claim next eligible task **without an hourly wait**. Capture exact SHAs, job URLs and timestamps; use a disposable work item and no staging writes for first verification.
5. Load test three parallel nonoverlapping tasks, branch conflict protection, duplicate event, worker crash, stale checks and fail-closed blocked queue before enabling sustained execution.
6. Preserve issue #57 as release tracker and all existing gates. Internal text-first is not first Enhanced Beta GO; media/Secret/analytics OFF; 0031 and hosted writes gated; domain/Apple held; SMTP six-digit OTP still mandatory.

## Operational contract

Always refresh GitHub/CI and the task queue, confirm immutable source ancestry (PR #30, stacked drafts and newer), and resume the highest unblocked task. A task can be marked deployment-ready **only** on unchanged source with applicable CI, independent Reviewer APPROVE, independent QA PASS, staging/security/device evidence and rollback. A running subprocess is not proof of a successful coding-agent execution.

## Exact next task

**ROLE: DEVOPS for implementation** (or another explicitly charter-authorized infrastructure implementation role): repair/provision external coding-agent runtime, then wire durable leases/event-driven dispatch and execute one real end-to-end dry-run safely. **ROLE: ARCHITECT** validates architecture and records decisions; BACKEND/FRONTEND code tasks remain explicitly assigned. Run `python3 -m unittest discover -s scripts/tests -p 'test_engineering_loop_v2.py' -v` and `python3 scripts/engineering_loop_v2.py --workers 3` before accepting the foundation. Independently verify CI on this exact PR SHA.
