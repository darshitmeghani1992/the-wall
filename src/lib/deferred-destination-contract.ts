export const DEFERRED_DESTINATION_STORAGE_KEY = "the-wall:deferred-destination:v1";
export const DEFERRED_DESTINATION_TTL_MS = 86_400_000;
export const MAX_NATIVE_INTENT_BYTES = 8 * 1024;
export const MAX_STORED_RECORD_BYTES = 16 * 1024;
export const DEFERRED_REFERENCE_PARAM = "__deferred_ref";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HANDLE = /^[a-z0-9_]{3,}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const ENCODED_SEPARATOR = /%(?:2f|5c)/i;
const INVALID_PERCENT = /%(?![0-9a-f]{2})/i;

export type DeferredDestination =
  | { kind: "personal_handle"; handle: string }
  | { kind: "personal_user"; userId: string }
  | { kind: "shared_wall"; wallId: string }
  | { kind: "shared_invite"; wallId: string }
  | {
      kind: "mark";
      markId: string;
      container:
        | { kind: "personal"; ownerId: string }
        | { kind: "shared"; wallId: string };
    };

export type StoredDeferredDestinationV1 = {
  version: 1;
  capturedAtMs: number;
  boundSubject: string | null;
  destination: DeferredDestination;
};

export type DeferredSubject =
  | { status: "unknown" }
  | { status: "signed_out" }
  | { status: "authenticated"; userId: string };

export type DeferredScreenIdentity =
  | { kind: "handle"; handle: string }
  | { kind: "personal"; ownerId: string; focusMarkId: string | null }
  | { kind: "shared"; wallId: string; focusMarkId: string | null }
  | { kind: "shared_invite"; wallId: string }
  | { kind: "unavailable" };

declare const attemptTokenBrand: unique symbol;
export type DeferredAttemptToken = string & { readonly [attemptTokenBrand]: true };
declare const navigationRefBrand: unique symbol;
export type DeferredNavigationRef = string & { readonly [navigationRefBrand]: true };

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length
      && value.charCodeAt(index + 1) >= 0xdc00 && value.charCodeAt(index + 1) <= 0xdfff) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

export function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && expected.slice().sort().every((key, index) => keys[index] === key);
}

function normalizedUuid(value: unknown): string | null {
  return isCanonicalUuid(value) ? value.toLowerCase() : null;
}

function normalizedHandle(value: string): string | null {
  let handle = value.toLowerCase();
  if (handle.startsWith("@")) handle = handle.slice(1);
  return HANDLE.test(handle) ? handle : null;
}

function decodeSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function strictUrlSegments(url: URL): string[] | null {
  const hostname = url.hostname;
  const pathname = url.pathname;
  if (!pathname.startsWith("/")) return null;
  const path = pathname.slice(1);
  const pathSegments = path === "" ? [] : path.split("/");
  if (pathSegments.some((segment) => segment.length === 0)) return null;
  const rawSegments = hostname ? [hostname, ...pathSegments] : pathSegments;
  const decoded = rawSegments.map(decodeSegment);
  return decoded.some((segment) => segment === null || segment.length === 0)
    ? null
    : decoded as string[];
}

export function isAuthCallbackIntent(rawUrl: unknown): boolean {
  if (typeof rawUrl !== "string" || !rawUrl || utf8ByteLength(rawUrl) > MAX_NATIVE_INTENT_BYTES
    || CONTROL.test(rawUrl) || rawUrl.includes("\\") || ENCODED_SEPARATOR.test(rawUrl)
    || INVALID_PERCENT.test(rawUrl)) return false;
  try {
    const url = new URL(rawUrl);
    if (url.protocol.toLowerCase() !== "thewall:" || url.username || url.password || url.port || url.hash) return false;
    const segments = strictUrlSegments(url);
    return segments?.length === 2 && segments[0]?.toLowerCase() === "auth" && segments[1]?.toLowerCase() === "callback";
  } catch {
    return false;
  }
}

/** Strictly converts an external custom-scheme intent into the only persistable union. */
export function parseDeferredDestinationUrl(rawUrl: unknown): DeferredDestination | null {
  if (typeof rawUrl !== "string" || rawUrl.length === 0 || utf8ByteLength(rawUrl) > MAX_NATIVE_INTENT_BYTES
    || CONTROL.test(rawUrl) || rawUrl.includes("\\") || ENCODED_SEPARATOR.test(rawUrl)
    || INVALID_PERCENT.test(rawUrl)) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol.toLowerCase() !== "thewall:" || url.username || url.password || url.port || url.hash) return null;

  const segments = strictUrlSegments(url);
  if (!segments) return null;
  const queryEntries: [string, string][] = [];
  url.searchParams.forEach((value, key) => queryEntries.push([key, value]));
  if (queryEntries.length > 1 || queryEntries.some(([key]) => key === DEFERRED_REFERENCE_PARAM)) return null;
  const focusMark = queryEntries.length === 1 && queryEntries[0][0] === "focusMark"
    ? normalizedUuid(queryEntries[0][1])
    : null;
  if (queryEntries.length === 1 && !focusMark) return null;

  const route = segments[0]?.toLowerCase();
  if (route === "u" && segments.length === 2 && !focusMark) {
    const handle = normalizedHandle(segments[1]);
    return handle ? { kind: "personal_handle", handle } : null;
  }
  if (route === "person" && segments.length === 2) {
    const ownerId = normalizedUuid(segments[1]);
    if (!ownerId) return null;
    return focusMark
      ? { kind: "mark", markId: focusMark, container: { kind: "personal", ownerId } }
      : { kind: "personal_user", userId: ownerId };
  }
  if ((route === "s" || route === "shared") && segments.length === 2) {
    const wallId = normalizedUuid(segments[1]);
    if (!wallId) return null;
    return focusMark
      ? { kind: "mark", markId: focusMark, container: { kind: "shared", wallId } }
      : { kind: "shared_wall", wallId };
  }
  if (route === "shared" && segments[1]?.toLowerCase() === "invite" && segments.length === 3 && !focusMark) {
    const wallId = normalizedUuid(segments[2]);
    return wallId ? { kind: "shared_invite", wallId } : null;
  }
  return null;
}

export function serializeDeferredDestinationRecord(record: StoredDeferredDestinationV1): string {
  return JSON.stringify(record);
}

function parseDestination(value: unknown): DeferredDestination | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.kind === "personal_handle" && exactKeys(row, ["kind", "handle"]) && typeof row.handle === "string") {
    const handle = normalizedHandle(row.handle);
    return handle === row.handle ? { kind: "personal_handle", handle } : null;
  }
  if (row.kind === "personal_user" && exactKeys(row, ["kind", "userId"])) {
    const userId = normalizedUuid(row.userId);
    return userId && userId === row.userId ? { kind: "personal_user", userId } : null;
  }
  if (row.kind === "shared_wall" && exactKeys(row, ["kind", "wallId"])) {
    const wallId = normalizedUuid(row.wallId);
    return wallId && wallId === row.wallId ? { kind: "shared_wall", wallId } : null;
  }
  if (row.kind === "shared_invite" && exactKeys(row, ["kind", "wallId"])) {
    const wallId = normalizedUuid(row.wallId);
    return wallId && wallId === row.wallId ? { kind: "shared_invite", wallId } : null;
  }
  if (row.kind !== "mark" || !exactKeys(row, ["kind", "markId", "container"])) return null;
  const markId = normalizedUuid(row.markId);
  if (!markId || markId !== row.markId || !row.container || typeof row.container !== "object" || Array.isArray(row.container)) return null;
  const container = row.container as Record<string, unknown>;
  if (container.kind === "personal" && exactKeys(container, ["kind", "ownerId"])) {
    const ownerId = normalizedUuid(container.ownerId);
    return ownerId && ownerId === container.ownerId
      ? { kind: "mark", markId, container: { kind: "personal", ownerId } }
      : null;
  }
  if (container.kind === "shared" && exactKeys(container, ["kind", "wallId"])) {
    const wallId = normalizedUuid(container.wallId);
    return wallId && wallId === container.wallId
      ? { kind: "mark", markId, container: { kind: "shared", wallId } }
      : null;
  }
  return null;
}

export function parseStoredDeferredDestination(raw: unknown): StoredDeferredDestinationV1 | null {
  if (typeof raw !== "string" || utf8ByteLength(raw) > MAX_STORED_RECORD_BYTES) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const row = parsed as Record<string, unknown>;
  if (!exactKeys(row, ["version", "capturedAtMs", "boundSubject", "destination"]) || row.version !== 1
    || !Number.isSafeInteger(row.capturedAtMs) || (row.capturedAtMs as number) < 0
    || (row.boundSubject !== null && !isCanonicalUuid(row.boundSubject))) return null;
  const destination = parseDestination(row.destination);
  if (!destination) return null;
  return {
    version: 1,
    capturedAtMs: row.capturedAtMs as number,
    boundSubject: typeof row.boundSubject === "string" ? row.boundSubject.toLowerCase() : null,
    destination,
  };
}

export function deferredRecordIsExpired(record: StoredDeferredDestinationV1, nowMs: number): boolean {
  return !Number.isSafeInteger(nowMs) || nowMs < 0 || record.capturedAtMs > nowMs
    || nowMs - record.capturedAtMs >= DEFERRED_DESTINATION_TTL_MS;
}

export function sameDeferredScreen(left: DeferredScreenIdentity, right: DeferredScreenIdentity): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function destinationScreenIdentity(destination: DeferredDestination): DeferredScreenIdentity {
  switch (destination.kind) {
    case "personal_handle": return { kind: "handle", handle: destination.handle };
    case "personal_user": return { kind: "personal", ownerId: destination.userId, focusMarkId: null };
    case "shared_wall": return { kind: "shared", wallId: destination.wallId, focusMarkId: null };
    case "shared_invite": return { kind: "shared_invite", wallId: destination.wallId };
    case "mark": return destination.container.kind === "personal"
      ? { kind: "personal", ownerId: destination.container.ownerId, focusMarkId: destination.markId }
      : { kind: "shared", wallId: destination.container.wallId, focusMarkId: destination.markId };
  }
}
