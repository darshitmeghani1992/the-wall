import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const script = new URL('../scripts/validate-eas-backend.mjs', import.meta.url);

function run(url, key = 'sb_publishable_mock_for_tests', flags = {}) {
  const env = { ...process.env };
  delete env.EXPO_PUBLIC_SUPABASE_URL;
  delete env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  // Isolate the test process from the runner's real EAS environment.
  for (const flag of [
    'EXPO_PUBLIC_MEDIA_MARKS_ENABLED',
    'EXPO_PUBLIC_SECRET_MARKS_ENABLED',
    'EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED',
  ]) delete env[flag];
  Object.assign(env, flags);
  if (url !== undefined) env.EXPO_PUBLIC_SUPABASE_URL = url;
  if (key !== undefined) env.EXPO_PUBLIC_SUPABASE_ANON_KEY = key;
  return spawnSync(process.execPath, [script.pathname], { env, encoding: 'utf8', timeout: 5000 });
}

test('EAS guard accepts only the approved staging origin', () => {
  const result = run('https://ewintxgdxdvschiqodkq.supabase.co');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /approved staging origin/);
});

test('EAS guard rejects original production and arbitrary HTTPS origins', () => {
  for (const origin of [
    'https://wfsfafmgvxevpzrurofz.supabase.co',
    'https://project-id.supabase.co',
  ]) {
    const result = run(origin);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /EAS build blocked/);
    assert.equal((result.stdout + result.stderr).includes(origin), false);
  }
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
  const r = run('https://ewintxgdxdvschiqodkq.supabase.co', fakeLegacyAnonKey('ewintxgdxdvschiqodkq'));
  assert.equal(r.status, 0);
});

test('EAS guard rejects mismatched legacy key or privileged service role', () => {
  const mismatch = fakeLegacyAnonKey('production-project');
  const wrongProject = run('https://ewintxgdxdvschiqodkq.supabase.co', mismatch);
  assert.equal(wrongProject.status, 1);
  const privileged = run('https://ewintxgdxdvschiqodkq.supabase.co', fakeLegacyAnonKey('ewintxgdxdvschiqodkq', 'service_role'));
  assert.equal(privileged.status, 1);
  assert.equal((wrongProject.stdout + wrongProject.stderr).includes(mismatch), false);
});

test('EAS guard rejects malformed JWT-like public keys without printing them', () => {
  const malformed = 'eyJinvalid.test.invalid';
  const result = run('https://ewintxgdxdvschiqodkq.supabase.co', malformed);
  assert.equal(result.status, 1);
  assert.equal((result.stdout + result.stderr).includes(malformed), false);
});

test('EAS guard refuses modern Supabase secret API keys before embedding', () => {
  const secret = 'sb_secret_do-not-bundle-this';
  const result = run('https://ewintxgdxdvschiqodkq.supabase.co', secret);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /EAS build blocked/);
  assert.equal((result.stdout + result.stderr).includes(secret), false);
});

test('EAS refuses opaque or noncanonical public-key formats before packaging', () => {
  for (const key of ['publishable-test-value', 'opaque-unclassified-key', 'sb_publishable_with space']) {
    const result = run('https://ewintxgdxdvschiqodkq.supabase.co', key);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /EAS build blocked/);
    assert.equal((result.stdout + result.stderr).includes(key), false);
  }
});


test('EAS blocks stale high-risk feature flags even with valid staging credentials', () => {
  const staging = 'https://ewintxgdxdvschiqodkq.supabase.co';
  const flags = [
    'EXPO_PUBLIC_MEDIA_MARKS_ENABLED',
    'EXPO_PUBLIC_SECRET_MARKS_ENABLED',
    'EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED',
  ];
  for (const flag of flags) {
    const result = run(staging, undefined, { [flag]: 'true' });
    assert.equal(result.status, 1, `${flag} must not enable an unverified beta`);
    assert.match(result.stderr, /EAS build blocked/);
    assert.equal((result.stdout + result.stderr).includes('sb_publishable_mock_for_tests'), false);
  }
  const inert = run(staging, undefined, Object.fromEntries(flags.map(flag => [flag, 'false'])));
  assert.equal(inert.status, 0, 'explicitly OFF beta features leave valid staging builds eligible');
});
