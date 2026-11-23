## 23 Nov 2026 · Unactivated deletion worker origin fence (#210)

Source-only risk reduction in isolated draft [#210](https://github.com/darshitmeghani1992/the-wall/pull/210), BACKEND implementation under ARCHITECT sequencing, child of integrated [#209](https://github.com/darshitmeghani1992/the-wall/pull/209). The prepared service-role deletion worker now rejects any Supabase origin except approved staging before adapter use; test matrix rejects original production, foreign/suffixed hosts, scheme/port/path/query/user-info, and preserves positive exact Storage/RPC/Auth Admin requests. Source/test commit `edb1a74999927c4f568ecf5e1d19484dd5828ffe`; check final docs-head, independent CI, Reviewer and QA separately. Staging migration 0031 and irreversible purge remain fully **HELD**. No external deployment or invocation. Different public environment requires independent new approved source+runtime fence; do not promote staging-only deletion code merely by changing an environment variable. Existing beta **NO-GO**.

---

## 23 Nov 2026 · Integrated staging source candidate / independent acceptance handoff (ENG-05/06)

**ROLE: ARCHITECT** integration and sequencing; implementation ownership remains **FRONTEND** (#204, #207, #208) and **BACKEND** (#205), with independently assigned **REVIEWER** and **QA** not self-certified.

- **Immutable source checkpoint (not a released build):** [draft #208](https://github.com/darshitmeghani1992/the-wall/pull/208) at `dde8b90e08efbe04906d6f9d032f35aff4cf2332`, tree `0fc5ff3fda88ef600859b60ce2f08d217196c3d9`. The source combines [#202](https://github.com/darshitmeghani1992/the-wall/pull/202) signed-download partial-write protection with [#206](https://github.com/darshitmeghani1992/the-wall/pull/206) composer retry + identity-only, complete media downloads; [#207](https://github.com/darshitmeghani1992/the-wall/pull/207) actor/generation-scoped Discover relationship refresh; and #208 friend-request Alert -> People category. Parent ancestry checked with GitHub comparisons: #201→#206 ahead 4, #202→#206 ahead 3 (five implementation files, no disposable workflow), #206→#207 ahead 1 (Discover + test), #207→#208 ahead 1 (notification routing + test). No older draft is declared superseded or authorized for merge.
- **Observed CI:** [#206 run 45145542787](https://github.com/darshitmeghani1992/the-wall/actions/runs/45145542787) and [#207 run 45147463741](https://github.com/darshitmeghani1992/the-wall/actions/runs/45147463741) both completed with 4/4 jobs successful (typecheck/lint, Edge contracts, media, DB security). At handoff capture, [#208 run 45148328186](https://github.com/darshitmeghani1992/the-wall/actions/runs/45148328186) had 3 completed passes and media still in progress: **not certified green**. Resolve its actual final conclusion before promotion. CI success for a parent is not approval for its descendants.
- **Container proof:** [disposable #203 ARM64 proof](https://github.com/darshitmeghani1992/the-wall/actions/runs/45140284539) is separate from the candidate tree; its checkout targets exact #206 worker commit `603fed9f5f02f70cdf10407d0d714d1dcb4f699c`. The #207/#208 comparisons touch only Discover/notification files, so that *source-level worker proof* can be associated with unchanged worker bytes; it still does not produce a pinned, independently approved deployable image or prove hosted C2/C3 playback. Do **not** merge the disposable #203 workflow.
- **Distribution boundary:** existing Android internal APK build `2c6b9416` represents older #201, **not** this #208 candidate. No fresh installed Android/iOS build, signed open-beta package, real SMTP-delivered six-digit OTP or public enrollment is certified. Media, Secret, optional analytics and deletion remain disabled. Protected original Supabase `wfsfafmgvxevpzrurofz` is off limits; staging-only `ewintxgdxdvschiqodkq`.
- **Independent Reviewer intake:** inspect the complete candidate diff relative to #201 and its unmerged ancestors, #204/#205/#206 union and #203 workflow exclusion. Specifically review the composer target retry and preserved draft, worker HTTP identity/full-response enforcement and stream cancellation, Discover actor/query generation fence, notification destination. Require an explicit approval/rejection pinned to the unchanged commit/tree; do not infer approval from green CI.
- **Independent QA intake:** after authorized OTP delivery and a new pinned installed staging artifact, exercise fresh signup/onboarding, owner/accepted-member/outsider HTTP **and installed app** private Wall + text Mark journeys, invite/friend Alert to People, editing a Discover search during relationship mutation, offline composer retry with draft retention, blocked/removed-user denial, accessibility and rollback. C2/C3 photo/voice/video on actual iOS/Android, Secret reveal+one-hour scheduled expiry, and 0031 account deletion/purge remain **separate gated** acceptance suites. Preserve exact build IDs, OS/devices, HTTPS/SQL results, actor roles, runtime settings, independent verdicts, and redacted logs.
- **Next exact source command:** `git fetch origin && git checkout --detach dde8b90e08efbe04906d6f9d032f35aff4cf2332 && npm ci && npm run test:contracts && npm run typecheck && npm run lint && npm run test:worker`. Then inspect #208's final [CI run](https://github.com/darshitmeghani1992/the-wall/actions/runs/45148328186), request independent review, and prepare a new pinned staging-only EAS internal build **only via authorized build controls**. If CI or reviewer fails, fix in an isolated child and invalidate affected evidence. No main merge, hosted write, migration, worker deployment, feature enablement, purchase, or external invitation is authorized by this handoff.

**Gate: Enhanced and open beta NO-GO.** The first beta has not met its full approved acceptance criteria. Release requires separately approved public backend, sender and signup controls, installed iOS/Android QA, moderation/support, rollback, Reviewer→QA, and Founder GO; keep all scopes, staging and production boundaries unchanged.

---

## 23 Nov 2026 · C3 signed download consistency

Backend source-only isolated child of #201: reject a truncated/malformed declared Storage response and retry partial worker disk writes. New tests are not hosted playback evidence; record child CI and independent review before claiming source readiness. No promoted image from #195, deployment or runtime activation. Media OFF; public/open beta still NO-GO.

## 23 Nov 2026 · C3 image proof and staging-only runtime origin

**Verified as disposable image-build evidence, not a hosted media launch:** sibling [draft #195](https://github.com/darshitmeghani1992/the-wall/pull/195), immutable SHA `3ab84c4fd4e68e3fefe170e6a29c0e1e014d2f31`, [GitHub ARM64 image proof 45129237153](https://github.com/darshitmeghani1992/the-wall/actions/runs/45129237153) completed success. Its package tests passed 43/43 *inside the Docker build*. Runtime image smoke confirmed ARM64 architecture, non-root UID:GID 10001:10001, ffmpeg+ffprobe under no-network/read-only mode, and rejection of startup with media disabled. Temporary base digest `node@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee` and FFmpeg `7:5.1.9-0+deb12u1` were CI test inputs, **not a promoted worker image**.

**Implemented and awaiting independent review:** [draft #198](https://github.com/darshitmeghani1992/the-wall/pull/198), child of #197, locks the C3 worker entrypoint to approved staging. Valid staging still fails closed if signing configuration is absent. Separate open-beta backend origin requires a newly approved and reviewed release code/config. Source/docs final-head CI remains to be verified; #195 is a sibling and not silently merged into #198. No actual pod/container was hosted; TLS, private ingress, exact egress, writable memory-only /tmp, immutable final image, rotation, quotas, signed dispatch and actual upload/playback/cleanup are runtime gates. All client media flags remain OFF. Original production project untouched.

# Open beta candidate evidence

Record one candidate here for the first self-serve open beta. Any eligible user must be able to install through an approved channel and create an account with the complete Enhanced Beta scope in [issue #57](https://github.com/darshitmeghani1992/the-wall/issues/57). Internal staging tests prepare that candidate.

## What already ran

[Draft #193](https://github.com/darshitmeghani1992/the-wall/pull/193) at `65cd8d2fab88e3bac8e3ebb8a7b3d27b825814cb` passed [four CI jobs](https://github.com/darshitmeghani1992/the-wall/actions/runs/45126028555). The media job tested the package outside its Docker image. A verified image build and FFmpeg smoke on the image remain due. The previous staging checkpoint records zero authenticated test users, Walls, and Marks.

A local, no-network check of the candidate's EAS pre-install script accepted the approved staging origin with media, Secret, and deletion flags off. With the EAS profile set to `production`, it rejected a separate public origin and each held feature flag. The staging guard stays in place. A distinct release profile needs an approved public environment, explicit origin binding, and review. Do not use the original production project to satisfy this requirement.

## Candidate record

Fill each row using durable links to executed checks. Record synthetic fixture IDs in private QA records where needed. Keep credentials, signed media URLs, tester emails, tokens, and private user data out of this document.

| Checkpoint | Record for the release candidate |
| --- | --- |
| Source | Git commit and tree, branch, PR, resolved stacked dependencies, and successful CI run. |
| Runtime | Approved release environment identifier, ordered schema revisions, function versions, worker image digest, enabled flags, and the date last verified. |
| Distribution | EAS build ID, exact platform and build version, signing team identity, approved channel or track, and link to submission or approval status. |
| Independent review | Approver and review permalink tied to the candidate SHA, including auth, permissions, media, Secret lifecycle, and deletion. |
| Independent QA | Installed OS/device versions, build IDs, tested backend configuration, QA report, open issue links, and named release blockers. |
| Operations | Monitoring link, report/escalation owner, backups and restore evidence, rollback steps and an executed rollback rehearsal on the same environment configuration. |
| Release authority | Founder go/no-go decision and evidence that external distribution is approved for the exact build. |

## Acceptance sequence

1. **Bind the candidate.** Resolve the stacked source diffs. Build using the isolated staging profile. In parallel, confirm release origin, secure configuration ownership, approved worker host, verified email sender, distribution credentials, and reviewer/device availability. Preserve the original production project.
2. **Prove hosted journeys.** On the installed staging build, verify delivered six-digit OTP using authorized inboxes, missed/expired/resend/recovery paths, return from invite to the intended Wall, and owner/member/outsider access. Confirm private media can upload, process, play, deny unauthorized reads, and clean up on-device. Record independent evidence for Anonymous author privacy, Secret one-time reveal/expiry and removal, blocked Shared Wall leave/remove, and account deletion. Resolve failures before freezing the release build.
3. **Bind the release environment.** Confirm the signed binary uses the intended approved backend and feature configuration. Validate the open-enrollment sender and rate controls with an authorized account outside the project team. Verify moderation and support paths. Re-run affected tests after any source, build, runtime, or rollout change.
4. **Verify public availability.** After channel and Founder approvals, confirm an eligible external account can discover the distribution channel, install the expected signed build, sign up without an invitation, and complete the first-use and Wall journey. If any required evidence or approval remains open, report no-go and the exact gap.

## What can proceed in parallel

- Integration resolves and freezes one candidate and tracks source and build IDs.
- Platform prepares signed candidate profiles and distribution metadata, including privacy, support, account deletion and moderation information.
- Auth and runtime prepare the isolated release backend, verified sender, worker, limits, and monitoring. Apply hosted changes only through their authorized rollout.
- Independent Reviewer starts with security-sensitive changes and rechecks any changed candidate. Independent QA prepares devices and cases before signed artifacts are available, then records actual executed journeys.
