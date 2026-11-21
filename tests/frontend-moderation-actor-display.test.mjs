import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screen = readFileSync(new URL("../app/moderation.tsx", import.meta.url), "utf8");

test("moderation screen gates privileged report display to exact loaded actor", () => {
  assert.match(screen, /const \[loadedActorId, setLoadedActorId\] = useState<string \| null>\(null\)/);
  assert.match(screen, /const currentActorLoaded = actorId !== null && loadedActorId === actorId/);
  assert.match(screen, /\) : loading \|\| !currentActorLoaded \? \(/);
  assert.match(screen, /setLoadedActorId\(token\.userId\)/);
  assert.match(screen, /setLoadedActorId\(null\)/);
});

test("an administrator A report is never displayed for administrator B before focus cleanup", () => {
  const visible = (isAdmin, currentActor, loadedActor) =>
    isAdmin && currentActor !== null && currentActor === loadedActor;
  assert.equal(visible(true, "admin-a", "admin-a"), true);
  assert.equal(visible(true, "admin-b", "admin-a"), false);
  assert.equal(visible(false, "user-b", "admin-a"), false);
  assert.equal(visible(true, null, "admin-a"), false);
  assert.equal(visible(true, "admin-b", "admin-b"), true);
});

test("error path marks current actor loaded so failure and retry UI remain reachable", () => {
  const catchBlock = screen.match(/} catch \(cause\) \{([\s\S]*?)\n    } finally \{/);
  assert.ok(catchBlock, "moderation main-load catch block exists");
  assert.match(catchBlock[1], /setLoadedActorId\(token\.userId\)/);
  assert.match(catchBlock[1], /setError\(cause instanceof Error/);
  assert.match(screen, /label="Try again"[^\n]+onPress=\{\(\) => void load\(\)\}/);
});
