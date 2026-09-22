// @ts-ignore Node's dependency-free contract tests need the explicit extension.
import { supabaseAnonKey, supabaseUrl } from "./config.ts";

export type ProtectedMediaType = "photo" | "voice" | "video";

export type ProtectedMediaItem = {
  position: number;
  media_type: ProtectedMediaType;
  url: string;
  preview_url: string | null;
  mime_type: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
};

export type ProtectedMediaManifest = {
  status: "ready";
  expires_at: string;
  items: ProtectedMediaItem[];
};

export type MediaCacheIdentity = {
  subject: string;
  sessionGeneration: number;
  markId: string;
};

export class MarkMediaReadError extends Error {
  readonly refreshable: boolean;

  constructor(refreshable: boolean) {
    super("MARK_MEDIA_UNAVAILABLE");
    this.name = "MarkMediaReadError";
    this.refreshable = refreshable;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const RESPONSE_KEYS = ["expires_at", "items", "status"];
const ITEM_KEYS = [
  "duration_ms",
  "height",
  "media_type",
  "mime_type",
  "position",
  "preview_url",
  "url",
  "width",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function nullablePositiveInteger(value: unknown): value is number | null {
  return value === null || (Number.isSafeInteger(value) && Number(value) > 0);
}

function parseHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || parsed.hash) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Strictly parses the public reader DTO. Extra/internal fields fail closed. */
export function parseProtectedMediaManifest(value: unknown, nowMs = Date.now()): ProtectedMediaManifest | null {
  if (!isRecord(value) || !hasExactKeys(value, RESPONSE_KEYS) || value.status !== "ready") return null;
  if (typeof value.expires_at !== "string" || !RFC3339.test(value.expires_at)) return null;
  const expiresAt = Date.parse(value.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) return null;
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 5) return null;

  const items: ProtectedMediaItem[] = [];
  for (const raw of value.items) {
    if (!isRecord(raw) || !hasExactKeys(raw, ITEM_KEYS)) return null;
    const mediaType = raw.media_type;
    const position = raw.position;
    const url = parseHttpsUrl(raw.url);
    const previewUrl = raw.preview_url === null ? null : parseHttpsUrl(raw.preview_url);
    if ((mediaType !== "photo" && mediaType !== "voice" && mediaType !== "video") ||
      !Number.isSafeInteger(position) || Number(position) < 0 || Number(position) > 4 ||
      !url || (raw.preview_url !== null && !previewUrl) ||
      typeof raw.mime_type !== "string" || raw.mime_type.length < 1 || raw.mime_type.length > 127 ||
      !nullablePositiveInteger(raw.width) || !nullablePositiveInteger(raw.height) ||
      !nullablePositiveInteger(raw.duration_ms)) {
      return null;
    }
    items.push({
      position: Number(position),
      media_type: mediaType,
      url,
      preview_url: previewUrl,
      mime_type: raw.mime_type,
      width: raw.width,
      height: raw.height,
      duration_ms: raw.duration_ms,
    });
  }

  if (items.some((item, index) => item.position !== index)) return null;
  const kind = items[0].media_type;
  if (items.some((item) => item.media_type !== kind) || (kind !== "photo" && items.length !== 1)) return null;
  if (kind === "photo" && items.some((item) => !["image/jpeg", "image/webp"].includes(item.mime_type) || item.width === null || item.height === null || item.duration_ms !== null)) return null;
  if (kind === "voice" && items.some((item) => item.mime_type !== "audio/mp4" || item.preview_url !== null || item.width !== null || item.height !== null || item.duration_ms === null || item.duration_ms > 60_000)) return null;
  if (kind === "video" && items.some((item) => item.mime_type !== "video/mp4" || item.width === null || item.height === null || item.duration_ms === null || item.duration_ms > 30_000)) return null;

  return { status: "ready", expires_at: value.expires_at, items };
}

export function mediaCacheKey(identity: MediaCacheIdentity): string {
  if (!UUID.test(identity.subject) || !UUID.test(identity.markId) ||
    !Number.isSafeInteger(identity.sessionGeneration) || identity.sessionGeneration < 1) {
    throw new Error("Invalid protected media cache identity");
  }
  return `${identity.subject}:${identity.sessionGeneration}:${identity.markId}`;
}

function freshRequestId(): string {
  const cryptoApi = (globalThis as unknown as {
    crypto?: { randomUUID?: () => string; getRandomValues?: (target: Uint8Array) => Uint8Array };
  }).crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID().toLowerCase();
  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function requestProtectedMedia(markId: string, accessToken: string): Promise<ProtectedMediaManifest> {
  if (!UUID.test(markId) || !accessToken || !supabaseUrl || !supabaseAnonKey) throw new MarkMediaReadError(false);
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/mark-media/read`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mark_id: markId, request_id: freshRequestId() }),
      redirect: "error",
    });
  } catch {
    throw new MarkMediaReadError(false);
  }
  if (!response.ok) throw new MarkMediaReadError([400, 401, 403, 404].includes(response.status));
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new MarkMediaReadError(false);
  }
  const manifest = parseProtectedMediaManifest(raw);
  if (!manifest) throw new MarkMediaReadError(false);
  return manifest;
}

type CacheEntry = { manifest?: ProtectedMediaManifest; inFlight?: Promise<ProtectedMediaManifest> };

let mediaSessionGeneration = 0;

/** Process-monotonic so an AuthProvider remount cannot reuse an old cache identity. */
export function allocateMediaSessionGeneration(): number {
  mediaSessionGeneration += 1;
  return mediaSessionGeneration;
}

export type MediaFailureDecision = "refresh" | "terminal" | "ignore";

/** Pure failure-budget state machine shared by photo/audio/video error callbacks. */
export class MediaFailureEpisode {
  private state: "fresh" | "refreshing" | "spent" | "terminal" = "fresh";

  reset() {
    this.state = "fresh";
  }

  begin(): MediaFailureDecision {
    if (this.state === "fresh") {
      this.state = "refreshing";
      return "refresh";
    }
    if (this.state === "spent") {
      this.state = "terminal";
      return "terminal";
    }
    return "ignore";
  }

  complete(succeeded: boolean) {
    if (this.state === "refreshing") this.state = succeeded ? "spent" : "terminal";
  }
}

/** Invalidates late native async completions after backgrounding or teardown. */
export class AsyncOperationFence {
  private epoch = 0;

  begin(): number {
    this.epoch += 1;
    return this.epoch;
  }

  invalidate() {
    this.epoch += 1;
  }

  isCurrent(candidate: number): boolean {
    return candidate === this.epoch;
  }
}

export type GuardedAsyncResult<T> =
  | { status: "current"; value: T }
  | { status: "stale" }
  | { status: "error"; cause: unknown };

/** Awaits native work without allowing a lifecycle-invalidated completion to escape. */
export async function awaitGuarded<T>(
  fence: AsyncOperationFence,
  token: number,
  operation: Promise<T>,
  cleanupStale?: (value: T) => void | Promise<void>,
): Promise<GuardedAsyncResult<T>> {
  try {
    const value = await operation;
    if (!fence.isCurrent(token)) {
      if (cleanupStale) {
        try {
          await cleanupStale(value);
        } catch {
          // Stale cleanup is best effort and must never become an unhandled rejection.
        }
      }
      return { status: "stale" };
    }
    return { status: "current", value };
  } catch (cause) {
    return fence.isCurrent(token) ? { status: "error", cause } : { status: "stale" };
  }
}

/** Runtime clears repeat; only component teardown unregisters the AV resource. */
export class RuntimeUnloadRegistration {
  private callback: (() => void | Promise<void>) | null = null;

  set(callback: (() => void | Promise<void>) | null) {
    this.callback = callback;
  }

  invoke() {
    if (!this.callback) return;
    try {
      void Promise.resolve(this.callback()).catch(() => undefined);
    } catch {
      // Native unload is best effort during security lifecycle invalidation.
    }
  }

  clear() {
    this.callback = null;
  }
}

/** Volatile process-memory cache. It deliberately has no serialization API. */
export class ProtectedMediaCache {
  private entries = new Map<string, CacheEntry>();
  private clearListeners = new Set<() => void>();
  private globalEpoch = 0;
  private keyEpochs = new Map<string, number>();

  async read(identity: MediaCacheIdentity, fetcher: () => Promise<ProtectedMediaManifest>, force = false) {
    const key = mediaCacheKey(identity);
    const globalEpoch = this.globalEpoch;
    const keyEpoch = this.keyEpochs.get(key) ?? 0;
    const current = this.entries.get(key);
    if (!force && current?.manifest && Date.parse(current.manifest.expires_at) > Date.now() + 15_000) return current.manifest;
    if (current?.inFlight) return current.inFlight;
    const promise = fetcher().then((manifest) => {
      if (globalEpoch === this.globalEpoch && keyEpoch === (this.keyEpochs.get(key) ?? 0)) {
        this.entries.set(key, { manifest });
      }
      return manifest;
    }).catch((cause) => {
      const latest = this.entries.get(key);
      if (latest?.inFlight === promise) this.entries.delete(key);
      throw cause;
    });
    this.entries.set(key, { inFlight: promise });
    return promise;
  }

  clear(identity: MediaCacheIdentity) {
    const key = mediaCacheKey(identity);
    this.keyEpochs.set(key, (this.keyEpochs.get(key) ?? 0) + 1);
    this.entries.delete(key);
  }

  clearAll() {
    this.globalEpoch += 1;
    this.entries.clear();
    this.keyEpochs.clear();
    for (const listener of this.clearListeners) listener();
  }

  onClear(listener: () => void): () => void {
    this.clearListeners.add(listener);
    return () => this.clearListeners.delete(listener);
  }
}

export const protectedMediaCache = new ProtectedMediaCache();

/**
 * The composer is the only caller allowed to render a direct client URI.
 * Persisted Marks—even if they still contain media_url—always use signed reads.
 */
export function selectLocalDraftPreviewUrl(markId: string, candidate: string | null): string | null {
  if (markId !== "preview" || !candidate) return null;
  return /^(?:file|content|ph|assets-library):\/\//.test(candidate) ? candidate : null;
}
