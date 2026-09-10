import {
  createSupabaseDispatchAdapters,
  createWorkerDispatches,
  type DispatchDependencies,
  type RuntimeConfig,
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
} from "../mark-media/index.ts";
import {
  decodeBase64UrlCanonical,
  randomWorkerToken,
  sha256Hex,
  type DispatchPrivateKey,
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
} from "../_shared/worker-envelope.ts";
import {
  assertCanonicalStoragePath,
  encodePath,
  normalizeProjectHost,
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
} from "../_shared/url-policy.ts";
import {
  MEDIA_BUCKET,
  PRIVATE_RESPONSE_HEADERS,
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
} from "../_shared/media-contract.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SCHEDULER_PATH = "/functions/v1/mark-media-ops/run";
const MAX_BODY_BYTES = 1024;
const MAX_EMPTY_ACK_READS = 4;

interface OperationsRequest {
  operation: "dispatch" | "cleanup";
  worker_execution_id: string;
  limit: number;
}

export interface ClaimedDeletion {
  deletion_id: string;
  attempt_id: string;
  bucket_id: typeof MEDIA_BUCKET;
  object_path: string;
  preview_path: string | null;
  lease_expires_at: string;
}

export interface CleanupDatabaseAdapter {
  claim(workerExecutionId: string, limit: number): Promise<ClaimedDeletion[]>;
  finalize(input: {
    deletionId: string;
    attemptId: string;
    outcome: "deleted" | "failed";
    objectEvidence: DeletionEvidence | null;
    previewEvidence: DeletionEvidence | null;
    errorCode: "STORAGE_DELETE_FAILED" | "OPERATIONS_UNAVAILABLE" | null;
  }): Promise<boolean>;
}

export interface CleanupStorageAdapter {
  removeAndProveMissing(path: string): Promise<DeletionEvidence>;
}

interface DeletionEvidence {
  path: string;
  outcome: "deleted" | "missing";
  observed_at: string;
}

export interface OperationsAdapter {
  dispatch: DispatchDependencies;
  cleanupDatabase: CleanupDatabaseAdapter;
  cleanupStorage: CleanupStorageAdapter;
  deliver(compactJws: string): Promise<boolean>;
}

export interface OperationsHandlerOptions {
  schedulerSecrets: readonly string[];
  now: () => Date;
  adapterFactory: () => OperationsAdapter;
  log?: (event: { event: "operations_failed"; operation: OperationsRequest["operation"] }) => void;
}

export function createMarkMediaOpsHandler(
  options: OperationsHandlerOptions = defaultOptions(),
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    // Authentication deliberately precedes method/path selection, body access,
    // JSON parsing, and construction of any service-role adapter.
    if (!await authenticateScheduler(request.headers.get("authorization"), options.schedulerSecrets)) {
      return fixedResponse(404);
    }
    if (request.method !== "POST" || new URL(request.url).pathname !== SCHEDULER_PATH) {
      return fixedResponse(404);
    }
    let payload: OperationsRequest | null;
    try {
      payload = parseOperationsRequest(await readBoundedJson(request, MAX_BODY_BYTES));
    } catch {
      return fixedResponse(404);
    }
    if (!payload) return fixedResponse(404);

    try {
      const adapter = options.adapterFactory();
      if (payload.operation === "dispatch") {
        const dispatches = await createWorkerDispatches(
          payload.worker_execution_id,
          payload.limit,
          adapter.dispatch,
        );
        // Each leased envelope is delivered once. A timeout, disconnect, or
        // malformed acknowledgement remains ambiguous until its DB lease ends.
        let deliveryFailed = false;
        for (const compact of dispatches) {
          try {
            if (!await adapter.deliver(compact)) deliveryFailed = true;
          } catch {
            deliveryFailed = true;
          }
        }
        if (deliveryFailed) throw new Error("dispatch acknowledgement unavailable");
      } else {
        await runCleanup(payload, adapter, options.now);
      }
    } catch {
      options.log?.({ event: "operations_failed", operation: payload.operation });
    }
    // A scheduler tick is always acknowledged after admission. This prevents
    // infrastructure-level immediate retry from violating lease ambiguity.
    return fixedResponse(204);
  };
}

async function runCleanup(
  request: OperationsRequest,
  adapter: OperationsAdapter,
  now: () => Date,
): Promise<void> {
  const claims = await adapter.cleanupDatabase.claim(request.worker_execution_id, request.limit);
  if (claims.length > request.limit) throw new Error("cleanup claim exceeded limit");
  for (const claim of claims) {
    validateClaim(claim, now());
    try {
      const objectEvidence = await adapter.cleanupStorage.removeAndProveMissing(claim.object_path);
      const previewEvidence = claim.preview_path
        ? await adapter.cleanupStorage.removeAndProveMissing(claim.preview_path)
        : null;
      await adapter.cleanupDatabase.finalize({
        deletionId: claim.deletion_id,
        attemptId: claim.attempt_id,
        outcome: "deleted",
        objectEvidence,
        previewEvidence,
        errorCode: null,
      });
    } catch {
      await adapter.cleanupDatabase.finalize({
        deletionId: claim.deletion_id,
        attemptId: claim.attempt_id,
        outcome: "failed",
        objectEvidence: null,
        previewEvidence: null,
        errorCode: "STORAGE_DELETE_FAILED",
      });
    }
  }
}

function validateClaim(claim: ClaimedDeletion, now: Date): void {
  if (!isExactRecord(claim, ["attempt_id", "bucket_id", "deletion_id", "lease_expires_at", "object_path", "preview_path"]) ||
    !UUID_PATTERN.test(claim.deletion_id) || !UUID_PATTERN.test(claim.attempt_id) ||
    claim.bucket_id !== MEDIA_BUCKET || typeof claim.object_path !== "string" ||
    (claim.preview_path !== null && typeof claim.preview_path !== "string") ||
    typeof claim.lease_expires_at !== "string") {
    throw new Error("invalid cleanup claim");
  }
  assertDeletionPath(claim.object_path);
  if (claim.preview_path) assertDeletionPath(claim.preview_path);
  const lease = Date.parse(claim.lease_expires_at);
  if (!Number.isFinite(lease) || lease <= now.getTime()) throw new Error("expired cleanup claim");
}

function assertDeletionPath(path: string): void {
  const root = path.startsWith("staging/") ? "staging" : path.startsWith("validated/") ? "validated" : null;
  if (!root || /[*?\[\]{}]/.test(path)) throw new Error("invalid deletion path");
  assertCanonicalStoragePath(path, root);
}

export function createSupabaseOperationsAdapter(input: {
  config: RuntimeConfig;
  signingKey: DispatchPrivateKey;
  workerEndpoint: string;
  fetch: typeof fetch;
  now: () => Date;
}): OperationsAdapter {
  const projectHost = normalizeProjectHost(input.config.supabaseUrl);
  const endpoint = new URL(input.workerEndpoint);
  const workerHost = normalizeProjectHost(endpoint.origin);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
    endpoint.pathname !== "/v1/media-jobs" || workerHost === projectHost) {
    throw new Error("invalid worker endpoint");
  }
  const base = createSupabaseDispatchAdapters(input.config, input.fetch);
  const headers = serviceHeaders(input.config.serviceRoleKey);
  const rpc = async (name: string, body: Record<string, unknown>): Promise<unknown> => {
    const response = await input.fetch(`${input.config.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST", headers, body: JSON.stringify(body), redirect: "error",
    });
    if (!response.ok) throw new Error("operations unavailable");
    return response.json();
  };
  return {
    dispatch: {
      ...base,
      signingKey: input.signingKey,
      projectUrl: input.config.supabaseUrl,
      now: input.now,
      randomToken: randomWorkerToken,
    },
    deliver: async (compactJws) => {
      const response = await input.fetch(endpoint.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/jose" },
        body: compactJws,
        redirect: "error",
      });
      return response.status === 202 && await hasStrictlyEmptyBody(response);
    },
    cleanupDatabase: {
      claim: async (workerExecutionId, limit) => {
        const value = await rpc("claim_media_object_deletions", {
          p_limit: limit, p_worker_execution_id: workerExecutionId,
        });
        if (!Array.isArray(value)) throw new Error("invalid cleanup claim response");
        return value as ClaimedDeletion[];
      },
      finalize: async (value) => await rpc("finalize_media_object_deletion_attempt", {
        p_deletion_id: value.deletionId,
        p_attempt_id: value.attemptId,
        p_outcome: value.outcome,
        p_object_evidence: value.objectEvidence,
        p_preview_evidence: value.previewEvidence,
        p_error_code: value.errorCode,
      }) === true,
    },
    cleanupStorage: {
      removeAndProveMissing: async (path) => {
        assertDeletionPath(path);
        const url = `${input.config.supabaseUrl}/storage/v1/object/${MEDIA_BUCKET}/${encodePath(path)}`;
        const removed = await input.fetch(url, { method: "DELETE", headers, redirect: "error" });
        if (![200, 204, 404].includes(removed.status)) throw new Error("delete unavailable");
        const missing = await input.fetch(url, { method: "HEAD", headers, redirect: "error" });
        if (missing.status !== 404) throw new Error("delete not proven");
        return {
          path,
          outcome: removed.status === 404 ? "missing" : "deleted",
          observed_at: input.now().toISOString(),
        };
      },
    },
  };
}

async function hasStrictlyEmptyBody(response: Response): Promise<boolean> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) !== 0)) {
    await response.body?.cancel().catch(() => undefined);
    return false;
  }
  if (!response.body) return true;
  const reader = response.body.getReader();
  try {
    for (let reads = 0; reads < MAX_EMPTY_ACK_READS; reads += 1) {
      const chunk = await reader.read();
      if (chunk.done) return true;
      if (chunk.value.byteLength !== 0) {
        await reader.cancel().catch(() => undefined);
        return false;
      }
    }
    await reader.cancel().catch(() => undefined);
    return false;
  } finally {
    reader.releaseLock();
  }
}

async function authenticateScheduler(header: string | null, accepted: readonly string[]): Promise<boolean> {
  const match = header ? /^Bearer ([\x21-\x7e]{32,512})$/.exec(header) : null;
  const candidate = match?.[1] ?? "invalid-scheduler-credential";
  const candidateHash = await sha256Hex(candidate);
  let matched = 0;
  for (const secret of accepted) {
    const expectedHash = await sha256Hex(secret);
    matched |= constantTimeAsciiEqual(candidateHash, expectedHash) ? 1 : 0;
  }
  return match !== null && accepted.length > 0 && matched === 1;
}

function constantTimeAsciiEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function readBoundedJson(request: Request, maximumBytes: number): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maximumBytes)) {
    throw new Error("request too large");
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maximumBytes) throw new Error("request too large");
  return JSON.parse(body);
}

function parseOperationsRequest(value: unknown): OperationsRequest | null {
  if (!isExactRecord(value, ["limit", "operation", "worker_execution_id"]) ||
    (value.operation !== "dispatch" && value.operation !== "cleanup") ||
    typeof value.worker_execution_id !== "string" || !UUID_PATTERN.test(value.worker_execution_id) ||
    !Number.isInteger(value.limit) || (value.limit as number) < 1 || (value.limit as number) > 5) return null;
  return value as unknown as OperationsRequest;
}

function isExactRecord(value: unknown, keys: string[]): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}

function fixedResponse(status: 204 | 404): Response {
  return new Response(status === 204 ? null : '{"status":"unavailable"}', {
    status,
    headers: PRIVATE_RESPONSE_HEADERS,
  });
}

function serviceHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    "Content-Type": "application/json",
    "X-Client-Info": "the-wall-mark-media-ops/1",
  };
}

function defaultOptions(): OperationsHandlerOptions {
  const runtime = (globalThis as unknown as { Deno?: { env?: { get(name: string): string | undefined } } }).Deno;
  const env = (name: string) => runtime?.env?.get(name) ?? "";
  const schedulerSecrets = [env("MARK_MEDIA_SCHEDULER_SECRET"), env("MARK_MEDIA_SCHEDULER_PREVIOUS_SECRET")]
    .filter((value) => value.length >= 32);
  return {
    schedulerSecrets,
    now: () => new Date(),
    adapterFactory: () => createSupabaseOperationsAdapter({
      config: {
        supabaseUrl: env("SUPABASE_URL"),
        anonKey: env("SUPABASE_ANON_KEY"),
        serviceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),
      },
      signingKey: {
        kid: env("MARK_MEDIA_DISPATCH_KID"),
        pkcs8: decodeBase64UrlCanonical(env("MARK_MEDIA_DISPATCH_PRIVATE_KEY_PKCS8")),
      },
      workerEndpoint: env("MARK_MEDIA_PROCESSOR_ENDPOINT"),
      fetch,
      now: () => new Date(),
    }),
    log: (event) => console.error(JSON.stringify(event)),
  };
}

const runtime = (globalThis as unknown as {
  Deno?: { serve?: (handler: (request: Request) => Promise<Response>) => void };
}).Deno;
if (runtime?.serve) runtime.serve(createMarkMediaOpsHandler());
