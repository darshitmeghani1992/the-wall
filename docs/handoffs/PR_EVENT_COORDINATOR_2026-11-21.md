# The-Wall native PR-event coordinator (draft, activation gated)

Requested: 21 November 2026. Repository `darshitmeghani1992/the-wall`. Canonical queue: [issue #57](https://github.com/darshitmeghani1992/the-wall/issues/57) and `docs/BUILD_STATUS.md`.

## Configuration

Workflow: `.github/workflows/the-wall-pr-event-coordination.yml`.

**Exact native GitHub triggers:**
- `pull_request_target`: `opened`, `reopened`, `synchronize`, `edited`, `ready_for_review`, `converted_to_draft`, `closed`.
- `pull_request_review`: `submitted`, `edited`, `dismissed`.
- `pull_request_review_comment`: `created`, `edited`, `deleted`.

This is **event-driven** (no `schedule`, `cron`, `workflow_dispatch` or timer). GitHub Actions starts workflows with these triggers only **after the file exists on the default branch**. This PR is intentionally a draft: merging or activating is **not authorized here**. Existing hourly engineering execution remains separate and unchanged.

Coordinator jobs: `concurrency.group=the-wall-pr-event-coordinator`, `cancel-in-progress=false`, `timeout-minutes=5`. Only **one coordination worker**, maximum three implementation workers a future separate reviewed architecture may allow; this workflow launches **zero implementation workers** and does not dispatch Codex.

GitHub native API only, using the ephemeral `GITHUB_TOKEN`. **No paid model API, no Codex credit usage, no secrets, no hosted DB or service calls.** GitHub-hosted Actions runner minutes may have usage limits and billing depending on the account; check included minutes before activation to enforce the user's no-extra-credits constraint.

Permissions: `contents:read`, `pull-requests:read`, `checks:read`, `actions:read`, `issues:write`. It never checks out or executes untrusted PR code, and makes **no repository branch edits, merges or deployments**. Writes one bounded, marked status comment on issue #57, updating only a prior bot-owned comment with the same marker, and avoiding duplicate content. It checks current PR SHA and CI checks on that SHA, latest review states and branch/dependency hints; the next queue item is explicitly a *candidate to verify*, not falsely asserted unblocked.

The existing Work/Codex execution task retains implementation ownership, lease discipline and AIOS role gates. Direct authenticated Codex Cloud task dispatch was **not discovered** and must not be claimed. Original production Supabase `wfsfafmgvxevpzrurofz` is forbidden; staging `ewintxgdxdvschiqodkq` only where separately authorized. No hosted migrations, paid API, extra credits, merge, release or deployment.

## Before activation (Founder/Reviewer/QA gate)

1. Independent security review the `pull_request_target` trust boundary and fine-grained `issues:write` token permissions on exact workflow SHA.
2. Verify GitHub Actions hosted minutes stay within the user's authorized included quota; otherwise provide an approved zero-billing environment before activation.
3. Test synthetic PR update/review events on a disposable repo/fork with issue #57 analogue; verify idempotence and that no PR branch is modified.
4. Obtain independent Reviewer APPROVE and QA PASS for identical SHA/tree. Founder explicitly approves merge to the default branch; **do not auto-merge**.
5. After activation, observe a real `opened` or `synchronize` trigger and confirm one issue #57 bot checkpoint; verify no Codex task was dispatched.
