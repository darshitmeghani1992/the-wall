import type { MarkStatus } from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CREATE_STATUSES = [
  "created",
  "existing",
  "deleted",
  "invalid",
  "unavailable",
  "media_not_ready",
  "request_id_reused",
] as const;
const MARK_STATUSES: readonly MarkStatus[] = ["active", "pending", "hidden", "removed"];

export type TextMarkSemanticDraft = {
  wallId: string;
  text: string;
  color: string;
  anonymous: boolean;
  secret: boolean;
};

export type PreparedTextMarkSubmission = TextMarkSemanticDraft & {
  fingerprint: string;
  requestId: string;
  rotation: number;
};

export type CreateTextMarkRpcArgs = {
  p_request_id: string;
  p_wall_id: string;
  p_type: "text";
  p_text: string;
  p_color: string;
  p_anonymous: boolean;
  p_secret: boolean;
  p_rotation: number;
  p_upload_ids: string[];
};

export type CreateTextMarkResult =
  | { status: "created" | "existing"; markId: string; markStatus: MarkStatus }
  | { status: "deleted"; markId: string }
  | { status: "invalid" | "unavailable" | "media_not_ready" | "request_id_reused" };

/** Synchronous intent gate shared by UI controls, navigation, and dispatch. */
export class TextSubmissionLock {
  private locked = false;

  tryBegin(): boolean {
    if (this.locked) return false;
    this.locked = true;
    return true;
  }

  finish(): void {
    this.locked = false;
  }

  allowsIntent(): boolean {
    return !this.locked;
  }

  runIntent(intent: () => void): boolean {
    if (this.locked) return false;
    intent();
    return true;
  }
}

function normalizedDraft(draft: TextMarkSemanticDraft): TextMarkSemanticDraft {
  return {
    wallId: draft.wallId,
    text: draft.text.trim(),
    color: draft.color.trim().toLowerCase(),
    anonymous: draft.anonymous,
    secret: draft.secret,
  };
}

export function textMarkFingerprint(draft: TextMarkSemanticDraft): string {
  return JSON.stringify(normalizedDraft(draft));
}

/** A UUID is an idempotency key, not a secret; prefer the platform CSPRNG when present. */
export function createRequestId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID().toLowerCase();

  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createMarkRotation(): number {
  return Math.round((Math.random() * 5 - 2.5) * 10) / 10;
}

/** Reuses the complete frozen submission only while its normalized meaning is unchanged. */
export function prepareTextMarkSubmission(
  draft: TextMarkSemanticDraft,
  previous: PreparedTextMarkSubmission | null,
  requestIdFactory: () => string = createRequestId,
  rotationFactory: () => number = createMarkRotation,
): PreparedTextMarkSubmission {
  const normalized = normalizedDraft(draft);
  const fingerprint = textMarkFingerprint(normalized);
  if (previous?.fingerprint === fingerprint) return previous;
  return {
    ...normalized,
    fingerprint,
    requestId: requestIdFactory(),
    rotation: rotationFactory(),
  };
}

/** Exact allowlisted RPC arguments: legacy media URL/payload fields cannot enter this API. */
export function textMarkRpcArgs(submission: PreparedTextMarkSubmission): CreateTextMarkRpcArgs {
  return {
    p_request_id: submission.requestId,
    p_wall_id: submission.wallId,
    p_type: "text",
    p_text: submission.text,
    p_color: submission.color,
    p_anonymous: submission.anonymous,
    p_secret: submission.secret,
    p_rotation: submission.rotation,
    p_upload_ids: [],
  };
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}

/** Fail closed when the security-boundary RPC returns a shape outside its contract. */
export function parseCreateTextMarkResult(value: unknown): CreateTextMarkResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.status !== "string" || !CREATE_STATUSES.includes(record.status as (typeof CREATE_STATUSES)[number])) {
    return null;
  }
  if (record.status === "created" || record.status === "existing") {
    if (!hasExactKeys(record, ["status", "mark_id", "mark_status"])) return null;
    if (typeof record.mark_id !== "string" || !UUID_PATTERN.test(record.mark_id)) return null;
    if (typeof record.mark_status !== "string" || !MARK_STATUSES.includes(record.mark_status as MarkStatus)) return null;
    return { status: record.status, markId: record.mark_id, markStatus: record.mark_status as MarkStatus };
  }
  if (record.status === "deleted") {
    if (!hasExactKeys(record, ["status", "mark_id"])) return null;
    if (typeof record.mark_id !== "string" || !UUID_PATTERN.test(record.mark_id)) return null;
    return { status: "deleted", markId: record.mark_id };
  }
  if (!hasExactKeys(record, ["status"])) return null;
  return {
    status: record.status as "invalid" | "unavailable" | "media_not_ready" | "request_id_reused",
  };
}

export async function executeTextMarkSubmission(
  submission: PreparedTextMarkSubmission,
  rpc: (args: CreateTextMarkRpcArgs) => Promise<unknown>,
): Promise<CreateTextMarkResult> {
  const parsed = parseCreateTextMarkResult(await rpc(textMarkRpcArgs(submission)));
  if (!parsed) throw new Error("MARK_CREATE_INVALID_RESPONSE");
  return parsed;
}
