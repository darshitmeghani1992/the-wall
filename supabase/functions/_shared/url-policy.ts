// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
import { MEDIA_BUCKET } from "./media-contract.ts";

const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;
const IP_LITERAL = /^(?:\d{1,3}\.){3}\d{1,3}$|^\[[0-9a-f:.]+\]$/i;
const AMBIGUOUS_ENCODING = /%(?:2e|2f|5c|25|00)/i;
const UUID_SEGMENT = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const STAGING_PATH = new RegExp(`^staging/${UUID_SEGMENT}/${UUID_SEGMENT}/source$`, "i");
const VALIDATED_PATH = new RegExp(
  `^validated/${UUID_SEGMENT}/${UUID_SEGMENT}/(?:full\\.(?:jpg|webp|m4a|mp4)|thumb\\.webp|poster\\.webp)$`,
  "i",
);

export interface StorageUrlPolicy {
  projectHost: string;
  bucket?: string;
}

export type SignedStorageRoute = "download" | "upload" | "either";

export function normalizeProjectHost(value: string): string {
  const candidate = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
  if (candidate.protocol !== "https:" || candidate.port || candidate.username || candidate.password ||
    candidate.pathname !== "/" || candidate.search || candidate.hash) {
    throw new Error("invalid project origin");
  }
  const hostname = candidate.hostname.toLowerCase();
  if (!isAllowedDnsHostname(hostname)) throw new Error("invalid project hostname");
  return hostname;
}

export function assertCanonicalStoragePath(path: string, expectedPrefix: "staging" | "validated"): void {
  if (!path || path.length > 1024 || CONTROL_OR_BACKSLASH.test(path) || AMBIGUOUS_ENCODING.test(path)) {
    throw new Error("invalid storage path");
  }
  if (path.startsWith("/") || path.endsWith("/") || path.includes("//")) {
    throw new Error("invalid storage path");
  }
  const segments = path.split("/");
  if (segments[0] !== expectedPrefix || segments.some((part) => !part || part === "." || part === "..")) {
    throw new Error("invalid storage path");
  }
  for (const segment of segments) {
    if (decodeURIComponent(segment) !== segment) throw new Error("encoded storage path is forbidden");
  }
  const exactPattern = expectedPrefix === "staging" ? STAGING_PATH : VALIDATED_PATH;
  if (!exactPattern.test(path)) throw new Error("unexpected storage path shape");
}

export function assertSignedStorageUrl(
  rawUrl: string,
  expectedPath: string,
  policy: StorageUrlPolicy,
  expectedRoute: SignedStorageRoute = "either",
): URL {
  if (CONTROL_OR_BACKSLASH.test(rawUrl) || AMBIGUOUS_ENCODING.test(rawUrl)) {
    throw new Error("ambiguous storage URL");
  }
  const url = new URL(rawUrl);
  const host = normalizeProjectHost(policy.projectHost);
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash ||
    url.hostname.toLowerCase() !== host || IP_LITERAL.test(url.hostname)) {
    throw new Error("storage origin denied");
  }
  const bucket = policy.bucket ?? MEDIA_BUCKET;
  const pathPrefixes = expectedRoute === "download"
    ? [`/storage/v1/object/sign/${bucket}/`]
    : expectedRoute === "upload"
    ? [`/storage/v1/object/upload/sign/${bucket}/`]
    : [`/storage/v1/object/sign/${bucket}/`, `/storage/v1/object/upload/sign/${bucket}/`];
  const prefix = pathPrefixes.find((candidate) => url.pathname.startsWith(candidate));
  if (!prefix) throw new Error("storage route denied");
  const encodedPath = url.pathname.slice(prefix.length);
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(encodedPath);
  } catch {
    throw new Error("invalid storage path encoding");
  }
  if (decodedPath !== expectedPath || encodePath(expectedPath) !== encodedPath) {
    throw new Error("storage path substitution denied");
  }
  if (!url.search) throw new Error("unsigned storage URL denied");
  return url;
}

export function assertWorkerCallbackUrl(rawUrl: string, projectHost: string): URL {
  if (CONTROL_OR_BACKSLASH.test(rawUrl) || AMBIGUOUS_ENCODING.test(rawUrl)) {
    throw new Error("ambiguous callback URL");
  }
  const url = new URL(rawUrl);
  const host = normalizeProjectHost(projectHost);
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash || url.search ||
    url.hostname.toLowerCase() !== host || IP_LITERAL.test(url.hostname) ||
    url.pathname !== "/functions/v1/mark-media-worker/worker/complete") {
    throw new Error("worker callback denied");
  }
  return url;
}

export function resolveSignedStorageUrl(projectUrl: string, value: string): string {
  const normalizedValue = value.startsWith("/object/") ? `/storage/v1${value}` : value;
  return new URL(normalizedValue, `${projectUrl.replace(/\/$/, "")}/`).toString();
}

export function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function isAllowedDnsHostname(hostname: string): boolean {
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || IP_LITERAL.test(hostname)) {
    return false;
  }
  if (!/^[a-z0-9.-]+$/.test(hostname) || hostname.startsWith(".") || hostname.endsWith(".") ||
    hostname.includes("..")) {
    return false;
  }
  return hostname.split(".").length >= 3;
}
