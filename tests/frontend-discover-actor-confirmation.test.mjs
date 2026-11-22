/* eslint-disable import/namespace -- Node test runner strips TypeScript. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SessionFocusFence } from "../src/lib/session-generation.ts";

const source = readFileSync(new URL("../app/(tabs)/discover.tsx", import.meta.url), "utf8");

test("Discover remounts private relationship, search and draft state when actor changes", () => {
  assert.match(source, /const actorId = session\?\.user\.id \?\? null/);
  assert.match(source, /<DiscoverForActor key=\{actorId \?\? "signed-out"\} userId=\{actorId\}/);
  assert.match(source, /liveActorId\.current = actorId/);
  assert.match(source, /function DiscoverForActor\(/);
  assert.match(source, /const \[results, setResults\] = useState<PersonRelationship\[\]>\(\[\]\)/);
  assert.match(source, /const \[friends, setFriends\] = useState<PersonRelationship\[\]>\(\[\]\)/);
  assert.match(source, /const \[incoming, setIncoming\] = useState<PersonRelationship\[\]>\(\[\]\)/);
});

test("Unfriend native confirmation is bound to live actor and focus lease", () => {
  assert.match(source, /const confirmationToken = actionFence\.current\.begin\(userId\)/);
  assert.match(source, /if \(!actionFence\.current\.isCurrent\(confirmationToken, liveActorId\.current\)\) return;\s*action\(\)/);
  const fence = new SessionFocusFence();
  fence.focus("actor-A");
  const confirmA = fence.begin("actor-A");
  assert.ok(confirmA);
  const canExecute = (currentActor) => fence.isCurrent(confirmA, currentActor);
  assert.equal(canExecute("actor-A"), true);
  // React render updates the shared ref before the old useFocusEffect cleanup.
  assert.equal(canExecute("actor-B"), false);
  fence.blur();
  fence.focus("actor-B");
  assert.equal(canExecute("actor-B"), false);
  fence.blur();
  fence.focus("actor-A");
  assert.equal(canExecute("actor-A"), false);
});

test("Unfriend action token cannot survive another operation or tab blur", () => {
  const fence = new SessionFocusFence();
  fence.focus("actor-A");
  const staleConfirm = fence.begin("actor-A");
  assert.ok(staleConfirm);
  const freshAction = fence.begin("actor-A");
  assert.ok(freshAction);
  assert.equal(fence.isCurrent(staleConfirm, "actor-A"), false);
  assert.equal(fence.isCurrent(freshAction, "actor-A"), true);
  fence.blur();
  assert.equal(fence.isCurrent(freshAction, "actor-A"), false);
});
