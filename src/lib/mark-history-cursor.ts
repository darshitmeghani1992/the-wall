// @ts-ignore Node's strip-types contract runner needs the source extension.
import { descendingCreatedAtIdFilter, type CreatedAtIdCursor } from "./created-at-pagination.ts";

export type MarkCursor = CreatedAtIdCursor & Readonly<{ pinned: boolean }>;

/** The phase predicate uses the same validated timestamp/UUID contract as Alerts. */
export function markHistoryFilter(cursor: MarkCursor): string {
  if (typeof cursor.pinned !== "boolean") throw new Error("The Wall history cursor is invalid.");
  return descendingCreatedAtIdFilter(cursor, "The Wall history cursor is invalid.");
}

export function markCursorFrom(row: MarkCursor): MarkCursor {
  return { pinned: row.pinned, created_at: row.created_at, id: row.id };
}

export const WALL_MARK_PAGE_SIZE = 50;

/** The caller's read is RLS-bound and filtered by the requested pinned phase. */
export async function readMarkHistoryPage<T extends MarkCursor>(
  read: (pinned: boolean, limit: number, after?: string) => Promise<T[]>,
  cursor?: MarkCursor,
): Promise<{ items: T[]; nextCursor: MarkCursor | null }> {
  const predicate = cursor ? markHistoryFilter(cursor) : undefined;
  const pinned = cursor?.pinned === false ? [] : await read(true, WALL_MARK_PAGE_SIZE + 1, predicate);
  const first = pinned.slice(0, WALL_MARK_PAGE_SIZE);
  if (pinned.length > WALL_MARK_PAGE_SIZE) {
    return { items: first, nextCursor: markCursorFrom(first[first.length - 1]) };
  }
  const remaining = WALL_MARK_PAGE_SIZE - first.length;
  const unpinned = await read(false, remaining + 1, cursor?.pinned === false ? predicate : undefined);
  const rows = [...first, ...unpinned.slice(0, remaining)];
  const last = rows.at(-1);
  return { items: rows, nextCursor: unpinned.length > remaining && last ? markCursorFrom(last) : null };
}

/** Keep live/overlapping page rows once, ordered as the server orders each phase. */
export function mergeWallMarks<T extends MarkCursor>(current: readonly T[], incoming: readonly T[]): T[] {
  const byId = new Map(current.map((mark) => [mark.id, mark]));
  for (const mark of incoming) byId.set(mark.id, mark);
  return [...byId.values()].sort((a, b) =>
    Number(b.pinned) - Number(a.pinned)
    || Date.parse(b.created_at) - Date.parse(a.created_at)
    || b.id.localeCompare(a.id));
}
