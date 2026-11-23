import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Dependency-free Node runner requires the explicit extension.
import { appendPollOption, hasPollDraftContent, newPollDraft, parsePollCreateResult, pollCreateArgs, preparePollCreate, removePollOption, validatePollDraft, type PollDraft } from "./poll-composer-contract.ts";
// @ts-ignore Dependency-free Node runner requires the explicit extension.
import { isPollComposerEnabled } from "./poll-composer-rollout.ts";

function draft(question: string, labels: string[], selectionMode: PollDraft["selectionMode"] = "single"): PollDraft {
  return { question, selectionMode, options: labels.map((label, id) => ({ id, label })), nextOptionId: labels.length };
}

test("Poll starts with two stable option identities and never adds more than six", () => {
  let value = newPollDraft();
  assert.equal(value.options.length, 2);
  assert.equal(hasPollDraftContent(value), false);
  assert.equal(removePollOption(value, 0), value);
  for (let index = 0; index < 5; index += 1) value = appendPollOption(value);
  assert.equal(value.options.length, 6);
  const removed = removePollOption(value, 2);
  const appended = appendPollOption(removed);
  assert.deepEqual(appended.options.map(({ id }) => id), [0, 1, 3, 4, 5, 6]);
  assert.equal(hasPollDraftContent(draft("", ["", "ready"])), true);
});

test("Poll validation preserves order, normalizes edge whitespace, and enforces size and uniqueness", () => {
  assert.deepEqual(validatePollDraft(draft(" \tWhere?\n", ["   Home", "School\r"], "multiple")), {
    status: "valid", payload: { question: "Where?", selectionMode: "multiple", options: ["Home", "School"] },
  });
  assert.equal(validatePollDraft(draft("Where?", ["Park", " park  "])).status, "duplicate_options");
  assert.equal(validatePollDraft(draft("Where?", ["  ", "Home"])).status, "incomplete");
  assert.equal(validatePollDraft(draft("Where?", ["One"])).status, "incomplete");
  assert.equal(validatePollDraft(draft("Where?", Array.from({ length: 7 }, (_, i) => String(i)))).status, "incomplete");
  assert.equal(validatePollDraft(draft("🙂".repeat(500), ["One", "Two"])).status, "valid");
  assert.equal(validatePollDraft(draft("🙂".repeat(501), ["One", "Two"])).status, "question_too_long");
  assert.equal(validatePollDraft(draft("Where?", ["🙂".repeat(81), "Home"])).status, "option_too_long");
});

test("Poll retries reuse the exact actor, Wall, ordered payload and request id", () => {
  const payload = { question: "Where?", selectionMode: "single", options: ["Home", "School"] } as const;
  const attempt = preparePollCreate("actor-a", "wall-a", payload, null, () => "request-one");
  assert.equal(preparePollCreate("actor-a", "wall-a", payload, attempt, () => "request-two"), attempt);
  assert.equal(preparePollCreate("actor-b", "wall-a", payload, attempt, () => "request-two").requestId, "request-two");
  assert.equal(preparePollCreate("actor-a", "wall-b", payload, attempt, () => "request-two").requestId, "request-two");
  assert.equal(preparePollCreate("actor-a", "wall-a", { ...payload, options: ["School", "Home"] }, attempt, () => "request-two").requestId, "request-two");
  assert.deepEqual(pollCreateArgs(attempt), {
    p_expected_actor_id: "actor-a", p_request_id: "request-one", p_wall_id: "wall-a",
    p_selection_mode: "single", p_question: "Where?", p_options: ["Home", "School"], p_anonymous: false, p_secret: false,
  });
});

test("Poll creation accepts exact server receipts only and the rollout is frozen off", () => {
  const markId = "11111111-1111-4111-8111-111111111111";
  const receipt = { status: "created", mark_id: markId, mark_status: "pending", poll_revision: 1 };
  assert.deepEqual(parsePollCreateResult(receipt), { status: "created", markId, markStatus: "pending" });
  assert.equal(parsePollCreateResult({ ...receipt, mark_status: "removed" }), null);
  assert.equal(parsePollCreateResult({ ...receipt, poll_revision: 0 }), null);
  assert.equal(parsePollCreateResult({ ...receipt, mark_id: "wrong" }), null);
  assert.equal(parsePollCreateResult({ status: "unavailable", mark_id: markId }), null);
  assert.deepEqual(parsePollCreateResult({ status: "unavailable" }), { status: "unavailable" });
  assert.equal(isPollComposerEnabled, false);
});
