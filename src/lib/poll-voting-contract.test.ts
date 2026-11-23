import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Dependency-free contract tests load source directly.
import { confirmedPollVoteMessage, isPollInteractionEnabled, isValidSelection, parsePollMutationResult, preparePollMutation, togglePollOption } from "./poll-voting-contract.ts";
import type { FocusedPoll } from "./poll-focused-reader";

const target = { actorId: "actor", wallId: "wall", markId: "mark" };
const open: FocusedPoll = {
  question: "Where?", selectionMode: "single", state: "open", revision: 3,
  options: [{ id: "home", label: "Home", count: 2 }, { id: "park", label: "Park", count: 1 }],
  ballotTotal: 3, ballot: { revision: 4, optionIds: ["home"] },
  capabilities: { canVote: true, canClose: false },
};

test("single-choice replacement and multiple-choice set edits stay local and valid", () => {
  assert.deepEqual(togglePollOption(open, ["home"], "park"), ["park"]);
  assert.deepEqual(togglePollOption(open, ["home"], "other"), ["home"]);
  assert.equal(isValidSelection(open, ["home", "park"]), false);
  const multi = { ...open, selectionMode: "multiple" } as const;
  assert.deepEqual(togglePollOption(multi, ["home"], "park"), ["home", "park"]);
  assert.deepEqual(togglePollOption(multi, ["home", "park"], "home"), ["park"]);
  assert.equal(isValidSelection(multi, ["park", "park"]), false);
  assert.equal(isValidSelection(multi, ["park", "other"]), false);
  assert.equal(isValidSelection(multi, []), false);
});

test("write intents use exact actor, Wall, Poll and revisions with stable retry keys", () => {
  assert.equal(isPollInteractionEnabled, false);
  const vote = preparePollMutation("vote", target, open, ["park"], null, () => "request");
  assert.ok(vote);
  assert.equal(preparePollMutation("vote", target, open, ["park"], vote, () => "second"), vote);
  assert.equal(preparePollMutation("vote", { ...target, wallId: "new" }, open, ["park"], vote, () => "second")?.args.p_request_id, "second");
  assert.equal(preparePollMutation("vote", target, { ...open, revision: 4 }, ["park"], vote, () => "second")?.args.p_request_id, "second");
  assert.equal(preparePollMutation("vote", target, { ...open, ballot: { revision: 5, optionIds: ["home"] } }, ["park"], vote, () => "second")?.args.p_request_id, "second");
  assert.deepEqual(vote.args, {
    p_expected_actor_id: "actor", p_wall_id: "wall", p_mark_id: "mark",
    p_expected_poll_revision: 3, p_expected_ballot_revision: 4, p_option_ids: ["park"], p_request_id: "request",
  });
  assert.equal(preparePollMutation("close", target, open, [], null, () => "never"), null);
  assert.equal(preparePollMutation("vote", target, { ...open, state: "closed" }, ["park"], vote, () => "never"), null);
});

test("vote receipts must confirm the right Poll and applied selection", () => {
  const vote = preparePollMutation("vote", target, open, ["park"], null, () => "request");
  assert.ok(vote);
  const accepted = { status: "applied", mark_id: "mark", revision: 3, ballot: { revision: 5, option_ids: ["park"] } };
  assert.equal(parsePollMutationResult(accepted, vote, open), "confirmed");
  assert.equal(parsePollMutationResult({ ...accepted, mark_id: "other" }, vote, open), null);
  assert.equal(parsePollMutationResult({ ...accepted, ballot: { revision: 6, option_ids: ["park"] } }, vote, open), null);
  assert.equal(parsePollMutationResult({ ...accepted, ballot: { revision: 5, option_ids: ["home"] } }, vote, open), null);
  assert.equal(parsePollMutationResult({ ...accepted, status: "existing", revision: 4, ballot: { revision: 6, option_ids: ["home"] } }, vote, open), "confirmed");
  assert.equal(parsePollMutationResult({ status: "conflict" }, vote, open), "conflict");
  assert.equal(parsePollMutationResult({ status: "unavailable" }, vote, open), "unavailable");
});

test("only the server-issued author close capability can produce a close request", () => {
  const authorPoll = { ...open, capabilities: { canVote: false, canClose: true } };
  const close = preparePollMutation("close", target, authorPoll, [], null, () => "close");
  assert.ok(close);
  assert.equal(preparePollMutation("close", target, authorPoll, [], close, () => "never"), close);
  assert.equal(parsePollMutationResult({ status: "closed", mark_id: "mark", revision: 4 }, close, authorPoll), "confirmed");
  assert.equal(parsePollMutationResult({ status: "closed", mark_id: "mark", revision: 3 }, close, authorPoll), null);
  assert.equal(parsePollMutationResult({ status: "closed" }, close, authorPoll), "closed");
});

test("confirmed replay feedback names the latest vote rather than claiming the old selection was saved", () => {
  assert.equal(confirmedPollVoteMessage(["home"], open), "Vote saved.");
  assert.equal(confirmedPollVoteMessage(["park"], open), "The vote shown is your latest selection.");
  assert.equal(confirmedPollVoteMessage(["park"], { ...open, ballot: null }), "There’s no current vote from this account.");
});
