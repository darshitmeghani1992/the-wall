// @ts-ignore Node's strip-types contract runner loads the source extension.
import { isCanonicalUuid } from "./deferred-destination-contract.ts";
// @ts-ignore Node's strip-types contract runner needs the source extension.
import { parsePoll, type FocusedPoll } from "./poll-focused-reader.ts";
import type { Mark } from "./types";

/** No runtime selection of the new endpoint until hosted ACL and device QA. */
export const isMixedPollHistoryEnabled: boolean = false;
export const MIXED_WALL_PAGE_SIZE = 20;

export type MixedWallCursor = Readonly<{
  pinned: boolean;
  created_at: string;
  mark_id: string;
  kind: "mark" | "poll";
}>;

export type MixedWallItem =
  | { kind: "mark"; id: string; pinned: boolean; created_at: string; mark: Mark }
  | { kind: "poll"; id: string; pinned: boolean; created_at: string; poll: FocusedPoll };

export type MixedWallPage = { items: MixedWallItem[]; nextCursor: MixedWallCursor | null };

export type MixedWallReadRequest = {
  p_expected_actor_id: string;
  p_wall_id: string;
  p_after_pinned: boolean | null;
  p_after_created_at: string | null;
  p_after_mark_id: string | null;
  p_after_kind: "mark" | "poll" | null;
  p_limit: number;
};

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

function invalid(): never {
  throw new Error("Couldn’t verify this Wall history. Please try again.");
}

const validTime = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

const kindOf = (value: unknown): value is MixedWallCursor["kind"] =>
  value === "mark" || value === "poll";

function cursorFrom(value: unknown): MixedWallCursor {
  if (!record(value) || typeof value.pinned !== "boolean" || !validTime(value.created_at)
    || !isCanonicalUuid(value.mark_id) || !kindOf(value.kind)) return invalid();
  return {
    pinned: value.pinned, created_at: value.created_at, mark_id: value.mark_id.toLowerCase(), kind: value.kind,
  };
}

function parseOrdinaryMark(value: unknown, wallId: string): Mark {
  if (!record(value) || !isCanonicalUuid(value.id) || value.wall_id !== wallId
    || !["text", "photo", "voice", "video"].includes(String(value.type))
    || value.status !== "active" || typeof value.anonymous !== "boolean"
    || typeof value.secret !== "boolean" || typeof value.pinned !== "boolean"
    || !validTime(value.created_at) || typeof value.rotation !== "number" || !Number.isFinite(value.rotation)
    || (value.author_id !== null && !isCanonicalUuid(value.author_id))
    || (value.text !== null && typeof value.text !== "string")
    || (value.color !== null && typeof value.color !== "string")
    || (value.media_url !== null && typeof value.media_url !== "string")
    || (value.payload !== null && !record(value.payload))
    || (value.anonymous && value.author_id !== null)
    || (value.secret && value.text !== null)) return invalid();

  // Construct only the explicitly approved ordinary Mark projection, rather
  // than passing through extra fields from a future/compromised RPC response.
  return {
    id: value.id.toLowerCase(), wall_id: wallId,
    author_id: value.author_id === null ? null : value.author_id.toLowerCase(),
    type: value.type as Mark["type"], text: value.text as string | null,
    color: value.color as string | null, anonymous: value.anonymous,
    secret: value.secret, media_url: value.media_url as string | null,
    payload: value.payload as Mark["payload"], rotation: value.rotation,
    pinned: value.pinned, status: "active", created_at: value.created_at,
  };
}

/** Strict actor-bound v2 envelope parser; fail closed on malformed server data. */
export function parseMixedWallHistoryPage(value: unknown, wallId: string): MixedWallPage | null {
  if (!isCanonicalUuid(wallId)) return invalid();
  const scope = wallId.toLowerCase();
  if (!record(value)) return invalid();
  if (value.status === "unavailable") return null;
  if (value.status !== "available" || !Array.isArray(value.items)
    || value.items.length > MIXED_WALL_PAGE_SIZE) return invalid();

  const keys = new Set<string>();
  const items: MixedWallItem[] = value.items.map((envelope: unknown) => {
    if (!record(envelope) || !kindOf(envelope.kind) || !record(envelope.mark)) return invalid();
    const row = envelope.mark;
    if (!isCanonicalUuid(row.id) || row.wall_id !== scope
      || typeof row.pinned !== "boolean" || !validTime(row.created_at)) return invalid();
    const id = row.id.toLowerCase();
    const key = envelope.kind + ":" + id;
    if (keys.has(key)) return invalid();
    keys.add(key);
    if (envelope.kind === "poll") {
      const poll = parsePoll({ status: "available", item: envelope }, scope, id);
      if (!poll) return invalid();
      return { kind: "poll", id, pinned: row.pinned, created_at: row.created_at, poll };
    }
    const mark = parseOrdinaryMark(row, scope);
    return { kind: "mark", id, pinned: mark.pinned, created_at: mark.created_at, mark };
  });

  const nextCursor = value.next_cursor === null ? null : cursorFrom(value.next_cursor);
  if (nextCursor) {
    const last = items.at(-1);
    if (!last || last.id !== nextCursor.mark_id || last.kind !== nextCursor.kind
      || last.pinned !== nextCursor.pinned || Date.parse(last.created_at) !== Date.parse(nextCursor.created_at)) return invalid();
  }
  return { items, nextCursor };
}

/** The caller owns the network request and must retain its account/screen generation fence. */
export async function readMixedWallHistory(
  actorId: string,
  wallId: string,
  cursor: MixedWallCursor | null,
  enabled: boolean,
  read: (request: MixedWallReadRequest) => Promise<unknown>,
): Promise<MixedWallPage | null> {
  if (!enabled) return null;
  if (!isCanonicalUuid(actorId) || !isCanonicalUuid(wallId)) return invalid();
  const checked = cursor === null ? null : cursorFrom(cursor);
  const response = await read({
    p_expected_actor_id: actorId.toLowerCase(),
    p_wall_id: wallId.toLowerCase(),
    p_after_pinned: checked?.pinned ?? null,
    p_after_created_at: checked?.created_at ?? null,
    p_after_mark_id: checked?.mark_id ?? null,
    p_after_kind: checked?.kind ?? null,
    p_limit: MIXED_WALL_PAGE_SIZE,
  });
  return parseMixedWallHistoryPage(response, wallId);
}
