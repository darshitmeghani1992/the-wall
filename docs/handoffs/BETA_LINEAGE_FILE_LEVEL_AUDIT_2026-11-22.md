# The-Wall — first-beta stacked lineage and file-level audit (preparation only)

**Recorded:** 22 November 2026 · **Role:** ARCHITECT integration/sequencing · **Release tracker:** [#57](https://github.com/darshitmeghani1992/the-wall/issues/57)
**Verdict:** **NO-GO.** This is a read-only GitHub diff/ancestry audit and safe integration plan, **not** independent Reviewer approval, QA, certification, authorization to merge, or proof of working hosted/devices.
**Staging only:** `ewintxgdxdvschiqodkq`; original production `wfsfafmgvxevpzrurofz` never touched.

## Git evidence — immutable heads at audit

| Range | GitHub compare status | Ahead / behind | Files returned | File-level interpretation |
|---|---|---:|---:|---|
| `main..#30` (`ea755876d600ca5e9b01ab0d117b5b01c5c8f41c`) | ahead | +184 / 0 | 300 (API listing cap; **not exhaustive**) | The #30 source incorporates the historical integrated app beyond main; do not discard it |
| `#30..#56` (`3684763f13b798c430e9576fcbc26f0834456a4e`) | ahead | +22 / 0 | 58 | Later Expo/build, auth, private-media rollout, staging audit and privacy changes extend—not replace—the base |
| `#56..#59` (`87f7a1b6fef7681ca8860e21a457b31635485309`) | ahead | +9 / 0 | 6 | Introduces Mark confirmation source/test and core queue/handoff edits |
| `#59..#149` (`00f3afc918e43f46b0af316ac9cb8469ca0a7632`) | ahead | +154 / 0 | 118 | Subsequent app race/privacy, security/source tests, release docs and auth callback changes build on #59 |
| `main..#149` (same SHA) | ahead | +369 / 0 | 300 (API listing cap; **not exhaustive**) | Main has no unique commits missing from this candidate in the compare; **not** proof that future merge is safe |

At read time `main` was `5f1f7ff4c8b8afa8c8e606f41c768c7c7721b613`. The `#149` head is an **unmerged draft**, **not** a release SHA. The source and documentation on this audit branch are a separate descendant and must be checked at their own immutable head.

### Confirmed per-PR branch dependency chain

GitHub Pull Request metadata establishes consecutive parent-head links in this segment (each PR's `base.sha` equals the preceding PR's `head.sha`):

`#30 → #34 → #35 → #36 → #38 → #40 → #41 → #42 → #43 → #44 → #46 → #47 → #48 → #49 → #50 → #51 → #52 → #53 → #54 → #55 → #56 → #58 → #59`.

Numbers #37, #39 and #45 are **not Pull Requests** in the checked API; #39 and #45 are open beta blocker **issues** and must not be treated as absent code. #30 targets `codex/integrated-mvp-resume` rather than main. Do **not** retarget, cherry-pick, squash, close or merge any portion of this stack solely on the basis of its number or a newer draft; preserve it pending file-level equivalence and independent acceptance.

The newest checked continuation has `#147` at `ebe59ab34fcac7b7bd64981ce0c00ed60e9432b2` → `#148` exact base SHA `ebe59...`, head `747ca1e50194a6373645abdca990912226211b97` → `#149` exact base `747ca1...`, head `00f3afc918e43f46b0af316ac9cb8469ca0a7632`. The range `#59..#149` is strict descendant per GitHub compare, but individual PRs #60–#146 need reviewer-level per-file/behavioral comparison before any readiness declaration.

## Actual cross-segment file overlap and non-discard rules

| Critical surface | Source evidence | Required integration/reviewer action |
|---|---|---|
| `app/(onboarding)/sign-in.tsx` | Modified in #30..#56 and again in #59..#149 | Preserve OAuth provider capability gates and immutable six-digit OTP challenge email. Independent slow-delivery, resend, account/route and genuine inbox testing |
| `app/create.tsx`, `app/delete-account.tsx` | Modified in **both** #30..#56 and #59..#149 | Reconcile Mark editor media/Secret flags, posting races, irreversible deletion confirmation. Never assume newer frontend code substitutes for backend migration 0031 |
| `app/auth/callback.tsx` | Found in #30 inherited app and changed again in #59..#149 | Review #148 returned exchange-error check and #149 explicit OAuth denial + retry as a *single* unchanged candidate; test real deep links and existing-session failure |
| `app/(tabs)/home.tsx`, `alerts.tsx`, `discover.tsx`, `profile.tsx`, Shared Wall screens | Implemented in #30 integration; broad subsequent edits in #59..#149 | Verify account-switch privacy, author/member permissions, Alerts, offline/retry and visual behavior together on installed builds |
| `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `app.json` | Present in #30 integration and changed in #30..#56 | Preserve installed Expo/toolchain, security fixes and exact required CI jobs. Run package-defined typecheck, lint, contracts, Expo Doctor, disposable iOS prebuild, Android/iOS export as appropriate |
| `docs/BUILD_STATUS.md`, `docs/handoffs/CURRENT.md` | Modified in **all** checked forward segments | The queue and history are cumulative; documentation overlaps require explicit reconciliation, not "latest file wins" or deletion of old approved milestones |

This list is **targeted**, not exhaustive; GitHub compare caps the large `main` file listing. Before an eventual integration, independently inspect individual historical PR patches and tests for cross-file functional conflicts. A linear Git ancestor relationship does **not** by itself validate product acceptance, data migrations, device performance or security.

## Runtime evidence vs blocked certification

Read-only Supabase check on 22 Nov 2026: staging `ACTIVE_HEALTHY`; 35 public tables, 0 without RLS; private `mark-media` bucket; 0 Auth users/profiles/Walls/Marks; no `pg_cron`; no account-deletion RPC. Migration history contains 0001–0030 and 0032–0034; 0031 intentionally withheld. No email or token testing was attempted; no hosted writes, migrations or production actions occurred.

Parent PR #148 exact `747ca1e50194a6373645abdca990912226211b97` has four successful GitHub jobs, **without** independent Reviewer or QA. PR #149 source/doc SHA `00f3afc918e43f46b0af316ac9cb8469ca0a7632` was still running some CI jobs when this audit started. Neither is automatically ready for deployment. Source-level frontend contract tests are not substitute for real OAuth/OTP, RLS/JWT negative API behavior or installed-device QA.

## Safe next integration sequence (future; no action authorized here)

1. Freeze one exact candidate ref and tree after queued source repairs; compare to `main` and the entire approved PR ancestry; check PR review/CI status at that exact head, and enumerate protected/missing non-document paths across every original PR patch.
2. Route security-sensitive diffs to an independent REVIEWER; separately obtain independent QA on the **same unchanged candidate** for three authenticated new/member/unrelated-blocked actors, session recovery, walls, text Mark mutations, Alerts/Discover/report/block/logout and HTTP JWT-negative tests. SQL `SET ROLE` tests are separate evidence. Include Shared Wall `INSERT RETURNING` and SECURITY DEFINER caller-grant review.
3. Maintain server/client gates OFF for private photo/voice/video processing and Secret until tested C2/C3 signing, quotas, cleanup, actual playback and Secret one-hour scheduler; keep deletion migration 0031 and purge worker behind Founder/legal/Reviewer/QA approval. Internal text-first candidate #57 is **not** a substitute for complete Enhanced Beta.
4. Only after the gates, independently exercise release artifact, offline/retry/accessibility, rollback and disable controls. No main merge, hosted deployment, tester invite, domain/DNS purchase, Apple signing/TestFlight or changes to original production during this preparation.

**Resume:** from canonical `docs/BUILD_STATUS.md`, `docs/handoffs/CURRENT.md` and [#57](https://github.com/darshitmeghani1992/the-wall/issues/57). Check the exact #149 and audit-descendant CI SHAs; independent Reviewer/QA needed. This document does not claim any feature is finished merely because its draft has green tests.
