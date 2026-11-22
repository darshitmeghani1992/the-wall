import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "@/lib/supabase";
import {
  getReactionSummaries,
  getReactionSummary,
  toggleReaction,
  type ReactionEmoji,
  type ReactionSummary,
} from "@/lib/reactions";
import type { MarkWithAuthor } from "@/lib/marks";
import { ReactionRequestTracker } from "@/lib/reaction-request-tracker";

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
  const [foregroundRefresh, setForegroundRefresh] = useState(0);
  const appState = useRef(AppState.currentState);
  const summariesRef = useRef(summaries);
  summariesRef.current = summaries;
  // Marks whose summary we've already requested — avoids redundant fetches as the
  // list re-renders or grows via realtime.
  const requested = useRef(new ReactionRequestTracker());
  // One optimistic reaction write per Mark at a time. Lease identity prevents
  // a stale actor/request finally from releasing a newer actor's in-flight write.
  const mutationLeases = useRef(new Map<string, symbol>());
  // A read begun before a tap must never overwrite that tap after it resolves.
  // Track a per-Mark epoch as well as the account session (including A → B → A).
  const readEpochs = useRef(new Map<string, number>());
  const sessionEpoch = useRef(0);
  const requestedUserId = useRef(userId ?? null);
  const currentUserId = useRef(userId ?? null);
  currentUserId.current = userId ?? null;

  useEffect(() => {
    sessionEpoch.current += 1;
    readEpochs.current.clear();
    requestedUserId.current = userId ?? null;
    requested.current.clear();
    mutationLeases.current.clear();
    setSummaries({});
  }, [userId]);

  // A failed offline summary load has no guaranteed re-render to retry it.
  // On background → active, invalidate older reads and re-request visible
  // Marks without waiting for a reaction tap or a prop identity change.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasActive = appState.current === "active";
      appState.current = nextState;
      if (nextState !== "active" || wasActive) return;
      sessionEpoch.current += 1;
      requested.current.clear();
      setForegroundRefresh((generation) => generation + 1);
    });
    return () => subscription.remove();
  }, []);

  const refresh = useCallback(
    async (markId: string) => {
      const sessionAtStart = sessionEpoch.current;
      const readEpochAtStart = readEpochs.current.get(markId) ?? 0;
      const summary = await getReactionSummary(markId, userId);
      setSummaries((cur) => {
        if (
          currentUserId.current !== (userId ?? null) ||
          sessionEpoch.current !== sessionAtStart ||
          (readEpochs.current.get(markId) ?? 0) !== readEpochAtStart ||
          mutationLeases.current.has(markId)
        ) return cur;
        return { ...cur, [markId]: summary };
      });
    },
    [userId],
  );

  // Load summaries for any Marks we haven't fetched yet.
  useEffect(() => {
    const request = requested.current.claim(marks.map((m) => m.id));
    const ids = request.ids;
    if (!ids.length) return;

    let active = true;
    let completed = false;
    const sessionAtStart = sessionEpoch.current;
    const readEpochsAtStart = new Map(ids.map((id) => [id, readEpochs.current.get(id) ?? 0]));
    getReactionSummaries(ids, userId)
      .then((map) => {
        if (active && currentUserId.current === (userId ?? null)) {
          completed = true;
          setSummaries((cur) => {
            if (sessionEpoch.current !== sessionAtStart) return cur;
            const fresh: Record<string, ReactionSummary> = {};
            for (const [id, summary] of Object.entries(map)) {
              if (
                !mutationLeases.current.has(id) &&
                (readEpochs.current.get(id) ?? 0) === readEpochsAtStart.get(id)
              ) fresh[id] = summary;
            }
            return Object.keys(fresh).length ? { ...cur, ...fresh } : cur;
          });
        }
      })
      .catch(() => {
        // Let a later render retry these ids.
        request.abandon();
      });
    return () => {
      active = false;
      if (!completed) request.abandon();
    };
  }, [marks, userId, foregroundRefresh]);

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
      // The initiating account must still own this rendered Wall before updating
      // optimistic state. The data layer repeats this check after getUser().
      if (!userId || currentUserId.current !== userId || mutationLeases.current.has(markId)) return;
      const lease = Symbol(markId);
      mutationLeases.current.set(markId, lease);
      readEpochs.current.set(markId, (readEpochs.current.get(markId) ?? 0) + 1);
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

      // The visible optimistic value is provisional, never reported as a
      // confirmed write. If the network fails, restore the pre-tap value even
      // when the server cannot be re-read (offline), then try to resync.
      void toggleReaction(userId, markId, emoji, prev)
        .catch(() => {
          if (currentUserId.current !== userId || mutationLeases.current.get(markId) !== lease) return;
          setSummaries((cur) => ({ ...cur, [markId]: current }));
        })
        .finally(() => {
          if (mutationLeases.current.get(markId) !== lease) return;
          mutationLeases.current.delete(markId);
          // Reconcile *after* releasing the lease: otherwise a response may be
          // discarded while the optimistic write is still in flight. This also
          // recovers a skipped initial load on both success and failure.
          void refresh(markId).catch(() => {
            // Offline refetch failure must not leave an unhandled rejection.
            // A rejected write has already restored the pre-tap summary.
          });
        });
    },
    [refresh, userId],
  );

  return { summaries: requestedUserId.current === (userId ?? null) ? summaries : {}, toggle };
}
