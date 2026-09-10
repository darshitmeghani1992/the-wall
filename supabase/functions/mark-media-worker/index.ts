// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
import { isPlainRecord, isUuid } from "../_shared/media-contract.ts";
import {
  decodeBase64UrlCanonical,
  sha256Hex,
  verifyDispatchEnvelope,
  type DispatchPublicKey,
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
} from "../_shared/worker-envelope.ts";

const BODY_LIMIT_BYTES = 65_536;
const NO_STORE_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  Pragma: "no-cache",
  "Content-Type": "application/json; charset=utf-8",
});

export interface WorkerDatabaseAdapter {
  redeemDispatch(input: { uploadId: string; attemptId: string; nonce: string; kid: string }): Promise<boolean>;
  finalize(input: {
    uploadId: string;
    attemptId: string;
    completionToken: string;
    kid: string;
    outcome: "success" | "failed";
    result: Record<string, unknown>;
  }): Promise<boolean>;
}

interface WorkerHandlerConfig {
  projectHost: string;
  gatewaySecrets: readonly GatewaySecret[];
  publicKeys: readonly DispatchPublicKey[];
  nowSeconds: () => number;
  adapterFactory: () => WorkerDatabaseAdapter;
}

export interface GatewaySecret {
  value: string;
  notAfterSeconds: number | null;
}

export function createMarkMediaWorkerHandler(config: WorkerHandlerConfig): (request: Request) => Promise<Response> {
  validateConfig(config);
  return async (request: Request): Promise<Response> => {
    if (!await hasValidGatewaySecret(
      request.headers.get("authorization"),
      config.gatewaySecrets,
      config.nowSeconds(),
    )) {
      return fixedResponse(401, "UNAUTHORIZED");
    }
    if (request.method !== "POST") return fixedResponse(404, "UNAVAILABLE");
    const path = new URL(request.url).pathname;

    if (path === "/functions/v1/mark-media-worker/worker/redeem") {
      const token = readDispatchToken(request.headers.get("x-the-wall-job-token"));
      if (!token) return fixedResponse(404, "UNAVAILABLE");
      try {
        if (await readOptionalEmptyBody(request) === null) return fixedResponse(404, "UNAVAILABLE");
        const verified = await verifyDispatchEnvelope(token, config.publicKeys, {
          projectHost: config.projectHost,
          nowSeconds: config.nowSeconds(),
        });
        const accepted = await config.adapterFactory().redeemDispatch({
          uploadId: verified.payload.upload_id,
          attemptId: verified.payload.attempt_id,
          nonce: verified.payload.nonce,
          kid: verified.kid,
        });
        return accepted ? fixedResponse(204) : fixedResponse(404, "UNAVAILABLE");
      } catch {
        return fixedResponse(404, "UNAVAILABLE");
      }
    }

    const outcome = path === "/functions/v1/mark-media-worker/worker/complete"
      ? "success"
      : path === "/functions/v1/mark-media-worker/worker/fail"
      ? "failed"
      : null;
    if (!outcome) return fixedResponse(404, "UNAVAILABLE");
    const token = readCompletionToken(request.headers.get("x-the-wall-job-token"));
    if (!token) return fixedResponse(404, "UNAVAILABLE");

    let body: unknown;
    try {
      body = await readBoundedJson(request);
    } catch {
      return fixedResponse(422, "INVALID_RESULT");
    }
    const callback = parseCallbackBody(body, outcome);
    if (!callback) return fixedResponse(422, "INVALID_RESULT");
    try {
      const accepted = await config.adapterFactory().finalize({
        uploadId: callback.upload_id,
        attemptId: callback.attempt_id,
        completionToken: token,
        kid: callback.kid,
        outcome,
        result: callback.result,
      });
      return accepted ? fixedResponse(204) : fixedResponse(404, "UNAVAILABLE");
    } catch {
      return fixedResponse(404, "UNAVAILABLE");
    }
  };
}

async function hasValidGatewaySecret(
  header: string | null,
  acceptedSecrets: readonly GatewaySecret[],
  nowSeconds: number,
): Promise<boolean> {
  const match = header && header.length <= 519 ? /^Bearer ([A-Za-z0-9._~-]{32,512})$/.exec(header) : null;
  const candidate = match?.[1] ?? "invalid-gateway-secret-placeholder";
  const candidateDigest = await sha256Hex(candidate);
  let accepted = 0;
  for (const secret of acceptedSecrets) {
    const expectedDigest = await sha256Hex(secret.value);
    const live = secret.notAfterSeconds === null || secret.notAfterSeconds > nowSeconds;
    accepted |= constantTimeEqual(candidateDigest, expectedDigest) && live ? 1 : 0;
  }
  return accepted === 1 && match !== null;
}

function readDispatchToken(header: string | null): string | null {
  if (!header || header.length > 65_536 || /\s/.test(header)) return null;
  return header;
}

function readCompletionToken(header: string | null): string | null {
  return header && /^[A-Za-z0-9_-]{43}$/.test(header) ? header : null;
}

async function readOptionalEmptyBody(request: Request): Promise<unknown | null> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > BODY_LIMIT_BYTES)) return null;
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > BODY_LIMIT_BYTES) return null;
  if (!text) return {};
  try {
    const value: unknown = JSON.parse(text);
    return isPlainRecord(value) && Object.keys(value).length === 0 ? value : null;
  } catch {
    return null;
  }
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > BODY_LIMIT_BYTES)) throw new Error("too large");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > BODY_LIMIT_BYTES) throw new Error("too large");
  return JSON.parse(text);
}

function parseCallbackBody(value: unknown, outcome: "success" | "failed") {
  if (!isPlainRecord(value)) return null;
  if (!hasExactKeys(value, ["attempt_id", "kid", "result", "upload_id"]) ||
    !isUuid(value.upload_id) || !isUuid(value.attempt_id) || typeof value.kid !== "string" ||
    !/^[A-Za-z0-9_-]{1,32}$/.test(value.kid) || !isPlainRecord(value.result)) return null;
  if (outcome === "failed") {
    if (!hasExactKeys(value.result, ["error_code"]) || typeof value.result.error_code !== "string" ||
      !/^[A-Z][A-Z0-9_]{0,63}$/.test(value.result.error_code)) return null;
  } else if (!isValidSuccessResult(value.result)) {
    return null;
  }
  return {
    upload_id: value.upload_id,
    attempt_id: value.attempt_id,
    kid: value.kid,
    result: value.result,
  };
}

function isValidSuccessResult(value: Record<string, unknown>): boolean {
  if (!hasExactKeys(value, [
    "cache_control_seconds", "detected_mime", "duration_ms", "height", "preview_path", "sha256",
    "validated_bytes", "validated_path", "width",
  ])) return false;
  return typeof value.detected_mime === "string" && value.detected_mime.length <= 128 &&
    Number.isSafeInteger(value.validated_bytes) && Number(value.validated_bytes) > 0 &&
    typeof value.sha256 === "string" && /^[0-9a-f]{64}$/.test(value.sha256) &&
    nullablePositiveInteger(value.width) && nullablePositiveInteger(value.height) &&
    nullablePositiveInteger(value.duration_ms) && typeof value.validated_path === "string" &&
    (value.preview_path === null || typeof value.preview_path === "string") && value.cache_control_seconds === 60;
}

function nullablePositiveInteger(value: unknown): boolean {
  return value === null || (Number.isSafeInteger(value) && Number(value) > 0);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function fixedResponse(status: number, code?: string): Response {
  return new Response(code ? JSON.stringify({ code }) : null, { status, headers: NO_STORE_HEADERS });
}

function validateConfig(config: WorkerHandlerConfig): void {
  if (config.gatewaySecrets.length < 1 || config.gatewaySecrets.length > 2 ||
    config.gatewaySecrets.filter((secret) => secret.notAfterSeconds === null).length !== 1 ||
    config.gatewaySecrets.some((secret) => !/^[A-Za-z0-9._~-]{32,512}$/.test(secret.value)) ||
    config.gatewaySecrets.some((secret) => secret.notAfterSeconds !== null &&
      (!Number.isSafeInteger(secret.notAfterSeconds) || secret.notAfterSeconds > config.nowSeconds() + 300)) ||
    config.publicKeys.length < 1 || config.publicKeys.some((key) => key.raw.length !== 32)) {
    throw new Error("invalid worker gateway configuration");
  }
}

function createRuntimeAdapter(): WorkerDatabaseAdapter {
  const runtime = (globalThis as unknown as { Deno?: { env?: { get(name: string): string | undefined } } }).Deno;
  const url = runtime?.env?.get("SUPABASE_URL") ?? "";
  const serviceKey = runtime?.env?.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) throw new Error("missing service configuration");
  const callBooleanRpc = async (name: string, body: Record<string, unknown>): Promise<boolean> => {
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      redirect: "error",
    });
    return response.ok && await response.json() === true;
  };
  return {
    redeemDispatch: (input) => callBooleanRpc("redeem_media_validation_dispatch_nonce", {
      p_upload_id: input.uploadId,
      p_attempt_id: input.attemptId,
      p_nonce: input.nonce,
      p_kid: input.kid,
    }),
    finalize: (input) => callBooleanRpc("finalize_media_validation_attempt", {
      p_upload_id: input.uploadId,
      p_attempt_id: input.attemptId,
      p_raw_completion_token: input.completionToken,
      p_kid: input.kid,
      p_outcome: input.outcome,
      p_result: input.result,
    }),
  };
}

function readPublicKeys(value: string): DispatchPublicKey[] {
  const parsed: unknown = JSON.parse(value);
  if (!isPlainRecord(parsed)) throw new Error("invalid public-key allow-list");
  return Object.entries(parsed).map(([kid, encoded]) => ({
    kid,
    raw: typeof encoded === "string" ? decodeBase64UrlCanonical(encoded) : new Uint8Array(),
  }));
}

const runtime = (globalThis as unknown as {
  Deno?: { env?: { get(name: string): string | undefined }; serve?: (handler: (request: Request) => Promise<Response>) => void };
}).Deno;

if (runtime?.serve) {
  const currentSecret = runtime.env?.get("MARK_MEDIA_WORKER_GATEWAY_SECRET") ?? "";
  const previousSecret = runtime.env?.get("MARK_MEDIA_WORKER_GATEWAY_PREVIOUS_SECRET");
  const previousExpiresAt = Number(runtime.env?.get("MARK_MEDIA_WORKER_GATEWAY_PREVIOUS_EXPIRES_AT"));
  runtime.serve(createMarkMediaWorkerHandler({
    projectHost: runtime.env?.get("SUPABASE_URL") ?? "",
    gatewaySecrets: previousSecret
      ? [
        { value: currentSecret, notAfterSeconds: null },
        { value: previousSecret, notAfterSeconds: previousExpiresAt },
      ]
      : [{ value: currentSecret, notAfterSeconds: null }],
    publicKeys: readPublicKeys(runtime.env?.get("MARK_MEDIA_WORKER_PUBLIC_KEYS") ?? "{}"),
    nowSeconds: () => Math.floor(Date.now() / 1000),
    adapterFactory: createRuntimeAdapter,
  }));
}
