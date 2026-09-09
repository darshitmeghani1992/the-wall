import { supabase } from "./supabase";
import { track } from "./analytics";
import type { Mark } from "./types";
import type { MediaWriterRpc } from "./mark-media-writer";
import {
  executeTextMarkSubmission,
  type CreateTextMarkResult,
  type PreparedTextMarkSubmission,
} from "./mark-writer-contract";

/** Exact actor-bound C4 writer surface shipped by migrations 0023/0024. */
export const protectedMediaWriterRpc: MediaWriterRpc = {
  async begin(args) {
    const { data, error } = await supabase.rpc("begin_media_upload", args);
    if (error) throw error;
    return data;
  },
  async uploaded(args) {
    const { data, error } = await supabase.rpc("mark_media_uploaded", args);
    if (error) throw error;
    return data;
  },
  async status(args) {
    const { data, error } = await supabase.rpc("get_media_upload_status", args);
    if (error) throw error;
    return data;
  },
  async cancel(args) {
    const { data, error } = await supabase.rpc("cancel_media_upload", args);
    if (error) throw error;
    return data;
  },
  async create(args) {
    const { data, error } = await supabase.rpc("create_mark", args);
    if (error) throw error;
    return data;
  },
};

/** C4 text-only writer path. Media creation remains on its separately gated flow. */
export async function createTextMark(submission: PreparedTextMarkSubmission): Promise<CreateTextMarkResult> {
  return executeTextMarkSubmission(submission, async (args) => {
    const { data, error } = await supabase.rpc("create_mark", args);
    if (error) throw error;
    return data;
  });
}

export type Author = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  handle: string;
};

/** A mark plus its resolved author — `author` is null for anonymous marks. */
export type MarkWithAuthor = Mark & { author: Author | null };

/**
 * Load a wall's active marks, newest first (pinned marks float to the top),
 * then hydrate authors. Anonymous marks never carry author info to the client.
 */
export async function getWallMarks(wallId: string): Promise<MarkWithAuthor[]> {
  const { data } = await supabase
    .from("marks")
    .select("*")
    .eq("wall_id", wallId)
    .eq("status", "active")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  const marks = (data ?? []) as Mark[];
  return hydrateAuthors(marks);
}

/** Resolve author profiles for a batch of marks in one query. */
export async function hydrateAuthors(marks: Mark[]): Promise<MarkWithAuthor[]> {
  const ids = Array.from(
    new Set(marks.filter((m) => !m.anonymous && m.author_id).map((m) => m.author_id as string)),
  );

  const authors: Record<string, Author> = {};
  if (ids.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, handle")
      .in("id", ids);
    for (const a of (data ?? []) as Author[]) authors[a.id] = a;
  }

  return marks.map((m) => ({
    ...m,
    author: !m.anonymous && m.author_id ? (authors[m.author_id] ?? null) : null,
  }));
}

/**
 * Subscribe to new marks on a wall. Calls `onInsert` with the hydrated mark
 * whenever someone leaves one — powers the live "drops onto the wall" effect.
 * Returns an unsubscribe function.
 */
export function subscribeToWall(
  wallId: string,
  onInsert: (mark: MarkWithAuthor) => void,
): () => void {
  const channel = supabase
    .channel(`wall:${wallId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "marks", filter: `wall_id=eq.${wallId}` },
      async (payload) => {
        const raw = payload.new as Mark;
        if (raw.status !== "active") return; // pending marks await approval
        const [hydrated] = await hydrateAuthors([raw]);
        onInsert(hydrated);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Why a Secret reveal did not return content (server-classified; see 0010). */
export type SecretRevealReason = "ok" | "consumed" | "expired" | "not_authorized" | "missing";

/** Result of a one-time Secret reveal. `content` is present only when `ok`. */
export type SecretRevealResult = { ok: boolean; reason: SecretRevealReason; content?: string };

/**
 * Reveal a Secret Mark's content through the one-time, server-atomic RPC
 * `reveal_secret` (0010 / FP-SEC-002 / ADR-010). The privacy AND lifecycle
 * boundaries are the SERVER, not this client:
 *   • recipient-only: the RPC authorizes the caller as the wall owner; anyone
 *     else gets `{ ok:false, reason:'not_authorized' }` and no content.
 *   • one-time: the first reveal atomically records `opened_at`; a second reveal
 *     returns `{ ok:false, reason:'consumed' }`. Clients cannot re-read the
 *     content out of band — direct SELECT on `mark_secrets` is revoked (0010).
 *   • expiry: past the 1-hour window the RPC returns `{ ok:false,
 *     reason:'expired' }`.
 *
 * The base `marks.text` is NULL for secrets, so a non-recipient never has content
 * on the client at all. Callers should still UX-gate to the wall owner; the RPC is
 * the real enforcement. Throws on a genuine network/API error so the UI can show an
 * honest error state rather than a false "empty".
 */
export async function revealSecret(markId: string): Promise<SecretRevealResult> {
  const { data, error } = await supabase.rpc("reveal_secret", { p_mark_id: markId });
  if (error) throw error;
  const result = (data ?? { ok: false, reason: "missing" }) as SecretRevealResult;
  if (result.ok) track("Secret Mark Opened", { mark_id: markId }); // no content in the event
  return result;
}

/** Owner-only: pin/unpin a mark to the top of the wall. */
export async function setPinned(markId: string, pinned: boolean): Promise<void> {
  await supabase.from("marks").update({ pinned }).eq("id", markId);
}

/** The sender edit/delete window — 10 minutes (Master Spec §32). Server-enforced. */
export const EDIT_WINDOW_MS = 10 * 60 * 1000;
/** Owner normal-removal allowance — 3 per rolling 30 days (§33). Server-enforced. */
export const NORMAL_REMOVAL_LIMIT = 3;

export type RemovalReason = "normal" | "safety";

/**
 * Owner: remove a received Mark (soft — status becomes 'removed'). The DB trigger
 * (0012) stamps who/when and enforces the §33 quota: 'normal' removals are capped
 * at 3 per rolling 30 days; 'safety' removals (from a report/block/abuse path) are
 * never rate-limited. Throws `MARK_REMOVAL_QUOTA` when a normal removal is over
 * the cap, so the UI can steer the owner to a safety removal.
 */
export async function removeMark(markId: string, reason: RemovalReason): Promise<void> {
  const { error, count } = await supabase
    .from("marks")
    .update({ status: "removed", removal_reason: reason }, { count: "exact" })
    .eq("id", markId);
  if (error) throw error;
  if (count !== 1) throw new Error("MARK_ACTION_NOT_ALLOWED");
}

/**
 * How many `normal` removals the owner has left in the rolling 30-day window
 * (0..NORMAL_REMOVAL_LIMIT), for the "you have N left" confirmation copy (§33).
 * The count is best-effort UX; the DB trigger is the real enforcement.
 */
export async function remainingNormalRemovals(ownerId: string): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("marks")
    .select("id", { count: "exact", head: true })
    .eq("removed_by", ownerId)
    .eq("removal_reason", "normal")
    .gt("removed_at", since);
  if (error) throw error;
  return Math.max(0, NORMAL_REMOVAL_LIMIT - (count ?? 0));
}

/** Is a Mark still inside the sender's 10-minute edit/delete window? (§32) */
export function isWithinEditWindow(mark: Pick<Mark, "created_at">): boolean {
  return Date.now() < new Date(mark.created_at).getTime() + EDIT_WINDOW_MS;
}

/**
 * Sender: edit a Mark's text within the window (§32). The DB trigger rejects
 * edits after 10 minutes with `MARK_EDIT_WINDOW`; we surface that as a thrown
 * error the UI can turn into an honest "the edit window has closed" message.
 */
export async function editMarkText(markId: string, text: string): Promise<void> {
  const { error, count } = await supabase
    .from("marks")
    .update({ text }, { count: "exact" })
    .eq("id", markId);
  if (error) throw error;
  if (count !== 1) throw new Error("MARK_ACTION_NOT_ALLOWED");
}

/** Sender: permanently delete their own Mark inside the server-enforced window. */
export async function deleteMark(markId: string): Promise<void> {
  const { error, count } = await supabase
    .from("marks")
    .delete({ count: "exact" })
    .eq("id", markId);
  if (error) throw error;
  if (count !== 1) throw new Error("MARK_ACTION_NOT_ALLOWED");
}
