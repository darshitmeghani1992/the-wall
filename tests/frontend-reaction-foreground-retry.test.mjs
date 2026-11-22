import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ReactionRequestTracker } from "../src/lib/reaction-request-tracker.ts";

const hook = readFileSync(new URL("../src/hooks/useWallReactions.ts", import.meta.url), "utf8");

test("foreground resume reclaims visible reaction reads instead of waiting for a new Mark prop", () => {
  assert.match(hook, /import \{ AppState \} from "react-native"/);
  assert.match(hook, /const appState = useRef\(AppState\.currentState\)/);
  assert.match(hook, /AppState\.addEventListener\("change", \(nextState\) => \{/);
  assert.match(hook, /const wasActive = appState\.current === "active"/);
  assert.match(hook, /if \(nextState !== "active" \|\| wasActive\) return/);
  assert.match(hook, /sessionEpoch\.current \+= 1/);
  assert.match(hook, /requested\.current\.clear\(\)/);
  assert.match(hook, /setForegroundRefresh\(\(generation\) => generation \+ 1\)/);
  assert.match(hook, /\}, \[marks, userId, foregroundRefresh\]\)/);
  assert.match(hook, /return \(\) => subscription\.remove\(\)/);
});

test("obsolete in-flight batch cannot abandon a newer foreground retry", () => {
  const tracker = new ReactionRequestTracker();
  const initial = tracker.claim(["mark-1"]);
  assert.deepEqual(initial.ids, ["mark-1"]);
  tracker.clear();
  const retry = tracker.claim(["mark-1"]);
  assert.deepEqual(retry.ids, ["mark-1"]);
  initial.abandon();
  assert.equal(tracker.has("mark-1"), true);
  retry.abandon();
  assert.equal(tracker.has("mark-1"), false);
});
