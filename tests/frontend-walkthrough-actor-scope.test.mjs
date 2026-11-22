/* eslint-disable import/namespace -- Node runner strips TypeScript. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AccountRouteFence, onboardingScreenScopeKey } from "../src/lib/onboarding-contract.ts";

const source = readFileSync(new URL("../app/(onboarding)/walkthrough.tsx", import.meta.url), "utf8");

test("tour step and finish state cannot be carried across accounts, routes or replay", () => {
  assert.match(source, /const actorId = session\?\.user\.id \?\? null/);
  assert.match(source, /liveActorId\.current = actorId/);
  assert.match(source, /onboardingScreenScopeKey\(actorId, accountRoute\)/);
  assert.match(source, /<WalkthroughEditor key=\{scopeKey\} liveActorId=\{liveActorId\}/);
  assert.match(source, /const \[index, setIndex\] = useState\(0\)/);
  assert.match(source, /const inFlight = useRef\(false\)/);
  assert.notEqual(onboardingScreenScopeKey("A", "walkthrough"), onboardingScreenScopeKey("B", "walkthrough"));
  assert.notEqual(onboardingScreenScopeKey("A", "walkthrough"), onboardingScreenScopeKey("A", "ready"));
});

test("delayed tour completion and navigation require live actor at every async checkpoint", () => {
  assert.match(source, /if \(inFlight\.current \|\| userId !== liveActorId\.current\) return/);
  assert.match(source, /if \(!lifecycleFence\.current\.isCurrent\(token, liveActorId\.current\)\) return/);
  assert.match(source, /if \(liveActorId\.current === userId\)/);
  const fence = new AccountRouteFence();
  const first = fence.begin("actor-A");
  assert.equal(fence.isCurrent(first, "actor-A"), true);
  assert.equal(fence.isCurrent(first, "actor-B"), false);
  fence.invalidate("actor-B");
  const second = fence.begin("actor-B");
  assert.equal(fence.isCurrent(first, "actor-A"), false);
  assert.equal(fence.isCurrent(second, "actor-B"), true);
  fence.invalidate("actor-A");
  assert.equal(fence.isCurrent(second, "actor-B"), false);
});

test("replay remains presentation-only and cannot persist onboarding", () => {
  assert.match(source, /if \(!walkthroughRequiresPersistence\(isReplay\)\)/);
  assert.match(source, /if \(accountRoute && !routeAllowed\) return <Redirect href="\/" \/>/);
});
