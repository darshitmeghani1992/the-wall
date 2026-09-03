// This file intentionally uses only Web APIs so the same cases run under Node
// (local/CI) and Deno (Supabase Edge) without adding a security dependency.
import {
  createMarkMediaHandler,
  createSupabaseDispatchAdapters,
  createWorkerDispatches,
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
} from "../mark-media/index.ts";
import {
  assertCanonicalStoragePath,
  assertSignedStorageUrl,
  normalizeProjectHost,
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
} from "../_shared/url-policy.ts";
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
import { verifyDispatchEnvelope } from "../_shared/worker-envelope.ts";

const PROJECT_URL = "https://project-ref.supabase.co";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const MARK_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const CONFIG = {
  supabaseUrl: PROJECT_URL,
  anonKey: "public-anon-key",
  serviceRoleKey: "private-service-role-key",
};

type FetchCall = { url: string; init?: RequestInit };
type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];

function test(name: string, run: Test["run"]): void {
  tests.push({ name, run });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
}

function throws(run: () => unknown, message: string): void {
  let didThrow = false;
  try {
    run();
  } catch {
    didThrow = true;
  }
  assert(didThrow, message);
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readRequest(body: unknown, bearer = "valid.jwt.value"): Request {
  return new Request(`${PROJECT_URL}/functions/v1/mark-media/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function resolvedRow(path = "validated/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/full.jpg") {
  return {
    position: 0,
    media_type: "photo",
    storage_path: path,
    preview_path: null,
    mime_type: "image/jpeg",
    byte_size: 1234,
    width: 800,
    height: 600,
    duration_ms: null,
    sha256: "a".repeat(64),
  };
}

function scriptedFetch(steps: Array<(call: FetchCall) => Response | Promise<Response>>, calls: FetchCall[]): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    const step = steps.shift();
    if (!step) throw new Error(`unexpected fetch: ${url}`);
    return step({ url, init });
  }) as typeof fetch;
}

function handler(fetchImplementation: typeof fetch) {
  return createMarkMediaHandler({
    fetch: fetchImplementation,
    now: () => new Date("2026-09-03T12:00:00.000Z"),
    config: CONFIG,
  });
}

async function assertUnavailable(response: Response): Promise<void> {
  equal(response.status, 404, "generic unavailable status");
  equal(await response.text(), '{"status":"unavailable"}', "generic unavailable body");
  equal(response.headers.get("cache-control"), "private, no-store", "unavailable response is not cached");
  equal(response.headers.get("pragma"), "no-cache", "legacy caches are disabled");
  equal(response.headers.get("referrer-policy"), "no-referrer", "referrers are suppressed");
  equal(response.headers.get("x-content-type-options"), "nosniff", "content sniffing is disabled");
}

test("read re-verifies JWT, binds actor to resolver, signs exact path, and suppresses raw path", async () => {
  const calls: FetchCall[] = [];
  const path = resolvedRow().storage_path;
  const response = await handler(scriptedFetch([
    ({ url, init }) => {
      equal(url, `${PROJECT_URL}/auth/v1/user`, "JWT verification endpoint");
      equal(new Headers(init?.headers).get("apikey"), CONFIG.anonKey, "auth uses public key");
      equal(init?.redirect, "error", "auth redirects are denied");
      return json({ id: USER_ID });
    },
    ({ url, init }) => {
      equal(url, `${PROJECT_URL}/rest/v1/rpc/resolve_mark_media_for_signing`, "service resolver endpoint");
      equal(new Headers(init?.headers).get("authorization"), `Bearer ${CONFIG.serviceRoleKey}`, "resolver is service-only");
      equal(init?.redirect, "error", "resolver redirects are denied");
      const body = JSON.parse(String(init?.body));
      equal(body.p_actor_id, USER_ID, "actor comes from verified JWT");
      equal(body.p_mark_id, MARK_ID, "mark ID is bound");
      equal(body.p_request_id, REQUEST_ID, "request ID is bound");
      return json([resolvedRow()]);
    },
    ({ url, init }) => {
      equal(url, `${PROJECT_URL}/storage/v1/object/sign/mark-media/${path}`, "exact resolved path is signed");
      equal(JSON.parse(String(init?.body)).expiresIn, 60, "URL lifetime is exactly 60 seconds");
      equal(init?.redirect, "error", "signing redirects are denied");
      return json({ signedURL: `/object/sign/mark-media/${path}?token=opaque` });
    },
  ], calls))(readRequest({ mark_id: MARK_ID, request_id: REQUEST_ID }));

  equal(response.status, 200, "manifest status");
  equal(response.headers.get("cache-control"), "private, no-store", "manifest is not cached");
  equal(response.headers.get("referrer-policy"), "no-referrer", "manifest has no referrer");
  const body = await response.json();
  equal(body.status, "ready", "manifest state");
  equal(body.expires_at, "2026-09-03T12:01:00.000Z", "explicit manifest expiry");
  equal(body.items.length, 1, "one media item");
  assert(body.items[0].url.includes("?token=opaque"), "signed URL is returned");
  assert(!JSON.stringify(body).includes('"storage_path"'), "raw storage path field is suppressed");
  equal(calls.length, 3, "only expected calls occur");
});

test("missing, invalid JWT, resolver denial, and signing failure are indistinguishable", async () => {
  const missing = await handler(scriptedFetch([], []))(new Request(`${PROJECT_URL}/functions/v1/mark-media/read`, { method: "POST" }));
  await assertUnavailable(missing);

  const invalid = await handler(scriptedFetch([() => json({}, 401)], []))(
    readRequest({ mark_id: MARK_ID, request_id: REQUEST_ID }),
  );
  await assertUnavailable(invalid);

  const denied = await handler(scriptedFetch([() => json({ id: USER_ID }), () => json([])], []))(
    readRequest({ mark_id: MARK_ID, request_id: REQUEST_ID }),
  );
  await assertUnavailable(denied);

  const signingFailure = await handler(scriptedFetch([
    () => json({ id: USER_ID }),
    () => json([resolvedRow()]),
    () => json({ message: "storage unavailable" }, 500),
  ], []))(readRequest({ mark_id: MARK_ID, request_id: REQUEST_ID }));
  await assertUnavailable(signingFailure);
});

test("app read signer rejects a signed upload credential for a resolved read path", async () => {
  const path = resolvedRow().storage_path;
  const response = await handler(scriptedFetch([
    () => json({ id: USER_ID }),
    () => json([resolvedRow()]),
    () => json({ signedURL: `/object/upload/sign/mark-media/${path}?token=write-capability` }),
  ], []))(readRequest({ mark_id: MARK_ID, request_id: REQUEST_ID }));
  await assertUnavailable(response);
});

test("a multi-photo manifest fails closed instead of returning a partial carousel", async () => {
  const first = resolvedRow();
  const second = {
    ...resolvedRow("validated/cccccccc-cccc-4ccc-8ccc-cccccccccccc/dddddddd-dddd-4ddd-8ddd-dddddddddddd/full.jpg"),
    position: 1,
  };
  const calls: FetchCall[] = [];
  const response = await handler(scriptedFetch([
    () => json({ id: USER_ID }),
    () => json([first, second]),
    () => json({ signedURL: `/object/sign/mark-media/${first.storage_path}?token=first` }),
    () => json({}, 503),
  ], calls))(readRequest({ mark_id: MARK_ID, request_id: REQUEST_ID }));
  await assertUnavailable(response);
  equal(calls.length, 4, "signing stops at the failed item");
});

test("malformed input and malicious resolver paths fail before Storage signing", async () => {
  const malformedCalls: FetchCall[] = [];
  const malformed = await handler(scriptedFetch([() => json({ id: USER_ID })], malformedCalls))(
    readRequest({ mark_id: MARK_ID, request_id: REQUEST_ID, actor_id: USER_ID }),
  );
  await assertUnavailable(malformed);
  equal(malformedCalls.length, 1, "extra fields never reach privileged resolver");

  const maliciousCalls: FetchCall[] = [];
  const malicious = await handler(scriptedFetch([
    () => json({ id: USER_ID }),
    () => json([resolvedRow("validated/../staging/secret")]),
  ], maliciousCalls))(readRequest({ mark_id: MARK_ID, request_id: REQUEST_ID }));
  await assertUnavailable(malicious);
  equal(maliciousCalls.length, 2, "invalid DB path is never signed");
});

test("signer output is pinned to HTTPS project origin, bucket, and canonical path", () => {
  const path = resolvedRow().storage_path;
  const policy = { projectHost: PROJECT_URL, bucket: "mark-media" };
  const valid = `${PROJECT_URL}/storage/v1/object/sign/mark-media/${path}?token=x`;
  equal(assertSignedStorageUrl(valid, path, policy).hostname, "project-ref.supabase.co", "valid signed URL");
  throws(() => assertSignedStorageUrl(`https://evil.example.com/storage/v1/object/sign/mark-media/${path}?token=x`, path, policy), "alternate host denied");
  throws(() => assertSignedStorageUrl(`https://127.0.0.1/storage/v1/object/sign/mark-media/${path}?token=x`, path, { projectHost: "127.0.0.1" }), "IP literal denied");
  throws(() => assertSignedStorageUrl(`${PROJECT_URL}/storage/v1/object/sign/attachments/${path}?token=x`, path, policy), "alternate bucket denied");
  throws(() => assertSignedStorageUrl(`${PROJECT_URL}/storage/v1/object/sign/mark-media/${path.replace("validated", "staging")}?token=x`, path, policy), "path substitution denied");
  throws(() => assertSignedStorageUrl(`${PROJECT_URL}/storage/v1/object/sign/mark-media/validated/%252e%252e/secret?token=x`, path, policy), "double encoding denied");
  throws(() => assertSignedStorageUrl(`${PROJECT_URL}/storage/v1/object/sign/mark-media/${path}`, path, policy), "unsigned URL denied");
});

test("canonical path and project-origin validation reject traversal and local targets", () => {
  assertCanonicalStoragePath(resolvedRow().storage_path, "validated");
  throws(() => assertCanonicalStoragePath("validated/../source", "validated"), "path traversal denied");
  throws(() => assertCanonicalStoragePath("validated/%2e%2e/source", "validated"), "encoded traversal denied");
  throws(() => assertCanonicalStoragePath("staging/user/upload/source", "validated"), "wrong prefix denied");
  equal(normalizeProjectHost(PROJECT_URL), "project-ref.supabase.co", "project host normalized");
  throws(() => normalizeProjectHost("http://project-ref.supabase.co"), "HTTP project origin denied");
  throws(() => normalizeProjectHost("https://localhost"), "localhost denied");
  throws(() => normalizeProjectHost("https://10.0.0.1"), "private IP denied");
});

test("dispatch persists a post-upload 2h30 output fence before signing a job", async () => {
  const events: string[] = [];
  let binding: Record<string, string> | null = null;
  const uploadId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const attemptId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const workerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const sourcePath = `staging/${USER_ID}/${uploadId}/source`;
  const destinationPath = `validated/${uploadId}/${attemptId}/full.m4a`;
  const privateKey = Uint8Array.from(
    "302e020100300506032b6570042204209d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60".match(/.{2}/g) ?? [],
    (byte) => Number.parseInt(byte, 16),
  );
  const publicKey = Uint8Array.from(
    "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a".match(/.{2}/g) ?? [],
    (byte) => Number.parseInt(byte, 16),
  );
  const dispatches = await createWorkerDispatches(workerId, 1, {
    database: {
      claim: async () => [{
        id: uploadId,
        attempt_id: attemptId,
        source_path: sourcePath,
        validated_path: `validated/${uploadId}/${attemptId}/full`,
        kind: "voice",
      }],
      bind: async (input) => {
        events.push("bind");
        binding = input as unknown as Record<string, string>;
        return true;
      },
    },
    storage: {
      signDownload: async () => {
        events.push("source");
        return `${PROJECT_URL}/storage/v1/object/sign/mark-media/${sourcePath}?token=source`;
      },
      signUpload: async () => {
        events.push("final-upload-return");
        return `${PROJECT_URL}/storage/v1/object/upload/sign/mark-media/${destinationPath}?token=destination`;
      },
    },
    signingKey: { kid: "test-a", pkcs8: privateKey },
    projectUrl: PROJECT_URL,
    now: () => {
      events.push("capture-time");
      return new Date("2026-09-03T12:00:00.500Z");
    },
    randomToken: (() => {
      const values = ["A".repeat(43), "B".repeat(43)];
      return () => values.shift() ?? "C".repeat(43);
    })(),
  });
  equal(events.join(","), "source,final-upload-return,capture-time,bind", "binding order");
  assert(binding !== null, "credentials were bound");
  const recordedBinding = binding as unknown as Record<string, string>;
  equal(recordedBinding.signedUrlsReturnedAt, "2026-09-03T12:00:00.500Z", "trusted post-response time");
  equal(recordedBinding.outputCredentialsExpireAt, "2026-09-03T14:30:00.500Z", "2h30 output fence");
  equal(dispatches.length, 1, "one bound dispatch");
  const verified = await verifyDispatchEnvelope(dispatches[0], [{ kid: "test-a", raw: publicKey }], {
    projectHost: PROJECT_URL,
    nowSeconds: 1788436800,
  });
  equal(verified.payload.destinations[0].path, destinationPath, "signed exact output path");
});

test("dispatch is never produced when destination signing or durable binding fails", async () => {
  const uploadId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const attemptId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const workerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const claim = [{
    id: uploadId,
    attempt_id: attemptId,
    source_path: `staging/${USER_ID}/${uploadId}/source`,
    validated_path: `validated/${uploadId}/${attemptId}/full`,
    kind: "voice" as const,
  }];
  let binds = 0;
  const common = {
    database: { claim: async () => claim, bind: async () => { binds += 1; return false; } },
    signingKey: { kid: "test-a", pkcs8: new Uint8Array(48) },
    projectUrl: PROJECT_URL,
    now: () => new Date("2026-09-03T12:00:00.000Z"),
  };
  const freshTokens = () => {
    let count = 0;
    return () => (count++ === 0 ? "A" : "B").repeat(43);
  };
  const sourceUrl = `${PROJECT_URL}/storage/v1/object/sign/mark-media/${claim[0].source_path}?token=source`;
  const destinationPath = `validated/${uploadId}/${attemptId}/full.m4a`;
  const noBind = await createWorkerDispatches(workerId, 1, {
    ...common,
    randomToken: freshTokens(),
    storage: {
      signDownload: async () => sourceUrl,
      signUpload: async () => `${PROJECT_URL}/storage/v1/object/upload/sign/mark-media/${destinationPath}?token=destination`,
    },
  });
  equal(noBind.length, 0, "failed binding emits no dispatch");
  equal(binds, 1, "binding was attempted after URLs");

  let signingFailed = false;
  try {
    await createWorkerDispatches(workerId, 1, {
      ...common,
      randomToken: freshTokens(),
      storage: { signDownload: async () => sourceUrl, signUpload: async () => { throw new Error("Storage down"); } },
    });
  } catch {
    signingFailed = true;
  }
  assert(signingFailed, "destination failure propagates safely");
  equal(binds, 1, "failed signing never binds credentials");
});

test("Supabase dispatch adapter accepts the documented signed-upload data.url field", async () => {
  const path = "validated/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/full.m4a";
  const calls: FetchCall[] = [];
  const adapters = createSupabaseDispatchAdapters(CONFIG, scriptedFetch([
    ({ url, init }) => {
      equal(url, `${PROJECT_URL}/storage/v1/object/upload/sign/mark-media/${path}`, "signed-upload endpoint");
      equal(init?.redirect, "error", "signed-upload redirects denied");
      equal(JSON.parse(String(init?.body)).upsert, false, "signed upload cannot overwrite");
      return json({ url: `/object/upload/sign/mark-media/${path}?token=documented-shape` });
    },
  ], calls));
  const signed = await adapters.storage.signUpload(path);
  equal(
    signed,
    `${PROJECT_URL}/storage/v1/object/upload/sign/mark-media/${path}?token=documented-shape`,
    "documented URL normalized",
  );
  equal(calls.length, 1, "one Storage request");
});

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
if (failures > 0) throw new Error(`${failures} mark-media test(s) failed`);
