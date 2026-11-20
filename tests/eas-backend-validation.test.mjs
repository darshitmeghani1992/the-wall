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

function fakeLegacyAnonKey(ref, role = 'anon') {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ref, role })).toString('base64url');
  return `${header}.${body}.test-signature`;
}

test('EAS guard accepts matching legacy anonymous key project ref', () => {
  const r = run('https://staging-project.supabase.co', fakeLegacyAnonKey('staging-project'));
  assert.equal(r.status, 0);
});

test('EAS guard rejects mismatched legacy key or privileged service role', () => {
  const mismatch = fakeLegacyAnonKey('production-project');
  const wrongProject = run('https://staging-project.supabase.co', mismatch);
  assert.equal(wrongProject.status, 1);
  const privileged = run('https://staging-project.supabase.co', fakeLegacyAnonKey('staging-project', 'service_role'));
  assert.equal(privileged.status, 1);
  assert.equal((wrongProject.stdout + wrongProject.stderr).includes(mismatch), false);
});

test('EAS guard rejects malformed JWT-like public keys without printing them', () => {
  const malformed = 'eyJinvalid.test.invalid';
  const result = run('https://staging-project.supabase.co', malformed);
  assert.equal(result.status, 1);
  assert.equal((result.stdout + result.stderr).includes(malformed), false);
});
