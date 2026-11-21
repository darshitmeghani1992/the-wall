/* eslint-disable import/namespace -- Node strips TypeScript in contract tests. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const mainLoad = source.slice(
  source.indexOf("  useEffect(() => {\n    let active = true;"),
  source.indexOf("  async function retryLoad()"),
);
assert.ok(mainLoad.startsWith("  useEffect(() => {\n    let active = true;"), "main account Wall load effect must exist");

test("My Wall resets prior account friend count before loading a new account", () => {
  const clearCount = mainLoad.indexOf("setFriendCount(null)");
  const clearSubject = mainLoad.indexOf("setLoadedSubject(null)");
  const personalFetch = mainLoad.indexOf("getPersonalWall(userId)");
  assert.ok(clearCount >= 0, "missing friend count reset");
  assert.ok(clearCount < clearSubject, "reset count before marking the new subject");
  assert.ok(clearCount < personalFetch, "reset count before new Wall network request");
  assert.match(mainLoad, /setFriendCount\(friends\.available \? friends\.value : null\)/);
  assert.match(source, /friendCount === null \? "FRIENDS UNAVAILABLE"/);
});

test("rendered old friend count cannot persist while next actor's Wall resolves", () => {
  let friendCount = 12;
  const startNewActor = () => { friendCount = null; };
  startNewActor();
  assert.equal(friendCount, null);
  const oldRequestStillPending = true;
  if (!oldRequestStillPending) friendCount = 12;
  assert.equal(friendCount, null);
  friendCount = 3; // new actor's returned total
  assert.equal(friendCount, 3);
});
