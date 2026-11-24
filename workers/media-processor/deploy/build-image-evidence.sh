#!/usr/bin/env bash
# Local ARM64 evidence bundle only. No registry push, backend access or deployment.
set -euo pipefail
umask 077
die() { printf '%s\n' "$*" >&2; exit 1; }
[[ $# -eq 4 ]] || die "Usage: bash build-image-evidence.sh EXACT_SOURCE_SHA NODE_DIGEST FFMPEG_VERSION OUTPUT_PARENT"
expected=$1
base_image=$2
ffmpeg_version=$3
output_parent=$4
[[ "$expected" =~ ^[a-f0-9]{40}$ ]] || die "Exact full source SHA required"
[[ "$base_image" =~ ^(docker.io/library/)?node@sha256:[a-f0-9]{64}$ ]] || die "Immutable Node image digest required"
[[ "$ffmpeg_version" =~ ^[0-9][a-zA-Z0-9.+:~_-]*$ ]] || die "Exact FFmpeg package version required"
[[ "$(uname -m)" == aarch64 ]] || die "Native ARM64 host required"
root=$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)
[[ "$(git -C "$root" rev-parse HEAD)" == "$expected" ]] || die "Source SHA mismatch"
[[ -z "$(git -C "$root" status --porcelain --untracked-files=all)" ]] || die "Source checkout must be clean"
[[ -d "$output_parent" ]] || die "Existing output parent required"
output_parent=$(cd "$output_parent" && pwd -P)
root=$(cd "$root" && pwd -P)
case "$output_parent/" in "$root/"*) die "Evidence output must be outside checkout";; esac
out=$(mktemp -d "$output_parent/the-wall-media-evidence.XXXXXXXX")
# Build only tracked files from the exact commit: ignored local secrets or stale
# generated files must never enter the Docker context.
context=$(mktemp -d "$out/context.XXXXXXXX")
trap 'rm -rf -- "$context"' EXIT
git -C "$root" archive "$expected" workers/media-processor | tar -x -C "$context"
cd "$context/workers/media-processor"
printf 'source=%s\nbase=%s\nffmpeg=%s\n' "$expected" "$base_image" "$ffmpeg_version" > "$out/inputs.txt"
# The build invocation itself records the immutable local image ID. Resolving
# a shared tag after build could pick up a concurrent build of the same source
# using different package pins. Do not create or resolve a mutable tag.
docker build --platform linux/arm64 --build-arg "BASE_IMAGE=$base_image" \
  --build-arg "FFMPEG_PACKAGE_VERSION=$ffmpeg_version" \
  --label "org.opencontainers.image.revision=$expected" \
  --iidfile "$out/build-image-id.txt" . 2>&1 | tee "$out/build.log"
image=$(cat "$out/build-image-id.txt")
[[ "$image" =~ ^sha256:[a-f0-9]{64}$ ]] || die "Image ID missing"
test "$(docker image inspect --format '{{.Id}}' "$image")" = "$image"
test "$(docker image inspect --format '{{.Architecture}}' "$image")" = arm64
test "$(docker image inspect --format '{{.Config.User}}' "$image")" = 10001:10001
test "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")" = "$expected"
printf '%s\n' "$image" > "$out/image-config-id.txt"
limits=(--network none --read-only --security-opt no-new-privileges:true
  --security-opt "seccomp=deploy/seccomp.json" --cap-drop ALL --cpus 2
  --memory 1g --pids-limit 64
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=512m,mode=0700,uid=10001,gid=10001)
timeout 20s docker run --rm "${limits[@]}" --entrypoint sh "$image" -ec \
  'test "$(id -u):$(id -g)" = 10001:10001; test "$(stat -c "%u:%g %a" /tmp)" = "10001:10001 700"; p=$(mktemp -d /tmp/preflight.XXXXXX); rmdir "$p"; ffmpeg -version; ffprobe -version' \
  2>&1 | tee "$out/runtime-preflight.log"
timeout 180s docker run --rm "${limits[@]}" --entrypoint sh "$image" -ec \
  'node --test --test-concurrency=1 dist/test/*.test.js' 2>&1 | tee "$out/worker-tests.log"
set +e
timeout 20s docker run --rm "${limits[@]}" "$image" > "$out/disabled-startup.log" 2>&1
status=$?
set -e
test "$status" -eq 1
grep -Fxq 'media runtime unavailable; check approved deployment configuration' "$out/disabled-startup.log"
# Inventory is supplemental, explicitly not a complete SBOM or vulnerability scan.
docker run --rm "${limits[@]}" --entrypoint dpkg-query "$image" -W \
  > "$out/os-packages.txt"
docker image inspect "$image" > "$out/image-inspect.json"
docker save "$image" -o "$out/image.tar"
(cd "$out"; sha256sum image.tar > image.tar.sha256)
printf '%s\n' 'LOCAL TEST EVIDENCE ONLY; SBOM, high/critical CVE review, registry manifest digest, independent review and hosted QA NOT VERIFIED.' > "$out/STATUS.txt"
printf 'Local evidence bundle: %s\n' "$out"
