/* eslint-disable import/namespace -- Node loads dependency-free TS directly. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sameActorScreenScope, SessionFocusFence } from "../src/lib/session-generation.ts";

const source = readFileSync(new URL("../app/delete-account.tsx", import.meta.url), "utf8");

test("deletion confirmation is mounted for one actor revision only", () => {
  assert.match(source, /key=\{scope\.revision\}/);
  assert.match(source, /liveScopeRef\.current = \{ actorId, revision: liveScopeRef\.current\.revision \+ 1 \}/);
  assert.match(source, /const \[confirmation, setConfirmation\] = useState\(""\)/);
  assert.match(source, /!isScopeCurrent\(\) \|\| confirmation !== "DELETE"/);
  assert.match(source, /requestAccountDeletion\(token\.userId, confirmation\)/);
  assert.match(source, /sameActorScreenScope\(scope, liveScopeRef\.current\)/);
});

test("old ownership alert can never navigate a different actor including A-B-A", () => {
  assert.match(source, /Review my Walls", onPress: \(\) => \{ if \(isActionCurrent\(token\)\) router\.replace/);
  const fence = new SessionFocusFence();
  const old = { actorId: "A", revision: 0 };
  let current = old;
  fence.focus("A");
  const token = fence.begin("A");
  assert.ok(token);
  const allowed = () => sameActorScreenScope(old, current) && fence.isCurrent(token, current.actorId);
  assert.equal(allowed(), true);
  current = { actorId: "B", revision: 1 };
  assert.equal(allowed(), false);
  current = { actorId: "A", revision: 2 };
  assert.equal(allowed(), false, "original confirmation must not revive on returning to A");
  fence.blur();
  fence.focus("A");
  assert.equal(allowed(), false, "old focus generation must stay invalid");
});

test("signed out and stale actor scopes cannot enable destructive confirmation", () => {
  assert.equal(sameActorScreenScope({ actorId: null, revision: 0 }, { actorId: null, revision: 0 }), false);
  assert.equal(sameActorScreenScope({ actorId: "A", revision: 0 }, { actorId: "B", revision: 0 }), false);
  assert.equal(sameActorScreenScope({ actorId: "A", revision: 0 }, { actorId: "A", revision: 1 }), false);
  assert.equal(sameActorScreenScope({ actorId: "A", revision: 3 }, { actorId: "A", revision: 3 }), true);
});
