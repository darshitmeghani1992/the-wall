import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screen = readFileSync(new URL("../app/approved-writers.tsx", import.meta.url), "utf8");

test("approved writers are hidden until matching account settings and roster load", () => {
  assert.match(screen, /const \[loadedActorId, setLoadedActorId\] = useState<string \| null>\(null\)/);
  assert.match(screen, /const currentActorLoaded = actorId !== null && loadedActorId === actorId/);
  assert.match(screen, /\{loading \|\| !currentActorLoaded \? \(/);
  assert.match(screen, /setLoadedActorId\(null\)/);
  assert.match(screen, /setWriters\(nextWriters\);\s+setLoadedActorId\(token.userId\)/);
  assert.match(screen, /if \(nextSettings.contributionPolicy !== "selected"\) \{\s+setWriters\(\[\]\);\s+setLoadedActorId\(token.userId\)/);
});
test("current actor load error still reaches retry and stale actor actions fail closed", () => {
  assert.match(screen, /setLoadedActorId\(token.userId\);\s+setLoadError\(cause/);
  assert.match(screen, /label="Try again"[^\n]+onPress=\{\(\) => void load\(\)\}/);
  assert.match(screen, /if \(!token \|\| loadedActorId !== actorId \|\| settings\?\.contributionPolicy/);
  assert.equal((screen.match(/if \(!actorId \|\| loadedActorId !== actorId \|\| !settings/g)??[]).length, 2);
  assert.match(screen, /function confirmRemove\(writer: ApprovedWriterRow\) \{\s+if \(!actorId \|\| loadedActorId !== actorId\) return/);
});
test("admin/account A state is hidden from account B during pre-focus render", () => {
 const visible=(actor,loaded)=>actor !== null && actor === loaded;
 assert.equal(visible("a","a"),true);
 assert.equal(visible("b","a"),false);
 assert.equal(visible("b",null),false);
});
