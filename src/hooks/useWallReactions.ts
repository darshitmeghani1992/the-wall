import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getReactionSummaries,
  getReactionSummary,
  toggleReaction,
  type ReactionEmoji,
  type ReactionSummary,
} from "@/lib/reactions";
import type { MarkWithAuthor } from "@/lib/marks";

const EMPTY: ReactionSummary = { counts: {}, mine: null };

/**
 * Owns reaction state for a list of Marks: loads summaries as Marks appear,
 * exposes an optimistic `toggle`, and keeps counts fresh via the existing
 * `mark_reactions` realtime publication.
 *
 * Failure recovery (Frontend Playbook §13): `toggle` updates the UI optimistically
 * and, if the write fails, re-reads that Mark's authoritative summary from the
 * server (rollback-by-refetch) rather than leaving a state that never persisted.
 * Realtime events also refetch the affected Mark, so the final state matches the
 * server regardless of event ordering.
 */
export function useWallReactions(marks: MarkWithAuthor[], userId?: string | null) {
  const [summaries, setSummaries] = useState<Record<string, ReactionSummary>>({});
  const summariesRef = useRef(summaries);
  summariesRef.current = summaries;
  // Marks whose summary we've already requested — avoids redundant fetches as the
  // list re-renders or grows via realtime.
  const requested = useRef<Set<string>>(new Set());

  const refresh = useCallback(
    async (markId: string) => {
      const summary = await getReactionSummary(markId, userId);
      setSummaries((cur) => ({ ...cur, [markId]: summary }));
    },
    [userId],
  );

  // Load summaries for any Marks we haven't fetched yet.
  useEffect(() => {
    const ids = marks.map((m) => m.id).filter((id) => !requested.current.has(id));
    if (!ids.length) return;
    ids.forEach((id) => requested.current.add(id));

    let active = true;
    getReactionSummaries(ids, userId)
      .then((map) => {
        if (active) setSummaries((cur) => ({ ...cur, ...map }));
      })
      .catch(() => {
        // Let a later render retry these ids.
        ids.forEach((id) => requested.current.delete(id));
      });
    return () => {
      active = false;
    };
  }, [marks, userId]);

  // Live counts: any reaction change to a Mark we're tracking → refetch it.
  useEffect(() => {
    const channel = supabase
      .channel(`mark_reactions:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mark_reactions" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { mark_id?: string } | null;
          if (row?.mark_id && requested.current.has(row.mark_id)) void refresh(row.mark_id);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const toggle = useCallback(
    (markId: string, emoji: ReactionEmoji) => {
      const current = summariesRef.current[markId] ?? EMPTY;
      const prev = current.mine; // the user's single active reaction, or null
      const wasOn = prev === emoji;

      // Optimistic single-reaction update: tapping the active emoji removes it;
      // tapping another switches (decrement the old emoji, increment the new).
      const counts = { ...current.counts };
      if (prev) {
        const c = (counts[prev] ?? 0) - 1;
        if (c > 0) counts[prev] = c;
        else delete counts[prev];
      }
      const mine = wasOn ? null : emoji;
      if (mine) counts[emoji] = (counts[emoji] ?? 0) + 1;
      setSummaries((cur) => ({ ...cur, [markId]: { counts, mine } }));

      // Persist; on failure, roll back to the server's truth for this Mark.
      toggleReaction(markId, emoji, prev).catch(() => {
        void refresh(markId);
      });
    },
    [refresh],
  );

  return { summaries, toggle };
}
