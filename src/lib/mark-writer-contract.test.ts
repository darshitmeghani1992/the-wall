import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { createRequestId, executeTextMarkSubmission, parseCreateTextMarkResult, prepareTextMarkSubmission, TextSubmissionLock, textMarkRpcArgs } from "./mark-writer-contract.ts";

const WALL = "00000000-0000-4000-8000-000000000001";
const REQUEST_A = "00000000-0000-4000-8000-000000000002";
const REQUEST_B = "00000000-0000-4000-8000-000000000003";
const MARK = "00000000-0000-4000-8000-000000000004";

async function main() {
  const draft = { wallId: WALL, text: "  hello world  ", color: "#FFE14D", anonymous: true, secret: true };
  const first = prepareTextMarkSubmission(draft, null, () => REQUEST_A, () => 1.4);
  assert.deepEqual(textMarkRpcArgs(first), {
    p_request_id: REQUEST_A,
    p_wall_id: WALL,
    p_type: "text",
    p_text: "hello world",
    p_color: "#ffe14d",
    p_anonymous: true,
    p_secret: true,
    p_rotation: 1.4,
    p_upload_ids: [],
  }, "text RPC args are normalized, exact, and contain no legacy media fields");

  const retry = prepareTextMarkSubmission({ ...draft, text: "hello world" }, first, () => REQUEST_B, () => -2);
  assert.equal(retry, first, "same semantic draft preserves the frozen request and rotation");

  const changed = prepareTextMarkSubmission({ ...draft, text: "changed" }, first, () => REQUEST_B, () => -2);
  assert.equal(changed.requestId, REQUEST_B, "changed semantic draft gets a new request identity");
  assert.equal(changed.rotation, -2);

  const lock = new TextSubmissionLock();
  assert.equal(lock.tryBegin(), true);
  assert.equal(lock.tryBegin(), false, "a second dispatch is denied while the RPC is in flight");
  let discardAttempts = 0;
  let semanticMutations = 0;
  assert.equal(lock.runIntent(() => { discardAttempts += 1; }), false, "discard/navigation intent is denied in flight");
  assert.equal(lock.runIntent(() => { semanticMutations += 1; }), false, "semantic mutation is denied in flight");
  assert.equal(discardAttempts, 0);
  assert.equal(semanticMutations, 0);

  let attempts = 0;
  let rejectLostResponse!: (cause: Error) => void;
  const lostResponseRpc = async (args: ReturnType<typeof textMarkRpcArgs>) => {
    attempts += 1;
    assert.deepEqual(args, textMarkRpcArgs(first), "lost-response retry sends the exact frozen request");
    if (attempts === 1) {
      return new Promise<never>((_resolve, reject) => { rejectLostResponse = reject; });
    }
    return { status: "existing", mark_id: MARK, mark_status: "active" };
  };
  const delayedAttempt = executeTextMarkSubmission(first, lostResponseRpc);
  await Promise.resolve();
  assert.equal(lock.allowsIntent(), false, "a delayed RPC retains the intent lock");
  rejectLostResponse(new Error("response lost"));
  await assert.rejects(() => delayedAttempt, /response lost/);
  assert.equal(lock.allowsIntent(), false, "a terminal result cannot unlock before the caller handles it");
  lock.finish();
  assert.equal(lock.runIntent(() => { discardAttempts += 1; }), true, "terminal failure re-enables editing/discard");
  assert.equal(discardAttempts, 1);
  assert.equal(prepareTextMarkSubmission(draft, first, () => REQUEST_B, () => -2), first,
    "terminal failure retains the same retry identity until a semantic edit");
  assert.deepEqual(await executeTextMarkSubmission(first, lostResponseRpc), {
    status: "existing",
    markId: MARK,
    markStatus: "active",
  }, "a confirmed existing result safely closes an ambiguous first attempt");

  assert.deepEqual(parseCreateTextMarkResult({ status: "created", mark_id: MARK, mark_status: "pending" }), {
    status: "created", markId: MARK, markStatus: "pending",
  });
  assert.deepEqual(parseCreateTextMarkResult({ status: "deleted", mark_id: MARK }), { status: "deleted", markId: MARK });
  for (const status of ["invalid", "unavailable", "media_not_ready", "request_id_reused"] as const) {
    assert.deepEqual(parseCreateTextMarkResult({ status }), { status });
  }
  assert.equal(parseCreateTextMarkResult({ status: "created", mark_id: MARK, mark_status: "active", author_id: WALL }), null);
  assert.equal(parseCreateTextMarkResult({ status: "existing", mark_id: "NOT-A-UUID", mark_status: "active" }), null);
  assert.equal(parseCreateTextMarkResult({ status: "invalid", reason: "too much detail" }), null);
  assert.equal(parseCreateTextMarkResult({ status: "unknown" }), null);
  assert.match(createRequestId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

  console.log("text Mark writer contract: exact args, stable retry identity, and strict outcomes passed");
}

void main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : "text Mark writer contract failed");
  process.exitCode = 1;
});
