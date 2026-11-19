import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyResult, requiredChecks, validatePublicClientConfig, verifyStagingBackend } from '../scripts/staging-preflight.mjs';

test('public client configuration requires HTTPS origin and key', () => {
  assert.equal(validatePublicClientConfig('https://example.supabase.co', 'safe-public-key'), 'https://example.supabase.co');
  for (const url of ['http://example.supabase.co', 'https://user:password@example.supabase.co', 'https://example.supabase.co/rest/v1', 'not-a-url']) {
    assert.throws(() => validatePublicClientConfig(url, 'key'));
  }
  assert.throws(() => validatePublicClientConfig('https://example.supabase.co', ''));
});

test('all current staging probes are readonly zero-row table checks', () => {
  assert.equal(requiredChecks.length, 4);
  assert(requiredChecks.every(({ path }) => path.includes('limit=0') || path === '/auth/v1/health'));
});

test('all required healthy endpoints pass without accessing row bodies', async () => {
  const seen = [];
  const fakeFetch = async (url, options) => {
    seen.push([url, options]);
    return { status: 200, json: async () => { throw new Error('success body should not be read'); } };
  };
  const result = await verifyStagingBackend({ url: 'https://example.supabase.co', key: 'public-key', fetchImpl: fakeFetch });
  assert.equal(result.ready, true);
  assert.equal(seen.length, requiredChecks.length);
  assert(seen.every(([url, options]) => url.startsWith('https://example.supabase.co/') && options.method === 'GET'));
});

test('missing follows schema fails decisively, without exposing error body', async () => {
  const fetchImpl = async (url) => url.includes('/follows?')
    ? { status: 404, json: async () => ({ code: 'PGRST205', details: 'do not print this sensitive value' }) }
    : { status: 200 };
  const result = await verifyStagingBackend({ url: 'https://example.supabase.co', key: 'public-key', fetchImpl });
  assert.equal(result.ready, false);
  assert.deepEqual(result.checks[3], { name: 'follows_api', ok: false, status: 404, reason: 'schema_or_rpc_missing' });
});

test('auth denied and network failures are fail-closed', async () => {
  assert.equal(classifyResult(requiredChecks[1], 401, '42501').ok, false);
  const fetchImpl = async () => { throw new Error('private request detail'); };
  const result = await verifyStagingBackend({ url: 'https://example.supabase.co', key: 'public-key', fetchImpl });
  assert.equal(result.ready, false);
  assert(result.checks.every((check) => check.reason === 'network_unreachable'));
});
