
/**
 * ROLE: FRONTEND. Standard Poll creation adapter for the 0035 actor-bound RPC.
 * Inert until the approved UI and server rollout are enabled. No Secret,
 * Anonymous, legacy poll_votes or client-side authority is permitted here.
 */
export type StandardPollMode = "single" | "multiple";
export type StandardPollDraft = Readonly<{
  actorId: string;
  wallId: string;
  question: string;
  options: readonly string[];
  selectionMode: StandardPollMode;
  anonymous: false;
  secret: false;
}>;

export type PreparedStandardPoll = Readonly<StandardPollDraft & {
  fingerprint: string;
  requestId: string;
}>;

export type CreateStandardPollArgs = Readonly<{
  p_expected_actor_id: string;
  p_request_id: string;
  p_wall_id: string;
  p_selection_mode: StandardPollMode;
  p_question: string;
  p_options: string[];
  p_anonymous: false;
  p_secret: false;
}>;

export type CreateStandardPollOutcome =
  | { status: "created" | "existing"; markId: string; markStatus: "active" | "pending"; revision: number }
  | { status: "invalid" | "unavailable" | "request_id_reused" };

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
/** Match SQL btrim(text, E' \\t\\r\\n') exactly, not broader JS Unicode trim. */
const trimSqlWhitespace = (value: string) => value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");

export class PollDraftInvalid extends Error {
  constructor() {
    super("POLL_DRAFT_INVALID");
    this.name = "PollDraftInvalid";
  }
}

/** The server remains authoritative; this prevents stale/ambiguous client submissions. */
export function prepareStandardPoll(
  draft: StandardPollDraft,
  previous: PreparedStandardPoll | null,
  newRequestId: () => string,
): PreparedStandardPoll {
  if (!draft || !UUID.test(draft.actorId) || !UUID.test(draft.wallId)
    || draft.anonymous !== false || draft.secret !== false
    || (draft.selectionMode !== "single" && draft.selectionMode !== "multiple")
    || typeof draft.question !== "string" || !Array.isArray(draft.options)
    || draft.options.length < 2 || draft.options.length > 6) {
    throw new PollDraftInvalid();
  }
  const question = trimSqlWhitespace(draft.question);
  const options = draft.options.map(option => typeof option === "string" ? trimSqlWhitespace(option) : "");
  if (question.length < 1 || question.length > 500
    || options.some(option => option.length < 1 || option.length > 80)
    || new Set(options.map(option => option.toLowerCase())).size !== options.length) {
    throw new PollDraftInvalid();
  }
  const normalized: StandardPollDraft = {
    actorId: draft.actorId.toLowerCase(), wallId: draft.wallId.toLowerCase(),
    question, options, selectionMode: draft.selectionMode, anonymous: false, secret: false,
  };
  const fingerprint = JSON.stringify([normalized.actorId, normalized.wallId,
    normalized.selectionMode, normalized.question, normalized.options]);
  if (previous?.fingerprint === fingerprint) return previous;
  const requestId = newRequestId();
  if (!UUID.test(requestId)) throw new PollDraftInvalid();
  return { ...normalized, fingerprint, requestId: requestId.toLowerCase() };
}

export function standardPollRpcArgs(poll: PreparedStandardPoll): CreateStandardPollArgs {
  return {
    p_expected_actor_id: poll.actorId, p_request_id: poll.requestId, p_wall_id: poll.wallId,
    p_selection_mode: poll.selectionMode, p_question: poll.question, p_options: [...poll.options],
    p_anonymous: false, p_secret: false,
  };
}

/** Reject unexpected fields so a returned private ballot, author or identity cannot leak. */
export function parseStandardPollCreation(value: unknown): CreateStandardPollOutcome | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.status === "created" || record.status === "existing") {
    if (!hasExactKeys(record, ["status", "mark_id", "mark_status", "poll_revision"])
      || typeof record.mark_id !== "string" || !UUID.test(record.mark_id)
      || (record.mark_status !== "active" && record.mark_status !== "pending")
      || typeof record.poll_revision !== "number" || !Number.isSafeInteger(record.poll_revision)
      || record.poll_revision < 1) return null;
    return { status: record.status, markId: record.mark_id, markStatus: record.mark_status,
      revision: record.poll_revision };
  }
  if (record.status === "invalid" || record.status === "unavailable"
    || record.status === "request_id_reused") {
    return hasExactKeys(record, ["status"]) ? { status: record.status } : null;
  }
  return null;
}

/**
 * Caller owns the synchronous submit lock and the frozen poll. A lost response
 * must retry with that same object/request ID. The scope lease must cover actor
 * AND exact destination, and responses are discarded after a scope change.
 */
export async function executeStandardPollCreate(
  poll: PreparedStandardPoll,
  rpc: (args: CreateStandardPollArgs) => Promise<unknown>,
  isCurrentScope: () => boolean,
): Promise<CreateStandardPollOutcome> {
  if (!isCurrentScope()) throw new Error("POLL_CREATE_STALE_SCOPE");
  const response = await rpc(standardPollRpcArgs(poll));
  if (!isCurrentScope()) throw new Error("POLL_CREATE_STALE_SCOPE");
  const parsed = parseStandardPollCreation(response);
  if (!parsed) throw new Error("POLL_CREATE_INVALID_RESPONSE");
  return parsed;
}
