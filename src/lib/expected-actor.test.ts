import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { requireExpectedActor } from "./expected-actor.ts";

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

void verifyDelayedAccountSwitch()
  .then(() => console.log("expected actor contract: signed-out, mismatch, and delayed-switch cases passed"))
  .catch((cause) => {
    console.error(cause instanceof Error ? cause.message : "expected actor contract failed");
    process.exitCode = 1;
  });
