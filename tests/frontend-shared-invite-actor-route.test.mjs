import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sharedInviteSubjectKey, sameSharedInviteSubject } from "../src/lib/shared-invite-scope.ts";

const source = readFileSync(new URL("../app/shared/invite/[id].tsx", import.meta.url), "utf8");

test("invitation preview subject tracks viewer, Wall, deferred reference and readiness", () => {
  const a = sharedInviteSubjectKey("actor-A", "wall-X", "ref-1", true);
  assert.ok(a);
  assert.equal(sameSharedInviteSubject(a, a), true);
  for (const next of [
    sharedInviteSubjectKey("actor-B", "wall-X", "ref-1", true),
    sharedInviteSubjectKey("actor-A", "wall-Y", "ref-1", true),
    sharedInviteSubjectKey("actor-A", "wall-X", "ref-2", true),
    sharedInviteSubjectKey("actor-A", "wall-X", "ref-1", false),
    sharedInviteSubjectKey(null, "wall-X", "ref-1", true),
    sharedInviteSubjectKey("actor-A", "", "ref-1", true),
  ]) assert.equal(sameSharedInviteSubject(a, next), false);
  assert.equal(sameSharedInviteSubject(null, null), false);
});

test("invite identity-bound reads and confirmation never use previous account or Wall", () => {
  assert.match(source, /claimedReference\.current === subjectKey/);
  assert.match(source, /subjectKey,\s*token: claimDeferredAttemptReference/);
  assert.match(source, /sameSharedInviteSubject\(requestedSubjectKey, currentSubjectKey\.current\)/);
  assert.match(source, /setLoadedSubjectKey\(requestedSubjectKey\)/);
  assert.match(source, /sameSharedInviteSubject\(loadedSubjectKey, subjectKey\)/);
  assert.match(source, /if \(reference && !activeAttempt\)/);
  assert.match(source, /const token = mutationFence\.begin\(userId\)/);
  assert.match(source, /mutationFence\.isCurrent\(token, currentUserId\.current\)/);
  assert.match(source, /mutationFence\.blur\(\)/);
  assert.doesNotMatch(source, /if \(reference && deferredAttempt\?\.reference/);
});
