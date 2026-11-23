export const POLL_QUESTION_LIMIT = 500;
export const POLL_OPTION_LIMIT = 80;
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 6;

export type PollSelectionMode = "single" | "multiple";

export type PollDraft = {
  question: string;
  selectionMode: PollSelectionMode;
  options: readonly { id: number; label: string }[];
  nextOptionId: number;
};

export type ValidPollDraft = {
  question: string;
  selectionMode: PollSelectionMode;
  options: readonly string[];
};

export function newPollDraft(): PollDraft {
  return {
    question: "",
    selectionMode: "single",
    options: [{ id: 0, label: "" }, { id: 1, label: "" }],
    nextOptionId: 2,
  };
}

export function appendPollOption(draft: PollDraft): PollDraft {
  if (draft.options.length >= POLL_MAX_OPTIONS) return draft;
  return {
    ...draft,
    options: [...draft.options, { id: draft.nextOptionId, label: "" }],
    nextOptionId: draft.nextOptionId + 1,
  };
}

export function removePollOption(draft: PollDraft, id: number): PollDraft {
  if (draft.options.length <= POLL_MIN_OPTIONS) return draft;
  return { ...draft, options: draft.options.filter((option) => option.id !== id) };
}

const trimPollText = (text: string) => text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
const characterLength = (text: string) => Array.from(text).length;

export function hasPollDraftContent(draft: PollDraft): boolean {
  return Boolean(trimPollText(draft.question) || draft.options.some((option) => trimPollText(option.label)));
}

export function validatePollDraft(draft: PollDraft):
  | { status: "valid"; payload: ValidPollDraft }
  | { status: "incomplete" | "question_too_long" | "option_too_long" | "duplicate_options" } {
  const question = trimPollText(draft.question);
  const options = draft.options.map(({ label }) => trimPollText(label));
  if (!question || options.length < POLL_MIN_OPTIONS || options.length > POLL_MAX_OPTIONS || options.some((option) => !option)) {
    return { status: "incomplete" };
  }
  if (characterLength(question) > POLL_QUESTION_LIMIT) return { status: "question_too_long" };
  if (options.some((option) => characterLength(option) > POLL_OPTION_LIMIT)) return { status: "option_too_long" };
  if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) return { status: "duplicate_options" };
  return { status: "valid", payload: { question, options, selectionMode: draft.selectionMode } };
}

export type PollCreateIntent = ValidPollDraft & {
  actorId: string;
  wallId: string;
  requestId: string;
  fingerprint: string;
};

export function preparePollCreate(
  actorId: string,
  wallId: string,
  payload: ValidPollDraft,
  prior: PollCreateIntent | null,
  createRequestId: () => string,
): PollCreateIntent {
  const fingerprint = JSON.stringify([actorId, wallId, payload.selectionMode, payload.question, payload.options]);
  if (prior?.fingerprint === fingerprint) return prior;
  return { ...payload, actorId, wallId, fingerprint, requestId: createRequestId() };
}

export function pollCreateArgs(intent: PollCreateIntent) {
  return {
    p_expected_actor_id: intent.actorId,
    p_request_id: intent.requestId,
    p_wall_id: intent.wallId,
    p_selection_mode: intent.selectionMode,
    p_question: intent.question,
    p_options: intent.options,
    p_anonymous: false,
    p_secret: false,
  };
}

type PollCreateResult =
  | { status: "created" | "existing"; markId: string; markStatus: "active" | "pending" }
  | { status: "invalid" | "unavailable" | "request_id_reused" };

export function parsePollCreateResult(value: unknown): PollCreateResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { status, mark_id: markId, mark_status: markStatus, poll_revision: revision } = value as Record<string, unknown>;
  if (status === "invalid" || status === "unavailable" || status === "request_id_reused") {
    return Object.keys(value).length === 1 ? { status } : null;
  }
  if ((status !== "created" && status !== "existing") || Object.keys(value).length !== 4
    || (markStatus !== "active" && markStatus !== "pending") || typeof revision !== "number"
    || !Number.isSafeInteger(revision) || revision < 1 || typeof markId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(markId)) return null;
  return { status, markId, markStatus };
}
