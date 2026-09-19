export const MEDIA_BUCKET = "mark-media";
export const MANIFEST_TTL_SECONDS = 60;
export const WORKER_ENVELOPE_TTL_SECONDS = 120;
export const MAX_MANIFEST_ITEMS = 5;

export const PRIVATE_RESPONSE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Content-Type": "application/json; charset=utf-8",
});

export type MediaKind = "photo" | "voice" | "video";

export interface ResolvedMediaRow {
  position: number;
  media_type: MediaKind;
  storage_path: string;
  preview_path: string | null;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  sha256: string;
}

export interface SignedMediaItem {
  position: number;
  media_type: MediaKind;
  url: string;
  preview_url: string | null;
  mime_type: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
}

export interface ReadManifest {
  status: "ready";
  expires_at: string;
  items: SignedMediaItem[];
}

export type WorkerDestinationRole = "full" | "full_jpeg" | "full_webp" | "preview";

export interface WorkerSource {
  method: "GET";
  path: string;
  url: string;
}

export interface WorkerDestination {
  role: WorkerDestinationRole;
  method: "PUT";
  path: string;
  url: string;
  mime_type: string;
  cache_control_seconds: 60;
}

export interface WorkerDispatchPayload {
  version: 1;
  issuer: "the-wall-mark-media-edge";
  audience: "the-wall-media-processor";
  purpose: "dispatch";
  job_id: string;
  upload_id: string;
  attempt_id: string;
  kind: MediaKind;
  source: WorkerSource;
  destinations: WorkerDestination[];
  callback_url: string;
  nonce: string;
  completion_token: string;
  iat: number;
  exp: number;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function parseReadRequest(value: unknown): { mark_id: string; request_id: string } | null {
  if (!isPlainRecord(value)) return null;
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== "mark_id" || keys[1] !== "request_id") return null;
  if (!isCanonicalUuid(value.mark_id) || !isCanonicalUuid(value.request_id)) return null;
  return { mark_id: value.mark_id, request_id: value.request_id };
}

export function parseResolvedMediaRows(value: unknown): ResolvedMediaRow[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MANIFEST_ITEMS) return null;
  const rows: ResolvedMediaRow[] = [];
  for (const item of value) {
    if (!isPlainRecord(item) || !isResolvedRow(item)) return null;
    rows.push(item);
  }
  if (rows.some((row, index) => row.position !== index)) return null;
  const expectedKind = rows[0].media_type;
  if (rows.some((row) => row.media_type !== expectedKind)) return null;
  if (expectedKind !== "photo" && rows.length !== 1) return null;
  return rows;
}

export function unavailableResponse(status = 404): Response {
  return new Response(JSON.stringify({ status: "unavailable" }), {
    status,
    headers: PRIVATE_RESPONSE_HEADERS,
  });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: PRIVATE_RESPONSE_HEADERS });
}

function isResolvedRow(value: Record<string, unknown>): value is Record<string, unknown> & ResolvedMediaRow {
  const keys = Object.keys(value).sort();
  const expectedKeys = [
    "byte_size",
    "duration_ms",
    "height",
    "media_type",
    "mime_type",
    "position",
    "preview_path",
    "sha256",
    "storage_path",
    "width",
  ];
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) return false;
  const kind = value.media_type;
  const width = value.width;
  const height = value.height;
  const duration = value.duration_ms;
  const common = Number.isInteger(value.position) && Number(value.position) >= 0 && Number(value.position) < 5 &&
    (kind === "photo" || kind === "voice" || kind === "video") &&
    typeof value.storage_path === "string" && value.storage_path.length > 0 &&
    (value.preview_path === null || typeof value.preview_path === "string") &&
    typeof value.mime_type === "string" && value.mime_type.length > 0 &&
    Number.isSafeInteger(value.byte_size) && Number(value.byte_size) > 0 &&
    (width === null || (Number.isSafeInteger(width) && Number(width) > 0)) &&
    (height === null || (Number.isSafeInteger(height) && Number(height) > 0)) &&
    (duration === null || (Number.isSafeInteger(duration) && Number(duration) > 0)) &&
    typeof value.sha256 === "string" && /^[0-9a-f]{64}$/.test(value.sha256);
  if (!common) return false;
  const storagePath = value.storage_path as string;
  const previewPath = value.preview_path as string | null;

  if (kind === "photo") {
    return (value.mime_type === "image/jpeg" || value.mime_type === "image/webp") &&
      Number(value.byte_size) <= 10_485_760 && hasValidDimensions(width, height) && duration === null &&
      hasExpectedMediaPaths(
        storagePath,
        previewPath,
        value.mime_type === "image/jpeg" ? "/full.jpg" : "/full.webp",
        "thumb.webp",
      );
  }
  if (kind === "voice") {
    return value.mime_type === "audio/mp4" && Number(value.byte_size) <= 10_485_760 &&
      width === null && height === null && duration !== null &&
      Number(duration) <= 60_000 && previewPath === null && /\/full\.m4a$/.test(storagePath);
  }
  return value.mime_type === "video/mp4" && Number(value.byte_size) <= 52_428_800 &&
    hasValidDimensions(width, height) && duration !== null && Number(duration) <= 30_000 &&
    hasExpectedMediaPaths(storagePath, previewPath, "/full.mp4", "poster.webp");
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

function hasValidDimensions(width: unknown, height: unknown): boolean {
  return typeof width === "number" && typeof height === "number" &&
    width <= 8192 && height <= 8192 && width * height <= 25_000_000;
}

function hasExpectedMediaPaths(
  storagePath: string,
  previewPath: string | null,
  fullSuffix: string,
  previewFilename: string,
): boolean {
  if (!storagePath.endsWith(fullSuffix)) return false;
  if (previewPath === null) return true;
  return previewPath === `${storagePath.slice(0, storagePath.lastIndexOf("/") + 1)}${previewFilename}`;
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
