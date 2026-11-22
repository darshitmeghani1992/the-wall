import type { ReactionSummary } from "./reactions";

/**
 * A successful batch read is authoritative for every requested Mark, including
 * Marks with zero reaction rows. Omitted IDs in the server aggregation mean an
 * empty summary, not "leave whatever stale count was rendered before".
 */
export function completeReactionBatch(
  markIds: readonly string[],
  reported: Readonly<Record<string, ReactionSummary>>,
): Record<string, ReactionSummary> {
  const completed: Record<string, ReactionSummary> = {};
  for (const id of markIds) {
    completed[id] = reported[id] ?? { counts: {}, mine: null };
  }
  return completed;
}
