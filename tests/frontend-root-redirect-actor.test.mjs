import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { visibleRedirectForActor } from "../src/lib/actor-redirect-target.ts";

const source = readFileSync(new URL("../app/index.tsx", import.meta.url), "utf8");

test("root destination belongs to the signed-in viewer that actually resolved it", () => {
  const destination = { actorId: "actor-A", href: "/person/target-A" };
  assert.equal(visibleRedirectForActor(destination, "actor-A"), "/person/target-A");
  assert.equal(visibleRedirectForActor(destination, "actor-B"), null);
  assert.equal(visibleRedirectForActor(destination, null), null);
  assert.equal(visibleRedirectForActor(destination, undefined), null);
  assert.equal(visibleRedirectForActor(null, "actor-A"), null);
});

test("a previous user's redirect never renders while a replacement session is mounting", () => {
  assert.match(source, /setTarget\(\{ actorId: subject, href: result\.href \}\)/);
  assert.match(source, /setTarget\(\{ actorId: subject, href: fallback/);
  assert.match(source, /visibleRedirectForActor\(target, session\.user\.id\)/);
  assert.match(source, /if \(visibleTarget === null\) return <Splash/);
  assert.match(source, /<Redirect href=\{visibleTarget\}/);
  assert.doesNotMatch(source, /<Redirect href=\{target\}/);
});
