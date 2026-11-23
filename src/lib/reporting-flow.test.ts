import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { loadSharedWallReportTarget, runUserReportFlow } from "./reporting-flow.ts";

const base = () => ({
  expectedActorId: "actor-a",
  targetUserId: "target-a",
  reason: "harassment" as const,
  details: "details",
  alreadyReported: false,
  blockAfterReport: true,
});

test("report-and-block runs in order and completes once", async () => {
  const events: string[] = [];
  await runUserReportFlow({
    ...base(),
    isCurrent: () => true,
    createReport: async (actor, input) => { events.push(`report:${actor}:${input.userId}`); },
    blockUser: async (actor, target) => { events.push(`block:${actor}:${target}`); },
    onReportSubmitted: () => events.push("reported"),
    onComplete: (blocked) => events.push(`complete:${blocked}`),
    onBlockError: () => events.push("block-error"),
    onError: () => events.push("error"),
    onFinally: () => events.push("finally"),
  });
  assert.deepEqual(events, [
    "report:actor-a:target-a",
    "reported",
    "block:actor-a:target-a",
    "complete:true",
    "finally",
  ]);
});

test("report failure never attempts a block", async () => {
  let blocks = 0;
  let errors = 0;
  await runUserReportFlow({
    ...base(),
    isCurrent: () => true,
    createReport: async () => { throw new Error("report failed"); },
    blockUser: async () => { blocks += 1; },
    onReportSubmitted: () => undefined,
    onComplete: () => undefined,
    onBlockError: () => undefined,
    onError: () => { errors += 1; },
    onFinally: () => undefined,
  });
  assert.equal(blocks, 0);
  assert.equal(errors, 1);
});

test("a block retry after partial success does not duplicate the report", async () => {
  let reports = 0;
  let blocks = 0;
  let blockErrors = 0;
  const callbacks = {
    isCurrent: () => true,
    createReport: async () => { reports += 1; },
    blockUser: async () => { blocks += 1; if (blocks === 1) throw new Error("offline"); },
    onReportSubmitted: () => undefined,
    onComplete: () => undefined,
    onBlockError: () => { blockErrors += 1; },
    onError: () => undefined,
    onFinally: () => undefined,
  };
  await runUserReportFlow({ ...base(), ...callbacks });
  await runUserReportFlow({ ...base(), ...callbacks, alreadyReported: true });
  assert.equal(reports, 1);
  assert.equal(blocks, 2);
  assert.equal(blockErrors, 1);
});

test("a stale flow has no side effects or callbacks", async () => {
  let current = true;
  const events: string[] = [];
  await runUserReportFlow({
    ...base(),
    isCurrent: () => current,
    createReport: async () => { events.push("report"); current = false; },
    blockUser: async () => { events.push("block"); },
    onReportSubmitted: () => events.push("reported"),
    onComplete: () => events.push("complete"),
    onBlockError: () => events.push("block-error"),
    onError: () => events.push("error"),
    onFinally: () => events.push("finally"),
  });
  assert.deepEqual(events, ["report"]);
});

const wall = { id: "wall", type: "shared", name: "Project Wall" };
const member = { wallType: "shared", joinState: "member" };

test("Shared Wall reporting verifies the exact Wall before showing its name", async () => {
  assert.deepEqual(
    await loadSharedWallReportTarget(wall.id, async (id) => ({ ...wall, id }), async () => member),
    { status: "ready", wallName: wall.name },
  );
  assert.equal((await loadSharedWallReportTarget("different", async () => wall, async () => member)).status, "unavailable");
  assert.equal((await loadSharedWallReportTarget(wall.id, async () => null, async () => member)).status, "unavailable");
  assert.equal((await loadSharedWallReportTarget(wall.id, async () => wall, async () => null)).status, "unavailable");
  assert.equal((await loadSharedWallReportTarget(wall.id, async () => wall, async () => ({ ...member, joinState: "owner" }))).status, "unavailable");
});

test("Shared Wall reporting can retry a failed lookup without changing targets", async () => {
  const requests: string[] = [];
  const lookup = async (id: string) => {
    requests.push(id);
    if (requests.length === 1) throw new Error("offline");
    return wall;
  };
  assert.equal((await loadSharedWallReportTarget(wall.id, lookup, async () => member)).status, "retryable");
  assert.equal((await loadSharedWallReportTarget(wall.id, lookup, async () => member)).status, "ready");
  assert.deepEqual(requests, [wall.id, wall.id]);
});
