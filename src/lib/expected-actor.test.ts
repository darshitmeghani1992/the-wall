import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { requireExpectedActor } from "./expected-actor.ts";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { executeAccountDeactivation, executeMarkRemoval } from "./actor-bound-service-contract.ts";

assert.equal(
  requireExpectedActor("user-a", "user-a", "signed out"),
  "user-a",
  "the account that began the mutation is accepted",
);
assert.throws(
  () => requireExpectedActor("user-a", null, "signed out"),
  /signed out/,
  "a signed-out mutation is rejected",
);
assert.throws(
  () => requireExpectedActor("user-a", "user-b", "signed out"),
  /session changed/i,
  "a mutation cannot be reassigned to another active account",
);

async function verifyDelayedAccountSwitch(): Promise<void> {
  const expectedActorId = "user-a";
  let currentActorId = expectedActorId;
  let releaseAuth!: () => void;
  const delayedAuth = new Promise<void>((resolve) => { releaseAuth = resolve; });
  const mutationFence = delayedAuth.then(() => requireExpectedActor(
    expectedActorId,
    currentActorId,
    "signed out",
  ));

  currentActorId = "user-b";
  releaseAuth();
  await assert.rejects(
    mutationFence,
    /session changed/i,
    "a delayed mutation is rejected after the account switches",
  );
}

async function verifyDelayedAccountDeactivation(): Promise<void> {
  const expectedActorId = "user-a";
  let currentActorId = expectedActorId;
  let releaseActor!: () => void;
  let mutationCalls = 0;
  const delayedActor = new Promise<void>((resolve) => { releaseActor = resolve; });

  const operation = executeAccountDeactivation(
    expectedActorId,
    {
      getActorId: async () => {
        await delayedActor;
        return currentActorId;
      },
      deactivate: async () => {
        mutationCalls += 1;
      },
    },
  );

  currentActorId = "user-b";
  releaseActor();
  await assert.rejects(operation, /session changed/i, "deactivation rejects a delayed account switch");
  assert.equal(mutationCalls, 0, "deactivation never reaches its RPC after the account switches");
}

async function verifyDelayedSafetyRemoval(): Promise<void> {
  const expectedActorId = "user-a";
  let currentActorId = expectedActorId;
  let releaseActor!: () => void;
  const delayedActor = new Promise<void>((resolve) => { releaseActor = resolve; });
  const removals: { markId: string; reason: string }[] = [];

  const operation = executeMarkRemoval(
    expectedActorId,
    "mark-1",
    "safety",
    {
      getActorId: async () => {
        await delayedActor;
        return currentActorId;
      },
      remove: async (markId, reason) => {
        removals.push({ markId, reason });
      },
    },
  );

  currentActorId = "user-b";
  releaseActor();
  await assert.rejects(operation, /session changed/i, "safety removal rejects a delayed account switch");
  assert.deepEqual(removals, [], "safety removal never reaches its update after the account switches");
}

void Promise.all([
  verifyDelayedAccountSwitch(),
  verifyDelayedAccountDeactivation(),
  verifyDelayedSafetyRemoval(),
])
  .then(() => console.log(
    "expected actor contract: signed-out, mismatch, deactivation switch, and safety-removal switch cases passed",
  ))
  .catch((cause) => {
    console.error(cause instanceof Error ? cause.message : "expected actor contract failed");
    process.exitCode = 1;
  });
