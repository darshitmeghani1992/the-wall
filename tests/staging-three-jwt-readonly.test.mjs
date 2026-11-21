import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runStagingJwtAudit } from '../scripts/staging-three-jwt-readonly.mjs';

const HOST = 'https://ewintxgdxdvschiqodkq.supabase.co';
const WALL_ID = '99999999-9999-4999-8999-999999999999';
const base = {
  TW_STAGING_JWT_AUDIT_APPROVED: 'true',
  TW_STAGING_URL: HOST,
  TW_STAGING_ANON_KEY: 'not-a-real-public-test-key',
  TW_PRIVATE_WALL_ID: WALL_ID,
  TW_OWNER_ID: '11111111-1111-4111-8111-111111111111',
  TW_MEMBER_ID: '22222222-2222-4222-8222-222222222222',
  TW_OUTSIDER_ID: '33333333-3333-4333-8333-333333333333',
  TW_OWNER_JWT: 'mockheader.owner.signature',
  TW_MEMBER_JWT: 'mockheader.member.signature',
  TW_OUTSIDER_JWT: 'mockheader.outsider.signature',
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
    assert.equal(init.headers.apikey, base.TW_STAGING_ANON_KEY);
    assert.equal(new URL(url).origin, HOST);
    const token = init.headers.Authorization.replace(/^Bearer /, '');
    if (options.http401) return { status: 401 };
    if (url.includes('/auth/v1/user')) {
      return {
        status: 200,
        json: async () => ({ id: options.mismatch ? base.TW_MEMBER_ID : ids[token] }),
      };
    }
    assert.ok(url.includes('/rest/v1/walls?'));
    assert.equal(new URL(url).searchParams.get('id'), 'eq.' + WALL_ID);
    const isOutsider = token === base.TW_OUTSIDER_JWT;
    const rows = isOutsider && !options.leak ? [] : [{ id: WALL_ID }];
    return { status: 200, json: async () => rows };
  };
  return { handler, calls };
}

test('six read-only staging GETs: three distinct actors, outsider sees no private Wall', async () => {
  const mock = fakeNetwork();
  const result = await runStagingJwtAudit(base, mock.handler);
  assert.deepEqual(result, { status: 'PASS', httpRequests: 6, actorCount: 3, readOnly: true });
  assert.equal(mock.calls.length, 6);
  assert.ok(mock.calls.every(([, init]) => init.method === 'GET'));
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

test('auth checks happen before any wall lookup for each actor', async () => {
  const mock = fakeNetwork();
  await runStagingJwtAudit(base, mock.handler);
  assert.deepEqual(mock.calls.map(([url]) => new URL(url).pathname),
    ['/auth/v1/user', '/rest/v1/walls',
     '/auth/v1/user', '/rest/v1/walls',
     '/auth/v1/user', '/rest/v1/walls']);
});
