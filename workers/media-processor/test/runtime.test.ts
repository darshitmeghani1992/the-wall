import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { request as httpRequest, type Server } from 'node:http';
import { createWorkerIngressServer, startWorkerRuntime } from '../src/runtime.js';
import type { EnvelopeVerifier, VerifiedWorkerDispatch } from '../src/contract.js';

function fakeVerifier(counter: { count: number }, reject = false): EnvelopeVerifier {
  return { verify: async () => {
    counter.count += 1;
    if (reject) throw new Error('unverified signed payload');
    return {} as VerifiedWorkerDispatch;
  } };
}

async function host(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function stop(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

test('ingress accepts only valid JWS after cryptographic verification and returns empty 202', async () => {
  const count = { count: 0 };
  let processed = 0;
  const server = createWorkerIngressServer({
    verifier: fakeVerifier(count), process: async () => { processed++; },
  });
  const origin = await host(server);
  try {
    const res = await fetch(origin + '/v1/media-jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/jose' },
      body: 'signed.claim.signature',
    });
    assert.equal(res.status, 202);
    assert.equal(await res.text(), '');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(count.count, 1);
    assert.equal(processed, 1);
  } finally { await stop(server); }
});

test('ingress rejects forged/oversized/no-credential endpoints before queueing', async () => {
  const count = { count: 0 };
  let processed = 0;
  const server = createWorkerIngressServer({
    verifier: fakeVerifier(count, true), process: async () => { processed++; },
  });
  const origin = await host(server);
  try {
    for (const [path, headers, body] of [
      ['/v1/media-jobs', { 'Content-Type': 'application/jose' }, 'signed.claim.signature'],
      ['/wrong', { 'Content-Type': 'application/jose' }, 'signed.claim.signature'],
      ['/v1/media-jobs', { 'Content-Type': 'text/plain' }, 'signed.claim.signature'],
      ['/v1/media-jobs', { 'Content-Type': 'application/jose', Authorization: 'Bearer not-authorized' }, 'signed.claim.signature'],
      ['/v1/media-jobs', { 'Content-Type': 'application/jose' }, 'x'.repeat(70_000)],
    ] as const) {
      const res = await fetch(origin + path, { method: 'POST', headers, body });
      assert.equal(res.status, 404);
    }
    assert.equal(processed, 0);
    assert.equal(count.count, 1);
  } finally { await stop(server); }
});

test('bounded queue returns 503 while one verified job is still active', async () => {
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const server = createWorkerIngressServer({
    verifier: fakeVerifier({ count: 0 }), maxPending: 1,
    process: async () => await blocked,
  });
  const origin = await host(server);
  try {
    const send = async () => await fetch(origin + '/v1/media-jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/jose' }, body: 'signed.claim.signature',
    });
    assert.equal((await send()).status, 202);
    assert.equal((await send()).status, 503);
  } finally {
    release();
    await stop(server);
  }
});

test('an unverified slow dispatch cannot bypass the capacity bound during signature verification', async () => {
  let releaseVerification!: () => void;
  const holdVerification = new Promise<void>((resolve) => { releaseVerification = resolve; });
  let enteredVerification!: () => void;
  const started = new Promise<void>((resolve) => { enteredVerification = resolve; });
  let verificationCalls = 0;
  let processed = 0;
  const server = createWorkerIngressServer({
    maxPending: 1,
    verifier: {
      verify: async () => {
        verificationCalls++;
        enteredVerification();
        await holdVerification;
        return {} as VerifiedWorkerDispatch;
      },
    },
    process: async () => { processed++; },
  });
  const origin = await host(server);
  const send = () => fetch(origin + '/v1/media-jobs', {
    method: 'POST', headers: { 'Content-Type': 'application/jose' },
    body: 'signed.claim.signature',
  });
  try {
    const first = send();
    await started;
    const second = await send();
    assert.equal(second.status, 503, 'deny before a second expensive verifier starts');
    assert.equal(verificationCalls, 1);
    releaseVerification();
    assert.equal((await first).status, 202);
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(processed, 1);
  } finally {
    releaseVerification();
    await stop(server);
  }
});

test('failed JWS verification releases the reserved admission slot for a valid retry', async () => {
  let verificationCalls = 0;
  const server = createWorkerIngressServer({
    verifier: {
      verify: async () => {
        verificationCalls++;
        if (verificationCalls === 1) throw new Error('invalid signature');
        return {} as VerifiedWorkerDispatch;
      },
    },
    process: async () => {},
  });
  const origin = await host(server);
  try {
    const send = () => fetch(origin + '/v1/media-jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/jose' },
      body: 'signed.claim.signature',
    });
    assert.equal((await send()).status, 404);
    assert.equal((await send()).status, 202);
    assert.equal(verificationCalls, 2);
  } finally {
    await stop(server);
  }
});

test('slow trickled JWS body releases a pre-verification admission slot after five elapsed seconds', { timeout: 12_000 }, async () => {
  const verified = { count: 0 };
  const server = createWorkerIngressServer({
    maxPending: 1, verifier: fakeVerifier(verified), process: async () => {},
  });
  const origin = await host(server);
  // Transfer-Encoding: chunked keeps the request open even while it sends
  // another byte every 200 ms; an idle-only timeout would never fire.
  const slow = httpRequest(origin + '/v1/media-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/jose', 'Transfer-Encoding': 'chunked' },
  });
  slow.on('error', () => {}); // expected when the server expires the body
  slow.on('response', (response) => response.resume());
  const disconnected = new Promise<void>((resolve) => slow.once('close', resolve));
  slow.write('x');
  const trickle = setInterval(() => { if (!slow.destroyed) slow.write('x'); }, 200);
  try {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const blocked = await fetch(origin + '/v1/media-jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/jose' },
      body: 'signed.claim.signature',
    });
    assert.equal(blocked.status, 503, 'a slow request uses exactly one admission slot');
    await Promise.race([
      disconnected,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('slow body never expired')), 7_000)),
    ]);
    clearInterval(trickle);
    // Let the server settle its rejection and release its capacity lease.
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(verified.count, 0, 'incomplete body must not invoke Ed25519');
    const resumed = await fetch(origin + '/v1/media-jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/jose' },
      body: 'signed.claim.signature',
    });
    assert.equal(resumed.status, 202, 'capacity must recover for the next valid dispatch');
    assert.equal(verified.count, 1);
  } finally {
    clearInterval(trickle);
    slow.destroy();
    await stop(server);
  }
});

test('runtime fails closed when enablement or security configuration is missing', async () => {
  await assert.rejects(startWorkerRuntime({ MARK_MEDIA_RUNTIME_ENABLED: 'false' }), /disabled/);
  await assert.rejects(startWorkerRuntime({ MARK_MEDIA_RUNTIME_ENABLED: 'true', PORT: '8080' }));
  await assert.rejects(startWorkerRuntime({ MARK_MEDIA_RUNTIME_ENABLED: 'true', MARK_MEDIA_PROJECT_URL: 'https://ewintxgdxdvschiqodkq.supabase.co', PORT: '99999' }), /port/);
});

test('enabled media runtime accepts only the reviewed staging backend origin', async () => {
  for (const origin of [
    'https://wfsfafmgvxevpzrurofz.supabase.co', // protected historic production
    'https://some-other-project.supabase.co',
    'http://ewintxgdxdvschiqodkq.supabase.co',
    'https://ewintxgdxdvschiqodkq.supabase.co/rest/v1/',
    'https://ewintxgdxdvschiqodkq.supabase.co.evil.example',
  ]) {
    await assert.rejects(startWorkerRuntime({
      MARK_MEDIA_RUNTIME_ENABLED: 'true',
      MARK_MEDIA_PROJECT_URL: origin,
    }), /unapproved media worker Supabase project origin/);
  }
  for (const origin of [
    'https://ewintxgdxdvschiqodkq.supabase.co',
    'https://ewintxgdxdvschiqodkq.supabase.co/',
  ]) {
    // A permitted project still cannot start with absent verification keys.
    await assert.rejects(startWorkerRuntime({
      MARK_MEDIA_RUNTIME_ENABLED: 'true',
      MARK_MEDIA_PROJECT_URL: origin,
    }), /worker public key/);
  }
});
