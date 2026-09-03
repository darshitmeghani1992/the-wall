import { webcrypto } from "node:crypto";
import type { MediaKind } from "./limits.js";

export type DestinationRole = "full" | "full_jpeg" | "full_webp" | "preview";

export interface WorkerObjectTarget {
  role: DestinationRole;
  path: string;
  url: string;
  method: "PUT";
  mime_type: string;
  cache_control_seconds: 60;
}

export interface WorkerDispatchClaims {
  version: 1;
  issuer: "the-wall-mark-media-edge";
  audience: "the-wall-media-processor";
  purpose: "dispatch";
  job_id: string;
  upload_id: string;
  attempt_id: string;
  kind: MediaKind;
  source: { path: string; url: string; method: "GET" };
  destinations: WorkerObjectTarget[];
  callback_url: string;
  nonce: string;
  completion_token: string;
  iat: number;
  exp: number;
}

export interface VerifiedWorkerDispatch extends WorkerDispatchClaims {
  /** Authenticated protected-header value; never present in the JWS payload. */
  envelopeKid: string;
}

export interface WorkerPublicKey {
  kid: string;
  /** Raw RFC 8032 Ed25519 public key, exactly 32 bytes. */
  publicKey: Uint8Array;
}

export interface EnvelopeVerifier {
  verify(serializedEnvelope: string, nowEpochSeconds: number): Promise<VerifiedWorkerDispatch>;
}

type NodeCryptoKey = Awaited<ReturnType<typeof webcrypto.subtle.importKey>>;

/** Native WebCrypto verifier for the protocol-v2 Ed25519 compact JWS. */
export class Ed25519EnvelopeVerifier implements EnvelopeVerifier {
  readonly #keys: ReadonlyArray<{ kid: string; key: NodeCryptoKey }>;

  private constructor(keys: ReadonlyArray<{ kid: string; key: NodeCryptoKey }>) {
    this.#keys = keys;
  }

  static async create(keys: readonly WorkerPublicKey[]): Promise<Ed25519EnvelopeVerifier> {
    if (keys.length < 1 || keys.length > 2) throw new Error("exactly current and optional prior public keys are allowed");
    const seenKids = new Set<string>();
    const seenKeys = new Set<string>();
    const imported: Array<{ kid: string; key: NodeCryptoKey }> = [];
    for (const candidate of keys) {
      if (!isKid(candidate.kid) || seenKids.has(candidate.kid) || candidate.publicKey.byteLength !== 32) {
        throw new Error("worker public-key allow-list is invalid");
      }
      const encodedKey = encodeBase64Url(candidate.publicKey);
      if (seenKeys.has(encodedKey)) throw new Error("one public key cannot have multiple key ids");
      seenKids.add(candidate.kid);
      seenKeys.add(encodedKey);
      const raw = new Uint8Array(candidate.publicKey);
      const key = await webcrypto.subtle.importKey("raw", raw, { name: "Ed25519" }, false, ["verify"]);
      imported.push({ kid: candidate.kid, key });
    }
    return new Ed25519EnvelopeVerifier(imported);
  }

  async verify(serializedEnvelope: string, nowEpochSeconds: number): Promise<VerifiedWorkerDispatch> {
    if (serializedEnvelope.length < 1 || serializedEnvelope.length > 65_536 || /\s/.test(serializedEnvelope)) {
      throw new Error("compact dispatch JWS is malformed");
    }
    const segments = serializedEnvelope.split(".");
    if (segments.length !== 3) throw new Error("compact dispatch JWS must have three segments");
    const [protectedSegment, payloadSegment, signatureSegment] = segments;
    if (!protectedSegment || !payloadSegment || !signatureSegment) throw new Error("compact dispatch JWS has an empty segment");
    const signature = decodeBase64UrlExact(signatureSegment);
    if (signature.byteLength !== 64) throw new Error("Ed25519 signature must be 64 bytes");
    const signingInput = new TextEncoder().encode(`${protectedSegment}.${payloadSegment}`);

    // Try the bounded current/prior list before parsing the untrusted header.
    const matches: Array<{ kid: string; key: NodeCryptoKey }> = [];
    for (const candidate of this.#keys) {
      if (await webcrypto.subtle.verify({ name: "Ed25519" }, candidate.key, signature, signingInput)) matches.push(candidate);
    }
    if (matches.length !== 1) throw new Error("dispatch signature is invalid");

    const protectedValue = parseCanonicalSegment(protectedSegment);
    if (!isRecord(protectedValue)) throw new Error("protected header must be an object");
    requireExactKeys(protectedValue, ["alg", "kid", "typ"]);
    if (protectedValue.alg !== "EdDSA" || protectedValue.typ !== "TW-MEDIA-DISPATCH+jws" || !isKid(protectedValue.kid)) {
      throw new Error("protected header is invalid");
    }
    if (protectedValue.kid !== matches[0]!.kid) throw new Error("protected key id does not match verifying key");
    return bindVerifiedDispatch(
      { kid: protectedValue.kid, payload: parseCanonicalSegment(payloadSegment) },
      nowEpochSeconds,
    );
  }
}

export interface DispatchNonceRedeemer {
  /** Sends the signed compact JWS to the dedicated /worker/redeem gateway. */
  redeem(serializedEnvelope: string, signal: AbortSignal): Promise<boolean>;
}

export interface CompletionAuthorization {
  callbackUrl: string;
  uploadId: string;
  attemptId: string;
  envelopeKid: string;
  completionToken: string;
}

export interface CompletionReporter {
  complete(authorization: CompletionAuthorization, result: ProcessedMedia, signal: AbortSignal): Promise<void>;
  fail(authorization: CompletionAuthorization, errorCode: string, signal: AbortSignal): Promise<void>;
}

export interface ProcessedObject {
  role: DestinationRole;
  path: string;
  localPath: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface ProcessedMedia {
  kind: MediaKind;
  full: ProcessedObject;
  preview?: ProcessedObject;
}

export function bindVerifiedDispatch(envelope: { kid: string; payload: unknown }, nowEpochSeconds: number): VerifiedWorkerDispatch {
  if (!isKid(envelope.kid)) throw new Error("verified envelope key id is invalid");
  return { ...parseVerifiedDispatchClaims(envelope.payload, nowEpochSeconds), envelopeKid: envelope.kid };
}

export function completionAuthorization(claims: VerifiedWorkerDispatch): CompletionAuthorization {
  return {
    callbackUrl: claims.callback_url,
    uploadId: claims.upload_id,
    attemptId: claims.attempt_id,
    envelopeKid: claims.envelopeKid,
    completionToken: claims.completion_token,
  };
}

export function parseVerifiedDispatchClaims(value: unknown, nowEpochSeconds: number): WorkerDispatchClaims {
  if (!isRecord(value)) throw new Error("dispatch claims must be an object");
  requireExactKeys(value, [
    "attempt_id", "audience", "callback_url", "completion_token", "destinations", "exp",
    "iat", "issuer", "job_id", "kind", "nonce", "purpose", "source", "upload_id", "version",
  ]);
  if (value.version !== 1 || value.issuer !== "the-wall-mark-media-edge" ||
      value.audience !== "the-wall-media-processor" || value.purpose !== "dispatch") {
    throw new Error("dispatch envelope identity is invalid");
  }
  for (const field of ["job_id", "upload_id", "attempt_id"] as const) {
    if (!isCanonicalUuid(value[field])) throw new Error(`${field} must be a canonical lowercase UUID`);
  }
  const jobId = value.job_id as string;
  const uploadId = value.upload_id as string;
  const attemptId = value.attempt_id as string;
  if (value.kind !== "photo" && value.kind !== "voice" && value.kind !== "video") throw new Error("dispatch media kind is invalid");
  if (!Number.isSafeInteger(value.iat) || !Number.isSafeInteger(value.exp)) throw new Error("dispatch timestamps are invalid");
  const iat = Number(value.iat);
  const exp = Number(value.exp);
  if (iat > nowEpochSeconds + 10 || exp <= nowEpochSeconds || exp <= iat || exp - iat > 120) {
    throw new Error("dispatch envelope is expired or exceeds its lifetime");
  }
  if (!isCredential32(value.nonce) || !isCredential32(value.completion_token) || value.nonce === value.completion_token) {
    throw new Error("dispatch credentials are invalid or not domain-separated");
  }
  const source = parseSource(value.source, uploadId);
  const destinations = parseDestinations(value.destinations, value.kind, uploadId, attemptId);
  if (!isAsciiString(value.callback_url, 4_096)) throw new Error("callback URL is invalid");
  return {
    version: 1,
    issuer: "the-wall-mark-media-edge",
    audience: "the-wall-media-processor",
    purpose: "dispatch",
    job_id: jobId,
    upload_id: uploadId,
    attempt_id: attemptId,
    kind: value.kind,
    source,
    destinations,
    callback_url: value.callback_url,
    nonce: value.nonce,
    completion_token: value.completion_token,
    iat,
    exp,
  };
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("canonical JSON numbers must be safe integers");
    return String(value);
  }
  if (typeof value === "string") {
    if (!isAscii(value)) throw new Error("canonical JSON strings must be ASCII");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    if (keys.some((key) => !isAscii(key))) throw new Error("canonical JSON keys must be ASCII");
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  throw new Error("canonical JSON contains an unsupported value");
}

export function encodeBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function parseCanonicalSegment(segment: string): unknown {
  const bytes = decodeBase64UrlExact(segment);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("JWS segment is not valid UTF-8");
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new Error("JWS segment is not valid JSON");
  }
  if (encodeBase64Url(new TextEncoder().encode(canonicalJson(value))) !== segment) {
    throw new Error("JWS segment is not canonical JSON");
  }
  return value;
}

function decodeBase64UrlExact(segment: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error("base64url segment is malformed or padded");
  const decoded = new Uint8Array(Buffer.from(segment, "base64url"));
  if (encodeBase64Url(decoded) !== segment) throw new Error("base64url segment is not canonical");
  return decoded;
}

function parseSource(value: unknown, uploadId: string): WorkerDispatchClaims["source"] {
  if (!isRecord(value)) throw new Error("source is invalid");
  requireExactKeys(value, ["method", "path", "url"]);
  const sourcePattern = new RegExp(`^staging/${UUID_SEGMENT}/${escapeRegex(uploadId)}/source$`);
  if (value.method !== "GET" || typeof value.path !== "string" || !sourcePattern.test(value.path) || !isAsciiString(value.url, 8_192)) {
    throw new Error("source is invalid");
  }
  return { method: "GET", path: value.path, url: value.url };
}

function parseDestinations(value: unknown, kind: MediaKind, uploadId: string, attemptId: string): WorkerObjectTarget[] {
  if (!Array.isArray(value)) throw new Error("destinations must be an array");
  const destinations = value.map(parseDestination);
  const roles = destinations.map((item) => item.role);
  const cardinalityOkay = kind === "photo" ? roles.length === 2 || roles.length === 3
    : kind === "voice" ? roles.length === 1 : roles.length === 1 || roles.length === 2;
  if (!cardinalityOkay || new Set(roles).size !== roles.length) throw new Error("destination roles are invalid for media kind");
  const requiredRoles: DestinationRole[] = kind === "photo" ? ["full_jpeg", "full_webp"] : ["full"];
  if (requiredRoles.some((role) => !roles.includes(role)) || roles.some((role) => !requiredRoles.includes(role) && role !== "preview")) {
    throw new Error("destination roles are invalid for media kind");
  }
  const prefix = `validated/${uploadId}/${attemptId}/`;
  for (const target of destinations) {
    const expected = target.role === "full_jpeg" ? ["full.jpg", "image/jpeg"]
      : target.role === "full_webp" ? ["full.webp", "image/webp"]
      : target.role === "preview" ? [kind === "photo" ? "thumb.webp" : "poster.webp", "image/webp"]
      : kind === "voice" ? ["full.m4a", "audio/mp4"] : ["full.mp4", "video/mp4"];
    if (target.path !== prefix + expected[0] || target.mime_type !== expected[1]) throw new Error("destination path or MIME does not match its role");
  }
  return destinations;
}

function parseDestination(value: unknown): WorkerObjectTarget {
  if (!isRecord(value)) throw new Error("destination is invalid");
  requireExactKeys(value, ["cache_control_seconds", "method", "mime_type", "path", "role", "url"]);
  if (!isDestinationRole(value.role) || value.method !== "PUT" || value.cache_control_seconds !== 60 ||
      !isAsciiString(value.path, 1_024) || !isAsciiString(value.url, 8_192) || !isAsciiString(value.mime_type, 128)) {
    throw new Error("destination is invalid");
  }
  return { role: value.role, method: "PUT", cache_control_seconds: 60, path: value.path, url: value.url, mime_type: value.mime_type };
}

function requireExactKeys(value: Record<string, unknown>, expected: string[]): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (actual.length !== sortedExpected.length || actual.some((key, index) => key !== sortedExpected[index])) {
    throw new Error("object contains missing or unexpected fields");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAsciiString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength && isAscii(value) && !/[\u0000-\u001f\u007f]/.test(value);
}

function isAscii(value: string): boolean {
  return /^[\u0000-\u007f]*$/.test(value);
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && new RegExp(`^${UUID_SEGMENT}$`).test(value);
}

function isCredential32(value: unknown): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) return false;
  // Credentials are opaque strings and the binding deterministic vector uses
  // non-zero terminal pad bits. Compact-JWS segments remain canonically strict;
  // embedded credentials follow the vector and only require alphabet/length.
  return Buffer.from(value, "base64url").byteLength === 32;
}

function isKid(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(value);
}

function isDestinationRole(value: unknown): value is DestinationRole {
  return value === "full" || value === "full_jpeg" || value === "full_webp" || value === "preview";
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const UUID_SEGMENT = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
