# Free-first autonomous engineering: zero-charge preparation (2026-11-21)

**Role boundary:** ARCHITECT sequencing; DEVOPS-designated CI/tooling preparation. Founder asked to carry out everything possible without payment. This branch is descendant of cloud prep draft PR #69; no older draft or internal beta candidate may be bypassed.

## What is already implemented

- Existing `docs/BUILD_STATUS.md` remains the canonical resumable queue; `scripts/engineering_loop_v2.py` only selects task candidates and caps at three.
- `config/engineering-cloud-v2.json` remains intentionally `enabled=false`, agent `unconfigured`, financial allowance USD 0, no Supabase hosted write, no production deploy, no merges.
- `scripts/free_worker_preflight.py` validates all of those conditions and rejects production project IDs. Adversarial unit tests verify fail-closed behavior.
- `.github/workflows/free-worker-smoke.yml` is a **manual-only**, least-privilege, no-secret, read-only `workflow_dispatch` smoke on GitHub's public-repository standard `ubuntu-latest`; it runs the preflight and unit checks and prints eligible tasks in dry-run mode. There is no model invocation, self-editing agent, automatic branch write or payment.

## Verified provider facts and limitations

- GitHub states standard GitHub-hosted runners are free/unlimited for **public repositories**: https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job. The-Wall's GitHub repository currently has public visibility. This status could change.
- Gemini API documentation includes eligible free-tier models, with quotas depending on the account, model and region. Free-tier content **may be used to improve provider products**. Public app source is visible already, but never transmit secrets, customer data, authorized tokens, private design data or staging credentials in agent prompts: https://ai.google.dev/gemini-api/docs/pricing
- Gemini CLI's headless execution requires an existing credential or the user/provider to configure `GEMINI_API_KEY` (or supported Vertex authentication): https://google-gemini.github.io/gemini-cli/docs/get-started/authentication.html. **No credential is stored in this PR, and no free quota is assumed.**
- A free-tier API key is not an enforceable **financial** cap if its billing status is unknown. The prospective integration must prove that the selected project has **billing disabled/free entitlement**, not merely trust pricing labels. Do not automatically fall back to paid endpoints.
- Running a cloud checkout does not itself create a coding agent. A real, authenticated coding runtime plus reviewed task/permission isolation and dispatch/lease code is still missing. A free model may throttle or stop, so uninterrupted three-worker work cannot be promised.

## Founder action eventually required (not requested in chat now)

A Google AI Studio account owner must explicitly establish that a free-tier model and API access are available without enabling billing, then configure an API key through an authorized secure secret entry method. The key must never appear in chat, PR, commit, or job logs. Google account authorization cannot be carried out by this repository code. If free-tier access is unavailable, continue safe hourly execution rather than activating charges.

## Next implementation stages — no user action for documentation/tests

1. Independent security/DEVOPS review of this isolated draft, verifying no prompt injection from GitHub issue/PR/task text can manipulate agent permissions.
2. Build lease controller with atomic three-worker cap, per-branch ownership, fencing tokens, idempotent webhook events, stale SHA rejection, bounded invocations, and kill switch. No CI PR untrusted context receives AI credentials.
3. Add version-pinned Gemini execution adapter after confirming exact compatible CLI binary and approved free-tier-only account environment. Account-side secret entry is an unavoidable external dependency.
4. Validate simulated task-to-task dispatch, duplicate events, CI-failure repair routing, Review/QA separation, reboot and free-quota exhaustion before any live coding.
5. One true authorized agent pilot on nonprotected change; capture actual provider usage/quota, source SHA, CI, independent Reviewer and QA evidence, and automatic second task dispatch. Only then consider scaling to three.
6. Enhanced Beta release remains **NO-GO**. Existing Founder holds for domain/DNS, Apple, SMTP; media/Secret/analytics remain OFF; staging `ewintxgdxdvschiqodkq` only and original production `wfsfafmgvxevpzrurofz` protected.

## Exact preparation checks

```bash
python3 scripts/free_worker_preflight.py
python3 -m unittest discover -s scripts/tests -p 'test_free_worker_preflight.py' -v
python3 -m unittest discover -s scripts/tests -p 'test_engineering_*v2.py' -v
python3 scripts/engineering_loop_v2.py --workers 1
```

The GitHub manual smoke is intentionally disabled as a recurring agent. No charge, agent invocation, credential collection, or release is claimed.
