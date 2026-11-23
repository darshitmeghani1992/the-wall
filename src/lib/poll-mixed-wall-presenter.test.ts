import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Node's strip-types runner uses the .ts extension.
import { hydrateMixedWallPage, mergeMixedWallItems, mixedItemForLiveMark } from "./poll-mixed-wall-presenter.ts";
import type { MarkWithAuthor } from "./marks";
import type { MixedWallPage } from "./poll-mixed-history";
import type { FocusedPoll } from "./poll-focused-reader";

const id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const wall = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const actor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const at = "2026-11-23T11:00:00.000Z";
const mark: MarkWithAuthor = {
  id, wall_id: wall, author_id: actor, type: "voice", text: null,
  color: null, anonymous: false, secret: false, media_url: null, payload: { durationMs: 59_000 },
  rotation: 0, pinned: true, status: "active", created_at: at,
  author: { id: actor, display_name: "Writer", avatar_url: null, handle: "writer" },
};
const poll: FocusedPoll = {
  question: "Which?", selectionMode: "single", state: "open",
  options: [], ballotTotal: 0, revision: 1,
  capabilities: { canVote: false, canClose: false }, ballot: null,
};
const input: MixedWallPage = {
  items: [
    { kind: "poll", id, pinned: true, created_at: at, poll },
    { kind: "mark", id, pinned: true, created_at: at, mark: { ...mark } },
  ],
  nextCursor: { pinned: true, created_at: at, mark_id: id, kind: "mark" },
};

test("hydrates only ordinary Marks while preserving mixed order and legal same-ID Polls", async () => {
  const page = await hydrateMixedWallPage(input, async (marks) => {
    assert.equal(marks.length, 1);
    assert.deepEqual(marks[0]?.payload, { durationMs: 59_000 });
    return [mark];
  });
  assert.deepEqual(page.items.map((item) => item.kind), ["poll", "mark"]);
  assert.deepEqual(page.nextCursor, input.nextCursor);
  const ordinary = page.items[1];
  if (ordinary?.kind !== "mark") assert.fail("missing ordinary Mark");
  assert.equal(ordinary.mark.author?.handle, "writer");
});

test("refuses an incomplete or reordered author hydration result", async () => {
  await assert.rejects(hydrateMixedWallPage(input, async () => []));
  await assert.rejects(hydrateMixedWallPage(input, async () => [{ ...mark, id: actor }]));
});

test("merges live Marks and fetched Polls with backend pin/time/kind ordering", async () => {
  const hydrated = await hydrateMixedWallPage(input, async () => [mark]);
  const incoming = mixedItemForLiveMark({ ...mark, pinned: false, created_at: "2026-11-23T12:00:00.000Z" });
  const result = mergeMixedWallItems(hydrated.items, [incoming]);
  assert.deepEqual(result.map((item) => item.kind), ["poll", "mark"]);
  assert.equal(result[1]?.pinned, false);
  assert.equal(result[1]?.created_at, "2026-11-23T12:00:00.000Z");
  assert.deepEqual(mergeMixedWallItems(result, result).map((item) => item.kind), ["poll", "mark"]);
});
