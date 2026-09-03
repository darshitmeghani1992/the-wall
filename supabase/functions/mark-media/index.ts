import {
  jsonResponse,
  MANIFEST_TTL_SECONDS,
  MEDIA_BUCKET,
  parseReadRequest,
  parseResolvedMediaRows,
  PRIVATE_RESPONSE_HEADERS,
  type ReadManifest,
  type SignedMediaItem,
  unavailableResponse,
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
} from "../_shared/media-contract.ts";
import {
  assertCanonicalStoragePath,
  assertSignedStorageUrl,
  encodePath,
  normalizeProjectHost,
  resolveSignedStorageUrl,
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
} from "../_shared/url-policy.ts";
import {
  sha256Hex,
  signDispatchEnvelope,
  type DispatchPrivateKey,
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
} from "../_shared/worker-envelope.ts";
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
import type { MediaKind, WorkerDestination, WorkerDispatchPayload } from "../_shared/media-contract.ts";

export interface RuntimeConfig {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
}

interface HandlerDependencies {
  fetch: typeof fetch;
  now: () => Date;
  config: RuntimeConfig;
}

interface AuthUser {
  id: string;
}

export interface ClaimedMediaAttempt {
  id: string;
  attempt_id: string;
  source_path: string;
  validated_path: string;
  kind: MediaKind;
}

export interface DispatchDatabaseAdapter {
  claim(workerExecutionId: string, limit: number): Promise<ClaimedMediaAttempt[]>;
  bind(input: {
    uploadId: string;
    attemptId: string;
    dispatchNonceHash: string;
    completionTokenHash: string;
    kid: string;
    dispatchEnvelopeExpiresAt: string;
    signedUrlsReturnedAt: string;
    outputCredentialsExpireAt: string;
  }): Promise<boolean>;
}

export interface DispatchStorageAdapter {
  signDownload(path: string, expiresInSeconds: 120): Promise<string>;
  signUpload(path: string): Promise<string>;
}

export interface DispatchDependencies {
  database: DispatchDatabaseAdapter;
  storage: DispatchStorageAdapter;
  signingKey: DispatchPrivateKey;
  projectUrl: string;
  now: () => Date;
  randomToken: () => string;
}

export function createSupabaseDispatchAdapters(
  config: RuntimeConfig,
  fetchImplementation: typeof fetch = fetch,
): { database: DispatchDatabaseAdapter; storage: DispatchStorageAdapter } {
  validateRuntimeConfig(config);
  const rpc = async (name: string, body: Record<string, unknown>): Promise<unknown> => {
    const response = await fetchImplementation(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: serviceHeaders(config),
      body: JSON.stringify(body),
      redirect: "error",
    });
    if (!response.ok) throw new Error("media orchestration unavailable");
    return response.json();
  };
  const sign = async (path: string, upload: boolean): Promise<string> => {
    const route = upload ? "upload/sign" : "sign";
    const response = await fetchImplementation(
      `${config.supabaseUrl}/storage/v1/object/${route}/${MEDIA_BUCKET}/${encodePath(path)}`,
      {
        method: "POST",
        headers: serviceHeaders(config),
        body: JSON.stringify(upload ? { upsert: false } : { expiresIn: 120 }),
        redirect: "error",
      },
    );
    if (!response.ok) throw new Error("media credential creation unavailable");
    const value: unknown = await response.json();
    if (typeof value !== "object" || value === null) throw new Error("invalid Storage response");
    const candidate = "signedURL" in value && typeof value.signedURL === "string"
      ? value.signedURL
      : "signedUrl" in value && typeof value.signedUrl === "string"
      ? value.signedUrl
      : upload && "url" in value && typeof value.url === "string"
      ? value.url
      : null;
    if (!candidate) throw new Error("missing Storage credential");
    return resolveSignedStorageUrl(config.supabaseUrl, candidate);
  };
  return {
    database: {
      claim: async (workerExecutionId, limit) => {
        const value = await rpc("claim_media_validation_jobs", {
          p_limit: limit,
          p_worker_execution_id: workerExecutionId,
        });
        if (!Array.isArray(value)) throw new Error("invalid claim response");
        return value as ClaimedMediaAttempt[];
      },
      bind: async (input) => await rpc("bind_media_validation_attempt_credentials", {
        p_upload_id: input.uploadId,
        p_attempt_id: input.attemptId,
        p_dispatch_nonce_hash: input.dispatchNonceHash,
        p_completion_token_hash: input.completionTokenHash,
        p_kid: input.kid,
        p_dispatch_envelope_expires_at: input.dispatchEnvelopeExpiresAt,
        p_signed_urls_returned_at: input.signedUrlsReturnedAt,
        p_output_credentials_expire_at: input.outputCredentialsExpireAt,
      }) === true,
    },
    storage: {
      signDownload: (path) => sign(path, false),
      signUpload: (path) => sign(path, true),
    },
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createMarkMediaHandler(overrides?: Partial<HandlerDependencies>): (request: Request) => Promise<Response> {
  const dependencies: HandlerDependencies = {
    fetch,
    now: () => new Date(),
    config: readRuntimeConfig(),
    ...overrides,
  };
  validateRuntimeConfig(dependencies.config);

  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST" ||
      new URL(request.url).pathname !== "/functions/v1/mark-media/read") {
      return unavailableResponse(404);
    }
    return handleRead(request, dependencies);
  };
}

export async function createWorkerDispatches(
  workerExecutionId: string,
  limit: number,
  dependencies: DispatchDependencies,
): Promise<string[]> {
  if (!UUID_PATTERN.test(workerExecutionId) || !Number.isInteger(limit) || limit < 1 || limit > 5) {
    throw new Error("invalid dispatch request");
  }
  const projectHost = normalizeProjectHost(dependencies.projectUrl);
  const attempts = await dependencies.database.claim(workerExecutionId, limit);
  if (attempts.length > limit) throw new Error("claim exceeded requested limit");
  const dispatches: string[] = [];
  for (const attempt of attempts) {
    validateClaimedAttempt(attempt);
    const dispatchNonce = dependencies.randomToken();
    const completionToken = dependencies.randomToken();
    if (dispatchNonce === completionToken) throw new Error("worker credentials must be distinct");

    assertCanonicalStoragePath(attempt.source_path, "staging");
    const sourceUrl = await dependencies.storage.signDownload(attempt.source_path, 120);
    assertSignedStorageUrl(sourceUrl, attempt.source_path, { projectHost, bucket: MEDIA_BUCKET }, "download");
    const destinations = destinationTemplates(attempt);
    const signedDestinations: WorkerDestination[] = [];
    for (const destination of destinations) {
      const url = await dependencies.storage.signUpload(destination.path);
      assertSignedStorageUrl(url, destination.path, { projectHost, bucket: MEDIA_BUCKET }, "upload");
      signedDestinations.push({ ...destination, url });
    }

    // This timestamp is deliberately captured after the final signed-upload
    // response. The database independently enforces the same non-shrinking
    // fence before it permits dispatch redemption or output cleanup.
    const signedUrlsReturnedAt = dependencies.now();
    const outputCredentialsExpireAt = new Date(signedUrlsReturnedAt.getTime() + 2.5 * 60 * 60 * 1000);
    const iat = Math.floor(signedUrlsReturnedAt.getTime() / 1000);
    const exp = iat + 120;
    const bound = await dependencies.database.bind({
      uploadId: attempt.id,
      attemptId: attempt.attempt_id,
      dispatchNonceHash: await sha256Hex(dispatchNonce),
      completionTokenHash: await sha256Hex(completionToken),
      kid: dependencies.signingKey.kid,
      dispatchEnvelopeExpiresAt: new Date(exp * 1000).toISOString(),
      signedUrlsReturnedAt: signedUrlsReturnedAt.toISOString(),
      outputCredentialsExpireAt: outputCredentialsExpireAt.toISOString(),
    });
    if (!bound) continue;

    const payload: WorkerDispatchPayload = {
      version: 1,
      issuer: "the-wall-mark-media-edge",
      audience: "the-wall-media-processor",
      purpose: "dispatch",
      job_id: workerExecutionId,
      upload_id: attempt.id,
      attempt_id: attempt.attempt_id,
      kind: attempt.kind,
      source: { method: "GET", path: attempt.source_path, url: sourceUrl },
      destinations: signedDestinations,
      callback_url: `${dependencies.projectUrl.replace(/\/$/, "")}/functions/v1/mark-media-worker/worker/complete`,
      nonce: dispatchNonce,
      completion_token: completionToken,
      iat,
      exp,
    };
    dispatches.push(await signDispatchEnvelope(payload, dependencies.signingKey, {
      projectHost,
      nowSeconds: iat,
    }));
  }
  return dispatches;
}

function validateClaimedAttempt(value: ClaimedMediaAttempt): void {
  if (!UUID_PATTERN.test(value.id) || !UUID_PATTERN.test(value.attempt_id) ||
    (value.kind !== "photo" && value.kind !== "voice" && value.kind !== "video") ||
    typeof value.source_path !== "string" || typeof value.validated_path !== "string") {
    throw new Error("invalid claimed attempt");
  }
  const expectedBase = `validated/${value.id}/${value.attempt_id}/full`;
  if (value.validated_path !== expectedBase) throw new Error("claimed attempt path mismatch");
}

function destinationTemplates(attempt: ClaimedMediaAttempt): Array<Omit<WorkerDestination, "url">> {
  const directory = `validated/${attempt.id}/${attempt.attempt_id}`;
  if (attempt.kind === "photo") {
    return [
      { role: "full_jpeg", method: "PUT", path: `${directory}/full.jpg`, mime_type: "image/jpeg", cache_control_seconds: 60 },
      { role: "full_webp", method: "PUT", path: `${directory}/full.webp`, mime_type: "image/webp", cache_control_seconds: 60 },
      { role: "preview", method: "PUT", path: `${directory}/thumb.webp`, mime_type: "image/webp", cache_control_seconds: 60 },
    ];
  }
  if (attempt.kind === "voice") {
    return [{ role: "full", method: "PUT", path: `${directory}/full.m4a`, mime_type: "audio/mp4", cache_control_seconds: 60 }];
  }
  return [
    { role: "full", method: "PUT", path: `${directory}/full.mp4`, mime_type: "video/mp4", cache_control_seconds: 60 },
    { role: "preview", method: "PUT", path: `${directory}/poster.webp`, mime_type: "image/webp", cache_control_seconds: 60 },
  ];
}

async function handleRead(request: Request, dependencies: HandlerDependencies): Promise<Response> {
  try {
    const bearer = readBearer(request.headers.get("authorization"));
    if (!bearer) return unavailableResponse(404);
    const actor = await verifyUserJwt(bearer, dependencies);
    if (!actor) return unavailableResponse(404);

    const payload = parseReadRequest(await readBoundedJson(request, 2048));
    if (!payload) return unavailableResponse(404);

    const rows = await resolveMedia(actor.id, payload.mark_id, payload.request_id, dependencies);
    if (!rows) return unavailableResponse(404);

    const items: SignedMediaItem[] = [];
    for (const row of rows) {
      assertCanonicalStoragePath(row.storage_path, "validated");
      const url = await signReadPath(row.storage_path, dependencies);
      let previewUrl: string | undefined;
      if (row.preview_path) {
        assertCanonicalStoragePath(row.preview_path, "validated");
        previewUrl = await signReadPath(row.preview_path, dependencies);
      }
      items.push({
        position: row.position,
        media_type: row.media_type,
        url,
        ...(previewUrl ? { preview_url: previewUrl } : {}),
        mime_type: row.mime_type,
        byte_size: row.byte_size,
        ...(row.width === null ? {} : { width: row.width }),
        ...(row.height === null ? {} : { height: row.height }),
        ...(row.duration_ms === null ? {} : { duration_ms: row.duration_ms }),
        sha256: row.sha256,
      });
    }

    const response: ReadManifest = {
      status: "ready",
      expires_at: new Date(dependencies.now().getTime() + MANIFEST_TTL_SECONDS * 1000).toISOString(),
      items,
    };
    return jsonResponse(response);
  } catch {
    // The public contract deliberately collapses parse, auth, authorization,
    // resolver, and signing failures so Mark existence and block state cannot leak.
    return unavailableResponse(404);
  }
}

async function verifyUserJwt(token: string, dependencies: HandlerDependencies): Promise<AuthUser | null> {
  const response = await dependencies.fetch(`${dependencies.config.supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: dependencies.config.anonKey,
      "X-Client-Info": "the-wall-mark-media/1",
    },
    redirect: "error",
  });
  if (!response.ok) return null;
  const value: unknown = await response.json();
  if (typeof value !== "object" || value === null || !("id" in value) ||
    typeof value.id !== "string" || !UUID_PATTERN.test(value.id)) {
    return null;
  }
  return { id: value.id };
}

async function resolveMedia(
  actorId: string,
  markId: string,
  requestId: string,
  dependencies: HandlerDependencies,
) {
  const response = await dependencies.fetch(
    `${dependencies.config.supabaseUrl}/rest/v1/rpc/resolve_mark_media_for_signing`,
    {
      method: "POST",
      headers: serviceHeaders(dependencies.config),
      body: JSON.stringify({ p_actor_id: actorId, p_mark_id: markId, p_request_id: requestId }),
      redirect: "error",
    },
  );
  if (!response.ok) return null;
  return parseResolvedMediaRows(await response.json());
}

async function signReadPath(path: string, dependencies: HandlerDependencies): Promise<string> {
  const response = await dependencies.fetch(
    `${dependencies.config.supabaseUrl}/storage/v1/object/sign/${MEDIA_BUCKET}/${encodePath(path)}`,
    {
      method: "POST",
      headers: serviceHeaders(dependencies.config),
      body: JSON.stringify({ expiresIn: MANIFEST_TTL_SECONDS }),
      redirect: "error",
    },
  );
  if (!response.ok) throw new Error("signing failed");
  const value: unknown = await response.json();
  if (typeof value !== "object" || value === null) throw new Error("invalid signing response");
  const candidate = "signedURL" in value && typeof value.signedURL === "string"
    ? value.signedURL
    : "signedUrl" in value && typeof value.signedUrl === "string"
    ? value.signedUrl
    : null;
  if (!candidate) throw new Error("missing signed URL");
  const signedUrl = resolveSignedStorageUrl(dependencies.config.supabaseUrl, candidate);
  assertSignedStorageUrl(signedUrl, path, {
    projectHost: normalizeProjectHost(dependencies.config.supabaseUrl),
    bucket: MEDIA_BUCKET,
  }, "download");
  return signedUrl;
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

function readBearer(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(header);
  return match?.[1] ?? null;
}

function serviceHeaders(config: RuntimeConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.serviceRoleKey}`,
    apikey: config.serviceRoleKey,
    "Content-Type": "application/json",
    "X-Client-Info": "the-wall-mark-media/1",
  };
}

function readRuntimeConfig(): RuntimeConfig {
  const runtime = (globalThis as unknown as {
    Deno?: { env?: { get(name: string): string | undefined } };
  }).Deno;
  return {
    supabaseUrl: runtime?.env?.get("SUPABASE_URL") ?? "",
    anonKey: runtime?.env?.get("SUPABASE_ANON_KEY") ?? "",
    serviceRoleKey: runtime?.env?.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  };
}

function validateRuntimeConfig(config: RuntimeConfig): void {
  normalizeProjectHost(config.supabaseUrl);
  if (!config.anonKey || !config.serviceRoleKey || config.anonKey === config.serviceRoleKey) {
    throw new Error("invalid mark-media function configuration");
  }
}

const runtime = (globalThis as unknown as {
  Deno?: { serve?: (handler: (request: Request) => Promise<Response>) => void };
}).Deno;

if (runtime?.serve) runtime.serve(createMarkMediaHandler());

export { PRIVATE_RESPONSE_HEADERS };
