import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { ACCOUNT_ROUTES, AccountRouteFence, DEFAULT_ONBOARDING_DRAFT, LEGACY_ONBOARDING_DESTINATION, destinationAfterWalkthrough, destinationForAccountRoute, isAccountRoute, onboardingFailureMessage, persistOnboardingInOrder, runForExpectedSubject, sanitizeOnboardingDraft, snapshotOnboardingDraft, walkthroughRequiresPersistence } from "./onboarding-contract.ts";

assert.deepEqual(
  ACCOUNT_ROUTES.map((route) => destinationForAccountRoute(route)),
  [
    "/account-unavailable",
    "/profile-setup",
    "/profile-setup",
    "/walkthrough",
    "/(tabs)/home",
    "/account-recovery",
    "/account-unavailable",
  ],
  "all seven fixed server outcomes route explicitly and inactive states fail closed",
);
assert.equal(isAccountRoute("ready"), true);
assert.equal(isAccountRoute("unexpected"), false);

assert.equal(
  destinationAfterWalkthrough("/u/maya", "discover"),
  "/u/maya",
  "pending deep-link restoration follows walkthrough and wins over onboarding intent",
);
assert.equal(destinationAfterWalkthrough(null, "discover"), "/(tabs)/discover");
assert.equal(destinationAfterWalkthrough(null, null), "/(tabs)/home");
assert.equal(LEGACY_ONBOARDING_DESTINATION, "/", "obsolete About/Interests return to the account gate");
assert.equal(walkthroughRequiresPersistence(false), true, "first-use finish and skip persist completion");
assert.equal(walkthroughRequiresPersistence(true), false, "Help replay cannot rewrite completion");

assert.deepEqual(sanitizeOnboardingDraft(null), DEFAULT_ONBOARDING_DRAFT);
assert.deepEqual(
  sanitizeOnboardingDraft({
    handle: "Maya",
    displayName: "Maya",
    bio: "b".repeat(180),
    privacy: "invalid",
    contribution: "invalid",
    allowAnonymous: "yes",
    postWalkthroughDestination: "/unsafe",
  }),
  {
    ...DEFAULT_ONBOARDING_DRAFT,
    handle: "Maya",
    displayName: "Maya",
    bio: "b".repeat(160),
  },
  "corrupt or stale drafts retain safe privacy defaults",
);

const fence = new AccountRouteFence();
const oldLoad = fence.begin("user-a");
const newLoad = fence.begin("user-a");
assert.equal(fence.isCurrent(oldLoad, "user-a"), false, "new load supersedes old response");
assert.equal(fence.isCurrent(newLoad, "user-a"), true);
fence.invalidate(null);
assert.equal(fence.isCurrent(newLoad, null), false, "sign-out rejects delayed response");
const switched = fence.begin("user-b");
assert.equal(fence.isCurrent(switched, "user-a"), false, "account switch rejects wrong subject");
const staleRefresh = fence.beginIfSubjectCurrent("user-a", "user-b");
assert.equal(staleRefresh, null, "a stale A refresh closure is classified as a no-op");
assert.equal(fence.isCurrent(switched, "user-b"), true, "stale A refresh cannot invalidate B's token");

const mutableDraft = { ...DEFAULT_ONBOARDING_DRAFT };
const submittedDraft = snapshotOnboardingDraft(mutableDraft);
mutableDraft.allowAnonymous = true;
mutableDraft.privacy = "public";
assert.equal(submittedDraft.allowAnonymous, false, "mid-flight Anonymous changes cannot alter submission");
assert.equal(submittedDraft.privacy, "private", "mid-flight privacy changes cannot alter submission");
assert.equal(
  onboardingFailureMessage({ code: "23505", message: "duplicate key", details: "profiles_handle_key" }),
  "That username is taken. Choose another and try again.",
  "the real insert constraint supplies truthful username collision copy",
);

const profileSource = readFileSync("src/lib/profiles.ts", "utf8");
const setupSource = readFileSync("app/(onboarding)/profile-setup.tsx", "utf8");
assert.doesNotMatch(profileSource, /function isHandleAvailable/, "RLS-hidden SELECT cannot claim global handle availability");
assert.doesNotMatch(setupSource, /isHandleAvailable|\.ilike\("handle"/, "setup does not infer availability from profile visibility");
assert.doesNotMatch(setupSource, /Available\s*✓/, "setup never displays an unverified availability claim");
assert.match(setupSource, /const submission = snapshotOnboardingDraft/, "Finish persists an immutable snapshot");
assert.ok((setupSource.match(/disabled=\{busy\}/g) ?? []).length >= 7, "mutable setup actions are disabled in flight");

console.log("onboarding route contract: seven states, safe drafts, destinations, and lifecycle fences passed");

async function verifyPersistenceOrder() {
  const calls: string[] = [];
  await persistOnboardingInOrder({
    persistProfile: async () => { calls.push("profile"); },
    persistWall: async () => { calls.push("wall"); },
    markComplete: async () => { calls.push("complete"); },
  });
  assert.deepEqual(calls, ["profile", "wall", "complete"]);

  const failedCalls: string[] = [];
  await assert.rejects(() => persistOnboardingInOrder({
    persistProfile: async () => { failedCalls.push("profile"); },
    persistWall: async () => { failedCalls.push("wall"); throw new Error("offline"); },
    markComplete: async () => { failedCalls.push("complete"); },
  }), /offline/);
  assert.deepEqual(failedCalls, ["profile", "wall"], "partial failure never marks onboarding complete");

  let releaseA!: () => void;
  const delayedA = new Promise<void>((resolve) => { releaseA = resolve; });
  const overlapFence = new AccountRouteFence();
  let currentSubject: string | null = "user-a";
  const eventA = overlapFence.begin(currentSubject);
  const loads: string[] = [];
  const resumeA = delayedA.then(() => {
    if (overlapFence.isCurrent(eventA, currentSubject)) loads.push("user-a");
  });
  currentSubject = "user-b";
  const eventB = overlapFence.begin(currentSubject);
  if (overlapFence.isCurrent(eventB, currentSubject)) loads.push("user-b");
  releaseA();
  await resumeA;
  assert.deepEqual(loads, ["user-b"], "delayed A cannot resume after newer B or invalidate B's route");

  let mutationCalled = false;
  await assert.rejects(
    () => runForExpectedSubject(
      "user-a",
      async () => "user-b",
      async () => { mutationCalled = true; },
    ),
    /account changed/,
  );
  assert.equal(mutationCalled, false, "A→B switch is rejected before a parameterless mutation starts");
  await runForExpectedSubject("user-a", async () => "user-a", async () => { mutationCalled = true; });
  assert.equal(mutationCalled, true, "matching subject may invoke the mutation immediately");
}

void verifyPersistenceOrder().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : "onboarding persistence test failed");
  process.exitCode = 1;
});
