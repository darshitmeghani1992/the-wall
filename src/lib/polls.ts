import { supabase } from "./supabase";
import { createRequestId } from "./mark-writer-contract";
import {
  executeStandardPollCreate, prepareStandardPoll,
  type CreateStandardPollOutcome, type PreparedStandardPoll, type StandardPollDraft,
} from "./poll-create-contract";

/**
 * ROLE: FRONTEND, isolated creation-service wiring for migration 0035.
 * Do not surface the composer action until PRODUCT-approved UX, ballot/close,
 * integrated v2 readers, hosted review, and independent device QA are ready.
 * This client cannot override the server's default-OFF rollout.
 */
export function preparePollCreate(
  draft: StandardPollDraft,
  previous: PreparedStandardPoll | null,
): PreparedStandardPoll {
  return prepareStandardPoll(draft, previous, createRequestId);
}

/**
 * The caller must use a synchronous single-submission lock, keep the returned
 * PreparedStandardPoll on ambiguous failure, and pass its actor/Wall scope lease.
 * A stale scope never receives another actor's result.
 */
export async function createPollMark(
  prepared: PreparedStandardPoll,
  isCurrentScope: () => boolean,
): Promise<CreateStandardPollOutcome> {
  return executeStandardPollCreate(prepared, async args => {
    const { data, error } = await supabase.rpc("create_poll_mark", args);
    if (error) throw error;
    return data;
  }, isCurrentScope);
}
