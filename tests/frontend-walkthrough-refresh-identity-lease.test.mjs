import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/(onboarding)/walkthrough.tsx", import.meta.url), "utf8");

test("post-refresh tour navigation is scoped to monotonic actor and replay revision", () => {
  assert.match(source, /actorRevisionRef\.current = \{ actorId, mode, revision: actorRevisionRef\.current\.revision \+ 1 \}/);
  assert.match(source, /const isActorRevisionCurrent = \(\) => liveActorId\.current === userId\s+&& actorRevisionRef\.current\.revision === actorRevision/);
  assert.match(source, /await refreshAccountRoute\(\);\s*if \(isActorRevisionCurrent\(\)\)/);
  assert.match(source, /catch \(cause: any\) \{\s*if \(isActorRevisionCurrent\(\)\)/);
  assert.match(source, /finally \{\s*if \(isActorRevisionCurrent\(\)\)/);
  const captured = { actorId: "A", mode: "first-use", revision: 0 };
  let current = captured;
  const canNavigate = () => captured.actorId === current.actorId && captured.revision === current.revision;
  assert.equal(canNavigate(), true, "same actor can navigate after route becomes ready");
  current = { actorId: "B", mode: "first-use", revision: 1 };
  assert.equal(canNavigate(), false);
  current = { actorId: "A", mode: "first-use", revision: 2 };
  assert.equal(canNavigate(), false, "A -> B -> A may not revive old callback");
  current = { actorId: "A", mode: "replay", revision: 3 };
  assert.equal(canNavigate(), false, "replay mode switch must not revive old callback");
});
