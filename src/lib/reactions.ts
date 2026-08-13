import { supabase } from "./supabase";
import { track } from "./analytics";

/**
 * Reactions on Marks. Backed by the EXISTING `mark_reactions` table + RLS from
 * 0001_init.sql ("reactions view" / "reactions write self" / "reactions delete
 * self") — no schema change. RLS is the real boundary: a row can only be written
 * or deleted for user_id = auth.uid(); this module never sends a foreign user_id.
 *
 * MVP emoji set is fixed and intentionally small so reactions stay a light touch
 * on the wall (no leaderboards, no dominating counts).
 *
 * NOTE (C2 dependency): notifying a Mark's author when someone reacts is a
 * backend trigger that does not exist yet — this module deliberately does NOT
 * fake it. It only writes the reaction and emits a client analytics event.
 */

/** The only emojis a user can react with (order = picker order). */
export const REACTION_EMOJIS = ["❤️", "😂", "🥹", "😭", "🔥"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export function isReactionEmoji(value: string): value is ReactionEmoji {
  return (REACTION_EMOJIS as readonly string[]).includes(value);
}

/** Aggregated reaction state for a single Mark, as the wall needs to render it. */
export type ReactionSummary = {
  /** emoji → how many people reacted with it (only non-zero emojis appear). */
  counts: Record<string, number>;
  /** the emojis the signed-in user has personally reacted with. */
  mine: string[];
};

/**
 * Load reaction summaries for a batch of Marks in one query. Returns a map keyed
 * by mark_id; Marks with no reactions are simply absent (callers default to an
 * empty summary). `userId` is used only to compute `mine` — never sent as a
 * filter, so counts reflect everyone.
 */
export async function getReactionSummaries(
  markIds: string[],
  userId?: string | null,
): Promise<Record<string, ReactionSummary>> {
  const summaries: Record<string, ReactionSummary> = {};
  if (!markIds.length) return summaries;

  const { data, error } = await supabase
    .from("mark_reactions")
    .select("mark_id, user_id, emoji")
    .in("mark_id", markIds);
  if (error) throw error;

  for (const row of (data ?? []) as { mark_id: string; user_id: string; emoji: string }[]) {
    const summary = (summaries[row.mark_id] ??= { counts: {}, mine: [] });
    summary.counts[row.emoji] = (summary.counts[row.emoji] ?? 0) + 1;
    if (userId && row.user_id === userId && !summary.mine.includes(row.emoji)) {
      summary.mine.push(row.emoji);
    }
  }
  return summaries;
}

/** Reaction summary for one Mark (or an empty summary when it has none). */
export async function getReactionSummary(
  markId: string,
  userId?: string | null,
): Promise<ReactionSummary> {
  const map = await getReactionSummaries([markId], userId);
  return map[markId] ?? { counts: {}, mine: [] };
}

/** Add one reaction as the signed-in user. Idempotent against the PK (mark,user,emoji). */
export async function addReaction(markId: string, emoji: ReactionEmoji): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) throw new Error("You need to be signed in to react.");

  // upsert so a double-tap can't error on the primary key.
  const { error } = await supabase
    .from("mark_reactions")
    .upsert({ mark_id: markId, user_id: uid, emoji }, { onConflict: "mark_id,user_id,emoji" });
  if (error) throw error;

  track("Reaction Added", { mark_id: markId, emoji });
}

/** Remove one of the signed-in user's own reactions. */
export async function removeReaction(markId: string, emoji: ReactionEmoji): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) return;

  const { error } = await supabase
    .from("mark_reactions")
    .delete()
    .eq("mark_id", markId)
    .eq("user_id", uid)
    .eq("emoji", emoji);
  if (error) throw error;
}

/**
 * Toggle the signed-in user's reaction. `currentlyOn` is the caller's current
 * view of whether the user already has this emoji — passed in so the caller can
 * drive an optimistic update and this stays a single round-trip.
 */
export async function toggleReaction(
  markId: string,
  emoji: ReactionEmoji,
  currentlyOn: boolean,
): Promise<void> {
  if (currentlyOn) {
    await removeReaction(markId, emoji);
  } else {
    await addReaction(markId, emoji);
  }
}
