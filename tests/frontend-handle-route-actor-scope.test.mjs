import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { handleLinkSubjectKey, sameHandleLinkSubject } from "../src/lib/handle-link-scope.ts";

const source = readFileSync(new URL("../app/u/[handle].tsx", import.meta.url), "utf8");

test("handle-link route subjects fail closed for account, handle, reference and readiness", () => {
  const a = handleLinkSubjectKey("actor-A", "alice", null, true);
  assert.ok(a);
  assert.equal(sameHandleLinkSubject(a, a), true);
  for (const changed of [
    handleLinkSubjectKey("actor-B", "alice", null, true),
    handleLinkSubjectKey("actor-A", "bob", null, true),
    handleLinkSubjectKey("actor-A", "alice", "ref-A", true),
    handleLinkSubjectKey("actor-A", "alice", null, false),
    handleLinkSubjectKey(null, "alice", null, true),
  ]) assert.equal(sameHandleLinkSubject(a, changed), false);
  assert.equal(sameHandleLinkSubject(undefined, a), false);
  assert.equal(sameHandleLinkSubject(null, null), false);
  assert.equal(sameHandleLinkSubject("", a), false);
});

test("deferred and ordinary handle results are rendered only for the current subject", () => {
  assert.match(source, /subjectKey = handleLinkSubjectKey\(session\?\.user\.id, clean, reference, accountRoute === "ready"\)/);
  assert.match(source, /currentSubjectKey\.current = subjectKey/);
  assert.match(source, /sameHandleLinkSubject\(capturedSubjectKey, currentSubjectKey\.current\)/);
  assert.match(source, /setResolvedView\(\{ subjectKey: capturedSubjectKey, status: "target", href: resolution\.href \}\)/);
  assert.match(source, /sameHandleLinkSubject\(resolvedView\?\.subjectKey, subjectKey\) \? resolvedView : null/);
  assert.match(source, /visibleView\?\.status === "target"/);
  assert.match(source, /visibleView\?\.status === "retryable"/);
  assert.match(source, /visibleView\?\.status === "not_found"/);
  assert.match(source, /sameHandleLinkSubject\(attempt\?\.subjectKey, subjectKey\)/);
  assert.match(source, /if \(reference && !activeAttempt\) return <Spinner/);
  assert.match(source, /if \(!sameHandleLinkSubject\(subjectKey, currentSubjectKey\.current\)\) return/);
  assert.doesNotMatch(source, /if \(target\) return <Redirect/);
});
