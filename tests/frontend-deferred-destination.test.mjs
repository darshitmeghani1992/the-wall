import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("native intents have one interception boundary and never add a parallel Linking listener", () => {
  const nativeIntent = read("app/+native-intent.ts");
  const auth = read("src/lib/auth.tsx");
  assert.match(nativeIntent, /captureDeferredDestinationUrl/);
  assert.match(nativeIntent, /isAuthCallbackIntent/);
  assert.match(nativeIntent, /return "\/"/);
  assert.doesNotMatch(auth, /Linking\.getInitialURL|Linking\.addEventListener/);
});

test("identity reconciliation finishes before a replacement session is exposed", () => {
  const auth = read("src/lib/auth.tsx");
  const reconcile = auth.indexOf("await reconcileDeferredDestinationIdentity");
  const sessionExposure = auth.indexOf("setSession(s);", reconcile);
  assert.ok(reconcile >= 0 && sessionExposure > reconcile);
  assert.match(auth, /clearDeferredDestinationForExplicitSignOut/);
  assert.match(auth, /retryDeferredDestinationSignOutScrub/);
});

test("root resume uses the exact coordinator href and handles in-flight explicitly", () => {
  const index = read("app/index.tsx");
  assert.match(index, /prepareDeferredDestinationResume/);
  assert.match(index, /setTarget\(result\.href\)/);
  assert.match(index, /`in_flight`/);
  assert.doesNotMatch(index, /pendingLink|consumePendingLink/);
});

test("every terminal screen claims an exact one-use reference and acknowledges only after load", () => {
  for (const file of [
    "app/(tabs)/home.tsx",
    "app/person/[id].tsx",
    "app/shared/[id].tsx",
    "app/shared/invite/[id].tsx",
    "app/deferred-destination-unavailable.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /claimDeferredAttemptReference/, file);
    assert.match(source, /acknowledgeDeferred(?:Arrival|Unavailable)/, file);
    assert.match(source, /__deferred_ref/, file);
  }
  const handle = read("app/u/[handle].tsx");
  assert.match(handle, /transferDeferredHandleTarget/);
  assert.match(handle, /transferDeferredAttemptToUnavailable/);
});

test("retryable UI preserves the token while terminal outcomes transfer to generic unavailable", () => {
  for (const file of ["app/u/[handle].tsx", "app/(tabs)/home.tsx", "app/person/[id].tsx", "app/shared/[id].tsx", "app/shared/invite/[id].tsx"]) {
    const source = read(file);
    assert.match(source, /retryDeferredDestination/, file);
  }
  const unavailable = read("app/deferred-destination-unavailable.tsx");
  assert.match(unavailable, /This isn&apos;t available anymore\./);
  assert.match(unavailable, /label="My Wall"/);
  assert.match(unavailable, /label="Discover"/);
  assert.doesNotMatch(unavailable, /wallId|ownerId|markId|handle/);
});

test("all live destination families call the executable resolver boundary", () => {
  for (const file of [
    "app/u/[handle].tsx",
    "app/(tabs)/home.tsx",
    "app/person/[id].tsx",
    "app/shared/[id].tsx",
    "app/shared/invite/[id].tsx",
  ]) {
    const source = read(file);
    assert.match(source, /import \{ resolveDeferredDestination \} from "@\/lib\/deferred-destination-resolver"/, file);
    assert.match(source, /await resolveDeferredDestination\(/, file);
  }
});

test("legacy process-memory holder is removed and recovery helpers propagate query failures", () => {
  const profiles = read("src/lib/profiles.ts");
  const marks = read("src/lib/marks.ts");
  assert.match(profiles, /getProfileByHandle[\s\S]*if \(error\) throw error/);
  assert.match(profiles, /getPersonalWall[\s\S]*if \(error\) throw error/);
  assert.match(marks, /listWallMarks[\s\S]*if \(error\) throw error/);
  assert.match(marks, /getWallMark[\s\S]*if \(error\) throw error/);
  assert.match(marks, /hydrateAuthors[\s\S]*if \(error\) throw error/);
  assert.match(marks, /postgres_changes[\s\S]*try \{[\s\S]*await hydrateAuthors\(\[raw\]\)[\s\S]*\} catch \{/);
});
