import type { FocusedPoll } from "./poll-focused-reader";

export type PollAddress = Readonly<{ actorId: string; wallId: string; markId: string }>;
type PollAction = "vote" | "close";

type MutationArgs = {
  p_expected_actor_id: string;
  p_wall_id: string;
  p_mark_id: string;
  p_expected_poll_revision: number;
  p_request_id: string;
};

export type PollMutation =
  | { kind: "vote"; key: string; args: MutationArgs & { p_expected_ballot_revision: number; p_option_ids: readonly string[] } }
  | { kind: "close"; key: string; args: MutationArgs };

export type MutationResult = "confirmed" | "invalid" | "unavailable" | "conflict" | "closed" | "request_id_reused";

/** No client flag can turn this on before server and device readiness is reviewed. */
export const isPollInteractionEnabled: boolean = false;

export function isValidSelection(poll: FocusedPoll, ids: readonly string[]): boolean {
  return ids.length > 0 && (poll.selectionMode === "multiple" || ids.length === 1)
    && new Set(ids).size === ids.length && ids.every((id) => poll.options.some((option) => option.id === id));
}

export function togglePollOption(poll: FocusedPoll, ids: readonly string[], id: string): readonly string[] {
  if (!poll.options.some((option) => option.id === id)) return ids;
  if (poll.selectionMode === "single") return ids[0] === id ? ids : [id];
  return ids.includes(id) ? ids.filter((selected) => selected !== id) : [...ids, id];
}

export function samePollSelection(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

export function preparePollMutation(
  kind: PollAction,
  target: PollAddress,
  poll: FocusedPoll,
  selection: readonly string[],
  previous: PollMutation | null,
  makeId: () => string,
): PollMutation | null {
  if (poll.state !== "open") return null;
  const optionIds = [...selection].sort();
  if (kind === "vote" && (!poll.capabilities.canVote || !isValidSelection(poll, optionIds))) return null;
  if (kind === "close" && !poll.capabilities.canClose) return null;

  const key = JSON.stringify([kind, target.actorId, target.wallId, target.markId, poll.revision,
    ...(kind === "vote" ? [poll.ballot?.revision ?? 0, optionIds] : [])]);
  if (previous?.key === key) return previous;

  const args: MutationArgs = {
    p_expected_actor_id: target.actorId, p_wall_id: target.wallId, p_mark_id: target.markId,
    p_expected_poll_revision: poll.revision, p_request_id: makeId(),
  };
  return kind === "vote"
    ? { kind, key, args: { ...args, p_expected_ballot_revision: poll.ballot?.revision ?? 0, p_option_ids: optionIds } }
    : { kind, key, args };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function positiveRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function parsePollMutationResult(value: unknown, mutation: PollMutation, poll: FocusedPoll): MutationResult | null {
  if (!isObject(value)) return null;
  const { status, mark_id: markId, revision, ballot } = value;
  if (Object.keys(value).length === 1) {
    switch (status) {
      case "invalid": case "unavailable": case "conflict": case "closed": case "request_id_reused": return status;
      default: return null;
    }
  }

  if (markId !== mutation.args.p_mark_id || !positiveRevision(revision)
    || revision < mutation.args.p_expected_poll_revision) return null;
  if (mutation.kind === "close") {
    return Object.keys(value).length === 3 && (status === "closed" || status === "existing")
      && revision > mutation.args.p_expected_poll_revision ? "confirmed" : null;
  }
  if (Object.keys(value).length !== 4 || (status !== "applied" && status !== "existing") || !isObject(ballot)
    || Object.keys(ballot).length !== 2 || !positiveRevision(ballot.revision)
    || ballot.revision <= mutation.args.p_expected_ballot_revision
    || !Array.isArray(ballot.option_ids) || !isValidSelection(poll, ballot.option_ids)) return null;
  if (status === "applied" && (revision !== mutation.args.p_expected_poll_revision
    || ballot.revision !== mutation.args.p_expected_ballot_revision + 1
    || !samePollSelection(ballot.option_ids, mutation.args.p_option_ids))) return null;
  return "confirmed";
}
