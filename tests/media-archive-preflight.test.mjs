import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const verifier = fileURLToPath(new URL('../workers/media-processor/deploy/verify-image-evidence.py', import.meta.url));
const fixture = String.raw`
import hashlib, io, json, pathlib, sys, tarfile
p = pathlib.Path(sys.argv[1])
scenario = sys.argv[2]
sha = "a" * 40
labels = {"org.opencontainers.image.revision": "b" * 40 if scenario == "revision" else sha}
config = {"architecture": "arm64", "os": "linux", "config": {"User": "10001:10001", "Labels": labels}, "rootfs": {"diff_ids": ["sha256:" + "c"*64]}}
raw = json.dumps(config).encode()
identity = "sha256:" + hashlib.sha256(raw).hexdigest()
if scenario == "identity":
    identity = "sha256:" + "d"*64
manifest = [{"Config": "config.json", "Layers": ["layer.tar"]}]
if scenario == "multiple":
    manifest *= 2
with tarfile.open(p / "image.tar", "w") as archive:
    for name, data in [("config.json", raw), ("manifest.json", json.dumps(manifest).encode()), ("layer.tar", b"test layer")]:
        member = tarfile.TarInfo(name)
        member.size = len(data)
        archive.addfile(member, io.BytesIO(data))
    if scenario == "duplicate":
        member = tarfile.TarInfo("config.json")
        member.size = len(raw)
        archive.addfile(member, io.BytesIO(raw))
checksum = hashlib.sha256((p / "image.tar").read_bytes()).hexdigest()
(p / "image.tar.sha256").write_text(checksum + "  image.tar\n")
(p / "image-config-id.txt").write_text(identity + "\n")
(p / "build-image-id.txt").write_text(identity + "\n")
(p / "image-inspect.json").write_text(json.dumps([{"Id": identity, "Architecture": "arm64", "Os": "linux", "Config": {"User": "10001:10001", "Labels": labels}}]))
if scenario == "tamper":
    with (p / "image.tar").open("ab") as stream:
        stream.write(b"tamper")
`;
for (const [scenario, expectedError] of [
  ['valid', null],
  ['tamper', 'Archive checksum mismatch'],
  ['identity', 'Archived config digest mismatch'],
  ['revision', 'Archived source revision mismatch'],
  ['multiple', 'Expected exactly one archived image'],
  ['duplicate', 'Duplicate archive member'],
]) {
  test('local media archive preflight: ' + scenario, () => {
    const dir = mkdtempSync(join(tmpdir(), 'tw-image-preflight-'));
    try {
      const setup = spawnSync('python3', ['-c', fixture, dir, scenario], { encoding: 'utf8' });
      assert.equal(setup.status, 0, setup.stderr);
      const result = spawnSync('python3', [verifier, dir, 'a'.repeat(40)], { encoding: 'utf8' });
      if (expectedError) {
        assert.equal(result.status, 1, result.stderr);
        assert.ok(result.stderr.includes(expectedError), result.stderr);
        assert.equal(result.stdout, '');
      } else {
        assert.equal(result.status, 0, result.stderr);
        assert.equal(JSON.parse(result.stdout).status, 'LOCAL_IDENTITY_PREFLIGHT_ONLY');
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}
