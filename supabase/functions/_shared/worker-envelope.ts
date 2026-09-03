import {
  isPlainRecord,
  isUuid,
  type MediaKind,
  type WorkerDestination,
  type WorkerDispatchPayload,
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
} from "./media-contract.ts";
import {
  assertCanonicalStoragePath,
  assertSignedStorageUrl,
  assertWorkerCallbackUrl,
  type StorageUrlPolicy,
// @ts-ignore Deno requires explicit extensions; Expo's root TS config does not enable them.
} from "./url-policy.ts";

const PROTECTED_TYPE = "TW-MEDIA-DISPATCH+jws";
const ISSUER = "the-wall-mark-media-edge";
const AUDIENCE = "the-wall-media-processor";
const PURPOSE = "dispatch";
const KID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const ASCII_PATTERN = /^[\x20-\x7e]*$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface DispatchPrivateKey {
  kid: string;
  pkcs8: Uint8Array;
}

export interface DispatchPublicKey {
  kid: string;
  raw: Uint8Array;
}

export interface DispatchValidationOptions {
  projectHost: string;
  nowSeconds: number;
}

export interface VerifiedDispatch {
  kid: string;
  payload: WorkerDispatchPayload;
}

export function randomWorkerToken(): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signDispatchEnvelope(
  payload: WorkerDispatchPayload,
  key: DispatchPrivateKey,
  options: DispatchValidationOptions,
): Promise<string> {
  assertKid(key.kid);
  validateDispatchPayload(payload, options);
  const protectedJson = canonicalJson({ alg: "EdDSA", kid: key.kid, typ: PROTECTED_TYPE });
  const payloadJson = canonicalJson(payload);
  const protectedSegment = encodeBase64Url(new TextEncoder().encode(protectedJson));
  const payloadSegment = encodeBase64Url(new TextEncoder().encode(payloadJson));
  const signingInput = `${protectedSegment}.${payloadSegment}`;
  const privateKey = await crypto.subtle.importKey("pkcs8", copyBuffer(key.pkcs8), "Ed25519", false, ["sign"]);
  const signature = await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(signingInput));
  return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyDispatchEnvelope(
  compact: string,
  keys: readonly DispatchPublicKey[],
  options: DispatchValidationOptions,
): Promise<VerifiedDispatch> {
  if (compact.length > 65_536 || /\s|=/.test(compact)) throw new Error("invalid compact JWS encoding");
  const parts = compact.split(".");
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) {
    throw new Error("invalid compact JWS encoding");
  }
  const protectedBytes = decodeBase64UrlCanonical(parts[0]);
  const signature = decodeBase64UrlCanonical(parts[2]);
  if (signature.length !== 64) throw new Error("invalid Ed25519 signature size");

  // The approved protocol requires signature verification before JSON parsing.
  // Try the small configured public-key allow-list, then bind the verified key
  // to the protected `kid`; untrusted header content never selects a key.
  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const verifiedKeys: DispatchPublicKey[] = [];
  for (const candidate of keys) {
    if (candidate.raw.length !== 32 || !KID_PATTERN.test(candidate.kid)) continue;
    const imported = await crypto.subtle.importKey("raw", copyBuffer(candidate.raw), "Ed25519", false, ["verify"]);
    if (await crypto.subtle.verify("Ed25519", imported, copyBuffer(signature), signingInput)) {
      verifiedKeys.push(candidate);
    }
  }
  if (verifiedKeys.length !== 1) throw new Error("invalid dispatch signature");

  const protectedHeader = parseCanonicalJson(protectedBytes);
  assertExactKeys(protectedHeader, ["alg", "kid", "typ"]);
  if (protectedHeader.alg !== "EdDSA" || protectedHeader.typ !== PROTECTED_TYPE ||
    typeof protectedHeader.kid !== "string" || protectedHeader.kid !== verifiedKeys[0].kid) {
    throw new Error("invalid protected header");
  }
  assertKid(protectedHeader.kid);

  const payload = parseCanonicalJson(decodeBase64UrlCanonical(parts[1]));
  validateDispatchPayload(payload, options);
  return { kid: protectedHeader.kid, payload };
}

export function decodeBase64UrlCanonical(value: string): Uint8Array {
  if (!value || /[^A-Za-z0-9_-]/.test(value) || value.includes("=")) throw new Error("invalid base64url");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new Error("invalid base64url");
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (encodeBase64Url(bytes) !== value) throw new Error("non-canonical base64url");
  return bytes;
}

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("non-integer JSON number");
    return value;
  }
  if (typeof value === "string") {
    if (!ASCII_PATTERN.test(value)) throw new Error("non-ASCII JSON string");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isPlainRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      if (!ASCII_PATTERN.test(key) || value[key] === undefined) throw new Error("invalid JSON object");
      result[key] = canonicalize(value[key]);
    }
    return result;
  }
  throw new Error("unsupported JSON value");
}

function parseCanonicalJson(bytes: Uint8Array): Record<string, unknown> {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("invalid UTF-8 JSON");
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("invalid JSON");
  }
  if (!isPlainRecord(value) || canonicalJson(value) !== text) throw new Error("non-canonical JSON");
  return value;
}

function validateDispatchPayload(value: unknown, options: DispatchValidationOptions): asserts value is WorkerDispatchPayload {
  if (!isPlainRecord(value)) throw new Error("invalid dispatch payload");
  assertExactKeys(value, [
    "attempt_id", "audience", "callback_url", "completion_token", "destinations", "exp", "iat", "issuer",
    "job_id", "kind", "nonce", "purpose", "source", "upload_id", "version",
  ]);
  if (value.version !== 1 || value.issuer !== ISSUER || value.audience !== AUDIENCE || value.purpose !== PURPOSE ||
    !isCanonicalUuid(value.job_id) || !isCanonicalUuid(value.upload_id) || !isCanonicalUuid(value.attempt_id) ||
    (value.kind !== "photo" && value.kind !== "voice" && value.kind !== "video") ||
    typeof value.nonce !== "string" || typeof value.completion_token !== "string" ||
    typeof value.callback_url !== "string" || !TOKEN_PATTERN.test(value.nonce) ||
    !TOKEN_PATTERN.test(value.completion_token) ||
    value.nonce === value.completion_token || !Number.isSafeInteger(value.iat) || !Number.isSafeInteger(value.exp)) {
    throw new Error("invalid dispatch payload");
  }
  const iat = Number(value.iat);
  const exp = Number(value.exp);
  if (iat > options.nowSeconds + 10 || exp <= options.nowSeconds || exp <= iat || exp - iat > 120) {
    throw new Error("invalid dispatch lifetime");
  }
  assertWorkerCallbackUrl(value.callback_url, options.projectHost);
  validateSource(value.source, options);
  validateDestinations(value.destinations, value.kind, options);
}

function validateSource(value: unknown, options: DispatchValidationOptions): void {
  if (!isPlainRecord(value)) throw new Error("invalid source");
  assertExactKeys(value, ["method", "path", "url"]);
  if (value.method !== "GET" || typeof value.path !== "string" || typeof value.url !== "string") {
    throw new Error("invalid source");
  }
  assertCanonicalStoragePath(value.path, "staging");
  assertSignedStorageUrl(value.url, value.path, storagePolicy(options), "download");
}

function validateDestinations(value: unknown, kind: MediaKind, options: DispatchValidationOptions): void {
  if (!Array.isArray(value)) throw new Error("invalid destinations");
  const expectedCounts = kind === "photo" ? [2, 3] : kind === "video" ? [1, 2] : [1];
  if (!expectedCounts.includes(value.length)) throw new Error("invalid destination count");
  const roles: string[] = [];
  for (const item of value) {
    if (!isPlainRecord(item)) throw new Error("invalid destination");
    assertExactKeys(item, ["cache_control_seconds", "method", "mime_type", "path", "role", "url"]);
    if (item.method !== "PUT" || item.cache_control_seconds !== 60 || typeof item.role !== "string" ||
      typeof item.mime_type !== "string" || typeof item.path !== "string" || typeof item.url !== "string") {
      throw new Error("invalid destination");
    }
    validateDestinationShape(item as unknown as WorkerDestination, kind);
    assertCanonicalStoragePath(item.path, "validated");
    assertSignedStorageUrl(item.url, item.path, storagePolicy(options), "upload");
    roles.push(item.role);
  }
  const sorted = [...roles].sort().join(",");
  const expected = kind === "photo"
    ? (value.length === 3 ? "full_jpeg,full_webp,preview" : "full_jpeg,full_webp")
    : kind === "video"
    ? (value.length === 2 ? "full,preview" : "full")
    : "full";
  if (sorted !== expected) throw new Error("invalid destination roles");
}

function validateDestinationShape(item: WorkerDestination, kind: MediaKind): void {
  const suffix = item.path.slice(item.path.lastIndexOf("/") + 1);
  if (kind === "photo") {
    const valid = (item.role === "full_jpeg" && item.mime_type === "image/jpeg" && suffix === "full.jpg") ||
      (item.role === "full_webp" && item.mime_type === "image/webp" && suffix === "full.webp") ||
      (item.role === "preview" && item.mime_type === "image/webp" && suffix === "thumb.webp");
    if (!valid) throw new Error("invalid photo destination");
  } else if (kind === "voice") {
    if (item.role !== "full" || item.mime_type !== "audio/mp4" || suffix !== "full.m4a") {
      throw new Error("invalid voice destination");
    }
  } else {
    const valid = (item.role === "full" && item.mime_type === "video/mp4" && suffix === "full.mp4") ||
      (item.role === "preview" && item.mime_type === "image/webp" && suffix === "poster.webp");
    if (!valid) throw new Error("invalid video destination");
  }
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (actual.length !== sortedExpected.length || actual.some((key, index) => key !== sortedExpected[index])) {
    throw new Error("unexpected JSON keys");
  }
}

function assertKid(kid: string): void {
  if (!KID_PATTERN.test(kid)) throw new Error("invalid key ID");
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value) && isUuid(value);
}

function storagePolicy(options: DispatchValidationOptions): StorageUrlPolicy {
  return { projectHost: options.projectHost, bucket: "mark-media" };
}

function copyBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}
