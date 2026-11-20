import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
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

test('runtime fails closed when enablement or security configuration is missing', async () => {
  await assert.rejects(startWorkerRuntime({ MARK_MEDIA_RUNTIME_ENABLED: 'false' }), /disabled/);
  await assert.rejects(startWorkerRuntime({ MARK_MEDIA_RUNTIME_ENABLED: 'true', PORT: '8080' }));
  await assert.rejects(startWorkerRuntime({ MARK_MEDIA_RUNTIME_ENABLED: 'true', PORT: '99999' }), /port/);
});
