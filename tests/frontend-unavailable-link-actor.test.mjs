import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { unavailableLinkSubjectKey } from "../src/lib/unavailable-link-scope.ts";

const source = readFileSync(new URL("../app/deferred-destination-unavailable.tsx", import.meta.url), "utf8");

test("unavailable destination claim key is exact viewer + opaque reference", () => {
  const a = unavailableLinkSubjectKey("actor-A", "ref-1", true);
  assert.ok(a);
  assert.notEqual(a, unavailableLinkSubjectKey("actor-B", "ref-1", true));
  assert.notEqual(a, unavailableLinkSubjectKey("actor-A", "ref-2", true));
  assert.equal(unavailableLinkSubjectKey("actor-A", "ref-1", false), null);
  assert.equal(unavailableLinkSubjectKey(null, "ref-1", true), null);
  assert.equal(unavailableLinkSubjectKey("actor-A", null, true), null);
});

test("one-time token acknowledgement and screen are bound to the same actor/reference", () => {
  assert.match(source, /claimedSubject\.current === subjectKey/);
  assert.match(source, /setClaimed\(\{\s*subjectKey,\s*token: claimDeferredAttemptReference/);
  assert.match(source, /claimed\?\.subjectKey === subjectKey && claimed\.token/);
  assert.match(source, /claimed\?\.subjectKey !== subjectKey/);
  assert.match(source, /if \(!claimed\.token\) return <Redirect href="\/\(tabs\)\/home"/);
  assert.doesNotMatch(source, /claimedReference\.current === reference/);
});
