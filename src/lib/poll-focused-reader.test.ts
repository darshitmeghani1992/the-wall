import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Dependency-free contract tests load source directly.
import { isFocusedPollReaderEnabled, readFocusedPoll, readFocusedWallCard } from "./poll-focused-reader.ts";
// @ts-ignore Dependency-free contract tests load source directly.
import { resolveDeferredDestination } from "./deferred-destination-resolver.ts";
import type { DeferredDestination } from "./deferred-destination-contract";

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
      mark_id: mark, question: "Where?", selection_mode: "multiple", state: "closed", revision: 2,
      capabilities: { can_vote: true, can_close: true },
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
  assert.deepEqual(calls, [{ p_expected_actor_id: actor, p_wall_id: wall, p_mark_id: mark, p_kind: "poll" }]);
  assert.deepEqual(result, { id: mark, kind: "poll", poll: {
    question: "Where?", selectionMode: "multiple", state: "closed", ballotTotal: 1,
    revision: 2, capabilities: { canVote: false, canClose: false }, ballot: { revision: 1, optionIds: [first] },
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
  const wrongBallot = { ...sample, item: { ...sample.item, poll: { ...sample.item.poll, ballot: { revision: 1, option_ids: [other] } } } };
  for (const response of [wrongWall, wrongPoll, duplicate, invalidTotal, wrongBallot]) {
    await assert.rejects(readFocusedWallCard(actor, wall, mark, noLegacyMark, async () => response, true), /verify this Poll/);
  }
});

test("focused Poll arrival keeps its exact Personal or Shared destination and honors the reader hold", async () => {
  const routes: [DeferredDestination, string][] = [
    [{ kind: "mark", markId: mark, container: { kind: "personal", ownerId: actor } }, "/(tabs)/home"],
    [{ kind: "mark", markId: mark, container: { kind: "personal", ownerId: other } }, `/person/${other}`],
    [{ kind: "mark", markId: mark, container: { kind: "shared", wallId: wall } }, `/shared/${wall}`],
  ];

  for (const [destination, route] of routes) {
    const resolve = (enabled: boolean) => resolveDeferredDestination(destination, actor, {
      personalWall: async () => ({ id: wall }),
      sharedWall: async () => ({ id: wall }),
      wallMark: (wallId, markId) => readFocusedWallCard(actor, wallId, markId, noLegacyMark, async () => fixture(), enabled),
    });
    assert.deepEqual(await resolve(isFocusedPollReaderEnabled), { status: "terminal_unavailable" });
    const available = await resolve(true);
    assert.equal(available.status, "available");
    if (available.status !== "available") assert.fail("expected focused destination");
    assert.equal(available.href, `${route}?focusMark=${mark}`);
  }
});


test("private Poll focus is kind-bound and cannot interpret a colliding ordinary Mark", async () => {
  const captured: unknown[] = [];
  const result = await readFocusedPoll(actor, wall, mark, async (args) => {
    captured.push(args);
    const sample = fixture();
    return { ...sample, item: { ...sample.item, kind: "mark" } };
  }, true);
  assert.equal(result, null);
  assert.deepEqual(captured, [{ p_expected_actor_id: actor, p_wall_id: wall, p_mark_id: mark, p_kind: "poll" }]);
  assert.equal(await readFocusedPoll(actor, wall, mark, async () => assert.fail("disabled read"), false), null);
});
