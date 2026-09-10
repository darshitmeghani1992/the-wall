import { supabase } from "./supabase";
import { Upload } from "tus-js-client";
import * as SecureStore from "expo-secure-store";
import { supabaseUrl } from "./config";
import {
  isAllowedProtectedResumeUrl, parseProtectedResumeIndex, protectedResumeEntryMatches, removeProtectedResumeScope,
  type MediaReservation, type MediaUploadTransport, type MediaWriterDraft, type ProtectedResumeIndexEntry,
} from "./mark-media-writer";

/**
 * Per-kind byte caps (client-side abuse safety, Master Spec §108). Server-side
 * bucket limits (allowed_mime_types / file_size_limit on the `attachments`
 * bucket) are a hosted-config hardening task — see docs/BUILD_STATUS.md.
 */
export const MEDIA_LIMITS = {
  image: 6 * 1024 * 1024, // 6 MB — avatars & photo Marks
  audio: 8 * 1024 * 1024, // 8 MB — voice Marks (≤60s)
  video: 40 * 1024 * 1024, // 40 MB — video Marks (≤30s)
} as const;

/** MIME allowlist per media kind (reject anything else before upload). */
const ALLOWED: Record<keyof typeof MEDIA_LIMITS, RegExp> = {
  image: /^image\/(jpe?g|png|heic|webp)$/i,
  audio: /^audio\/(m4a|x-m4a|mp4|aac|mpeg|wav)$/i,
  video: /^video\/(mp4|quicktime|x-m4v)$/i,
};

function extFor(contentType: string): string {
  const sub = contentType.split("/")[1]?.toLowerCase() ?? "bin";
  return sub
    .replace("jpeg", "jpg")
    .replace("x-m4a", "m4a")
    .replace("quicktime", "mov")
    .replace("x-m4v", "m4v")
    .replace("mpeg", "mp3");
}

async function uploadPublicAttachment(
  localUri: string,
  prefix: string,
  contentType: string,
  kind: keyof typeof MEDIA_LIMITS,
): Promise<string> {
  if (!ALLOWED[kind].test(contentType)) {
    throw new Error(`Unsupported ${kind} format.`);
  }
  const arraybuffer = await fetch(localUri).then((r) => r.arrayBuffer());
  if (arraybuffer.byteLength > MEDIA_LIMITS[kind]) {
    const mb = Math.round(MEDIA_LIMITS[kind] / (1024 * 1024));
    throw new Error(`That ${kind} is too large — max ${mb}MB.`);
  }
  const path = `${prefix}/${Date.now()}.${extFor(contentType)}`;

  const { error } = await supabase.storage
    .from("attachments")
    .upload(path, arraybuffer, { contentType, cacheControl: "3600", upsert: false });
  if (error) throw error;

  return supabase.storage.from("attachments").getPublicUrl(path).data.publicUrl;
}

/** Public avatars remain governed by ADR-006. Mark media must never use this path. */
export async function uploadImage(
  localUri: string,
  prefix: string,
  contentType = "image/jpeg",
): Promise<string> {
  return uploadPublicAttachment(localUri, prefix, contentType, "image");
}

const STANDARD_UPLOAD_MAX = 6 * 1024 * 1024;
const TUS_CHUNK_SIZE = 6 * 1024 * 1024;
const TUS_RETRY_DELAYS = [0, 1_000, 3_000, 5_000] as const;

type ActiveTusUpload = {
  upload: Upload;
  reject: (cause: Error) => void;
  promise: Promise<void>;
  urlStorage: ScopedTusUrlStorage;
};

const activeTusUploads = new Map<string, ActiveTusUpload>();
const resumableUrlStores = new Map<string, ScopedTusUrlStorage>();
const RESUME_INDEX_KEY = "tw_media_tus_index_v1";
let resumeIndexQueue: Promise<void> = Promise.resolve();
let resumeResetEpoch = 0;

/** Local picker/recorder URIs do not consistently expose byte size on Android. */
export async function getLocalMediaSize(localUri: string): Promise<number> {
  const response = await fetch(localUri);
  if (!response.ok) throw new Error("MARK_MEDIA_FILE_UNAVAILABLE");
  const blob = await response.blob();
  if (!Number.isSafeInteger(blob.size) || blob.size <= 0) throw new Error("MARK_MEDIA_FILE_UNAVAILABLE");
  return blob.size;
}

function protectedUploadKey(subject: string, uploadId: string): string {
  return `${subject}:${uploadId}`;
}

function resumableEndpoint(): string {
  if (!supabaseUrl) throw new Error("MARK_MEDIA_UPLOAD_UNAVAILABLE");
  const parsed = new URL(supabaseUrl);
  const match = /^([a-z0-9-]+)\.supabase\.co$/.exec(parsed.hostname);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || parsed.hash || parsed.search ||
    parsed.pathname !== "/" || !match) {
    throw new Error("MARK_MEDIA_UPLOAD_UNAVAILABLE");
  }
  return `https://${match[1]}.storage.supabase.co/storage/v1/upload/resumable`;
}

type TusPreviousUpload = Awaited<ReturnType<Upload["findPreviousUploads"]>>[number];

function safeStorageKey(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `tw_media_tus_${(hash >>> 0).toString(16)}`;
}

/** One encrypted resume record, scoped to the exact subject/session/upload/path fingerprint. */
class ScopedTusUrlStorage {
  private readonly storageKey: string;
  private readonly resetEpoch = resumeResetEpoch;

  constructor(private readonly scope: Omit<ProtectedResumeIndexEntry, "storageKey">) {
    this.storageKey = safeStorageKey(scope.fingerprint);
  }

  async findAllUploads(): Promise<TusPreviousUpload[]> {
    return this.findUploadsByFingerprint(this.scope.fingerprint);
  }

  async findUploadsByFingerprint(fingerprint: string): Promise<TusPreviousUpload[]> {
    if (fingerprint !== this.scope.fingerprint || this.resetEpoch !== resumeResetEpoch) return [];
    const index = await readResumeIndex();
    const expected = { ...this.scope, storageKey: this.storageKey };
    if (!index?.some((entry) => protectedResumeEntryMatches(entry, expected))) {
      await SecureStore.deleteItemAsync(this.storageKey);
      return [];
    }
    const raw = await SecureStore.getItemAsync(this.storageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as { fingerprint?: unknown; upload?: TusPreviousUpload };
      return parsed.fingerprint === this.scope.fingerprint && parsed.upload ? [parsed.upload] : [];
    } catch {
      await this.clear();
      return [];
    }
  }

  async removeUpload(urlStorageKey: string): Promise<void> {
    if (urlStorageKey === this.storageKey) await this.clear();
  }

  async addUpload(fingerprint: string, upload: TusPreviousUpload): Promise<string> {
    if (fingerprint !== this.scope.fingerprint || this.resetEpoch !== resumeResetEpoch) {
      throw new Error("MARK_MEDIA_RESUME_SCOPE_MISMATCH");
    }
    const stored = { ...upload, urlStorageKey: this.storageKey };
    await SecureStore.setItemAsync(this.storageKey, JSON.stringify({ fingerprint, upload: stored }));
    try {
      await mutateResumeIndex((entries) => {
        if (this.resetEpoch !== resumeResetEpoch) throw new Error("MARK_MEDIA_SESSION_CHANGED");
        return [
          ...entries.filter((entry) => entry.fingerprint !== fingerprint && entry.storageKey !== this.storageKey),
          { ...this.scope, storageKey: this.storageKey },
        ];
      });
    } catch (cause) {
      await SecureStore.deleteItemAsync(this.storageKey);
      throw cause;
    }
    return this.storageKey;
  }

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(this.storageKey);
    await mutateResumeIndex((entries) => entries.filter((entry) =>
      entry.fingerprint !== this.scope.fingerprint && entry.storageKey !== this.storageKey));
  }


  async deletePayloadOnly(): Promise<void> {
    await SecureStore.deleteItemAsync(this.storageKey);
  }
}

async function readResumeIndex(): Promise<ProtectedResumeIndexEntry[] | null> {
  const raw = await SecureStore.getItemAsync(RESUME_INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = parseProtectedResumeIndex(JSON.parse(raw));
    if (parsed) return parsed;
  } catch {
    // Fall through to fail-closed cleanup.
  }
  await purgeDecodedResumeStorage(raw);
  return null;
}

async function purgeDecodedResumeStorage(raw: string): Promise<void> {
  let decoded: unknown;
  try { decoded = JSON.parse(raw); } catch { decoded = null; }
  if (Array.isArray(decoded)) {
    await Promise.all(decoded.map(async (entry) => {
      if (entry && typeof entry === "object" && "storageKey" in entry &&
        typeof entry.storageKey === "string" && /^tw_media_tus_[0-9a-f]{1,8}$/.test(entry.storageKey)) {
        await SecureStore.deleteItemAsync(entry.storageKey);
      }
    }));
  }
  await SecureStore.deleteItemAsync(RESUME_INDEX_KEY);
}

function safeIndexedStorageKeys(raw: string | null): string[] {
  if (!raw) return [];
  let decoded: unknown;
  try { decoded = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(decoded)) return [];
  return [...new Set(decoded.flatMap((entry) => entry && typeof entry === "object" && "storageKey" in entry &&
    typeof entry.storageKey === "string" && /^tw_media_tus_[0-9a-f]{1,8}$/.test(entry.storageKey)
    ? [entry.storageKey]
    : []))];
}

async function mutateResumeIndex(
  mutate: (entries: ProtectedResumeIndexEntry[]) => ProtectedResumeIndexEntry[],
): Promise<void> {
  const operation = resumeIndexQueue.catch(() => undefined).then(async () => {
    const current = await readResumeIndex();
    const next = mutate(current ?? []);
    if (next.length === 0) await SecureStore.deleteItemAsync(RESUME_INDEX_KEY);
    else await SecureStore.setItemAsync(RESUME_INDEX_KEY, JSON.stringify(next));
  });
  resumeIndexQueue = operation;
  await operation;
}

async function pruneExpiredResumeRecords(): Promise<void> {
  const raw = await SecureStore.getItemAsync(RESUME_INDEX_KEY);
  if (!raw) return;
  let decoded: unknown;
  try { decoded = JSON.parse(raw); } catch { decoded = null; }
  const valid = parseProtectedResumeIndex(decoded);
  if (valid) return;
  await purgeDecodedResumeStorage(raw);
}

async function currentAccessToken(expectedSubject: string): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token || data.session.user.id !== expectedSubject) {
    throw new Error("MARK_MEDIA_SESSION_CHANGED");
  }
  return data.session.access_token;
}

async function standardProtectedUpload(
  draft: MediaWriterDraft,
  reservation: MediaReservation,
  expectedSubject: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  if (draft.bytes > STANDARD_UPLOAD_MAX) throw new Error("MARK_MEDIA_RESUMABLE_REQUIRED");
  await currentAccessToken(expectedSubject);
  onProgress(0.05);
  const response = await fetch(draft.uri);
  if (!response.ok) throw new Error("MARK_MEDIA_FILE_UNAVAILABLE");
  const body = await response.arrayBuffer();
  if (body.byteLength !== draft.bytes || body.byteLength > STANDARD_UPLOAD_MAX) throw new Error("MARK_MEDIA_FILE_CHANGED");
  onProgress(0.2);
  const { error } = await supabase.storage.from(reservation.bucket).upload(reservation.path, body, {
    contentType: draft.mime,
    upsert: false,
  });
  // A retry after a lost success response receives a conflict. The following
  // mark_media_uploaded RPC is the authenticated reconciliation boundary.
  const statusCode = error && "statusCode" in error ? String(error.statusCode) : "";
  if (error && statusCode !== "409") throw new Error("MARK_MEDIA_UPLOAD_FAILED");
  onProgress(1);
}

async function resumableProtectedUpload(
  draft: MediaWriterDraft,
  reservation: MediaReservation,
  expectedSubject: string,
  sessionGeneration: number,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const fingerprint = `${protectedUploadKey(expectedSubject, reservation.uploadId)}:${sessionGeneration}:${reservation.path}`;
  const endpoint = resumableEndpoint();
  await pruneExpiredResumeRecords();
  const existing = activeTusUploads.get(fingerprint);
  // A concurrent retry joins the authoritative in-flight attempt. Calling
  // start() twice can create a second TUS request or race completion callbacks.
  if (existing) return existing.promise;

  let resolveUpload!: () => void;
  let rejectUpload!: (cause: Error) => void;
  const promise = new Promise<void>((resolve, reject) => {
    resolveUpload = resolve;
    rejectUpload = reject;
  });
  const urlStorage = new ScopedTusUrlStorage({ fingerprint, subject: expectedSubject,
    uploadId: reservation.uploadId, sessionGeneration, path: reservation.path, expiresAt: reservation.expiresAt });
  resumableUrlStores.set(fingerprint, urlStorage);
  // tus-js-client's React Native reader accepts the native picker object and
  // resolves its URI to a Blob internally. The cast reflects a missing RN
  // overload in its public TypeScript declaration, verified in v4.3.1 source.
  const file = { uri: draft.uri, name: reservation.uploadId, size: draft.bytes, type: draft.mime } as unknown as Blob;
  const upload = new Upload(file, {
      endpoint,
      uploadSize: draft.bytes,
      chunkSize: TUS_CHUNK_SIZE,
      retryDelays: [...TUS_RETRY_DELAYS],
      uploadDataDuringCreation: true,
      storeFingerprintForResuming: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: reservation.bucket,
        objectName: reservation.path,
        contentType: draft.mime,
        cacheControl: "60",
      },
      headers: { "x-upsert": "false" },
      fingerprint: async () => fingerprint,
      urlStorage,
      onBeforeRequest: async (request) => {
        request.setHeader("Authorization", `Bearer ${await currentAccessToken(expectedSubject)}`);
        request.setHeader("x-upsert", "false");
      },
      onProgress: (sent, total) => onProgress(total > 0 ? sent / total : 0),
      onSuccess: () => {
        activeTusUploads.delete(fingerprint);
        resumableUrlStores.delete(fingerprint);
        void urlStorage.clear();
        onProgress(1);
        resolveUpload();
      },
      onError: (cause) => {
        activeTusUploads.delete(fingerprint);
        if ("originalResponse" in cause && cause.originalResponse?.getStatus() === 409) {
          void urlStorage.clear();
          resumableUrlStores.delete(fingerprint);
          onProgress(1);
          resolveUpload();
          return;
        }
        rejectUpload(new Error("MARK_MEDIA_UPLOAD_FAILED"));
      },
  });
  activeTusUploads.set(fingerprint, { upload, reject: rejectUpload, promise, urlStorage });
  void upload.findPreviousUploads().then(async (previous) => {
    const candidate = previous.length === 1 ? previous[0] : null;
    let valid = false;
    if (candidate?.uploadUrl && candidate.size === draft.bytes &&
      candidate.metadata.bucketName === reservation.bucket &&
      candidate.metadata.objectName === reservation.path && candidate.metadata.contentType === draft.mime) {
      try {
        valid = isAllowedProtectedResumeUrl(candidate.uploadUrl, endpoint);
      } catch {
        valid = false;
      }
    }
    if (valid && candidate) upload.resumeFromPreviousUpload(candidate);
    else if (candidate) await urlStorage.clear();
    upload.start();
  }).catch(() => {
    upload.start();
  });
  return promise;
}

/**
 * Creates the C4 transport bound to one authenticated subject. Photos use the
 * standard private upload path; AV uses TUS so progress/resume is real even
 * below 6 MiB, while files above 6 MiB can never fall back to whole-file upload.
 */
export function createProtectedMediaTransport(expectedSubject: string, sessionGeneration: number): MediaUploadTransport {
  return async (draft, reservation, onProgress) => {
    const kind: keyof typeof MEDIA_LIMITS = draft.kind === "photo" ? "image" : draft.kind === "voice" ? "audio" : "video";
    if (!ALLOWED[kind].test(draft.mime) || draft.bytes > MEDIA_LIMITS[kind]) throw new Error("MARK_MEDIA_INVALID_FILE");
    if (draft.kind === "photo") {
      await standardProtectedUpload(draft, reservation, expectedSubject, onProgress);
      return;
    }
    await resumableProtectedUpload(draft, reservation, expectedSubject, sessionGeneration, onProgress);
  };
}

/** Abort the in-memory TUS session before the actor-bound cancellation RPC. */
export async function abortProtectedMediaUpload(expectedSubject: string, uploadId: string): Promise<void> {
  const prefix = `${protectedUploadKey(expectedSubject, uploadId)}:`;
  const matches = [...activeTusUploads.entries()].filter(([key]) => key.startsWith(prefix));
  await Promise.all(matches.map(async ([key, active]) => {
    activeTusUploads.delete(key);
    try {
      await active.upload.abort(false);
      await active.urlStorage.clear();
    } finally {
      active.reject(new Error("MARK_MEDIA_UPLOAD_ABORTED"));
    }
  }));
  const stores = [...resumableUrlStores.entries()].filter(([key]) => key.startsWith(prefix));
  await Promise.all(stores.map(async ([key, store]) => {
    resumableUrlStores.delete(key);
    await store.clear();
  }));
}

/** Clears enumerable encrypted resume records on session rotation or logout. */
export async function clearProtectedMediaResumeScope(expectedSubject: string, sessionGeneration: number): Promise<void> {
  const entries = await readResumeIndex();
  if (!entries) return;
  const matches = entries.filter((entry) => entry.subject === expectedSubject && entry.sessionGeneration === sessionGeneration);
  await Promise.all(matches.map((entry) => SecureStore.deleteItemAsync(entry.storageKey)));
  await mutateResumeIndex((current) => removeProtectedResumeScope(current, expectedSubject, sessionGeneration, "exact"));
}

/** On a new auth generation, purge restart leftovers that can no longer resume. */
export async function clearProtectedMediaOtherSessions(expectedSubject: string, sessionGeneration: number): Promise<void> {
  const entries = await readResumeIndex();
  if (!entries) return;
  const matches = entries.filter((entry) => entry.subject === expectedSubject && entry.sessionGeneration !== sessionGeneration);
  await Promise.all(matches.map((entry) => SecureStore.deleteItemAsync(entry.storageKey)));
  await mutateResumeIndex((current) => removeProtectedResumeScope(current, expectedSubject, sessionGeneration, "other"));
}

/**
 * Global auth fence. The index becomes unreachable before any slower abort or
 * payload deletion, so a new identity can never discover the departing
 * identity's resume URL. Cleanup is deliberately local and best-effort.
 */
export async function resetProtectedMediaUploads(): Promise<void> {
  resumeResetEpoch += 1;
  let detachedIndex: string | null = null;
  const detach = resumeIndexQueue.catch(() => undefined).then(async () => {
    detachedIndex = await SecureStore.getItemAsync(RESUME_INDEX_KEY);
    await SecureStore.deleteItemAsync(RESUME_INDEX_KEY);
  });
  resumeIndexQueue = detach;
  try { await detach; } catch { detachedIndex = null; }

  const active = [...activeTusUploads.values()];
  const stores = [...resumableUrlStores.values()];
  activeTusUploads.clear();
  resumableUrlStores.clear();
  await Promise.allSettled(active.map(async (entry) => {
    try { await entry.upload.abort(false); } finally {
      entry.reject(new Error("MARK_MEDIA_SESSION_CHANGED"));
      await entry.urlStorage.deletePayloadOnly();
    }
  }));
  await Promise.allSettled([
    ...stores.map((store) => store.deletePayloadOnly()),
    ...safeIndexedStorageKeys(detachedIndex).map((key) => SecureStore.deleteItemAsync(key)),
  ]);
  // Defense in depth for an addUpload callback that was already queued at the
  // first fence. The reset epoch prevents any later callback from re-adding.
  let lateIndex: string | null = null;
  const detachLate = resumeIndexQueue.catch(() => undefined).then(async () => {
    lateIndex = await SecureStore.getItemAsync(RESUME_INDEX_KEY);
    await SecureStore.deleteItemAsync(RESUME_INDEX_KEY);
  });
  resumeIndexQueue = detachLate;
  try { await detachLate; } catch { lateIndex = null; }
  await Promise.allSettled(safeIndexedStorageKeys(lateIndex).map((key) => SecureStore.deleteItemAsync(key)));
}
