import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const policy = readFileSync(new URL('../workers/media-processor/deploy/container-policy.yaml', import.meta.url), 'utf8');
const dockerfile = readFileSync(new URL('../workers/media-processor/Dockerfile', import.meta.url), 'utf8');
const handoff = readFileSync(new URL('../workers/media-processor/README.md', import.meta.url), 'utf8');

function tmpfsBlock(source) {
  const match = source.match(/^    jobTmpfs:\n((?:^      [^\n]+\n)+)/m);
  assert.ok(match, 'media sandbox must define the job tmpfs');
  return match[1];
}

test('media processor temp sandbox is writable only by its unprivileged runtime identity', () => {
  const tmpfs = tmpfsBlock(policy);
  assert.match(dockerfile, /^USER 10001:10001$/m, 'runtime must remain non-root');
  assert.match(policy, /^    runAsUser: 10001$/m);
  assert.match(policy, /^    runAsGroup: 10001$/m);
  assert.match(tmpfs, /^      mountPath: \/tmp$/m);
  assert.match(tmpfs, /^      sizeLimit: 512Mi$/m);
  assert.match(tmpfs, /^      mode: "0700"$/m);
  assert.match(tmpfs, /^      ownerUid: 10001$/m);
  assert.match(tmpfs, /^      ownerGid: 10001$/m);
  assert.match(policy, /^    readOnlyRootFilesystem: true$/m);
  assert.match(policy, /^    allowPrivilegeEscalation: false$/m);
  assert.match(policy, /^    defaultDenyEgress: true$/m);
});

test('operator handoff requires checking writable /tmp before accepting protected media jobs', () => {
  assert.match(handoff, /Before enabling ingress, run this check/);
  assert.match(handoff, /stat -c '%u:%g %a' \/tmp/);
  assert.match(handoff, /mktemp -d \/tmp\/the-wall-media-preflight/);
  assert.match(handoff, /not iOS\/Android playback certification/);
  assert.match(handoff, /declarative handoff, not a deployable/);
});
