import type { MarkStatus, MarkType } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// PostgreSQL JSON serializes UTC timestamptz values with `+00:00`, while some
// test/Edge paths use the equivalent `Z`. Accept only those two UTC forms.
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/;

export type MediaKind = Exclude<MarkType, "text">;
export type ProtectedResumeIndexEntry = {
  fingerprint: string;
  storageKey: string;
  subject: string;
  uploadId: string;
  sessionGeneration: number;
  path: string;
  expiresAt: string;
};
export type MediaUploadState =
  | "selected"
  | "reserving"
  | "uploading"
  | "uploaded"
  | "validating"
  | "validated"
  | "failed"
  | "cancelling"
  | "cancelled";

export type MediaFailureCode =
  | "UNSUPPORTED_FORMAT"
  | "TOO_LARGE"
  | "TOO_LONG"
  | "INVALID_MEDIA"
  | "PROCESSING_FAILED";

export type MediaWriterDraft = {
  clientUploadId: string;
  uploadId: string | null;
  kind: MediaKind;
  uri: string;
  mime: string;
  bytes: number;
  durationMs?: number;
  state: MediaUploadState;
  progress: number;
  errorCode?: MediaFailureCode;
  retryFrom?: "upload" | "validation";
};

export type MediaReservation = {
  status: "ready";
  uploadId: string;
  bucket: "mark-media";
  path: string;
  expiresAt: string;
};

export type MediaUploadPublicState = Exclude<MediaUploadState, "selected" | "reserving" | "uploading">;
export type MediaUploadStatus = {
  uploadId: string;
  state: "initiated" | "uploaded" | "processing" | "validated" | "failed" | "expired" | "cancelling" | "cancelled";
  errorCode?: MediaFailureCode;
};

export type CreateMediaMarkResult =
  | { status: "created" | "existing"; markId: string; markStatus: MarkStatus }
  | { status: "deleted"; markId: string }
  | { status: "invalid" | "unavailable" | "media_not_ready" | "request_id_reused" };

export type PreparedMediaMarkRequest = {
  fingerprint: string;
  requestId: string;
  rotation: number;
};

export type MediaWriterRpc = {
  begin(args: {
    p_wall_id: string;
    p_kind: MediaKind;
    p_client_upload_id: string;
    p_declared_mime: string;
    p_declared_bytes: number;
  }): Promise<unknown>;
  uploaded(args: { p_upload_id: string }): Promise<unknown>;
  status(args: { p_upload_ids: string[] }): Promise<unknown>;
  cancel(args: { p_upload_id: string }): Promise<unknown>;
  create(args: {
    p_request_id: string;
    p_wall_id: string;
    p_type: MediaKind;
    p_text: string | null;
    p_color: null;
    p_anonymous: boolean;
    p_secret: false;
    p_rotation: number;
    p_upload_ids: string[];
  }): Promise<unknown>;
};

export type MediaUploadTransport = (
  draft: MediaWriterDraft,
  reservation: MediaReservation,
  onProgress: (fraction: number) => void,
) => Promise<void>;

export class MediaWriterError extends Error {
  readonly code:
    | "invalid"
    | "unavailable"
    | "rate_limited"
    | "invalid_response"
    | "upload_failed"
    | "validation_failed"
    | "validation_timeout"
    | "paused"
    | "stale";
  readonly retryable: boolean;
  readonly mediaFailureCode?: MediaFailureCode;

  constructor(
    code:
      | "invalid"
      | "unavailable"
      | "rate_limited"
      | "invalid_response"
      | "upload_failed"
      | "validation_failed"
      | "validation_timeout"
      | "paused"
      | "stale",
    retryable: boolean,
    mediaFailureCode?: MediaFailureCode,
  ) {
    super(`MARK_MEDIA_${code.toUpperCase()}`);
    this.name = "MediaWriterError";
    this.code = code;
    this.retryable = retryable;
    this.mediaFailureCode = mediaFailureCode;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function isFailureCode(value: unknown): value is MediaFailureCode {
  return value === "UNSUPPORTED_FORMAT" || value === "TOO_LARGE" || value === "TOO_LONG" ||
    value === "INVALID_MEDIA" || value === "PROCESSING_FAILED";
}

function isFutureUtcTimestamp(value: unknown, nowMs: number): value is string {
  if (typeof value !== "string" || !UTC_TIMESTAMP.test(value)) return false;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && epoch > nowMs;
}

/** Strict, non-secret index parser used to enumerate encrypted TUS records. */
export function parseProtectedResumeIndex(value: unknown, nowMs = Date.now()): ProtectedResumeIndexEntry[] | null {
  if (!Array.isArray(value) || value.length > 20) return null;
  const entries: ProtectedResumeIndexEntry[] = [];
  const fingerprints = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry) || !hasExactKeys(entry,
      ["fingerprint", "storageKey", "subject", "uploadId", "sessionGeneration", "path", "expiresAt"]) ||
      typeof entry.fingerprint !== "string" || entry.fingerprint.length < 20 || entry.fingerprint.length > 500 ||
      typeof entry.storageKey !== "string" || !/^tw_media_tus_[0-9a-f]{1,8}$/.test(entry.storageKey) ||
      !isUuid(entry.subject) || !isUuid(entry.uploadId) ||
      !Number.isSafeInteger(entry.sessionGeneration) || Number(entry.sessionGeneration) <= 0 ||
      entry.path !== `staging/${entry.subject}/${entry.uploadId}/source` ||
      entry.fingerprint !== `${entry.subject}:${entry.uploadId}:${entry.sessionGeneration}:${entry.path}` ||
      !isFutureUtcTimestamp(entry.expiresAt, nowMs) || fingerprints.has(entry.fingerprint)) return null;
    fingerprints.add(entry.fingerprint);
    entries.push(entry as ProtectedResumeIndexEntry);
  }
  return entries;
}

export function protectedResumeEntryMatches(
  entry: ProtectedResumeIndexEntry,
  expected: Pick<ProtectedResumeIndexEntry, "fingerprint" | "storageKey" | "subject" | "uploadId" | "sessionGeneration" | "path">,
): boolean {
  return entry.fingerprint === expected.fingerprint && entry.storageKey === expected.storageKey &&
    entry.subject === expected.subject && entry.uploadId === expected.uploadId &&
    entry.sessionGeneration === expected.sessionGeneration && entry.path === expected.path;
}

export function removeProtectedResumeScope(
  entries: ProtectedResumeIndexEntry[], subject: string, sessionGeneration: number, mode: "exact" | "other",
): ProtectedResumeIndexEntry[] {
  return entries.filter((entry) => entry.subject !== subject ||
    (mode === "exact" ? entry.sessionGeneration !== sessionGeneration : entry.sessionGeneration === sessionGeneration));
}

export function shouldResetProtectedResumeState(
  event: string, previousSubject: string | null | undefined, nextSubject: string | null,
): boolean {
  if (event === "INITIAL_SESSION") return false;
  if (event === "SIGNED_OUT") return true;
  return previousSubject !== undefined && previousSubject !== null && previousSubject !== nextSubject;
}

export type AuthEventEffects = {
  mode: "session_only" | "refresh_account" | "identity_boundary";
  rotateMediaGeneration: boolean;
  clearProtectedMedia: boolean;
  clearAccountState: boolean;
  showRouteLoading: boolean;
  refreshAccountState: boolean;
  resetProtectedResume: boolean;
};

/**
 * One production contract for the auth/media seam. Routine same-subject token/user refreshes
 * must not interrupt an active upload; identity boundaries retain the complete isolation reset.
 */
export function authEventEffects(
  event: string,
  previousSubject: string | null | undefined,
  nextSubject: string | null,
): AuthEventEffects {
  const sameAuthenticatedSubject = previousSubject !== undefined
    && previousSubject !== null
    && previousSubject === nextSubject;
  if (sameAuthenticatedSubject && (event === "TOKEN_REFRESHED" || event === "USER_UPDATED")) {
    return {
      mode: "session_only",
      rotateMediaGeneration: false,
      clearProtectedMedia: false,
      clearAccountState: false,
      showRouteLoading: false,
      refreshAccountState: false,
      resetProtectedResume: false,
    };
  }
  if (sameAuthenticatedSubject) {
    return {
      mode: "refresh_account",
      rotateMediaGeneration: false,
      clearProtectedMedia: false,
      clearAccountState: false,
      showRouteLoading: false,
      refreshAccountState: true,
      resetProtectedResume: false,
    };
  }
  return {
    mode: "identity_boundary",
    rotateMediaGeneration: true,
    clearProtectedMedia: true,
    clearAccountState: true,
    showRouteLoading: true,
    refreshAccountState: true,
    resetProtectedResume: shouldResetProtectedResumeState(event, previousSubject, nextSubject),
  };
}

/** TUS resume URLs must be an exact, opaque child of the validated endpoint. */
export function isAllowedProtectedResumeUrl(value: unknown, endpoint: string): value is string {
  if (typeof value !== "string") return false;
  try {
    const expected = new URL(endpoint);
    const candidate = new URL(value);
    const prefix = `${expected.pathname}/`;
    const opaqueChild = candidate.pathname.slice(prefix.length);
    return expected.protocol === "https:" && candidate.protocol === "https:" &&
      candidate.origin === expected.origin && !candidate.username && !candidate.password && !candidate.port &&
      !candidate.search && !candidate.hash && candidate.pathname.startsWith(prefix) &&
      opaqueChild.length > 0 && opaqueChild.length <= 1024 && !opaqueChild.includes("/") &&
      !opaqueChild.includes("%") && opaqueChild !== "." && opaqueChild !== "..";
  } catch {
    return false;
  }
}

/** Strictly parses the reservation RPC; protected paths never leave this writer module. */
export function parseMediaReservation(value: unknown, expectedSubject: string, nowMs = Date.now()): MediaReservation | "invalid" | "unavailable" | "rate_limited" | null {
  if (!isRecord(value) || typeof value.status !== "string") return null;
  if (value.status === "invalid" || value.status === "unavailable" || value.status === "rate_limited") {
    return hasExactKeys(value, ["status"]) ? value.status : null;
  }
  if (value.status !== "ready" || !hasExactKeys(value, ["status", "upload_id", "bucket", "path", "expires_at"]) ||
    !isUuid(expectedSubject) || !isUuid(value.upload_id) || value.bucket !== "mark-media" ||
    value.path !== `staging/${expectedSubject}/${value.upload_id}/source` ||
    !isFutureUtcTimestamp(value.expires_at, nowMs)) {
    return null;
  }
  return { status: "ready", uploadId: value.upload_id, bucket: "mark-media", path: value.path, expiresAt: value.expires_at };
}

export function parseMediaUploaded(value: unknown): "uploaded" | "processing" | "validated" | { status: "failed"; errorCode: MediaFailureCode } | "unavailable" | null {
  if (!isRecord(value) || typeof value.status !== "string") return null;
  if (value.status === "uploaded" || value.status === "processing" || value.status === "validated" || value.status === "unavailable") {
    return hasExactKeys(value, ["status"]) ? value.status : null;
  }
  if (value.status === "failed" && hasExactKeys(value, ["status", "error_code"]) && isFailureCode(value.error_code)) {
    return { status: "failed", errorCode: value.error_code };
  }
  return null;
}

export function parseMediaStatuses(value: unknown): MediaUploadStatus[] | "unavailable" | null {
  if (isRecord(value)) {
    return value.status === "unavailable" && hasExactKeys(value, ["status"]) ? "unavailable" : null;
  }
  if (!Array.isArray(value) || value.length > 5) return null;
  const result: MediaUploadStatus[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || !isUuid(entry.upload_id) || typeof entry.state !== "string") return null;
    const validState = entry.state === "initiated" || entry.state === "uploaded" || entry.state === "processing" ||
      entry.state === "validated" || entry.state === "failed" || entry.state === "expired" ||
      entry.state === "cancelling" || entry.state === "cancelled";
    if (!validState) return null;
    if (entry.state === "failed") {
      if (!hasExactKeys(entry, ["upload_id", "state", "error_code"]) || !isFailureCode(entry.error_code)) return null;
      result.push({ uploadId: entry.upload_id, state: "failed", errorCode: entry.error_code });
    } else {
      if (!hasExactKeys(entry, ["upload_id", "state"])) return null;
      result.push({ uploadId: entry.upload_id, state: entry.state as MediaUploadStatus["state"] });
    }
  }
  return result;
}

export function parseMediaCancellation(value: unknown): "cancelling" | "cancelled" | "unavailable" | null {
  if (!isRecord(value) || !hasExactKeys(value, ["status"])) return null;
  return value.status === "cancelling" || value.status === "cancelled" || value.status === "unavailable"
    ? value.status
    : null;
}

export function parseCreateMediaMark(value: unknown): CreateMediaMarkResult | null {
  if (!isRecord(value) || typeof value.status !== "string") return null;
  if (value.status === "created" || value.status === "existing") {
    if (!hasExactKeys(value, ["status", "mark_id", "mark_status"]) || !isUuid(value.mark_id) ||
      (value.mark_status !== "active" && value.mark_status !== "pending" && value.mark_status !== "hidden" && value.mark_status !== "removed")) return null;
    return { status: value.status, markId: value.mark_id, markStatus: value.mark_status };
  }
  if (value.status === "deleted") {
    return hasExactKeys(value, ["status", "mark_id"]) && isUuid(value.mark_id)
      ? { status: "deleted", markId: value.mark_id }
      : null;
  }
  if (value.status === "invalid" || value.status === "unavailable" || value.status === "media_not_ready" || value.status === "request_id_reused") {
    return hasExactKeys(value, ["status"]) ? { status: value.status } : null;
  }
  return null;
}

export function createMediaWriterDraft(input: Omit<MediaWriterDraft, "clientUploadId" | "uploadId" | "state" | "progress">, id: string): MediaWriterDraft {
  if (!isUuid(id) || !Number.isSafeInteger(input.bytes) || input.bytes <= 0) throw new MediaWriterError("invalid", false);
  return { ...input, mime: input.mime.trim().toLowerCase(), clientUploadId: id, uploadId: null, state: "selected", progress: 0 };
}

/** Freezes Mark identity across ambiguous create retries; semantic/order changes rotate it. */
export function prepareMediaMarkRequest(
  input: { wallId: string; type: MediaKind; text: string; anonymous: boolean; uploads: MediaWriterDraft[] },
  previous: PreparedMediaMarkRequest | null,
  requestIdFactory: () => string,
  rotationFactory: () => number,
): PreparedMediaMarkRequest {
  const fingerprint = JSON.stringify({
    wallId: input.wallId,
    type: input.type,
    text: input.text.trim(),
    anonymous: input.anonymous,
    uploadIds: input.uploads.map((draft) => draft.uploadId),
  });
  if (previous?.fingerprint === fingerprint) return previous;
  return { fingerprint, requestId: requestIdFactory(), rotation: rotationFactory() };
}

export type AdvanceMediaOptions = {
  wallId: string;
  subject: string;
  rpc: MediaWriterRpc;
  transport: MediaUploadTransport;
  update: (draft: MediaWriterDraft) => void;
  isCurrent: () => boolean;
  isActive: () => boolean;
  wait?: (milliseconds: number) => Promise<void>;
  maxPolls?: number;
  pollIntervalMs?: number;
};

function currentOrThrow(options: AdvanceMediaOptions) {
  if (!options.isCurrent()) throw new MediaWriterError("stale", false);
  if (!options.isActive()) throw new MediaWriterError("paused", true);
}

/**
 * Advances one draft through the exact protected writer flow. The caller owns React state;
 * this pure orchestration layer owns strict DTO parsing, retry identity, and phase ordering.
 */
export async function advanceMediaDraft(original: MediaWriterDraft, options: AdvanceMediaOptions): Promise<MediaWriterDraft> {
  let draft = { ...original };
  const publish = (patch: Partial<MediaWriterDraft>) => {
    draft = { ...draft, ...patch };
    if (options.isCurrent()) options.update(draft);
  };
  currentOrThrow(options);
  if (draft.state === "failed" && draft.retryFrom === "upload") publish({ state: "uploading", errorCode: undefined });
  if (draft.state === "failed" && draft.retryFrom === "validation") publish({ state: "validating", errorCode: undefined });

  let reservation: MediaReservation | null = null;
  if (!draft.uploadId) {
    publish({ state: "reserving", progress: 0, errorCode: undefined });
    const parsed = parseMediaReservation(await options.rpc.begin({
      p_wall_id: options.wallId,
      p_kind: draft.kind,
      p_client_upload_id: draft.clientUploadId,
      p_declared_mime: draft.mime,
      p_declared_bytes: draft.bytes,
    }), options.subject);
    currentOrThrow(options);
    if (!parsed) {
      publish({ state: "failed", retryFrom: undefined });
      throw new MediaWriterError("invalid_response", false);
    }
    if (typeof parsed === "string") {
      publish({ state: "failed", retryFrom: undefined });
      throw new MediaWriterError(parsed, parsed !== "invalid");
    }
    reservation = parsed;
    publish({ uploadId: parsed.uploadId, state: "uploading", progress: 0 });
  }

  if (draft.state === "uploading" || reservation) {
    if (!reservation) {
      const parsed = parseMediaReservation(await options.rpc.begin({
        p_wall_id: options.wallId,
        p_kind: draft.kind,
        p_client_upload_id: draft.clientUploadId,
        p_declared_mime: draft.mime,
        p_declared_bytes: draft.bytes,
      }), options.subject);
      currentOrThrow(options);
      if (!parsed || typeof parsed === "string") {
        publish({ state: "failed", retryFrom: "upload" });
        throw new MediaWriterError(parsed ?? "invalid_response", parsed !== "invalid");
      }
      reservation = parsed;
    }
    try {
      await options.transport(draft, reservation, (progress) => {
        if (options.isCurrent()) publish({ progress: Math.max(0, Math.min(1, progress)) });
      });
    } catch {
      currentOrThrow(options);
      publish({ state: "failed", retryFrom: "upload" });
      throw new MediaWriterError("upload_failed", true);
    }
    currentOrThrow(options);
    publish({ state: "uploaded", progress: 1 });
  }

  if (!draft.uploadId) throw new MediaWriterError("invalid_response", false);
  if (draft.state === "uploaded") {
    const transitioned = parseMediaUploaded(await options.rpc.uploaded({ p_upload_id: draft.uploadId }));
    currentOrThrow(options);
    if (!transitioned) {
      publish({ state: "failed", retryFrom: "upload" });
      throw new MediaWriterError("invalid_response", false);
    }
    if (transitioned === "unavailable") {
      publish({ state: "failed", retryFrom: "upload" });
      throw new MediaWriterError("unavailable", true);
    }
    if (typeof transitioned === "object") {
      publish({ state: "failed", errorCode: transitioned.errorCode, retryFrom: undefined });
      throw new MediaWriterError("validation_failed", false, transitioned.errorCode);
    }
    if (transitioned === "validated") {
      publish({ state: "validated", progress: 1 });
      return draft;
    }
    publish({ state: "validating", progress: 1 });
  }

  const wait = options.wait ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const maxPolls = options.maxPolls ?? 60;
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    currentOrThrow(options);
    const parsed = parseMediaStatuses(await options.rpc.status({ p_upload_ids: [draft.uploadId] }));
    currentOrThrow(options);
    if (!parsed) {
      publish({ state: "failed", retryFrom: "validation" });
      throw new MediaWriterError("invalid_response", false);
    }
    if (parsed === "unavailable" || parsed.length !== 1 || parsed[0].uploadId !== draft.uploadId) {
      publish({ state: "failed", retryFrom: "validation" });
      throw new MediaWriterError("unavailable", true);
    }
    const status = parsed[0];
    if (status.state === "validated") {
      publish({ state: "validated", progress: 1 });
      return draft;
    }
    if (status.state === "failed") {
      publish({ state: "failed", errorCode: status.errorCode, retryFrom: undefined });
      throw new MediaWriterError("validation_failed", false, status.errorCode);
    }
    if (status.state === "expired" || status.state === "cancelled" || status.state === "cancelling") {
      publish({ state: status.state === "cancelling" ? "cancelling" : "cancelled" });
      throw new MediaWriterError("unavailable", false);
    }
    publish({ state: "validating" });
    await wait(options.pollIntervalMs ?? 1_000);
  }
  publish({ state: "failed", retryFrom: "validation" });
  throw new MediaWriterError("validation_timeout", true);
}

export async function cancelMediaDraft(draft: MediaWriterDraft, rpc: MediaWriterRpc): Promise<MediaWriterDraft> {
  if (!draft.uploadId || draft.state === "cancelled") return { ...draft, state: "cancelled" };
  const parsed = parseMediaCancellation(await rpc.cancel({ p_upload_id: draft.uploadId }));
  if (!parsed) throw new MediaWriterError("invalid_response", false);
  if (parsed === "unavailable") throw new MediaWriterError("unavailable", false);
  return { ...draft, state: parsed };
}

export async function createMediaMark(input: {
  requestId: string;
  wallId: string;
  type: MediaKind;
  text: string;
  anonymous: boolean;
  rotation: number;
  uploads: MediaWriterDraft[];
}, rpc: MediaWriterRpc): Promise<CreateMediaMarkResult> {
  if (!isUuid(input.requestId) || !isUuid(input.wallId) || input.uploads.some((item) => !item.uploadId || item.state !== "validated") ||
    (input.type === "photo" ? input.uploads.length < 1 || input.uploads.length > 5 : input.uploads.length !== 1) ||
    input.uploads.some((item) => item.kind !== input.type)) throw new MediaWriterError("invalid", false);
  const parsed = parseCreateMediaMark(await rpc.create({
    p_request_id: input.requestId,
    p_wall_id: input.wallId,
    p_type: input.type,
    p_text: input.text.trim() || null,
    p_color: null,
    p_anonymous: input.anonymous,
    p_secret: false,
    p_rotation: input.rotation,
    p_upload_ids: input.uploads.map((item) => item.uploadId as string),
  }));
  if (!parsed) throw new MediaWriterError("invalid_response", false);
  return parsed;
}

/** Prevents an authoritative create result from repainting after session/lifecycle invalidation. */
export async function createMediaMarkGuarded(
  input: Parameters<typeof createMediaMark>[0],
  rpc: MediaWriterRpc,
  isCurrent: () => boolean,
): Promise<CreateMediaMarkResult | { status: "stale" }> {
  const result = await createMediaMark(input, rpc);
  return isCurrent() ? result : { status: "stale" };
}
