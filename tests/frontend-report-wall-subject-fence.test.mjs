import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screen = readFileSync(new URL("../app/report-wall/[id].tsx", import.meta.url), "utf8");

test("Shared Wall reporting UI is scoped to current actor AND target before focus effects", () => {
  assert.match(screen, /const subject = actorId && wallId \? `\$\{actorId\}:\$\{wallId\}` : null/);
  assert.match(screen, /const currentSubjectLoaded = subject !== null && loadedSubject === subject/);
  assert.match(screen, /const visibleWallName = currentSubjectLoaded \? wallName : null/);
  assert.match(screen, /const visibleError = currentSubjectLoaded \? error : null/);
  assert.match(screen, /loading \|\| \(Boolean\(subject\) && !currentSubjectLoaded\)/);
  assert.match(screen, /visibleError \|\| !visibleWallName \? \(/);
  assert.match(screen, /disabled=\{!reason \|\| !visibleWallName \|\| !currentSubjectLoaded \|\| reportSubmitted\}/);
  const visible = (actor, target, loaded) => actor !== null && target !== null && loaded === `${actor}:${target}`;
  assert.equal(visible("A", "wall-1", "A:wall-1"), true);
  assert.equal(visible("B", "wall-1", "A:wall-1"), false);
  assert.equal(visible("A", "wall-2", "A:wall-1"), false);
  assert.equal(visible(null, "wall-1", "A:wall-1"), false);
});

test("read success, no-permission, not-found, failure and retry settle only current subject", () => {
  assert.match(screen, /setLoadedSubject\(null\);\s+setWallName\(null\);\s+setLoading\(true\)/);
  assert.match(screen, /await loadSharedWallReportTarget\(targetToken\.targetId, getWall, getWallCapabilities\)[^]*?if \(!subjectFence\.current\.isCurrent[^]*?\|\| !targetFence\.current\.isCurrent[^]*?setLoadedSubject/);
  assert.match(screen, /result\.status === "ready"\) setWallName\(result\.wallName\)/);
  assert.match(screen, /visibleError\?\.status === "retryable" \? <Button label="Try again"/);
  assert.match(screen, /label="Back to Walls"/);
  assert.match(screen, /setLoadedSubject\(null\);\s+setWallName\(null\);\s+setReason\(null\)/);
  assert.match(screen, /subjectFence\.current\.blur\(\);\s+targetFence\.current\.blur\(\);\s+setLoadedSubject\(null\)/);
  assert.match(screen, /currentActorId\.current !== actorId[\s\S]*currentWallId\.current !== wallId[\s\S]*!currentSubjectLoaded/);
  assert.match(screen, /createReport\(subjectToken\.userId/);
});
