import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Source-extension import is needed by Node's strip-types runner.
import { isMixedPollHistoryEnabled, MIXED_WALL_PAGE_SIZE, parseMixedWallHistoryPage, readMixedWallHistory } from "./poll-mixed-history.ts";

const actor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const wall = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const mark = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const option1 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const option2 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const created = "2026-11-23T11:00:00.000Z";

function ordinary() {
  return {
    kind: "mark",
    mark: {
      id: mark, wall_id: wall, author_id: actor, status: "active",
      type: "voice", text: null, color: null, anonymous: false, secret: false,
      rotation: 0, pinned: true, created_at: created, media_url: null,
      payload: { durationMs: 59_000 }, removed_by: actor,
    },
  };
}
function poll() {
  return {
    kind: "poll",
    mark: { id: mark, wall_id: wall, status: "active", type: "poll", secret: false,
      pinned: true, created_at: created },
    poll: {
      mark_id: mark, revision: 1, question: "Which?", selection_mode: "single",
      state: "open", capabilities: { can_vote: true, can_close: false },
      ballot: null,
      options: [
        { option_id: option1, label: "A", position: 0 },
        { option_id: option2, label: "B", position: 1 },
      ],
      results: { ballot_total: 0, counts: [
        { option_id: option1, count: 0 }, { option_id: option2, count: 0 },
      ] },
    },
  };
}
const page = (items: unknown[], next_cursor: unknown = null) => ({
  status: "available", items, next_cursor,
});

test("held mixed history never contacts a new endpoint", async () => {
  assert.equal(isMixedPollHistoryEnabled, false);
  const result = await readMixedWallHistory(actor, wall, null, isMixedPollHistoryEnabled,
    async () => { assert.fail("No v2 request before authorization"); });
  assert.equal(result, null);
});

test("preserves ordinary media data and distinct Poll/Mark identity on same-key records", () => {
  const result = parseMixedWallHistoryPage(page([poll(), ordinary()], {
    pinned: true, created_at: created, mark_id: mark, kind: "mark",
  }), wall);
  assert.deepEqual(result?.items.map((x) => x.kind), ["poll", "mark"]);
  const ordinaryMark = result?.items[1];
  if (ordinaryMark?.kind !== "mark") assert.fail("missing ordinary Mark");
  assert.deepEqual(ordinaryMark.mark.payload, { durationMs: 59_000 });
  assert.equal(ordinaryMark.mark.media_url, null);
  assert.equal(Object.hasOwn(ordinaryMark.mark, "removed_by"), false);
  const pollCard = result?.items[0];
  if (pollCard?.kind !== "poll") assert.fail("missing Poll");
  assert.equal(pollCard.poll.question, "Which?");
  assert.deepEqual(result.nextCursor, { pinned: true, created_at: created, mark_id: mark, kind: "mark" });
});

test("read request uses only authenticated actor and valid exact kind cursor", async () => {
  let seen: unknown;
  const cursor = { pinned: true, created_at: created, mark_id: mark, kind: "poll" as const };
  const result = await readMixedWallHistory(actor.toUpperCase(), wall.toUpperCase(), cursor, true, async (args) => {
    seen = args;
    return page([poll()], cursor);
  });
  assert.deepEqual(seen, {
    p_expected_actor_id: actor, p_wall_id: wall, p_after_pinned: true,
    p_after_created_at: created, p_after_mark_id: mark, p_after_kind: "poll",
    p_limit: MIXED_WALL_PAGE_SIZE,
  });
  assert.equal(result?.items[0]?.kind, "poll");
});

test("a denied Wall read is unavailable and never falls back to raw Mark data", async () => {
  assert.equal(parseMixedWallHistoryPage({ status: "unavailable" }, wall), null);
});

test("fail closed on cross-Wall rows, duplicate identities, missing media metadata or malformed cursor", () => {
  const badWall = ordinary();
  badWall.mark.wall_id = actor;
  assert.throws(() => parseMixedWallHistoryPage(page([badWall]), wall));
  assert.throws(() => parseMixedWallHistoryPage(page([ordinary(), ordinary()]), wall));
  const ordinaryMark = ordinary();
  const { payload: _ignoredPayload, ...metadataMissing } = ordinaryMark.mark;
  assert.throws(() => parseMixedWallHistoryPage(page([{ ...ordinaryMark, mark: metadataMissing }]), wall));
  assert.throws(() => parseMixedWallHistoryPage(page([ordinary()], {
    pinned: false, created_at: created, mark_id: mark, kind: "mark",
  }), wall));
  assert.throws(() => parseMixedWallHistoryPage(page([ordinary()], {
    pinned: true, created_at: created, mark_id: mark, kind: "poll",
  }), wall));
});

test("reject leaked Secret text and anonymous author identity", () => {
  const secret = ordinary();
  const leakedSecret = { ...secret, mark: { ...secret.mark, secret: true, text: "do not display" } };
  assert.throws(() => parseMixedWallHistoryPage(page([leakedSecret]), wall));
  const anon = ordinary();
  anon.mark.anonymous = true;
  assert.throws(() => parseMixedWallHistoryPage(page([anon]), wall));
});

test("reject unrelated Poll option or malformed ballot snapshot", () => {
  const changed = poll();
  changed.poll.results.counts[1].option_id = actor;
  assert.throws(() => parseMixedWallHistoryPage(page([changed]), wall));
  assert.throws(() => parseMixedWallHistoryPage(page(Array.from({ length: 21 }, () => poll())), wall));
});
