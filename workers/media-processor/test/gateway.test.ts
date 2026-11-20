import assert from 'node:assert/strict';
import test from 'node:test';
import { createGatewayAdapters } from '../src/gateway.js';
import type { CompletionAuthorization, ProcessedMedia } from '../src/contract.js';

const project = 'https://ewintxgdxdvschiqodkq.supabase.co';
const secret = 'some-separated-random-gateway-secret-32bytes';
const attempt: CompletionAuthorization = {
  callbackUrl: project + '/functions/v1/mark-media-worker/worker/complete',
  uploadId: '11111111-1111-4111-8111-111111111111',
  attemptId: '22222222-2222-4222-8222-222222222222',
  envelopeKid: 'key-1',
  completionToken: 'A'.repeat(43),
};
const media: ProcessedMedia = {
  kind: 'voice',
  full: {
    role: 'full', path: `validated/${attempt.uploadId}/${attempt.attemptId}/full.m4a`,
    localPath: '/tmp/media-process-only', mimeType: 'audio/mp4', byteSize: 1250,
    sha256: 'b'.repeat(64), durationMs: 25_000,
  },
};

function adapterWithCapture(status = 204) {
  const calls: { url: string; init: RequestInit }[] = [];
  const gateway = createGatewayAdapters({ projectUrl: project, gatewaySecret: secret,
    fetchImpl: (async (url: string | URL | Request, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(null, { status });
    }) as typeof fetch,
  });
  return { calls, gateway };
}

test('requires HTTPS exact Supabase project origin and a separate gateway secret', () => {
  for (const projectUrl of [
    'http://ewintxgdxdvschiqodkq.supabase.co',
    'https://ewintxgdxdvschiqodkq.supabase.co/rest/v1',
    'https://user@ewintxgdxdvschiqodkq.supabase.co/',
    'https://localhost/',
  ]) assert.throws(() => createGatewayAdapters({ projectUrl, gatewaySecret: secret }));
  assert.throws(() => createGatewayAdapters({ projectUrl: project, gatewaySecret: 'too-short' }));
});

test('redeem sends JWS only to gateway with custom Bearer credential, never DB/service credentials', async () => {
  const { gateway, calls } = adapterWithCapture();
  const jws = 'protected.payload.signature';
  assert.equal(await gateway.nonceRedeemer.redeem(jws, AbortSignal.timeout(1000)), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, project + '/functions/v1/mark-media-worker/worker/redeem');
  const h = calls[0]?.init.headers as Record<string, string>;
  assert.equal(h.Authorization, `Bearer ${secret}`);
  assert.equal(h['X-The-Wall-Job-Token'], jws);
  assert.equal(h['Cache-Control'], 'no-store');
  assert.equal(calls[0]?.init.redirect, 'error');
  assert.equal(calls[0]?.init.body, '{}');
});

test('completion contains exact authoritative result fields and distinct completion credential', async () => {
  const { gateway, calls } = adapterWithCapture();
  await gateway.completionReporter.complete(attempt, media, AbortSignal.timeout(1000));
  const call = calls[0];
  assert.equal(call?.url, attempt.callbackUrl);
  const headers = call?.init.headers as Record<string, string>;
  assert.equal(headers['X-The-Wall-Job-Token'], attempt.completionToken);
  const parsed = JSON.parse(String(call?.init.body));
  assert.deepEqual(Object.keys(parsed).sort(), ['attempt_id', 'kid', 'result', 'upload_id']);
  assert.deepEqual(parsed.result, {
    cache_control_seconds: 60, detected_mime: 'audio/mp4', duration_ms: 25_000,
    height: null, preview_path: null, sha256: 'b'.repeat(64), validated_bytes: 1250,
    validated_path: media.full.path, width: null,
  });
  assert.equal(String(call?.init.body).includes(secret), false);
});

test('failure spends completion token only, with allowlisted safe failure codes', async () => {
  const { gateway, calls } = adapterWithCapture();
  await gateway.completionReporter.fail(attempt, 'INVALID_MEDIA', AbortSignal.timeout(1000));
  assert.equal(calls[0]?.url, project + '/functions/v1/mark-media-worker/worker/fail');
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)).result, { error_code: 'INVALID_MEDIA' });
  await assert.rejects(gateway.completionReporter.fail(attempt, 'signed-url-secret', AbortSignal.timeout(1000)));
  assert.equal(calls.length, 1);
});

test('wrong callback, unaccepted receipts, or malformed JWS fail closed', async () => {
  const { gateway, calls } = adapterWithCapture();
  await assert.rejects(gateway.completionReporter.complete({ ...attempt, callbackUrl: 'https://evil.example/worker/complete' }, media, AbortSignal.timeout(1000)));
  assert.equal(calls.length, 0);
  await assert.rejects(gateway.nonceRedeemer.redeem('no spaces allowed', AbortSignal.timeout(1000)));
  assert.equal(calls.length, 0);
  const rejected = adapterWithCapture(404);
  assert.equal(await rejected.gateway.nonceRedeemer.redeem('valid.jws.string', AbortSignal.timeout(1000)), false);
  await assert.rejects(rejected.gateway.completionReporter.complete(attempt, media, AbortSignal.timeout(1000)));
});
