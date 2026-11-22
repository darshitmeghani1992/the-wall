import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Node's strip-types runner requires the source extension.
import { completeReactionBatch } from "./reaction-batch.ts";

test("a successful empty batch clears previously rendered reaction counts", () => {
  assert.deepEqual(completeReactionBatch(["mark-1"], {}), {
    "mark-1": { counts: {}, mine: null },
  });
});

test("partial batch preserves returned counts and clears omitted requested Marks", () => {
  const summary = { counts: { "❤️": 2 }, mine: "❤️" };
  const results = completeReactionBatch(["mark-1", "mark-2"], {
    "mark-1": summary,
    "unrequested": { counts: { "🔥": 8 }, mine: null },
  });
  assert.deepEqual(results, {
    "mark-1": summary,
    "mark-2": { counts: {}, mine: null },
  });
  assert.equal("unrequested" in results, false);
});

test("each missing Mark gets independent empty summary objects", () => {
  const summaries = completeReactionBatch(["mark-1", "mark-2"], {});
  assert.notStrictEqual(summaries["mark-1"], summaries["mark-2"]);
  assert.notStrictEqual(summaries["mark-1"].counts, summaries["mark-2"].counts);
});
