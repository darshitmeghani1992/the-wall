/**
 * Verify the native iOS project can be generated without mutating the checkout.
 * Requires npm ci beforehand. This is *not* a signed Xcode/device build.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'the-wall-ios-prebuild-'));
const ignored = new Set(['node_modules', '.git', '.expo', '.local-test-results', 'ios', 'android']);
try {
  fs.cpSync(root, temp, {
    recursive: true,
    filter: (source) => source === root || !ignored.has(path.basename(source))
  });
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(temp, 'node_modules'), 'dir');
  const expo = path.join(root, 'node_modules', '.bin', 'expo');
  const result = spawnSync(expo, ['prebuild', '--platform', 'ios', '--no-install'], {
    cwd: temp,
    encoding: 'utf8',
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(`Expo iOS prebuild failed (exit ${result.status})`);
  }
  const ios = path.join(temp, 'ios');
  if (!fs.existsSync(path.join(ios, 'Podfile')) ||
      !fs.readdirSync(ios).some((name) => name.endsWith('.xcodeproj'))) {
    throw new Error('iOS prebuild completed without its Podfile or Xcode project');
  }
  console.log('Verified: disposable iOS prebuild produces Podfile and Xcode project.');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
