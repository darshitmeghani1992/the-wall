import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { APPROVED_STAGING_ORIGIN, assertApprovedStagingOrigin, classifyResult, requiredChecks, validatePublicClientConfig, verifyStagingBackend } from '../scripts/staging-preflight.mjs';

test('public client configuration requires HTTPS origin and key', () => {
  assert.equal(validatePublicClientConfig('https://ewintxgdxdvschiqodkq.supabase.co', 'sb_publishable_mock_for_tests'), 'https://ewintxgdxdvschiqodkq.supabase.co');
  for (const url of ['http://example.supabase.co', 'https://user:password@example.supabase.co', 'https://ewintxgdxdvschiqodkq.supabase.co/rest/v1', 'not-a-url']) {
    assert.throws(() => validatePublicClientConfig(url, 'sb_publishable_mock_for_tests'));
  }
  assert.throws(() => validatePublicClientConfig('https://ewintxgdxdvschiqodkq.supabase.co', ''));
});

test('all current staging probes are readonly zero-row table checks', () => {
  assert.equal(requiredChecks.length, 7);
  assert(requiredChecks.every(({ path }) => path.includes('limit=0') || path === '/auth/v1/health'));
});

test('all required healthy endpoints pass without accessing row bodies', async () => {
  const seen = [];
  const fakeFetch = async (url, options) => {
    seen.push([url, options]);
    return { status: url.includes('mark_secrets?') || url.includes('mark_media?') || url.includes('secret_mark_rollout?') ? 401 : 200, json: async () => { throw new Error('success body should not be read'); } };
  };
  const result = await verifyStagingBackend({ url: 'https://ewintxgdxdvschiqodkq.supabase.co', key: 'sb_publishable_mock_for_tests', fetchImpl: fakeFetch });
  assert.equal(result.ready, true);
  assert.equal(seen.length, requiredChecks.length);
  assert(seen.every(([url, options]) => url.startsWith('https://ewintxgdxdvschiqodkq.supabase.co/') && options.method === 'GET' && options.redirect === 'error'));
  assert(seen.every(([, options]) =>
    options.headers.apikey === 'sb_publishable_mock_for_tests' &&
    options.headers.Authorization === undefined),
  'all modern publishable probes must exercise anonymous RLS without an invalid JWT bearer');
});

test('staging probes never follow redirects or carry public keys to another origin', async () => {
  const origin = APPROVED_STAGING_ORIGIN;
  const key = 'sb_publishable_mock_for_tests';
  const seen = [];
  const fetchImpl = async (url, options) => {
    seen.push({ url, options });
    assert.equal(new URL(url).origin, origin);
    assert.equal(options.redirect, 'error', 'never forward the apikey header through a redirect');
    assert.equal(options.headers.apikey, key);
    assert.equal(options.headers.Authorization, undefined, 'modern publishable key is not a JWT');
    // A malicious Location must not be fetched or interpreted as success.
    return { status: 302, headers: { get: () => 'https://foreign.example/collect' }, json: async () => ({}) };
  };
  const result = await verifyStagingBackend({ url: origin, key, fetchImpl });
  assert.equal(result.ready, false);
  assert.equal(seen.length, requiredChecks.length);
  assert(result.checks.every((check) => !check.ok && check.status === 302 && check.reason === 'unexpected_http_status'));
  assert(seen.every(({ url }) => new URL(url).origin === origin));
});

test('redirect exceptions from native fetch are a failed read-only staging gate', async () => {
  let count = 0;
  const fetchImpl = async (_url, options) => {
    count += 1;
    assert.equal(options.redirect, 'error');
    throw new TypeError('redirect mode is set to error');
  };
  const result = await verifyStagingBackend({
    url: APPROVED_STAGING_ORIGIN,
    key: 'sb_publishable_mock_for_tests',
    fetchImpl,
  });
  assert.equal(result.ready, false);
  assert.equal(count, requiredChecks.length);
  assert(result.checks.every((check) => !check.ok && check.reason === 'network_unreachable'));
});

test('missing follows schema fails decisively, without exposing error body', async () => {
  const fetchImpl = async (url) => url.includes('/follows?')
    ? { status: 404, json: async () => ({ code: 'PGRST205', details: 'do not print this sensitive value' }) }
    : { status: url.includes('mark_secrets?') || url.includes('mark_media?') || url.includes('secret_mark_rollout?') ? 401 : 200 };
  const result = await verifyStagingBackend({ url: 'https://ewintxgdxdvschiqodkq.supabase.co', key: 'sb_publishable_mock_for_tests', fetchImpl });
  assert.equal(result.ready, false);
  assert.deepEqual(result.checks[3], { name: 'follows_api', ok: false, status: 404, reason: 'schema_or_rpc_missing' });
});

test('auth denied and network failures are fail-closed', async () => {
  assert.equal(classifyResult(requiredChecks[1], 401, '42501').ok, false);
  const fetchImpl = async () => { throw new Error('private request detail'); };
  const result = await verifyStagingBackend({ url: 'https://ewintxgdxdvschiqodkq.supabase.co', key: 'sb_publishable_mock_for_tests', fetchImpl });
  assert.equal(result.ready, false);
  assert(result.checks.every((check) => check.reason === 'network_unreachable'));
});

test('public read of a protected table fails the release gate', async () => {
  const fetchImpl = async (url) => ({
    status: url.includes('mark_secrets?') ? 200 :
      url.includes('mark_media?') || url.includes('secret_mark_rollout?') ? 403 : 200,
    json: async () => ({}),
  });
  const result = await verifyStagingBackend({ url: 'https://ewintxgdxdvschiqodkq.supabase.co', key: 'sb_publishable_mock_for_tests', fetchImpl });
  assert.equal(result.ready, false);
  assert.deepEqual(result.checks[4], { name: 'secret_payload_isolation', ok: false, status: 200, reason: 'unexpected_http_status' });
  assert(result.checks[5].ok && result.checks[6].ok);
});

test('missing Secret rollout gate is not confused with expected client denial', async () => {
  const fetchImpl = async (url) => ({
    status: url.includes('secret_mark_rollout?') ? 404 :
      url.includes('mark_secrets?') || url.includes('mark_media?') ? 401 : 200,
    json: async () => ({ code: 'PGRST205' }),
  });
  const result = await verifyStagingBackend({ url: 'https://ewintxgdxdvschiqodkq.supabase.co', key: 'sb_publishable_mock_for_tests', fetchImpl });
  assert.equal(result.ready, false);
  assert.deepEqual(result.checks[6], { name: 'secret_rollout_isolation', ok: false, status: 404, reason: 'schema_or_rpc_missing' });
});


test('beta smoke and EAS guard reject the original production project before any network access', async () => {
  assert.equal(APPROVED_STAGING_ORIGIN, 'https://ewintxgdxdvschiqodkq.supabase.co');
  assert.doesNotThrow(() => assertApprovedStagingOrigin(APPROVED_STAGING_ORIGIN));
  const originalProduction = 'https://wfsfafmgvxevpzrurofz.supabase.co';
  assert.throws(() => assertApprovedStagingOrigin(originalProduction), /approved staging project/);
  assert.throws(() => assertApprovedStagingOrigin('https://example.supabase.co'), /approved staging project/);
  let networkCalls = 0;
  await assert.rejects(
    verifyStagingBackend({
      url: originalProduction,
      key: 'sb_publishable_mock_for_tests',
      fetchImpl: async () => { networkCalls += 1; throw new Error('should never request production'); },
    }),
    /approved staging project/,
  );
  assert.equal(networkCalls, 0, 'no API call should reach original production');
  const easGuard = readFileSync(new URL('../scripts/validate-eas-backend.mjs', import.meta.url), 'utf8');
  assert.match(easGuard, /assertApprovedStagingOrigin\(origin\)/, 'EAS pre-install must enforce staging');
});

test('staging probe refuses secret and service-role keys without any network calls', async () => {
  const approved = 'https://ewintxgdxdvschiqodkq.supabase.co';
  assert.throws(
    () => validatePublicClientConfig(approved, 'sb_secret_must-not-be-embedded'),
    /secret API key forbidden/,
  );
  let networkCalls = 0;
  const fakeFetch = async () => {
    networkCalls += 1;
    throw new Error('probe must fail before contacting staging');
  };
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const legacyKey = (claimRef, role) => {
    const claims = Buffer.from(JSON.stringify({ ref: claimRef, role })).toString('base64url');
    return `${header}.${claims}.mock-signature`;
  };
  for (const key of [
    'sb_secret_must-not-be-embedded',
    legacyKey('ewintxgdxdvschiqodkq', 'service_role'),
    legacyKey('wfsfafmgvxevpzrurofz', 'anon'),
    'eyJinvalid.test.invalid',
  ]) {
    await assert.rejects(
      verifyStagingBackend({ url: approved, key, fetchImpl: fakeFetch }),
    );
  }
  assert.equal(networkCalls, 0, 'no request may use a secret, service-role or mismatched key');
});

test('staging preflight rejects unknown opaque API keys before any HTTP request', async () => {
  const approved = 'https://ewintxgdxdvschiqodkq.supabase.co';
  let networkCalls = 0;
  const never = async () => { networkCalls++; throw Error('no HTTP expected'); };
  for (const key of [
    'opaque-unclassified-key',
    'publishable-test-value',
    'sb_publishable_contains space',
    'SB_PUBLISHABLE_wrong_prefix',
  ]) {
    assert.throws(() => validatePublicClientConfig(approved, key),
      /publishable\/anon key format invalid/);
    await assert.rejects(
      verifyStagingBackend({ url: approved, key, fetchImpl: never }),
      /publishable\/anon key format invalid/,
    );
  }
  assert.equal(networkCalls, 0);
});


test('legacy staging anon JWT remains a Bearer on read-only preflight requests', async () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ role: 'anon', ref: 'ewintxgdxdvschiqodkq' })).toString('base64url');
  const legacy = `${header}.${payload}.mock-signature`;
  const seen = [];
  const result = await verifyStagingBackend({
    url: APPROVED_STAGING_ORIGIN,
    key: legacy,
    fetchImpl: async (url, options) => {
      seen.push({ url, options });
      return { status: url.includes('mark_secrets?') || url.includes('mark_media?') ||
          url.includes('secret_mark_rollout?') ? 403 : 200 };
    },
  });
  assert.equal(result.ready, true);
  assert.equal(seen.length, requiredChecks.length);
  assert(seen.every(({ url, options }) =>
    new URL(url).origin === APPROVED_STAGING_ORIGIN &&
    options.method === 'GET' && options.redirect === 'error' &&
    options.headers.apikey === legacy &&
    options.headers.Authorization === 'Bearer ' + legacy));
});
