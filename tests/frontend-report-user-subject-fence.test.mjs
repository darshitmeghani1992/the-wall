import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/report-user/[id].tsx", import.meta.url), "utf8");

test("report person form hides old reason, details, block and receipt state before focus", () => {
  assert.match(source, /const subject = actorId && targetId \? `\$\{actorId\}:\$\{targetId\}` : null/);
  assert.match(source, /const currentSubjectLoaded = subject !== null && loadedSubject === subject/);
  assert.match(source, /setLoadedSubject\(null\);\s+setReason\(null\);\s+setDetails\(""\)/);
  assert.match(source, /setReportSubmitted\(false\);\s+setLoadedSubject\(subject\)/);
  assert.match(source, /!currentSubjectLoaded \? \(\s*<ActivityIndicator accessibilityLabel="Loading report form"/);
  assert.match(source, /setLoadedSubject\(null\);\s+\};\s+\}, \[actorId, targetId, subject\]\)/);
  const visible = (actor, target, loaded) => actor !== null && target !== null && loaded === `${actor}:${target}`;
  assert.equal(visible("A", "person-X", "A:person-X"), true);
  assert.equal(visible("B", "person-X", "A:person-X"), false);
  assert.equal(visible("A", "person-Y", "A:person-X"), false);
  assert.equal(visible(null, "person-X", "A:person-X"), false);
});

test("stale report and block event handlers cannot submit another session's context", () => {
  assert.match(source, /if \(!actorId \|\| !targetId \|\| !currentSubjectLoaded[\s\S]*currentActorId\.current !== actorId \|\| currentTargetId\.current !== targetId/);
  assert.equal((source.match(/currentSubjectLoaded && currentActorId\.current === actorId && currentTargetId\.current === targetId/g) ?? []).length, 3);
  assert.match(source, /disabled=\{!reason \|\| !currentSubjectLoaded \|\| \(reportSubmitted && !alsoBlock\)\}/);
  assert.match(source, /alreadyReported: reportSubmitted/);
  assert.match(source, /runUserReportFlow/);
  assert.match(source, /if \(subjectFence\.current\.isCurrent\(subjectToken, currentActorId\.current\)/);
});
