# Local ARM64 media image evidence — held, not a deployment

BACKEND local build artifact under the existing C3 contract and container-policy.yaml. Run only in an authorized disposable ARM64 checkout; no registry, cloud, service keys, hosted calls, DNS or feature flags. The prior #262 container proof used base `node@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee` and FFmpeg `7:5.1.9-0+deb12u1` (run 45239446961). Those are historical **test** pins, not approved deployment pins.

From an exact clean candidate checkout containing this helper, with Docker and standard Linux tools already installed:

```sh
bash workers/media-processor/deploy/build-image-evidence.sh \
  "$(git rev-parse HEAD)" "$REVIEWED_NODE_DIGEST" "$REVIEWED_FFMPEG_VERSION" /tmp
```

Use reviewed explicit pin values, not a mutable tag or automatically selected apt candidate. The helper archives only tracked worker source, runs the existing Dockerfile and constrained tests, checks fail-closed startup, and saves the exact local tested image by configuration ID with an archive checksum. A failed build/test creates no success status. The output is local and private. No image push is implemented. A local config ID / Docker archive checksum is **not** a registry manifest digest; the apt transitive package set can change between builds. The package inventory is not a complete SBOM.

Before staging can use an image, authorized DevOps and independent Reviewer must: review the Dockerfile and all resolved dependencies; generate a complete SBOM and scan the exact tested image with an approved scanner and current vulnerability database; resolve or block HIGH/CRITICAL findings per container-policy; record scanner identity/version/database date and reports tied to the image; pin the resulting approved registry manifest digest and verify identity on the staging host. No scanner provider or registry authorization is assumed here. Never ship the evidence archive to an unapproved service. Enforce the existing default-deny egress, private ingress and runtime policy separately. Validate signed C2/C3 dispatch, Storage URL binding, real upload/playback, cleanup and three distinct authorized actors independently. Feature gates stay OFF until approved.

Rollback: if any build evidence, digest, scan or hosted health check fails, withhold the image; do not enable ingress/media. If a later authorized deployment fails, use the separately approved disable/rollback sequence and preserve evidence. No action against the protected original production environment.

## Offline scan input preflight

Before handing a private evidence bundle to the already-approved local scanner, run with Python 3 (standard library only):

```sh
python3 workers/media-processor/deploy/verify-image-evidence.py "$EVIDENCE_DIR" "$EXACT_TESTED_SOURCE_SHA"
```

The preflight checks the archive checksum, raw Docker config digest, one-image manifest, recorded build/inspect IDs, ARM64/Linux platform, runtime user and source revision. It checks referenced layers exist, not their unpacked content digests. Run on a private, unchanged bundle; neither the checksum nor this utility authenticates an untrusted bundle or replaces the independently witnessed build. No extraction, Docker load, network access or scanner invocation is performed. Keep the bundle unchanged through the approved scan, compare loaded image identity, record fresh scanner/DB metadata, and do not interpret the preflight as a scan, SBOM, provenance attestation or release clearance.
