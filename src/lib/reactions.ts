import { supabase } from "./supabase";
import { track } from "./analytics";

/**
 * Reactions on Marks. Backed by `mark_reactions` + RLS. Master Spec §31: ONE
 * active reaction per user per Mark — the PK is (mark_id, user_id) (migration
 * 0016), so a user has at most one reaction; changing it replaces it (upsert),
 * removing it deletes it. RLS is the real boundary: a row can only be written,
 * changed, or deleted for user_id = auth.uid(); this module never sends a foreign
 * user_id.
 *
 * The emoji set is the fixed §31 vocabulary so reactions stay a light touch on the
 * wall (no leaderboards, no dominating counts).
 *
 * NOTE: notifying a Mark's author when someone reacts is a backend trigger (0006);
 * this module only writes the reaction and emits a client analytics event.
 */

/** The only emojis a user can react with (order = picker order) — Master Spec §31. */
export const REACTION_EMOJIS = ["❤️", "😂", "🥹", "🔥", "👏"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export function isReactionEmoji(value: string): value is ReactionEmoji {
  return (REACTION_EMOJIS as readonly string[]).includes(value);
}

/** Aggregated reaction state for a single Mark, as the wall needs to render it. */
export type ReactionSummary = {
  /** emoji → how many people reacted with it (only non-zero emojis appear). */
  counts: Record<string, number>;
  /** the signed-in user's single active reaction on this Mark, or null. */
  mine: string | null;
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
    const summary = (summaries[row.mark_id] ??= { counts: {}, mine: null });
    summary.counts[row.emoji] = (summary.counts[row.emoji] ?? 0) + 1;
    if (userId && row.user_id === userId) summary.mine = row.emoji; // one row per user (PK)
  }
  return summaries;
}

/** Reaction summary for one Mark (or an empty summary when it has none). */
export async function getReactionSummary(
  markId: string,
  userId?: string | null,
): Promise<ReactionSummary> {
  const map = await getReactionSummaries([markId], userId);
  return map[markId] ?? { counts: {}, mine: null };
}

/**
 * Set the signed-in user's single reaction on a Mark (§31). Upserts on
 * (mark_id, user_id), so it both adds a first reaction and CHANGES an existing
 * one — a user never stacks two reactions.
 */
export async function setReaction(markId: string, emoji: ReactionEmoji): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) throw new Error("You need to be signed in to react.");

  const { error } = await supabase
    .from("mark_reactions")
    .upsert({ mark_id: markId, user_id: uid, emoji }, { onConflict: "mark_id,user_id" });
  if (error) throw error;

  track("Reaction Added", { mark_id: markId, emoji });
}

/** Remove the signed-in user's reaction from a Mark. */
export async function removeReaction(markId: string): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) return;

  const { error } = await supabase
    .from("mark_reactions")
    .delete()
    .eq("mark_id", markId)
    .eq("user_id", uid);
  if (error) throw error;
}

/**
 * Toggle the signed-in user's reaction to `emoji`. `currentEmoji` is the caller's
 * current view of the user's active reaction (or null) — passed in so the caller
 * can drive an optimistic update in a single round-trip. Tapping the active emoji
 * removes it; tapping a different one switches to it (§31: one active reaction).
 */
export async function toggleReaction(
  markId: string,
  emoji: ReactionEmoji,
  currentEmoji: string | null,
): Promise<void> {
  if (currentEmoji === emoji) {
    await removeReaction(markId);
  } else {
    await setReaction(markId, emoji);
  }
}
