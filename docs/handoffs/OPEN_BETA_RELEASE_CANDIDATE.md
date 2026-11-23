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
