import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Dependency-free contract tests load source directly.
import { isFocusedPollReaderEnabled, readFocusedWallCard } from "./poll-focused-reader.ts";

const actor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const wall = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const mark = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const other = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const first = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const second = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const noLegacyMark = async () => null;
const fixture = () => ({
  status: "available",
  item: {
    kind: "poll",
    mark: { id: mark, wall_id: wall, status: "active", type: "poll", secret: false },
    poll: {
      mark_id: mark, question: "Where?", selection_mode: "multiple", state: "closed",
      options: [{ option_id: first, position: 0, label: "Home" }, { option_id: second, position: 1, label: "Park" }],
      ballot: { revision: 1, option_ids: [first] },
      results: { ballot_total: 1, counts: [{ option_id: first, count: 1 }, { option_id: second, count: 1 }] },
    },
  },
});

test("held reader and successful legacy read never query the v2 endpoint", async () => {
  assert.equal(isFocusedPollReaderEnabled, false);
  const noV2 = async () => assert.fail("unexpected Poll read");
  assert.equal(await readFocusedWallCard(actor, wall, mark, noLegacyMark, noV2, isFocusedPollReaderEnabled), null);
  const legacy = { id: mark, text: "Existing Mark" };
  assert.deepEqual(await readFocusedWallCard(actor, wall, mark, async () => legacy, noV2, true), {
    id: mark, kind: "mark", mark: legacy,
  });
});

test("focused Poll reads send exact actor, Wall and Mark and return only display fields", async () => {
  const calls: unknown[] = [];
  const result = await readFocusedWallCard(actor, wall, mark, noLegacyMark, async (args) => {
    calls.push(args);
    return fixture();
  }, true);
  assert.deepEqual(calls, [{ p_expected_actor_id: actor, p_wall_id: wall, p_mark_id: mark }]);
  assert.deepEqual(result, { id: mark, kind: "poll", poll: {
    question: "Where?", selectionMode: "multiple", state: "closed", ballotTotal: 1,
    options: [{ id: first, label: "Home", count: 1 }, { id: second, label: "Park", count: 1 }],
  } });
});

test("denial and redacted results do not become a Poll or invent vote counts", async () => {
  assert.equal(await readFocusedWallCard(actor, wall, mark, noLegacyMark, async () => ({ status: "unavailable" }), true), null);
  const sample = fixture();
  const response = { ...sample, item: { ...sample.item, poll: { ...sample.item.poll, results: null } } };
  const result = await readFocusedWallCard(actor, wall, mark, noLegacyMark, async () => response, true);
  assert.equal(result?.kind, "poll");
  if (result?.kind !== "poll") assert.fail("expected Poll");
  assert.equal(result.poll.ballotTotal, null);
  assert.deepEqual(result.poll.options.map((option) => option.count), [null, null]);
});

test("selector rejects a foreign Wall, wrong identity, duplicate options and mismatched totals for retry", async () => {
  const sample = fixture();
  const wrongWall = { ...sample, item: { ...sample.item, mark: { ...sample.item.mark, wall_id: other } } };
  const wrongPoll = { ...sample, item: { ...sample.item, poll: { ...sample.item.poll, mark_id: other } } };
  const duplicate = { ...sample, item: { ...sample.item, poll: { ...sample.item.poll, options: [
    { ...sample.item.poll.options[0] }, { ...sample.item.poll.options[1], option_id: first },
  ] } } };
  const invalidTotal = { ...sample, item: { ...sample.item, poll: { ...sample.item.poll, selection_mode: "single" } } };
  for (const response of [wrongWall, wrongPoll, duplicate, invalidTotal]) {
    await assert.rejects(readFocusedWallCard(actor, wall, mark, noLegacyMark, async () => response, true), /verify this Poll/);
  }
});
