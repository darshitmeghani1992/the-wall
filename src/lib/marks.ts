import { supabase } from "./supabase";
import type { Mark } from "./types";

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

/** Owner-only: pin/unpin a mark to the top of the wall. */
export async function setPinned(markId: string, pinned: boolean): Promise<void> {
  await supabase.from("marks").update({ pinned }).eq("id", markId);
}

/** Owner or author: hide a mark from the wall (soft delete). */
export async function hideMark(markId: string): Promise<void> {
  await supabase.from("marks").update({ status: "hidden" }).eq("id", markId);
}
