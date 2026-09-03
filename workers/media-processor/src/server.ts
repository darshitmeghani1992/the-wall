import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CompletionReporter,
  DispatchNonceRedeemer,
  EnvelopeVerifier,
  ProcessedMedia,
  ProcessedObject,
  VerifiedWorkerDispatch,
  WorkerObjectTarget,
} from "./contract.js";
import { completionAuthorization } from "./contract.js";
import { INPUT_BYTES, MediaProcessingError, WALL_TIME_MS, type MediaKind } from "./limits.js";
import { processPhoto } from "./photo.js";
import { processAudio } from "./audio.js";
import { processVideo } from "./video.js";
import {
  assertCallbackUrl,
  assertFinalResponseOrigin,
  assertHostnameResolvesPublic,
  assertStorageObjectUrl,
  type UrlPolicy,
} from "./url-policy.js";

export interface SafeLogger {
  info(event: string, fields: Record<string, string | number>): void;
  error(event: string, fields: Record<string, string | number>): void;
}

export interface ProcessorDependencies {
  verifier: EnvelopeVerifier;
  nonceRedeemer: DispatchNonceRedeemer;
  completionReporter: CompletionReporter;
  urlPolicy: UrlPolicy;
  fetchImpl?: typeof fetch;
  logger?: SafeLogger;
  now?: () => number;
  resolveHostname?: (hostname: string, signal: AbortSignal) => Promise<void>;
  /** Test-only shortening; clamped so it can never widen the contract limit. */
  testOnlyAttemptTimeoutMs?: number;
}

/**
 * Runs one isolated attempt. C2 supplies the signature verifier, atomic nonce
 * redeemer and attempt-bound completion reporter. This function intentionally
 * has no fallback implementations: missing security adapters cannot fail open.
 */
export async function processEnvelope(serializedEnvelope: string, dependencies: ProcessorDependencies): Promise<void> {
  const startedAt = Date.now();
  const now = dependencies.now ?? Date.now;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  let claims: VerifiedWorkerDispatch | undefined;
  let workspace: string | undefined;
  let networkBindingsValidated = false;
  let dispatchRedeemed = false;
  let finalizationStarted = false;
  let deadlineMs: number | undefined;
  try {
    claims = await dependencies.verifier.verify(serializedEnvelope, Math.floor(now() / 1_000));
    const testTimeout = dependencies.testOnlyAttemptTimeoutMs ?? WALL_TIME_MS[claims.kind];
    deadlineMs = startedAt + Math.min(WALL_TIME_MS[claims.kind], Math.max(1, testTimeout));
    validateNetworkBindings(claims, dependencies.urlPolicy);
    networkBindingsValidated = true;
    const resolveHostname = dependencies.resolveHostname ??
      ((hostname: string, signal: AbortSignal) => assertHostnameResolvesPublic(hostname, undefined, signal));
    await resolveHostname(dependencies.urlPolicy.storageHostname, deadlineSignal(deadlineMs));
    const callbackHostname = new URL(dependencies.urlPolicy.callbackOrigin).hostname;
    if (callbackHostname !== dependencies.urlPolicy.storageHostname) {
      await resolveHostname(callbackHostname, deadlineSignal(deadlineMs));
    }

    const redeemed = await dependencies.nonceRedeemer.redeem(serializedEnvelope, deadlineSignal(deadlineMs));
    if (!redeemed) throw new MediaProcessingError("INVALID_MEDIA", "dispatch nonce was rejected");
    dispatchRedeemed = true;

    workspace = await mkdtemp(join(tmpdir(), "the-wall-media-"));
    const sourcePath = join(workspace, "source");
    await downloadSource(fetchImpl, claims, sourcePath, dependencies.urlPolicy, deadlineMs);
    const processed = await processLocalMedia(claims, sourcePath, workspace, deadlineMs);
    await uploadProcessedObjects(fetchImpl, claims, processed, dependencies.urlPolicy, deadlineMs);
    const completionSignal = deadlineSignal(deadlineMs);
    finalizationStarted = true;
    await dependencies.completionReporter.complete(completionAuthorization(claims), processed, completionSignal);
    dependencies.logger?.info("media_job_completed", safeFields(claims, startedAt));
  } catch (error) {
    const safeError = error instanceof MediaProcessingError
      ? error
      : new MediaProcessingError("PROCESSING_FAILED", "media processing attempt failed");
    const code = safeError.code;
    if (claims && networkBindingsValidated && dispatchRedeemed && !finalizationStarted) {
      try {
        if (!deadlineMs) throw new Error("attempt deadline unavailable");
        await dependencies.completionReporter.fail(completionAuthorization(claims), code, deadlineSignal(deadlineMs));
      } catch {
        // C2's lease retry is authoritative. Never replace the original safe error
        // with callback details, which may contain a signed credential.
      }
      dependencies.logger?.error("media_job_failed", { ...safeFields(claims, startedAt), error_code: code });
    }
    throw safeError;
  } finally {
    if (workspace) await rm(workspace, { recursive: true, force: true });
  }
}

function validateNetworkBindings(claims: VerifiedWorkerDispatch, policy: UrlPolicy): void {
  assertStorageObjectUrl(claims.source.url, claims.source.path, "download", policy);
  for (const destination of claims.destinations) {
    assertStorageObjectUrl(destination.url, destination.path, "upload", policy);
  }
  assertCallbackUrl(claims.callback_url, policy);
}

async function downloadSource(
  fetchImpl: typeof fetch,
  claims: VerifiedWorkerDispatch,
  destinationPath: string,
  policy: UrlPolicy,
  deadlineMs: number,
): Promise<void> {
  const expected = assertStorageObjectUrl(claims.source.url, claims.source.path, "download", policy);
  let response: Response;
  try {
    response = await fetchImpl(expected, { method: "GET", redirect: "error", cache: "no-store", signal: deadlineSignal(deadlineMs) });
  } catch {
    throw new MediaProcessingError("PROCESSING_FAILED", "source download failed");
  }
  if (!response.ok || !response.body) throw new MediaProcessingError("PROCESSING_FAILED", "source download failed");
  if (response.url) assertFinalResponseOrigin(response.url, expected);
  const announcedLength = Number(response.headers.get("content-length"));
  const maximum = INPUT_BYTES[claims.kind];
  if (Number.isFinite(announcedLength) && announcedLength > maximum) throw new MediaProcessingError("TOO_LARGE", "source is too large");

  const handle = await (await import("node:fs/promises")).open(destinationPath, "wx", 0o600);
  let received = 0;
  try {
    const reader = response.body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.byteLength;
      if (received > maximum) {
        await reader.cancel();
        throw new MediaProcessingError("TOO_LARGE", "source stream exceeded its byte limit");
      }
      await handle.write(chunk.value);
    }
  } finally {
    await handle.close();
  }
  if (received === 0) throw new MediaProcessingError("INVALID_MEDIA", "source is empty");
}

async function processLocalMedia(
  claims: VerifiedWorkerDispatch,
  sourcePath: string,
  workspace: string,
  deadlineMs: number,
): Promise<ProcessedMedia> {
  const previewTarget = findOptionalTarget(claims.destinations, "preview");
  const previewPath = previewTarget ? join(workspace, "preview.webp") : undefined;
  if (claims.kind === "photo") {
    const jpegTarget = findTarget(claims.destinations, "full_jpeg");
    const webpTarget = findTarget(claims.destinations, "full_webp");
    const result = await processPhoto(sourcePath, join(workspace, "full.jpg"), join(workspace, "full.webp"), previewPath, deadlineMs);
    const selectedTarget = result.full.mimeType === "image/jpeg" ? jpegTarget : webpTarget;
    return assembleResult("photo", selectedTarget, result.full, previewTarget, result.preview);
  }
  const fullTarget = findTarget(claims.destinations, "full");
  const fullPath = join(workspace, "full" + extensionForMime(fullTarget.mime_type));
  if (claims.kind === "voice") {
    const result = await processAudio(sourcePath, fullPath, deadlineMs);
    return assembleResult("voice", fullTarget, result.full);
  }
  const result = await processVideo(sourcePath, fullPath, previewPath, deadlineMs);
  return assembleResult("video", fullTarget, result.full, previewTarget, result.preview);
}

function assembleResult(
  kind: MediaKind,
  fullTarget: WorkerObjectTarget,
  full: Omit<ProcessedObject, "path" | "role">,
  previewTarget?: WorkerObjectTarget,
  preview?: Omit<ProcessedObject, "path" | "role">,
): ProcessedMedia {
  if (full.mimeType !== fullTarget.mime_type) throw new MediaProcessingError("PROCESSING_FAILED", "full output MIME does not match destination");
  const result: ProcessedMedia = { kind, full: { ...full, role: fullTarget.role, path: fullTarget.path } };
  if (previewTarget || preview) {
    if (!previewTarget || !preview || preview.mimeType !== previewTarget.mime_type) {
      throw new MediaProcessingError("PROCESSING_FAILED", "preview output does not match destination");
    }
    result.preview = { ...preview, role: previewTarget.role, path: previewTarget.path };
  }
  return result;
}

async function uploadProcessedObjects(
  fetchImpl: typeof fetch,
  claims: VerifiedWorkerDispatch,
  processed: ProcessedMedia,
  policy: UrlPolicy,
  deadlineMs: number,
): Promise<void> {
  const objects = [processed.full, ...(processed.preview ? [processed.preview] : [])];
  for (const object of objects) {
    const target = claims.destinations.find((candidate) => candidate.path === object.path);
    if (!target) throw new MediaProcessingError("PROCESSING_FAILED", "output destination is missing");
    const expected = assertStorageObjectUrl(target.url, target.path, "upload", policy);
    const bytes = await readFile(object.localPath);
    let response: Response;
    try {
      response = await fetchImpl(expected, {
        method: "PUT",
        redirect: "error",
        signal: deadlineSignal(deadlineMs),
        headers: {
          "Content-Type": object.mimeType,
          "Cache-Control": "max-age=60",
          "Content-Length": String(bytes.byteLength),
          "x-upsert": "false",
        },
        body: bytes,
      });
    } catch {
      throw new MediaProcessingError("PROCESSING_FAILED", "canonical upload failed");
    }
    if (!response.ok) throw new MediaProcessingError("PROCESSING_FAILED", "canonical upload failed");
    if (response.url) assertFinalResponseOrigin(response.url, expected);
  }
}

function deadlineSignal(deadlineMs: number): AbortSignal {
  const remaining = Math.floor(deadlineMs - Date.now());
  if (remaining < 1) throw new MediaProcessingError("PROCESSING_FAILED", "media processing deadline exceeded");
  return AbortSignal.timeout(remaining);
}

function findTarget(destinations: WorkerObjectTarget[], role: WorkerObjectTarget["role"]): WorkerObjectTarget {
  const matches = destinations.filter((target) => target.role === role);
  if (matches.length !== 1) throw new MediaProcessingError("INVALID_MEDIA", "full destination is invalid");
  return matches[0]!;
}

function findOptionalTarget(destinations: WorkerObjectTarget[], role: WorkerObjectTarget["role"]): WorkerObjectTarget | undefined {
  const matches = destinations.filter((target) => target.role === role);
  if (matches.length > 1) throw new MediaProcessingError("INVALID_MEDIA", "preview destination is invalid");
  return matches[0];
}

function extensionForMime(mime: string): string {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  if (mime === "audio/mp4") return ".m4a";
  if (mime === "video/mp4") return ".mp4";
  throw new MediaProcessingError("INVALID_MEDIA", "destination MIME is not canonical");
}

function safeFields(claims: VerifiedWorkerDispatch, startedAt: number): Record<string, string | number> {
  return {
    job_id: claims.job_id,
    upload_id: claims.upload_id,
    attempt_id: claims.attempt_id,
    kind: claims.kind,
    elapsed_ms: Math.max(0, Date.now() - startedAt),
  };
}
