import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const script = new URL('../scripts/validate-eas-backend.mjs', import.meta.url);

function run(url, key = 'publishable-test-value') {
  const env = { ...process.env };
  delete env.EXPO_PUBLIC_SUPABASE_URL;
  delete env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (url !== undefined) env.EXPO_PUBLIC_SUPABASE_URL = url;
  if (key !== undefined) env.EXPO_PUBLIC_SUPABASE_ANON_KEY = key;
  return spawnSync(process.execPath, [script.pathname], { env, encoding: 'utf8', timeout: 5000 });
}

test('EAS guard accepts HTTPS Supabase project origin', () => {
  const result = run('https://project-id.supabase.co');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /valid HTTPS project origin/);
});

test('EAS guard rejects incorrectly suffixed REST endpoint', () => {
  const result = run('https://project-id.supabase.co/rest/v1/');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /EAS build blocked/);
});

test('EAS guard rejects missing URL or key', () => {
  assert.equal(run(undefined).status, 1);
  assert.equal(run('https://project-id.supabase.co', '').status, 1);
});

test('EAS guard never prints configured keys or URLs, even if credentials are in the URL', () => {
  const secret = 'do-not-print-this-credential';
  const address = `https://user:${secret}@project-id.supabase.co/path`;
  const result = run(address, secret);
  assert.equal(result.status, 1);
  assert.equal((result.stdout + result.stderr).includes(secret), false);
  assert.equal((result.stdout + result.stderr).includes(address), false);
});

test('EAS guard rejects insecure HTTP and query-bearing origins', () => {
  assert.equal(run('http://project-id.supabase.co').status, 1);
  assert.equal(run('https://project-id.supabase.co?token=bad').status, 1);
});
