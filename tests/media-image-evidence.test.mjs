import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../workers/media-processor/deploy/build-image-evidence.sh', import.meta.url));
const sha = 'a'.repeat(40);
const digest = 'node@sha256:' + 'b'.repeat(64);
test('local image evidence helper has valid bash syntax', () => {
  const result = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
for (const [name, args, message] of [
  ['missing args', [], 'Usage:'],
  ['short source SHA', ['abc', digest, '7:5.1.9-0+deb12u1', '/tmp'], 'Exact full source SHA required'],
  ['mutable base tag', [sha, 'node:22-bookworm-slim', '7:5.1.9-0+deb12u1', '/tmp'], 'Immutable Node image digest required'],
  ['shell-like package argument', [sha, digest, '7;echo bad', '/tmp'], 'Exact FFmpeg package version required'],
]) {
  test('image evidence refuses ' + name + ' before Docker', () => {
    const result = spawnSync('bash', [script, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, new RegExp(message));
  });
}

test('local image evidence uses the build invocation ID rather than a shared mutable tag', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /--iidfile "\$out\/build-image-id\.txt"/);
  assert.match(source, /image=\$\(cat "\$out\/build-image-id\.txt"\)/);
  assert.match(source, /docker image inspect --format '\{\{\.Id\}\}' "\$image"/);
  assert.doesNotMatch(source, /--tag\s|docker image inspect[^\n]*"\$tag"/);
  assert.match(source, /docker save "\$image" -o "\$out\/image\.tar"/);
});
