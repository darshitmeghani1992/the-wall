import {
  canonicalJson,
  decodeBase64UrlCanonical,
  encodeBase64Url,
  signDispatchEnvelope,
  verifyDispatchEnvelope,
  type DispatchPublicKey,
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
} from "../_shared/worker-envelope.ts";
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
import type { WorkerDispatchPayload } from "../_shared/media-contract.ts";
import {
  createMarkMediaWorkerHandler,
  type WorkerDatabaseAdapter,
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
} from "../mark-media-worker/index.ts";

const SEED_HEX = "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
const PUBLIC_HEX = "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
const PKCS8_PREFIX_HEX = "302e020100300506032b657004220420";
const EXPECTED_JWS = "eyJhbGciOiJFZERTQSIsImtpZCI6InRlc3QtYSIsInR5cCI6IlRXLU1FRElBLURJU1BBVENIK2p3cyJ9.eyJhdHRlbXB0X2lkIjoiMDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAzIiwiYXVkaWVuY2UiOiJ0aGUtd2FsbC1tZWRpYS1wcm9jZXNzb3IiLCJjYWxsYmFja191cmwiOiJodHRwczovL3Auc3VwYWJhc2UuY28vZnVuY3Rpb25zL3YxL21hcmstbWVkaWEtd29ya2VyL3dvcmtlci9jb21wbGV0ZSIsImNvbXBsZXRpb25fdG9rZW4iOiJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCIiwiZGVzdGluYXRpb25zIjpbeyJjYWNoZV9jb250cm9sX3NlY29uZHMiOjYwLCJtZXRob2QiOiJQVVQiLCJtaW1lX3R5cGUiOiJhdWRpby9tcDQiLCJwYXRoIjoidmFsaWRhdGVkLzAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMi8wMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDMvZnVsbC5tNGEiLCJyb2xlIjoiZnVsbCIsInVybCI6Imh0dHBzOi8vcC5zdXBhYmFzZS5jby9zdG9yYWdlL3YxL29iamVjdC91cGxvYWQvc2lnbi9tYXJrLW1lZGlhL3ZhbGlkYXRlZC8wMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDIvMDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAzL2Z1bGwubTRhP3Rva2VuPWRzdCJ9XSwiZXhwIjoxNzg4NDA4MTIwLCJpYXQiOjE3ODg0MDgwMDAsImlzc3VlciI6InRoZS13YWxsLW1hcmstbWVkaWEtZWRnZSIsImpvYl9pZCI6IjAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMSIsImtpbmQiOiJ2b2ljZSIsIm5vbmNlIjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQSIsInB1cnBvc2UiOiJkaXNwYXRjaCIsInNvdXJjZSI6eyJtZXRob2QiOiJHRVQiLCJwYXRoIjoic3RhZ2luZy8wMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDQvMDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAyL3NvdXJjZSIsInVybCI6Imh0dHBzOi8vcC5zdXBhYmFzZS5jby9zdG9yYWdlL3YxL29iamVjdC9zaWduL21hcmstbWVkaWEvc3RhZ2luZy8wMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDQvMDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAyL3NvdXJjZT90b2tlbj1zcmMifSwidXBsb2FkX2lkIjoiMDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAyIiwidmVyc2lvbiI6MX0.oG7jrzajNltxT6q4AeUSmRXT1zFYnZRel8HD6mQY4DK_MNKDT1Q6cZHNPCpBFXY1q6yAKs3uWqyEh--8SS--DQ";

const PAYLOAD: WorkerDispatchPayload = {
  attempt_id: "00000000-0000-4000-8000-000000000003",
  audience: "the-wall-media-processor",
  callback_url: "https://p.supabase.co/functions/v1/mark-media-worker/worker/complete",
  completion_token: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  destinations: [{
    cache_control_seconds: 60,
    method: "PUT",
    mime_type: "audio/mp4",
    path: "validated/00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000003/full.m4a",
    role: "full",
    url: "https://p.supabase.co/storage/v1/object/upload/sign/mark-media/validated/00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000003/full.m4a?token=dst",
  }],
  exp: 1788408120,
  iat: 1788408000,
  issuer: "the-wall-mark-media-edge",
  job_id: "00000000-0000-4000-8000-000000000001",
  kind: "voice",
  nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  purpose: "dispatch",
  source: {
    method: "GET",
    path: "staging/00000000-0000-4000-8000-000000000004/00000000-0000-4000-8000-000000000002/source",
    url: "https://p.supabase.co/storage/v1/object/sign/mark-media/staging/00000000-0000-4000-8000-000000000004/00000000-0000-4000-8000-000000000002/source?token=src",
  },
  upload_id: "00000000-0000-4000-8000-000000000002",
  version: 1,
};

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];
function test(name: string, run: Test["run"]): void { tests.push({ name, run }); }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function equal(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}
async function rejects(run: () => Promise<unknown>, message: string): Promise<void> {
  let rejected = false;
  try { await run(); } catch { rejected = true; }
  assert(rejected, message);
}
function hex(value: string): Uint8Array {
  if (value.length % 2 !== 0) throw new Error("invalid hex");
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

const PRIVATE_KEY = { kid: "test-a", pkcs8: hex(`${PKCS8_PREFIX_HEX}${SEED_HEX}`) };
const PUBLIC_KEYS: DispatchPublicKey[] = [{ kid: "test-a", raw: hex(PUBLIC_HEX) }];
const OPTIONS = { projectHost: "https://p.supabase.co", nowSeconds: 1788408000 };

test("native Ed25519 produces and verifies the exact approved compact-JWS vector", async () => {
  const signed = await signDispatchEnvelope(PAYLOAD, PRIVATE_KEY, OPTIONS);
  equal(signed, EXPECTED_JWS, "deterministic compact JWS");
  const verified = await verifyDispatchEnvelope(EXPECTED_JWS, PUBLIC_KEYS, OPTIONS);
  equal(verified.kid, "test-a", "verified kid");
  equal(canonicalJson(verified.payload), canonicalJson(PAYLOAD), "verified canonical payload");
});

test("signature, algorithm, key, padding, canonicalization, and lifetime attacks fail", async () => {
  const [header, payload, signature] = EXPECTED_JWS.split(".");
  const flipped = `${header}.${payload}.${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;
  await rejects(() => verifyDispatchEnvelope(flipped, PUBLIC_KEYS, OPTIONS), "signature bit flip denied");
  await rejects(() => verifyDispatchEnvelope(`${header}.${payload}.${signature}=`, PUBLIC_KEYS, OPTIONS), "padding denied");
  await rejects(() => verifyDispatchEnvelope(EXPECTED_JWS, [{ kid: "other", raw: hex(PUBLIC_HEX) }], OPTIONS), "unknown kid denied");

  const wrongHeader = encodeBase64Url(new TextEncoder().encode('{"alg":"HS256","kid":"test-a","typ":"TW-MEDIA-DISPATCH+jws"}'));
  await rejects(() => verifyDispatchEnvelope(`${wrongHeader}.${payload}.${signature}`, PUBLIC_KEYS, OPTIONS), "algorithm confusion denied");
  const duplicateHeader = encodeBase64Url(new TextEncoder().encode('{"alg":"EdDSA","alg":"EdDSA","kid":"test-a","typ":"TW-MEDIA-DISPATCH+jws"}'));
  await rejects(() => verifyDispatchEnvelope(`${duplicateHeader}.${payload}.${signature}`, PUBLIC_KEYS, OPTIONS), "duplicate key denied");

  await rejects(() => verifyDispatchEnvelope(EXPECTED_JWS, PUBLIC_KEYS, { ...OPTIONS, nowSeconds: PAYLOAD.exp }), "expiry boundary denied");
  const future = { ...PAYLOAD, iat: OPTIONS.nowSeconds + 11, exp: OPTIONS.nowSeconds + 120 };
  await rejects(() => signDispatchEnvelope(future, PRIVATE_KEY, OPTIONS), "+11 second iat denied");
});

test("URL, callback, method, and credential-domain substitution fail before signing", async () => {
  await rejects(() => signDispatchEnvelope({
    ...PAYLOAD,
    callback_url: "https://evil.example.com/functions/v1/mark-media-worker/worker/complete",
  }, PRIVATE_KEY, OPTIONS), "alternate callback denied");
  await rejects(() => signDispatchEnvelope({
    ...PAYLOAD,
    destinations: [{ ...PAYLOAD.destinations[0], url: PAYLOAD.source.url }],
  }, PRIVATE_KEY, OPTIONS), "download URL cannot substitute for upload URL");
  await rejects(() => signDispatchEnvelope({
    ...PAYLOAD,
    completion_token: PAYLOAD.nonce,
  }, PRIVATE_KEY, OPTIONS), "nonce cross-use denied");
});

async function signUncheckedPayload(payload: unknown): Promise<string> {
  const protectedSegment = encodeBase64Url(new TextEncoder().encode(
    canonicalJson({ alg: "EdDSA", kid: "test-a", typ: "TW-MEDIA-DISPATCH+jws" }),
  ));
  const payloadSegment = encodeBase64Url(new TextEncoder().encode(canonicalJson(payload)));
  const key = await crypto.subtle.importKey("pkcs8", PRIVATE_KEY.pkcs8.slice().buffer, "Ed25519", false, ["sign"]);
  const input = `${protectedSegment}.${payloadSegment}`;
  const signature = await crypto.subtle.sign("Ed25519", key, new TextEncoder().encode(input));
  return `${input}.${encodeBase64Url(new Uint8Array(signature))}`;
}

test("validly signed array values cannot masquerade as primitive credential strings", async () => {
  const fields = ["nonce", "completion_token", "callback_url"] as const;
  for (const field of fields) {
    const signed = await signUncheckedPayload({ ...PAYLOAD, [field]: [PAYLOAD[field]] });
    await rejects(
      () => verifyDispatchEnvelope(signed, PUBLIC_KEYS, OPTIONS),
      `non-string ${field} denied after valid signature`,
    );
  }
});

function workerRequest(path: string, gateway: string, token: string, body?: unknown): Request {
  return new Request(`https://p.supabase.co/functions/v1/mark-media-worker${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gateway}`,
      "X-The-Wall-Job-Token": token,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function makeWorkerHarness(adapter: WorkerDatabaseAdapter, onFactory: () => void) {
  return createMarkMediaWorkerHandler({
    projectHost: "https://p.supabase.co",
    gatewaySecrets: [
      { value: "g".repeat(32), notAfterSeconds: null },
      { value: "p".repeat(32), notAfterSeconds: OPTIONS.nowSeconds + 300 },
    ],
    publicKeys: PUBLIC_KEYS,
    nowSeconds: () => OPTIONS.nowSeconds,
    adapterFactory: () => { onFactory(); return adapter; },
  });
}

const SUCCESS_RESULT = {
  detected_mime: "audio/mp4",
  validated_bytes: 4096,
  sha256: "a".repeat(64),
  width: null,
  height: null,
  duration_ms: 1000,
  validated_path: PAYLOAD.destinations[0].path,
  preview_path: null,
  cache_control_seconds: 60,
};

test("gateway authentication happens before token/body parsing or adapter construction", async () => {
  let factories = 0;
  const adapter: WorkerDatabaseAdapter = {
    redeemDispatch: async () => true,
    finalize: async () => true,
  };
  const response = await makeWorkerHarness(adapter, () => { factories += 1; })(
    workerRequest("/worker/complete", "wrong-secret-that-is-still-long-enough", "malformed", { bad: true }),
  );
  equal(response.status, 401, "fixed unauthorized status");
  equal(await response.text(), '{"code":"UNAUTHORIZED"}', "fixed unauthorized body");
  equal(response.headers.get("cache-control"), "no-store", "unauthorized response is not cached");
  equal(factories, 0, "privileged adapter not constructed");
});

test("previous gateway secret expires at the five-minute overlap boundary", async () => {
  let factories = 0;
  const handle = createMarkMediaWorkerHandler({
    projectHost: "https://p.supabase.co",
    gatewaySecrets: [
      { value: "g".repeat(32), notAfterSeconds: null },
      { value: "p".repeat(32), notAfterSeconds: OPTIONS.nowSeconds },
    ],
    publicKeys: PUBLIC_KEYS,
    nowSeconds: () => OPTIONS.nowSeconds,
    adapterFactory: () => {
      factories += 1;
      return { redeemDispatch: async () => true, finalize: async () => true };
    },
  });
  const response = await handle(workerRequest("/worker/redeem", "p".repeat(32), EXPECTED_JWS));
  equal(response.status, 401, "expired previous secret denied");
  equal(factories, 0, "expired secret reaches no privileged adapter");
});

test("dispatch redemption passes only verified bound claims and maps replay to fixed 404", async () => {
  let factories = 0;
  let calls = 0;
  const adapter: WorkerDatabaseAdapter = {
    redeemDispatch: async (input) => {
      calls += 1;
      equal(input.uploadId, PAYLOAD.upload_id, "bound upload");
      equal(input.attemptId, PAYLOAD.attempt_id, "bound attempt");
      equal(input.nonce, PAYLOAD.nonce, "dispatch nonce only");
      equal(input.kid, "test-a", "verified header kid");
      return calls === 1;
    },
    finalize: async () => false,
  };
  const handle = makeWorkerHarness(adapter, () => { factories += 1; });
  const accepted = await handle(workerRequest("/worker/redeem", "g".repeat(32), EXPECTED_JWS));
  equal(accepted.status, 204, "first redemption accepted");
  const replay = await handle(workerRequest("/worker/redeem", "g".repeat(32), EXPECTED_JWS));
  equal(replay.status, 404, "replay is generic unavailable");
  equal(await replay.text(), '{"code":"UNAVAILABLE"}', "fixed unavailable body");
  equal(factories, 2, "adapter is constructed only after verified credentials");
});

test("completion validates exact schema before atomic finalize and preserves fixed responses", async () => {
  let factories = 0;
  let finalizeCalls = 0;
  const adapter: WorkerDatabaseAdapter = {
    redeemDispatch: async () => false,
    finalize: async (input) => {
      finalizeCalls += 1;
      equal(input.completionToken, PAYLOAD.completion_token, "completion token domain");
      equal(input.outcome, "success", "endpoint-bound outcome");
      return true;
    },
  };
  const handle = makeWorkerHarness(adapter, () => { factories += 1; });
  const invalid = await handle(workerRequest("/worker/complete", "g".repeat(32), PAYLOAD.completion_token, {
    upload_id: PAYLOAD.upload_id,
    attempt_id: PAYLOAD.attempt_id,
    kid: "test-a",
    result: { ...SUCCESS_RESULT, parser_detail: "must not cross boundary" },
  }));
  equal(invalid.status, 422, "schema-invalid completion");
  equal(await invalid.text(), '{"code":"INVALID_RESULT"}', "fixed invalid-result body");
  equal(factories, 0, "invalid result never constructs adapter");

  const accepted = await handle(workerRequest("/worker/complete", "g".repeat(32), PAYLOAD.completion_token, {
    upload_id: PAYLOAD.upload_id,
    attempt_id: PAYLOAD.attempt_id,
    kid: "test-a",
    result: SUCCESS_RESULT,
  }));
  equal(accepted.status, 204, "completion accepted");
  equal(await accepted.text(), "", "204 echoes nothing");
  equal(finalizeCalls, 1, "one atomic finalize call");
});

test("worker callback body cap is enforced before JSON parsing and finalization", async () => {
  let factories = 0;
  const adapter: WorkerDatabaseAdapter = { redeemDispatch: async () => false, finalize: async () => true };
  const handle = makeWorkerHarness(adapter, () => { factories += 1; });
  const response = await handle(new Request(
    "https://p.supabase.co/functions/v1/mark-media-worker/worker/complete",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${"g".repeat(32)}`,
        "X-The-Wall-Job-Token": PAYLOAD.completion_token,
        "Content-Type": "application/json",
        "Content-Length": "65537",
      },
      body: "{}",
    },
  ));
  equal(response.status, 422, "oversized callback denied as invalid result");
  equal(factories, 0, "oversized callback never constructs adapter");
});

test("base64url decoder enforces no padding and canonical round trip", () => {
  equal(encodeBase64Url(decodeBase64UrlCanonical("AA")), "AA", "canonical round trip");
  let failed = false;
  try { decodeBase64UrlCanonical("AA=="); } catch { failed = true; }
  assert(failed, "padded base64url denied");
});

async function runTests(): Promise<void> {
  let failures = 0;
  for (const entry of tests) {
    try {
      await entry.run();
      console.log(`ok - ${entry.name}`);
    } catch (error) {
      failures += 1;
      console.error(`not ok - ${entry.name}`);
      console.error(error instanceof Error ? error.message : String(error));
    }
  }
  if (failures > 0) throw new Error(`${failures} mark-media-worker test(s) failed`);
}

void runTests();
