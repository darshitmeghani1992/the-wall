import type { MarkWithAuthor } from "./marks";
import type { MixedWallPage, MixedWallCursor } from "./poll-mixed-history";
import type { FocusedPoll } from "./poll-focused-reader";
import type { Mark } from "./types";

export type HydratedMixedWallItem =
  | { kind: "mark"; id: string; pinned: boolean; created_at: string; mark: MarkWithAuthor }
  | { kind: "poll"; id: string; pinned: boolean; created_at: string; poll: FocusedPoll };

export type HydratedMixedWallPage = {
  items: HydratedMixedWallItem[];
  nextCursor: MixedWallCursor | null;
};

/** Keep existing RLS-author hydration; the v2 RPC never exposes profile rows. */
export async function hydrateMixedWallPage(
  page: MixedWallPage,
  hydrate: (marks: Mark[]) => Promise<MarkWithAuthor[]>,
): Promise<HydratedMixedWallPage> {
  const ordinary = page.items.filter((item): item is Extract<MixedWallPage["items"][number], { kind: "mark" }> =>
    item.kind === "mark");
  const hydrated = await hydrate(ordinary.map((item) => item.mark));
  if (hydrated.length !== ordinary.length || hydrated.some((mark, i) => mark.id !== ordinary[i]?.id)) {
    throw new Error("Couldn’t verify this Wall history. Please try again.");
  }
  const byId = new Map(hydrated.map((mark) => [mark.id, mark]));
  return {
    nextCursor: page.nextCursor,
    items: page.items.map((item) => {
      if (item.kind === "poll") return item;
      const mark = byId.get(item.id);
      if (!mark) throw new Error("Couldn’t verify this Wall history. Please try again.");
      return { ...item, mark };
    }),
  };
}

export function mixedItemForLiveMark(mark: MarkWithAuthor): HydratedMixedWallItem {
  return { kind: "mark", id: mark.id, pinned: mark.pinned, created_at: mark.created_at, mark };
}

/** Deduplicate only by kind+ID: a synthetic equal-ID Poll/Mark pair is legal. */
export function mergeMixedWallItems(
  current: readonly HydratedMixedWallItem[],
  incoming: readonly HydratedMixedWallItem[],
): HydratedMixedWallItem[] {
  const items = new Map(current.map((item) => [`${item.kind}:${item.id}`, item]));
  for (const item of incoming) items.set(`${item.kind}:${item.id}`, item);
  return Array.from(items.values()).sort((a, b) =>
    Number(b.pinned) - Number(a.pinned)
    || Date.parse(b.created_at) - Date.parse(a.created_at)
    || b.created_at.localeCompare(a.created_at)
    || b.id.localeCompare(a.id)
    || b.kind.localeCompare(a.kind));
}

export type MixedWallSegment =
  | { kind: "marks"; key: string; entries: { item: Extract<HydratedMixedWallItem, { kind: "mark" }>; index: number }[] }
  | { kind: "poll"; key: string; item: Extract<HydratedMixedWallItem, { kind: "poll" }>; index: number };

/** Render full-width Poll cards between contiguous masonry runs of regular Marks. */
export function groupMixedWallItems(items: readonly HydratedMixedWallItem[]): MixedWallSegment[] {
  const groups: MixedWallSegment[] = [];
  for (const [index, item] of items.entries()) {
    if (item.kind === "poll") {
      groups.push({ kind: "poll", key: `poll:${item.id}`, item, index });
      continue;
    }
    const last = groups.at(-1);
    if (last?.kind === "marks") {
      last.entries.push({ item, index });
    } else {
      groups.push({ kind: "marks", key: `marks:${item.id}`, entries: [{ item, index }] });
    }
  }
  return groups;
}
