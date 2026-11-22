import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AccountRouteFence } from "../src/lib/onboarding-contract.ts";

const source = readFileSync(new URL("../src/lib/auth.tsx", import.meta.url), "utf8");
const bootstrap = source.split("supabase.auth.getSession()")[1]?.split("const { data: sub }")[0] ?? "";
const authEvents = source.split("supabase.auth.onAuthStateChange")[1]?.split("return () => {\n      active = false;")[0] ?? "";

test("bootstrap rejects a returned Auth error and fails closed without an endless splash", () => {
  assert.match(bootstrap, /then\(async \(\{ data, error \}\) => \{/);
  assert.match(bootstrap, /if \(error\) throw error/);
  assert.match(bootstrap, /\.catch\(\(\) => \{/);
  assert.match(bootstrap, /if \(!active\) return/);
  assert.match(bootstrap, /if \(authSubjectRef\.current !== undefined\) return/);
  assert.match(bootstrap, /setSession\(null\);[\s\S]*?setAccountRoute\(null\);[\s\S]*?setProfile\(null\);[\s\S]*?setLoading\(false\)/);
  assert.match(bootstrap, /authSubjectRef\.current = null;\s*currentRouteFence\.invalidate\(null\);\s*setSession\(null\)/);
  assert.doesNotMatch(bootstrap, /console\.(log|error)/);
});

test("deferred intent ownership is fenced before the bootstrap's first await", () => {
  const fence = bootstrap.indexOf("initialToken = currentRouteFence.begin(initialSubject)");
  const reconcile = bootstrap.indexOf("await reconcileDeferredDestinationIdentity");
  assert.ok(fence > 0 && reconcile > fence);
  assert.match(bootstrap, /currentRouteFence\.isCurrent\(initialToken, authSubjectRef\.current \?\? null\)/);
});

test("a delayed bootstrap failure cannot overwrite a newer A-to-B-to-A event", () => {
  const fence = new AccountRouteFence();
  const bootstrapA = fence.begin("A");
  fence.begin("B");
  const replacementA = fence.begin("A");
  assert.equal(fence.isCurrent(bootstrapA, "A"), false);
  assert.equal(fence.isCurrent(replacementA, "A"), true);
  assert.match(bootstrap, /if \(!currentRouteFence\.isCurrent\(initialToken, authSubjectRef\.current \?\? null\)\) return/);
});

test("auth event destination-reconciliation failure also fails closed if it still owns the event", () => {
  assert.match(authEvents, /try \{\s*await reconcileDeferredDestinationIdentity\(/);
  assert.match(authEvents, /\} catch \{[\s\S]*?currentRouteFence\.isCurrent\(eventToken, authSubjectRef\.current \?\? null\)/);
  assert.match(authEvents, /setSession\(null\);[\s\S]*?setAccountRoute\(null\);[\s\S]*?setProfile\(null\);[\s\S]*?setLoading\(false\)/);
  assert.match(authEvents, /authSubjectRef\.current = null;\s*currentRouteFence\.invalidate\(null\);\s*setSession\(null\)/);
  assert.match(authEvents, /if \(!currentRouteFence\.isCurrent\(eventToken, authSubjectRef\.current \?\? null\)\) return/);
});
