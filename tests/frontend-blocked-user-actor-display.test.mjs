import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screen = readFileSync(new URL("../app/blocked-users.tsx", import.meta.url), "utf8");

test("blocked-user roster is render-gated by account identity", () => {
  assert.match(screen, /const \[loadedActorId, setLoadedActorId\] = useState<string \| null>\(null\)/);
  assert.match(screen, /const currentActorLoaded = actorId !== null && loadedActorId === actorId/);
  assert.match(screen, /\{loading \|\| !currentActorLoaded \? \(/);
  assert.match(screen, /setLoadedActorId\(null\)/);
});

test("list response and failure/unavailable state are tagged to the current actor", () => {
  const loadBlock = screen.slice(screen.indexOf("const loadPage ="), screen.indexOf("useFocusEffect("));
  assert.match(loadBlock, /setNextCursor\(result.nextCursor\);\s+setLoadedActorId\(token.userId\)/);
  assert.match(loadBlock, /if \(result.status !== "available"\) \{\s+setLoadedActorId\(token.userId\)/);
  assert.match(loadBlock, /catch \(cause: any\) \{\s+if \(loadFence.current.isCurrent\(token, currentActorId.current\)\) \{\s+setLoadedActorId\(token.userId\)/);
  assert.match(screen, /label="Try again"[^\n]+onPress=\{\(\) => void loadPage\(null, false\)\}/);
});

test("cached blocked identities from account A cannot be shown while B's fetch starts", () => {
  const canDisplay = (viewer, source) => viewer !== null && source === viewer;
  assert.equal(canDisplay("a", "a"), true);
  assert.equal(canDisplay("b", "a"), false);
  assert.equal(canDisplay(null, "a"), false);
  assert.equal(canDisplay("b", null), false);
  assert.equal(canDisplay("b", "b"), true);
});
