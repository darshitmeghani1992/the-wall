import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the built-in module import.
import { readFileSync } from "node:fs";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { mapActorBoundMutationError, requireExpectedActor } from "./expected-actor.ts";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { executeAccountDeactivation, executeAccountReactivation, executeMarkRemoval, executeProfileUpdate } from "./actor-bound-service-contract.ts";

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

const serverMismatch = mapActorBoundMutationError({ message: "ACTOR_MISMATCH", code: "42501" });
assert.ok(serverMismatch instanceof Error);
assert.equal(serverMismatch.message, "Your session changed. Please try again.");
const unrelatedServerError = { message: "MARK_REMOVAL_QUOTA", code: "P0001" };
assert.equal(
  mapActorBoundMutationError(unrelatedServerError),
  unrelatedServerError,
  "non-actor server errors retain their original object and behavior",
);
const spoofedMessage = { message: "ACTOR_MISMATCH", code: "P0001" };
assert.equal(
  mapActorBoundMutationError(spoofedMessage),
  spoofedMessage,
  "the session-changed copy requires both the exact server state and message",
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

async function verifyDelayedProfileUpdate(): Promise<void> {
  let currentActorId = "user-a";
  let releaseActor!: () => void;
  const delayedActor = new Promise<void>((resolve) => { releaseActor = resolve; });
  const updates: { actorId: string; name: string }[] = [];
  const operation = executeProfileUpdate("user-a", { name: "Alice" }, {
    getActorId: async () => {
      await delayedActor;
      return currentActorId;
    },
    update: async (actorId, patch) => {
      updates.push({ actorId, name: patch.name });
      return patch;
    },
  });

  currentActorId = "user-b";
  releaseActor();
  await assert.rejects(operation, /session changed/i, "profile update rejects a delayed account switch");
  assert.deepEqual(updates, [], "profile update never reaches storage after the account switches");
}

async function verifyProfileActorPropagation(): Promise<void> {
  const updates: { actorId: string; bio: string }[] = [];
  await executeProfileUpdate("user-a", { bio: "Hello" }, {
    getActorId: async () => "user-a",
    update: async (actorId, patch) => {
      updates.push({ actorId, bio: patch.bio });
      return patch;
    },
  });
  assert.deepEqual(updates, [{ actorId: "user-a", bio: "Hello" }]);
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

async function verifyAccountActorPropagation(): Promise<void> {
  const calls: string[] = [];
  await executeAccountDeactivation("user-a", {
    getActorId: async () => "user-a",
    deactivate: async (actorId) => { calls.push(actorId); },
  });
  assert.deepEqual(calls, ["user-a"], "the preflight-confirmed actor reaches the deactivation RPC port");
}

async function verifyDelayedAccountReactivation(): Promise<void> {
  const expectedActorId = "user-a";
  let currentActorId = expectedActorId;
  let releaseActor!: () => void;
  let mutationCalls = 0;
  const delayedActor = new Promise<void>((resolve) => { releaseActor = resolve; });

  const operation = executeAccountReactivation(expectedActorId, {
    getActorId: async () => {
      await delayedActor;
      return currentActorId;
    },
    reactivate: async () => { mutationCalls += 1; },
  });

  currentActorId = "user-b";
  releaseActor();
  await assert.rejects(operation, /session changed/i, "reactivation rejects a delayed account switch");
  assert.equal(mutationCalls, 0, "reactivation never reaches its RPC after the account switches");
}

async function verifyReactivationActorPropagation(): Promise<void> {
  const calls: string[] = [];
  await executeAccountReactivation("user-a", {
    getActorId: async () => "user-a",
    reactivate: async (actorId) => { calls.push(actorId); },
  });
  assert.deepEqual(calls, ["user-a"], "the preflight-confirmed actor reaches the reactivation RPC port");
}

async function verifyDelayedSafetyRemoval(): Promise<void> {
  const expectedActorId = "user-a";
  let currentActorId = expectedActorId;
  let releaseActor!: () => void;
  const delayedActor = new Promise<void>((resolve) => { releaseActor = resolve; });
  const removals: { actorId: string; markId: string; reason: string }[] = [];

  const operation = executeMarkRemoval(
    expectedActorId,
    "mark-1",
    "safety",
    {
      getActorId: async () => {
        await delayedActor;
        return currentActorId;
      },
      remove: async (actorId, markId, reason) => {
        removals.push({ actorId, markId, reason });
      },
    },
  );

  currentActorId = "user-b";
  releaseActor();
  await assert.rejects(operation, /session changed/i, "safety removal rejects a delayed account switch");
  assert.deepEqual(removals, [], "safety removal never reaches its update after the account switches");
}

async function verifyMarkActorPropagation(): Promise<void> {
  const removals: { actorId: string; markId: string; reason: string }[] = [];
  const port = {
    getActorId: async () => "user-a",
    remove: async (actorId: string, markId: string, reason: "normal" | "safety") => {
      removals.push({ actorId, markId, reason });
    },
  };

  await executeMarkRemoval("user-a", "mark-normal", "normal", port);
  await executeMarkRemoval("user-a", "mark-safety", "safety", port);
  assert.deepEqual(removals, [
    { actorId: "user-a", markId: "mark-normal", reason: "normal" },
    { actorId: "user-a", markId: "mark-safety", reason: "safety" },
  ], "normal and safety removals bind the same confirmed actor into the RPC port");
}

const accountSource = readFileSync("src/lib/account.ts", "utf8");
assert.match(accountSource, /rpc\("deactivate_account", \{ p_expected_actor_id: actorId \}\)/);
assert.doesNotMatch(
  accountSource,
  /\.rpc\((["'])deactivate_account\1\s*\)/,
  "deactivation cannot fall back to the retired parameterless RPC",
);
assert.match(accountSource, /throw mapActorBoundMutationError\(error\)/);
assert.match(accountSource, /rpc\("reactivate_account", \{ p_expected_actor_id: actorId \}\)/);
assert.doesNotMatch(
  accountSource,
  /\.rpc\((["'])reactivate_account\1\s*\)/,
  "reactivation cannot fall back to the retired parameterless RPC",
);
const marksSource = readFileSync("src/lib/marks.ts", "utf8");
const removeMarkSource = marksSource.slice(
  marksSource.indexOf("export async function removeMark("),
  marksSource.indexOf("export async function remainingNormalRemovals("),
);
assert.match(removeMarkSource, /rpc\("remove_mark", \{/);
assert.match(removeMarkSource, /p_expected_actor_id: actorId/);
assert.match(removeMarkSource, /p_mark_id: targetMarkId/);
assert.match(removeMarkSource, /p_reason: removalReason/);
assert.match(removeMarkSource, /throw mapActorBoundMutationError\(error\)/);
assert.doesNotMatch(removeMarkSource, /\.from\("marks"\)/, "removal cannot fall back to a direct table update");
const profilesSource = readFileSync("src/lib/profiles.ts", "utf8");
assert.match(profilesSource, /executeProfileUpdate\(expectedActorId, patch/);
assert.match(profilesSource, /\.eq\("id", actorId\)/);
const uploadSource = readFileSync("src/lib/upload.ts", "utf8");
assert.match(uploadSource, /uploadProfileImage/);
assert.match(uploadSource, /runExpectedActorMutation\(/);
assert.match(uploadSource, /`avatars\/\$\{actorId\}`/);

void Promise.all([
  verifyDelayedAccountSwitch(),
  verifyDelayedProfileUpdate(),
  verifyProfileActorPropagation(),
  verifyDelayedAccountDeactivation(),
  verifyAccountActorPropagation(),
  verifyDelayedAccountReactivation(),
  verifyReactivationActorPropagation(),
  verifyDelayedSafetyRemoval(),
  verifyMarkActorPropagation(),
])
  .then(() => console.log(
    "expected actor contract: preflight/server mismatch, RPC propagation, and delayed-switch cases passed",
  ))
  .catch((cause) => {
    console.error(cause instanceof Error ? cause.message : "expected actor contract failed");
    process.exitCode = 1;
  });
