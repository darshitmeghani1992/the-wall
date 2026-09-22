import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { PEOPLE_SEARCH_MAX_LENGTH, TargetRouteFence, classifyOtherWallAvailability, contributionUnavailableCopy, friendActionsFor, isFollowEligible, normalizePeopleSearchQuery, toIlikeContainsPattern } from "./relationship-ui.ts";

assert.equal(normalizePeopleSearchQuery("  @Darsh  "), "Darsh");
assert.equal(
  Array.from(normalizePeopleSearchQuery("a".repeat(PEOPLE_SEARCH_MAX_LENGTH + 5))).length,
  PEOPLE_SEARCH_MAX_LENGTH,
  "search input is bounded before querying",
);

const targetFence = new TargetRouteFence();
targetFence.focus("person-a");
const deferredUnfriend = targetFence.capture("person-a")!;
assert.equal(targetFence.isCurrent(deferredUnfriend, "person-a"), true);
targetFence.focus("person-b");
assert.equal(
  targetFence.isCurrent(deferredUnfriend, "person-b"),
  false,
  "a deferred confirm opened for A cannot act after same-user navigation to B",
);
assert.equal(targetFence.capture("person-a"), null, "the old target cannot recapture on B's route");

assert.equal(classifyOtherWallAvailability({ readFailed: true, hasReadableWall: false, hasCapabilities: false }), "unavailable");
assert.equal(classifyOtherWallAvailability({ readFailed: false, hasReadableWall: false, hasCapabilities: false }), "private");
assert.equal(classifyOtherWallAvailability({ readFailed: false, hasReadableWall: true, hasCapabilities: false }), "unavailable");
assert.equal(classifyOtherWallAvailability({ readFailed: false, hasReadableWall: true, hasCapabilities: true }), "available");
assert.equal(toIlikeContainsPattern("50%_real\\name"), "%50\\%\\_real\\\\name%", "wildcards are literal");

assert.deepEqual(friendActionsFor("none").map((action) => action.kind), ["send"]);
assert.deepEqual(friendActionsFor("outgoing").map((action) => action.kind), ["cancel"]);
assert.deepEqual(friendActionsFor("incoming").map((action) => action.kind), ["accept", "decline"]);
assert.deepEqual(friendActionsFor("friends").map((action) => action.kind), ["unfriend"]);

assert.equal(isFollowEligible("public"), true);
assert.equal(isFollowEligible("private"), false);
assert.equal(contributionUnavailableCopy("friends", "incoming"), "Accept their friend request to leave a Mark.");
assert.equal(
  contributionUnavailableCopy("selected", "friends"),
  "Only people approved by the Wall owner can leave Marks here.",
);

console.log("relationship UI contract: bounded search, actions, follow, and contribution copy passed");
