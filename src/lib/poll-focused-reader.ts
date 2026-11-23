// @ts-ignore Dependency-free contract tests load the source file directly.
import { isCanonicalUuid } from "./deferred-destination-contract.ts";

export type FocusedPoll = {
  question: string;
  selectionMode: "single" | "multiple";
  state: "open" | "closed";
  options: readonly { id: string; label: string; count: number | null }[];
  ballotTotal: number | null;
};

type FocusedWallCard<T> =
  | { id: string; kind: "mark"; mark: T }
  | { id: string; kind: "poll"; poll: FocusedPoll };

type PollReadRequest = {
  p_expected_actor_id: string;
  p_wall_id: string;
  p_mark_id: string;
};

/** Leave legacy clients and hosted endpoints untouched while Poll read QA is held. */
export const isFocusedPollReaderEnabled: boolean = false;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

function invalidPoll(): never {
  throw new Error("Couldn’t verify this Poll. Please try again.");
}

function parsePoll(value: unknown, wallId: string, markId: string): FocusedPoll | null {
  if (!isRecord(value)) return invalidPoll();
  if (value.status === "unavailable") return null;
  if (value.status !== "available" || !isRecord(value.item)) return invalidPoll();
  const { item } = value;
  const { mark } = item;
  if (!isRecord(mark) || mark.id !== markId || mark.wall_id !== wallId || mark.status !== "active") return invalidPoll();
  if (item.kind === "mark") return null;
  if (item.kind !== "poll" || mark.type !== "poll" || mark.secret !== false || !isRecord(item.poll)) return invalidPoll();
  const { mark_id: pollId, question, selection_mode: selectionMode, state, options: rawOptions, results } = item.poll;
  if (pollId !== markId || typeof question !== "string" || !question.trim() || Array.from(question).length > 500
    || (selectionMode !== "single" && selectionMode !== "multiple") || (state !== "open" && state !== "closed")
    || !Array.isArray(rawOptions) || rawOptions.length < 2 || rawOptions.length > 6) return invalidPoll();

  const identifiers = new Set<string>();
  const options = rawOptions.map((option, position) => {
    if (!isRecord(option) || !isCanonicalUuid(option.option_id) || identifiers.has(option.option_id)
      || option.position !== position || typeof option.label !== "string" || !option.label.trim()
      || Array.from(option.label).length > 80) return invalidPoll();
    identifiers.add(option.option_id);
    return { id: option.option_id, label: option.label, count: null as number | null };
  });
  if (results === null) return { question, selectionMode, state, options, ballotTotal: null };
  if (!isRecord(results) || !isCount(results.ballot_total) || !Array.isArray(results.counts)
    || results.counts.length !== options.length) return invalidPoll();
  const ballotTotal = results.ballot_total;
  let selections = 0;
  for (const [position, row] of results.counts.entries()) {
    const option = options[position];
    if (!option || !isRecord(row) || row.option_id !== option.id || !isCount(row.count) || row.count > ballotTotal) return invalidPoll();
    selections += row.count;
    option.count = row.count;
  }
  if (selections < ballotTotal || (selectionMode === "single" && selections !== ballotTotal)) return invalidPoll();
  return { question, selectionMode, state, options, ballotTotal };
}

export async function readFocusedWallCard<T extends { id: string }>(
  actorId: string,
  wallId: string,
  markId: string,
  readLegacy: (wallId: string, markId: string) => Promise<T | null>,
  readPollV2: (request: PollReadRequest) => Promise<unknown>,
  enablePoll: boolean,
): Promise<FocusedWallCard<T> | null> {
  const legacy = await readLegacy(wallId, markId);
  if (legacy) return { id: legacy.id, kind: "mark", mark: legacy };
  if (!enablePoll || !isCanonicalUuid(actorId) || !isCanonicalUuid(wallId) || !isCanonicalUuid(markId)) return null;
  const canonicalWallId = wallId.toLowerCase();
  const canonicalMarkId = markId.toLowerCase();
  const result = await readPollV2({
    p_expected_actor_id: actorId.toLowerCase(),
    p_wall_id: canonicalWallId,
    p_mark_id: canonicalMarkId,
  });
  const poll = parsePoll(result, canonicalWallId, canonicalMarkId);
  return poll ? { id: canonicalMarkId, kind: "poll", poll } : null;
}
