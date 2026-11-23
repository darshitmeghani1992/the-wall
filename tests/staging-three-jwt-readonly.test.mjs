import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runStagingJwtAudit } from '../scripts/staging-three-jwt-readonly.mjs';

const HOST = 'https://ewintxgdxdvschiqodkq.supabase.co';
const WALL_ID = '99999999-9999-4999-8999-999999999999';
const MARK_ID = '88888888-8888-4888-8888-888888888888';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const OUTSIDER_ID = '33333333-3333-4333-8333-333333333333';

// Deliberately unsigned mock JWT-shaped strings: no credentials are supplied.
// The runtime separately calls the real staging Auth server to verify identity.
function mockJwt(claims, suffix = 'mock') {
  return [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify(claims)).toString('base64url'),
    suffix,
  ].join('.');
}
function actorJwt(id, override = {}) {
  return mockJwt({
    iss: HOST + '/auth/v1',
    sub: id,
    aud: 'authenticated',
    role: 'authenticated',
    exp: 4102444800,
    ...override,
  });
}
const base = {
  TW_STAGING_JWT_AUDIT_APPROVED: 'true',
  TW_STAGING_URL: HOST,
  TW_STAGING_ANON_KEY: 'sb_publishable_mock_staging_public',
  TW_PRIVATE_WALL_ID: WALL_ID,
  TW_PRIVATE_TEXT_MARK_ID: MARK_ID,
  TW_OWNER_ID: OWNER_ID,
  TW_MEMBER_ID: MEMBER_ID,
  TW_OUTSIDER_ID: OUTSIDER_ID,
  TW_OWNER_JWT: actorJwt(OWNER_ID),
  TW_MEMBER_JWT: actorJwt(MEMBER_ID),
  TW_OUTSIDER_JWT: actorJwt(OUTSIDER_ID),
};

function fakeNetwork(options = {}) {
  const calls = [];
  const ids = {
    [base.TW_OWNER_JWT]: base.TW_OWNER_ID,
    [base.TW_MEMBER_JWT]: base.TW_MEMBER_ID,
    [base.TW_OUTSIDER_JWT]: base.TW_OUTSIDER_ID,
  };
  const handler = async (url, init) => {
    calls.push([url, init]);
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.apikey, options.apiKey || base.TW_STAGING_ANON_KEY);
    assert.equal(new URL(url).origin, HOST);
    const token = init.headers.Authorization?.replace(/^Bearer /, '') ?? init.headers.apikey;
    if (options.http401) return { status: 401 };
    if (url.includes('/auth/v1/user')) {
      return {
        status: 200,
        json: async () => ({ id: options.mismatch ? base.TW_MEMBER_ID : ids[token] }),
      };
    }
    if (url.includes('/rest/v1/marks?')) {
      const params = new URL(url).searchParams;
      assert.equal(params.get('id'), 'eq.' + MARK_ID);
      assert.equal(params.get('wall_id'), 'eq.' + WALL_ID);
      assert.equal(params.get('select'), 'id,wall_id,type,status,secret');
      const isOutsider = token === base.TW_OUTSIDER_JWT;
      const isAnonymous = token === (options.apiKey || base.TW_STAGING_ANON_KEY);
      if (isAnonymous && options.anonMarkStatus) return { status: options.anonMarkStatus };
      if (isAnonymous && options.anonMarkMalformed) return { status: 200, json: async () => ({}) };
      const visible = (!isOutsider && !isAnonymous) ||
        (isOutsider && options.markLeak) || (isAnonymous && options.anonMarkLeak);
      return {
        status: 200,
        json: async () => visible ? [{
          id: MARK_ID,
          wall_id: WALL_ID,
          type: options.wrongMarkType ? 'photo' : 'text',
          status: options.wrongMarkStatus ? 'removed' : 'active',
          secret: options.wrongMarkSecret === true,
        }] : [],
      };
    }
    assert.ok(url.includes('/rest/v1/walls?'));
    assert.equal(new URL(url).searchParams.get('id'), 'eq.' + WALL_ID);
    assert.equal(new URL(url).searchParams.get('select'), 'id,type,visibility');
    const isOutsider = token === base.TW_OUTSIDER_JWT;
    const isAnonymous = token === (options.apiKey || base.TW_STAGING_ANON_KEY);
    if (isAnonymous) {
      // The read-only anon probe must reach RLS through a valid app key.
      // A modern publishable key is not a JWT: sending it as Bearer can
      // yield an unrelated 401, falsely satisfying the negative check.
      if (init.headers.apikey.startsWith('sb_publishable_')) {
        assert.equal(init.headers.Authorization, undefined);
      } else {
        assert.equal(init.headers.Authorization, 'Bearer ' + init.headers.apikey);
      }
    } else {
      assert.equal(init.headers.Authorization, 'Bearer ' + token);
    }
    if (isAnonymous && options.anonStatus) return { status: options.anonStatus };
    if (isAnonymous && options.anonMalformed) return { status: 200, json: async () => ({}) };
    const rows = ((isOutsider && !options.leak) ||
      (isAnonymous && !options.anonLeak)) ? [] : [{
      id: WALL_ID,
      type: options.wrongType ? 'personal' : 'shared',
      visibility: options.wrongVisibility ? 'public' : 'private',
    }];
    return { status: 200, json: async () => rows };
  };
  return { handler, calls };
}

test('eleven read-only staging GETs: private Wall and active text Mark actor/anonymous RLS', async () => {
  const mock = fakeNetwork();
  const result = await runStagingJwtAudit(base, mock.handler);
  assert.deepEqual(result, { status: 'PASS', httpRequests: 11, actorCount: 3, readOnly: true });
  assert.equal(mock.calls.length, 11);
  assert.ok(mock.calls.every(([, init]) => init.method === 'GET'));
  assert.ok(mock.calls.every(([url]) => !url.includes('text=') && !url.includes('author_id=')));
  assert.ok(mock.calls.every(([, init]) => init.redirect === 'error'));
  // Authenticated actor requests retain the real user-JWT Authorization;
  // only the separate anonymous check omits a modern public-key Bearer.
  assert.equal(mock.calls[0][1].headers.Authorization, 'Bearer ' + base.TW_OWNER_JWT);
  assert.equal(mock.calls[1][1].headers.Authorization, 'Bearer ' + base.TW_OWNER_JWT);
  assert.equal(mock.calls[9][1].headers.Authorization, undefined);
  assert.equal(mock.calls[10][1].headers.Authorization, undefined);
});

test('fails before network on production, wrong protocol or alternate host', async () => {
  let calls = 0;
  const unreachable = async () => { calls++; throw Error('should never call'); };
  for (const url of [
    'https://wfsfafmgvxevpzrurofz.supabase.co',
    'http://ewintxgdxdvschiqodkq.supabase.co',
    'https://ewintxgdxdvschiqodkq.supabase.co.attacker.invalid',
    'https://ewintxgdxdvschiqodkq.supabase.co/extra',
  ]) {
    await assert.rejects(runStagingJwtAudit({ ...base, TW_STAGING_URL: url }, unreachable));
  }
  assert.equal(calls, 0);
});

test('fails before network without explicit opt-in, three distinct JWTs and known fixture', async () => {
  const never = async () => { throw Error('should never call'); };
  await assert.rejects(runStagingJwtAudit({ ...base, TW_STAGING_JWT_AUDIT_APPROVED: 'false' }, never));
  await assert.rejects(runStagingJwtAudit({ ...base, TW_OUTSIDER_JWT: base.TW_OWNER_JWT }, never));
  await assert.rejects(runStagingJwtAudit({ ...base, TW_OUTSIDER_ID: base.TW_OWNER_ID }, never));
  await assert.rejects(runStagingJwtAudit({ ...base, TW_PRIVATE_WALL_ID: '' }, never));
  await assert.rejects(runStagingJwtAudit({ ...base, TW_PRIVATE_TEXT_MARK_ID: '' }, never));
  await assert.rejects(runStagingJwtAudit({ ...base, TW_PRIVATE_TEXT_MARK_ID: WALL_ID + '/bad' }, never));
  await assert.rejects(runStagingJwtAudit({ ...base, TW_STAGING_ANON_KEY: '' }, never));
});

test('valid HTTP 401 never passes as outsider denial', async () => {
  const mock = fakeNetwork({ http401: true });
  await assert.rejects(runStagingJwtAudit(base, mock.handler), /Authenticated staging GET failed/);
  assert.equal(mock.calls.length, 1);
});

test('rejects mismatched server verified user ID and outsider visibility leak', async () => {
  await assert.rejects(runStagingJwtAudit(base, fakeNetwork({ mismatch: true }).handler),
    /Authenticated actor identity mismatch/);
  await assert.rejects(runStagingJwtAudit(base, fakeNetwork({ leak: true }).handler),
    /Private Shared Wall RLS visibility mismatch/);
});

test('rejects non-shared or non-private fixtures even when the actor visibility looks correct', async () => {
  for (const options of [{ wrongType: true }, { wrongVisibility: true }]) {
    const mock = fakeNetwork(options);
    await assert.rejects(runStagingJwtAudit(base, mock.handler),
      /Private Shared Wall RLS visibility mismatch/);
    assert.equal(mock.calls.length, 2);
  }
});

test('each verified Auth actor sees Wall and text Mark before anonymous GETs', async () => {
  const mock = fakeNetwork();
  await runStagingJwtAudit(base, mock.handler);
  assert.deepEqual(mock.calls.map(([url]) => new URL(url).pathname),
    ['/auth/v1/user', '/rest/v1/walls', '/rest/v1/marks',
     '/auth/v1/user', '/rest/v1/walls', '/rest/v1/marks',
     '/auth/v1/user', '/rest/v1/walls', '/rest/v1/marks',
     '/rest/v1/walls', '/rest/v1/marks']);
});

test('rejects service-role/secret API keys before any HTTP request', async () => {
  let calls = 0;
  const noNetwork = async () => { calls++; throw Error('not allowed'); };
  for (const key of [
    'sb_secret_example_server_key',
    mockJwt({ role: 'service_role' }, 'service'),
    mockJwt({ role: 'authenticated' }, 'user'),
    mockJwt({ role: 'anon' }, 'bad token with spaces'),
    'opaque_unclassified_key',
  ]) {
    await assert.rejects(runStagingJwtAudit({ ...base, TW_STAGING_ANON_KEY: key }, noNetwork),
      /Staging publishable\/anon key required/);
  }
  assert.equal(calls, 0);
});

test('accepts legacy anon JWT-shaped public key only with anon role', async () => {
  const key = mockJwt({ role: 'anon', ref: 'ewintxgdxdvschiqodkq', iss: 'supabase' }, 'anon-signature');
  const mock = fakeNetwork({ apiKey: key });
  const result = await runStagingJwtAudit({ ...base, TW_STAGING_ANON_KEY: key }, mock.handler);
  assert.equal(result.status, 'PASS');
  assert.equal(mock.calls.length, 11);
  assert.equal(mock.calls.at(-1)[1].headers.Authorization, 'Bearer ' + key);
});

test('refuses mismatched, expired and privileged actor claims before HTTP', async () => {
  let calls = 0;
  const noNetwork = async () => { calls++; throw Error('not allowed'); };
  for (const claims of [
    { sub: OUTSIDER_ID },
    { role: 'service_role' },
    { role: 'anon' },
    { iss: 'https://wfsfafmgvxevpzrurofz.supabase.co/auth/v1' },
    { aud: 'service_role' },
    { exp: 1 },
    { exp: '4102444800' },
    { exp: undefined },
  ]) {
    await assert.rejects(runStagingJwtAudit({
      ...base,
      TW_OWNER_JWT: actorJwt(OWNER_ID, claims),
    }, noNetwork), /Three distinct authenticated actor IDs\/JWTs required/);
  }
  assert.equal(calls, 0);
});

test('rejects legacy anon keys with missing or foreign project ref before any HTTP', async () => {
  let calls = 0;
  const noNetwork = async () => { calls++; throw Error('should never call'); };
  for (const key of [
    mockJwt({ role: 'anon', iss: 'supabase' }, 'missing-ref'),
    mockJwt({ role: 'anon', ref: 'wfsfafmgvxevpzrurofz' }, 'prod-ref'),
    mockJwt({ role: 'anon', ref: 'arbitrary-other-ref' }, 'other-ref'),
    mockJwt({ role: 'service_role', ref: 'ewintxgdxdvschiqodkq' }, 'service'),
  ]) {
    await assert.rejects(
      runStagingJwtAudit({ ...base, TW_STAGING_ANON_KEY: key }, noNetwork),
      /Staging publishable\/anon key required/,
    );
  }
  assert.equal(calls, 0);
});

test('fails if the public anonymous key can read the same private Shared Wall', async () => {
  const mock = fakeNetwork({ anonLeak: true });
  await assert.rejects(runStagingJwtAudit(base, mock.handler),
    /Private Shared Wall visible without authentication/);
  assert.equal(mock.calls.length, 10);
  const [, request] = mock.calls.at(-1);
  assert.equal(request.headers.Authorization, undefined);
  assert.equal(request.headers.apikey, base.TW_STAGING_ANON_KEY);
  assert.equal(request.redirect, 'error');
});

test('anonymous RLS requires filtered HTTP 200; 401/403 gateway denials are not policy proof', async () => {
  // Confirm positive RLS evidence is a genuine empty JSON result, not a
  // successful HTTP status on a malformed response.
  assert.equal((await runStagingJwtAudit(base, fakeNetwork().handler)).status, 'PASS');
  for (const status of [401, 403, 500, 302]) {
    const mock = fakeNetwork({ anonStatus: status });
    await assert.rejects(runStagingJwtAudit(base, mock.handler),
      new RegExp('Anonymous RLS check inconclusive: expected HTTP 200, got ' + status));
    assert.equal(mock.calls.length, 10);
  }
  const malformed = fakeNetwork({ anonMalformed: true });
  await assert.rejects(runStagingJwtAudit(base, malformed.handler),
    /Malformed anonymous staging HTTP JSON/);
  assert.equal(malformed.calls.length, 7);
});


test('fails closed on text Mark denial, leakage, wrong fixture or missing metadata', async () => {
  for (const config of [
    { markLeak: true },
    { wrongMarkType: true },
    { wrongMarkStatus: true },
    { wrongMarkSecret: true },
  ]) {
    await assert.rejects(
      runStagingJwtAudit(base, fakeNetwork(config).handler),
      /Private text Mark RLS visibility mismatch/,
    );
  }
  // A gateway denial must not masquerade as authenticated RLS filtering.
  await assert.rejects(
    runStagingJwtAudit(base, fakeNetwork({ anonMarkStatus: 403 }).handler),
    /Anonymous text Mark RLS check inconclusive/,
  );
  await assert.rejects(
    runStagingJwtAudit(base, fakeNetwork({ anonMarkMalformed: true }).handler),
    /Malformed anonymous text Mark HTTP JSON response/,
  );
  await assert.rejects(
    runStagingJwtAudit(base, fakeNetwork({ anonMarkLeak: true }).handler),
    /Private text Mark visible without authentication/,
  );
});

test('anonymous negative check never bypasses the three server-verified JWT identities', async () => {
  const mock = fakeNetwork({ mismatch: true, anonLeak: true });
  await assert.rejects(runStagingJwtAudit(base, mock.handler),
    /Authenticated actor identity mismatch/);
  assert.equal(mock.calls.length, 1);
});
