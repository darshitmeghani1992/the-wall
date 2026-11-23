/* eslint-disable import/namespace -- Node strips TypeScript at test runtime. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { pendingSharedInviteArrivalToken } from "../src/lib/shared-invite-scope.ts";

test("a consumed deferred invitation can refresh while a different claim still requires its lease", () => {
  assert.equal(pendingSharedInviteArrivalToken(null, null), null);
  assert.equal(pendingSharedInviteArrivalToken("first-claim", null), "first-claim");
  assert.equal(pendingSharedInviteArrivalToken("first-claim", "first-claim"), null);
  assert.equal(pendingSharedInviteArrivalToken("new-claim", "first-claim"), "new-claim");
  assert.equal(pendingSharedInviteArrivalToken(null, "first-claim"), null);
});

test("the invitation screen uses the arrival distinction for both fresh reads and the Retry action", () => {
  const route = readFileSync(new URL("../app/shared/invite/[id].tsx", import.meta.url), "utf8");
  const load = route.slice(route.indexOf("  const load ="), route.indexOf("  useFocusEffect("));
  const retry = route.slice(route.indexOf("  async function retryLoad()"), route.indexOf("  if (authLoading)"));
  const pending = /pendingSharedInviteArrivalToken\(activeAttempt\?\.token \?\? null, arrivedDeferredToken\.current\)/;
  assert.match(load, pending);
  assert.match(load, /if \(next\.status === "available" && capturedDeferredToken\) \{\s*arrivedDeferredToken\.current = capturedDeferredToken;\s*setDeferredReadyToken\(capturedDeferredToken\)/);
  assert.match(retry, pending);
  assert.match(retry, /if \(captured && !await retryDeferredDestination\(captured\)\) return/);
  assert.match(retry, /if \(!sameSharedInviteSubject\(subjectKey, currentSubjectKey\.current\)\) return;\s*await load\(\)/);
});
