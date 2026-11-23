import assert from "node:assert/strict";
// @ts-ignore Node's dependency-free TypeScript runner uses the explicit .ts extension.
import { executeStandardPollCreate, parseStandardPollCreation, PollDraftInvalid,
  prepareStandardPoll, standardPollRpcArgs } from "./poll-create-contract.ts";

const OWNER = "11111111-1111-4111-8111-111111111111";
const WALL = "22222222-2222-4222-8222-222222222222";
const REQUEST_A = "33333333-3333-4333-8333-333333333333";
const REQUEST_B = "44444444-4444-4444-8444-444444444444";
const MARK = "55555555-5555-4555-8555-555555555555";
const draft = {
  actorId: OWNER, wallId: WALL, question: "  Which colour?\n",
  options: [" Red ", " Blue\t"], selectionMode: "single" as const,
  anonymous: false as const, secret: false as const,
};

async function main() {
  const original = prepareStandardPoll(draft, null, () => REQUEST_A);
  assert.deepEqual(standardPollRpcArgs(original), {
    p_expected_actor_id: OWNER, p_request_id: REQUEST_A, p_wall_id: WALL,
    p_selection_mode: "single", p_question: "Which colour?", p_options: ["Red", "Blue"],
    p_anonymous: false, p_secret: false,
  });
  assert.equal(prepareStandardPoll({ ...draft, question: "Which colour?", options: ["Red", "Blue"] },
    original, () => REQUEST_B), original, "a lost-response retry must reuse the exact request");
  const changed = prepareStandardPoll({ ...draft, selectionMode: "multiple" }, original, () => REQUEST_B);
  assert.equal(changed.requestId, REQUEST_B, "a semantic edit gets its own request");
  assert.equal(changed.fingerprint === original.fingerprint, false);

  for (const invalid of [
    { ...draft, secret: true }, { ...draft, anonymous: true },
    { ...draft, options: ["A"] }, { ...draft, options: Array(7).fill("A") },
    { ...draft, options: ["A", " a\t"] }, { ...draft, options: ["A", ""] },
    { ...draft, options: ["A", "A".repeat(81)] },
    { ...draft, question: " " }, { ...draft, question: "Q".repeat(501) },
    { ...draft, wallId: "wrong" }, { ...draft, actorId: "wrong" },
    { ...draft, selectionMode: "other" }, { ...draft, options: [null, "B"] },
  ]) {
    assert.throws(() => prepareStandardPoll(invalid as typeof draft, null, () => REQUEST_A), PollDraftInvalid);
  }
  assert.throws(() => prepareStandardPoll(draft, null, () => "bad-request-id"), PollDraftInvalid);

  assert.deepEqual(parseStandardPollCreation({
    status: "created", mark_id: MARK, mark_status: "pending", poll_revision: 1,
  }), { status: "created", markId: MARK, markStatus: "pending", revision: 1 });
  for (const status of ["invalid", "unavailable", "request_id_reused"] as const) {
    assert.deepEqual(parseStandardPollCreation({ status }), { status });
  }
  for (const response of [
    { status: "created", mark_id: MARK, mark_status: "active", poll_revision: 1, voter_id: OWNER },
    { status: "created", mark_id: MARK, mark_status: "active", poll_revision: "1" },
    { status: "created", mark_id: "not-uuid", mark_status: "active", poll_revision: 1 },
    { status: "existing", mark_id: MARK, mark_status: "hidden", poll_revision: 1 },
    { status: "unavailable", reason: "private" }, { status: "unknown" }, null,
  ]) assert.equal(parseStandardPollCreation(response), null);

  let active = false;
  let dispatched = 0;
  await assert.rejects(() => executeStandardPollCreate(original, async () => {
    dispatched++; return { status: "invalid" };
  }, () => active), /POLL_CREATE_STALE_SCOPE/);
  assert.equal(dispatched, 0, "no RPC may start after actor/destination change");

  active = true;
  let release!: (payload: unknown) => void;
  const pending = executeStandardPollCreate(original, async args => {
    dispatched++;
    assert.deepEqual(args, standardPollRpcArgs(original));
    return new Promise(resolve => { release = resolve; });
  }, () => active);
  active = false;
  release({ status: "created", mark_id: MARK, mark_status: "active", poll_revision: 1 });
  await assert.rejects(() => pending, /POLL_CREATE_STALE_SCOPE/,
    "a response from a prior actor or Wall must never reach UI");

  active = true;
  assert.deepEqual(await executeStandardPollCreate(original, async () => ({
    status: "existing", mark_id: MARK, mark_status: "active", poll_revision: 1,
  }), () => active), { status: "existing", markId: MARK, markStatus: "active", revision: 1 });
  await assert.rejects(() => executeStandardPollCreate(original, async () => ({
    status: "created", mark_id: MARK, mark_status: "active", poll_revision: 1, voter_id: OWNER,
  }), () => active), /POLL_CREATE_INVALID_RESPONSE/);

  console.log("standard Poll create: SQL-equivalent validation, actor-bound args, stable retries and stale-scope denial passed");
}

void main().catch(cause => {
  console.error(cause instanceof Error ? cause.message : "standard Poll client contract failed");
  process.exitCode = 1;
});
