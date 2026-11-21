# Beta integration PR lineage and overlap audit — 2026-11-21

**ROLE: ARCHITECT; BETA-P0-01 evidence only.** This is a file- and graph-level review of the current *unmerged* GitHub drafts, not a release certificate, merge instruction or independent Reviewer/QA decision. Product source is the Founder-approved master build specification; live issue #57 remains the release tracker. The first beta requires core plus Enhanced Beta; the text-first candidate is INTERNAL only.

## Observed branch state

- GitHub `main` SHA: `5f1f7ff4c8b8afa8c8e606f41c768c7c7721b613`.
- [PR #30](https://github.com/darshitmeghani1992/the-wall/pull/30) exact head `ea755876d600ca5e9b01ab0d117b5b01c5c8f41c`: **184 commits ahead** of `main`, zero behind. The REST compare returned its **300-file cap**. A separate Git tree REST walk — main tree `01026b8ee62ec476ac5f0f42344441cb78c25713` (180 entries, 151 blobs) versus #30 tree `beb3cae2151e87244d22927b8a631d821f015ea1` (473 entries, 425 blobs) — returned **`truncated=false` for both trees**. Exact path+blob SHA comparison found **276 added, 73 changed, 2 removed = 351 changed blob paths**. This closes the completeness gap in *path/blob inventory*, not semantic correctness or independently reviewed source. The two removed files were `app/write/[type].tsx` and `src/lib/pendingLink.ts`.
- Original linear release branch chain, **base branch relationship confirmed for every listed PR**: `#30 → #34 → #35 → #36 → #38 → #40 → #41 → #42 → #43 → #44 → #46 → #47 → #48 → #49 → #50 → #51 → #52 → #53 → #54 → #55 → #56 → #58`. [PR #58](https://github.com/darshitmeghani1992/the-wall/pull/58) head `4cfd9f9d2a782fc1cd956d282953e227505773d3` is **26 commits ahead** of #30 and zero behind, 61 compare-reported changed paths.
- #59 (docs) and #60 (FRONTEND Mark-detail race fix) are **sibling branches of #58**, not each other's ancestors. [PR #61](https://github.com/darshitmeghani1992/the-wall/pull/61), head `ad7ac597749c9eac67ea5131861b4d90f3492e9d`, descends from #59 and includes #60's exact `src/components/marks/MarkDetailModal.tsx` blob **`23a4e1159e258ae19a8636c2927961f75b0fab84`**. #61 is 8 commits ahead of #58, zero behind. This verifies the single integrated file, **not every behavior or all PR #60 review evidence**.
- #62 → #63 continues from #61 with media URL-policy tests. #63 head `fdf1fbbcd342100b5a958eb7af95281650b973a2`. #64 (caller-triage docs, 7 commits ahead of #63) and #65 (IPv6 transition egress implementation, 2 commits ahead of #63) are **siblings**. [PR #67](https://github.com/darshitmeghani1992/the-wall/pull/67), head `ebdf28c196a3f50e4b5218dd6038d12277d12953`, descends from #64, 11 commits ahead of #63, zero behind. #67 includes byte-identical #65 `workers/media-processor/src/url-policy.ts` blob **`88b235eb5c818b110abcd798ec63af766c1414aa`** and worker test blob **`8473f47ca63d9096ad245ec7ec7512246df9f4b5`**, checked afresh in both branches.
- #68 → #69 → #70 → #71 → #72 → #73 are linear draft **internal engineering-loop tooling** descendants of #67. #73 head `4f3ef5f15f20d0b4c79254ac967afe109ebc4272` is 46 commits ahead of #67, zero behind, 21 compare-reported modified/added files; its application blobs for MarkDetailModal and media URL policy still match #60/#65 respectively. These are not release branches to merge into `main` without separate review. #73 full CI [44885692102](https://github.com/darshitmeghani1992/the-wall/actions/runs/44885692102) and contract CI [44885692058](https://github.com/darshitmeghani1992/the-wall/actions/runs/44885692058) completed SUCCESS on the immutable head, but there are no submitted independent reviews/behavioral QA approvals.

## Known files edited by multiple historical release slices

This is a **collision watchlist**, not proof of a conflict or regression: every pair below is in the confirmed linear `#34–#58` draft release chain unless identified as a sibling integration above.

| File/area | Overlapping PRs | Reconciliation checkpoint |
|---|---|---|
| `package.json` | #34, #35, #36, #40, #41 | Preserve security override + Expo patch, native prebuild, staging/EAS checks; rerun install/typecheck/Expo Doctor/prebuild on final tree |
| `scripts/staging-preflight.mjs` | #40, #48, #55 | Preserve fail-closed staging endpoint/API and sensitive-table negative checks, not just latest intended script output |
| `scripts/validate-eas-backend.mjs` and tests | #41, #48 | Ensure EAS backend validation still rejects malformed or production project settings |
| `app/create.tsx` | #44, #52 | Media and Secret UI switches must remain OFF when hosted safety infrastructure is unverified |
| `supabase/tests/run_tests.sh` | #46, #51, #53 | Confirm 0032/0033/0034 suite inclusion, no dropped tests and real Postgres/Edge contract execution |
| `supabase/operations/secret-expiry-unschedule.sql` | #52, #53 | Preserve safe stop/rollback instructions; do not schedule Secret cron while pg_cron is absent |
| `app.json` | #48, #54 | Preserve account, icon configuration and iOS privacy manifest assertions |
| `docs/BUILD_STATUS.md` / `docs/handoffs/CURRENT.md` | #52, #59, #61, #64, #67 and later | Source of truth is current canonical queue + current handoff, not an old historical status paragraph |

## What this audit does and does not prove

**Verified:** GitHub full recursive main/#30 tree path and blob inventories (nontruncated, 351 changed blob paths), PR live base/head metadata, compare ancestry for `main→#30`, `#30→#58`, `#58→#61`, `#63→#64/#65/#67` and `#67→#73`, PR changed-filename lists for every listed release-slice PR, and three file-level blob equivalences (#60→#61, #65→#67 source/test). #73 exact-head CI is green. All PRs inspected remain **draft, open, unmerged**.

**Not verified:** complete *semantic* reconciliation of the historical `main→#30` 351 changed blob paths, independent Reviewer APPROVE/QA PASS on the unchanged integrated application tree, actual three-user JWT/HTTP permissions, SMTP delivery, iOS/Android device flows, private media worker runtime/cleanup, Secret cron/expiry, account deletion 0031 worker, release rollback. A green test does not compensate for these.

**Staging read-only refresh, 21 Nov:** `ewintxgdxdvschiqodkq` had 0 Auth users, 0 Walls, 0 Marks and 0 `mark-media` objects; `mark-media` private, `pg_cron` absent, migrations 0001–0030 plus 0032–0034 applied, 0031 withheld. Original `wfsfafmgvxevpzrurofz` not queried or changed.

## Next ARCHITECT handoff

1. Independently review #67/descendants against the watchlist **at the exact unchanged tree**, especially authentication and backend permission boundaries. The exhaustive main→#30 **path/blob** walk is complete (351 changed files), but use a source-critical code review to establish **semantic** equivalence and risks, not just file count.
2. Preserve this as *audit evidence*, not an instruction to merge #30, intermediate PRs or loop tooling drafts. Evaluate any proposed final integration only after file-level equivalence and release-branch policy review.
3. Assign BACKEND for SQL/JWT security verification and FRONTEND for remaining visible state/accessibility defects on isolated branches, then obtain independent Reviewer and QA. Issue #57 controls final GO/NO-GO. No merge, deploy, hosted migration 0031, service activation or invitations.

**Tier:** risk-aware ARCHITECT integration audit (read-only/reversible; any eventual merge, infra or authz change remains High-Risk/Two-Key). **Technical-debt delta:** semantic audit of the historical baseline's 351 changed paths and multi-host cloud coordinator still open; the recursive changed-path inventory gap is closed. **Open Founder question:** no new product decision requested by this audit; existing holds remain.
