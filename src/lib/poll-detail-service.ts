import { getWallMark } from "@/lib/marks";
import { isMixedPollHistoryEnabled, readMixedWallHistory, type MixedWallCursor, type MixedWallReadRequest } from "@/lib/poll-mixed-history";
import { isFocusedPollReaderEnabled, readFocusedPoll, readFocusedWallCard, type PollReadRequest } from "@/lib/poll-focused-reader";
import { isPollInteractionEnabled, type PollMutation, type PollAddress } from "@/lib/poll-voting-contract";
import { supabase } from "@/lib/supabase";

async function fetchPollDetail(args: PollReadRequest): Promise<unknown> {
  const { data, error } = await supabase.rpc("get_wall_mark_item_v2", args);
  if (error) throw new Error("Couldn’t load this Poll. Please try again.");
  return data;
}

export async function mutateFocusedPoll(request: PollMutation): Promise<unknown> {
  if (!isFocusedPollReaderEnabled || !isPollInteractionEnabled) throw new Error("Poll changes are unavailable.");
  const response = request.kind === "vote"
    ? await supabase.rpc("replace_poll_ballot", request.args)
    : await supabase.rpc("close_poll_mark", request.args);
  if (response.error) throw response.error;
  return response.data;
}

export function getFocusedWallMark(actorId: string, wallId: string, markId: string) {
  return readFocusedWallCard(actorId, wallId, markId, getWallMark, fetchPollDetail, isFocusedPollReaderEnabled);
}

export function refreshFocusedPoll({ actorId, wallId, markId }: PollAddress) {
  return readFocusedPoll(actorId, wallId, markId, fetchPollDetail, isFocusedPollReaderEnabled);
}

/** Versioned mixed chronology is deliberately unavailable until server/device gates pass. */
export function loadMixedWallHistory(actorId: string, wallId: string, cursor: MixedWallCursor | null) {
  return readMixedWallHistory(actorId, wallId, cursor, isMixedPollHistoryEnabled,
    async (args: MixedWallReadRequest) => {
      const { data, error } = await supabase.rpc("list_wall_marks_v2", args);
      if (error) throw new Error("Couldn’t load this Wall history. Please try again.");
      return data;
    });
}
