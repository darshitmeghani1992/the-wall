import {
  createMarkMediaOpsHandler,
  createSupabaseOperationsAdapter,
  type OperationsAdapter,
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
} from "../mark-media-ops/index.ts";

const PROJECT = "https://project-ref.supabase.co";
const WORKER = "https://media.example.net/v1/media-jobs";
const SECRET = "s".repeat(32);
const EXECUTION = "11111111-1111-4111-8111-111111111111";
const tests: { name: string; run: () => void | Promise<void> }[] = [];
function test(name: string, run: () => void | Promise<void>): void { tests.push({ name, run }); }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function equal(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

function request(body: unknown, secret = SECRET): Request {
  return new Request(`${PROJECT}/functions/v1/mark-media-ops/run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function emptyAdapter(): OperationsAdapter {
  return {
    dispatch: {
      database: { claim: async () => [], bind: async () => true },
      storage: { signDownload: async () => "", signUpload: async () => "" },
      signingKey: { kid: "unused", pkcs8: new Uint8Array() },
      projectUrl: PROJECT,
      now: () => new Date("2026-09-08T00:00:00Z"),
      randomToken: () => "a".repeat(43),
    },
    deliver: async () => true,
    cleanupDatabase: { claim: async () => [], finalize: async () => true },
    cleanupStorage: { removeAndProveMissing: async () => { throw new Error("unused"); } },
  };
}

test("scheduler authentication precedes route, body parsing, and privileged construction", async () => {
  let factories = 0;
  const handler = createMarkMediaOpsHandler({
    schedulerSecrets: [SECRET], now: () => new Date(),
    adapterFactory: () => { factories += 1; return emptyAdapter(); },
  });
  const malformed = new Request(`${PROJECT}/functions/v1/mark-media-ops/private-route`, {
    method: "DELETE", headers: { Authorization: `Bearer ${"x".repeat(32)}` }, body: "{not-json",
  });
  const response = await handler(malformed);
  equal(response.status, 404, "fixed unauthorized response");
  equal(await response.text(), '{"status":"unavailable"}', "fixed unauthorized body");
  equal(factories, 0, "no privileged adapter before authentication");
});

test("authenticated requests require exact body and return fixed no-store responses", async () => {
  let factories = 0;
  const handler = createMarkMediaOpsHandler({
    schedulerSecrets: [SECRET], now: () => new Date(),
    adapterFactory: () => { factories += 1; return emptyAdapter(); },
  });
  const invalid = await handler(request({ operation: "dispatch", limit: 1, worker_execution_id: EXECUTION, extra: true }));
  equal(invalid.status, 404, "extra field rejected");
  equal(factories, 0, "invalid request cannot construct adapter");
  const valid = await handler(request({ operation: "dispatch", limit: 1, worker_execution_id: EXECUTION }));
  equal(valid.status, 204, "accepted scheduler tick");
  equal(valid.headers.get("cache-control"), "private, no-store", "response cannot be cached");
  equal(factories, 1, "valid request constructs one adapter");
});

function transport(fetchImplementation: typeof fetch) {
  return transportWithEndpoint(WORKER, fetchImplementation);
}

function transportWithEndpoint(workerEndpoint: string, fetchImplementation: typeof fetch) {
  return createSupabaseOperationsAdapter({
    config: { supabaseUrl: PROJECT, anonKey: "anon", serviceRoleKey: "service" },
    signingKey: { kid: "unused", pkcs8: new Uint8Array([1]) },
    workerEndpoint,
    fetch: fetchImplementation,
    now: () => new Date("2026-09-08T00:00:00.000Z"),
  });
}

test("OCI dispatch is one raw application/jose POST with redirects forbidden", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const adapter = transport((async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(null, { status: 202 });
  }) as typeof fetch);
  assert(await adapter.deliver("a.b.c"), "empty 202 accepted");
  equal(calls.length, 1, "exactly one delivery attempt");
  equal(calls[0].url, WORKER, "exact configured endpoint");
  equal(calls[0].init?.method, "POST", "POST method");
  equal(calls[0].init?.body, "a.b.c", "compact JWS is raw body");
  equal(new Headers(calls[0].init?.headers).get("content-type"), "application/jose", "exact media type");
  equal(calls[0].init?.redirect, "error", "redirects forbidden");
});

test("OCI acknowledgement accepts only empty 202 and never performs a transport retry", async () => {
  for (const response of [new Response(null, { status: 200 }), new Response("body", { status: 202 })]) {
    let calls = 0;
    const adapter = transport((async () => { calls += 1; return response; }) as typeof fetch);
    assert(!await adapter.deliver("a.b.c"), "non-contract acknowledgement rejected");
    equal(calls, 1, "no immediate retry");
  }
  let ambiguousCalls = 0;
  const adapter = transport((async () => {
    ambiguousCalls += 1;
    throw new TypeError("ambiguous network failure");
  }) as typeof fetch);
  let failed = false;
  try { await adapter.deliver("a.b.c"); } catch { failed = true; }
  assert(failed, "ambiguous delivery remains failed");
  equal(ambiguousCalls, 1, "ambiguous delivery is not retried");
});

test("OCI endpoint rejects the Supabase origin, loopback, IP literals, and non-HTTPS origins", () => {
  for (const denied of [
    `${PROJECT}/v1/media-jobs`,
    "https://localhost/v1/media-jobs",
    "https://worker.localhost/v1/media-jobs",
    "https://127.0.0.1/v1/media-jobs",
    "https://[::1]/v1/media-jobs",
    "http://media.example.net/v1/media-jobs",
  ]) {
    let rejected = false;
    try { transportWithEndpoint(denied, (async () => new Response(null, { status: 202 })) as typeof fetch); }
    catch { rejected = true; }
    assert(rejected, `hostile worker endpoint rejected: ${denied}`);
  }
});

test("oversized and chunked 202 bodies are rejected and cancelled without aggregation", async () => {
  let largeCancelled = false;
  const largeStream = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); },
    cancel() { largeCancelled = true; },
  });
  const large = transport((async () => new Response(largeStream, { status: 202 })) as typeof fetch);
  assert(!await large.deliver("a.b.c"), "large acknowledgement body rejected");
  assert(largeCancelled, "large response stream cancelled after first non-empty chunk");

  let chunkedCancelled = false;
  let pulls = 0;
  const chunkedStream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      controller.enqueue(pulls === 1 ? new Uint8Array() : new Uint8Array([1]));
    },
    cancel() { chunkedCancelled = true; },
  });
  const chunked = transport((async () => new Response(chunkedStream, { status: 202 })) as typeof fetch);
  assert(!await chunked.deliver("a.b.c"), "chunked non-empty acknowledgement rejected");
  assert(chunkedCancelled, "chunked response stream cancelled");
});

test("cleanup deletes and proves only the exact encoded object path", async () => {
  const path = "validated/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/full.jpg";
  const calls: { url: string; init?: RequestInit }[] = [];
  const adapter = transport((async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(null, { status: init?.method === "DELETE" ? 204 : 404 });
  }) as typeof fetch);
  const evidence = await adapter.cleanupStorage.removeAndProveMissing(path);
  equal(calls.length, 2, "delete then proof");
  equal(calls[0].url, `${PROJECT}/storage/v1/object/mark-media/${path}`, "exact delete URL");
  equal(calls[0].init?.method, "DELETE", "exact delete");
  equal(calls[1].url, calls[0].url, "HEAD proves same object");
  equal(calls[1].init?.method, "HEAD", "fresh missing proof");
  equal(calls[0].init?.redirect, "error", "delete redirects forbidden");
  equal(evidence.path, path, "evidence binds exact path");
  equal(evidence.outcome, "deleted", "delete evidence outcome");
});

test("multi-object cleanup finalizes all-or-nothing and never persists partial evidence", async () => {
  const objectPath = "validated/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/full.mp4";
  const previewPath = "validated/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/poster.webp";
  const finalizations: unknown[] = [];
  let removals = 0;
  const adapter = emptyAdapter();
  adapter.cleanupDatabase.claim = async () => [{
    deletion_id: "22222222-2222-4222-8222-222222222222",
    attempt_id: "33333333-3333-4333-8333-333333333333",
    bucket_id: "mark-media",
    object_path: objectPath,
    preview_path: previewPath,
    lease_expires_at: "2026-09-08T00:05:00.000Z",
  }];
  adapter.cleanupDatabase.finalize = async (value) => { finalizations.push(value); return true; };
  adapter.cleanupStorage.removeAndProveMissing = async (path) => {
    removals += 1;
    if (path === previewPath) throw new Error("preview delete unavailable");
    return { path, outcome: "deleted", observed_at: "2026-09-08T00:00:00.000Z" };
  };
  const handler = createMarkMediaOpsHandler({
    schedulerSecrets: [SECRET], now: () => new Date("2026-09-08T00:00:00.000Z"),
    adapterFactory: () => adapter,
  });
  const response = await handler(request({ operation: "cleanup", limit: 1, worker_execution_id: EXECUTION }));
  equal(response.status, 204, "scheduler tick acknowledged");
  equal(removals, 2, "both exact paths attempted in order");
  equal(finalizations.length, 1, "one atomic finalization");
  const finalization = finalizations[0] as Record<string, unknown>;
  equal(finalization.outcome, "failed", "partial deletion is not completed");
  equal(finalization.objectEvidence, null, "partial object evidence is withheld");
  equal(finalization.previewEvidence, null, "partial preview evidence is withheld");
  equal(finalization.errorCode, "STORAGE_DELETE_FAILED", "fixed safe failure code");
});

async function run(): Promise<void> {
  let failures = 0;
  for (const entry of tests) {
    try { await entry.run(); console.log(`ok - ${entry.name}`); }
    catch (error) { failures += 1; console.error(`not ok - ${entry.name}`); console.error(error); }
  }
  if (failures) throw new Error(`${failures} mark-media-ops test(s) failed`);
}
void run();
