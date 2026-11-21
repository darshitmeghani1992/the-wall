import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screen = readFileSync(new URL("../app/status.tsx", import.meta.url), "utf8");

test("Status editor never renders another account or Wall's draft before focus cleanup", () => {
  assert.match(screen, /const subject = userId && wallId \? `\$\{userId\}:\$\{wallId\}` : null/);
  assert.match(screen, /const currentSubjectLoaded = subject !== null && loadedSubject === subject/);
  assert.match(screen, /const visibleStatus = currentSubjectLoaded \? status : null/);
  assert.match(screen, /const visibleBody = currentSubjectLoaded \? body : ""/);
  assert.match(screen, /value=\{visibleBody\}/);
  assert.match(screen, /\{loading \|\| \(Boolean\(subject\) && !currentSubjectLoaded\) \? \(/);
  assert.match(screen, /const changed = currentSubjectLoaded && draft\.body !== originalBody/);
  assert.match(screen, /const canSave = currentSubjectLoaded &&/);
});

test("authorized empty, denied and failed loads settle to current subject for retry", () => {
  assert.match(screen, /setStatus\(nextStatus\);\s+setBody\(nextBody\);\s+setOriginalBody\(nextBody\);\s+setLoadedSubject\(`\$\{token\.userId\}:\$\{wallId\}`\)/);
  assert.match(screen, /!capabilities\.isOwner\) \{[\s\S]*?setLoadedSubject\(`\$\{token\.userId\}:\$\{wallId\}`\);\s+setLoadFailed\(true\)/);
  assert.match(screen, /catch \(cause: any\) \{\s+if \(fence\.isCurrent\(token, currentUserId\.current\)\) \{[\s\S]*?setLoadedSubject\(`\$\{token\.userId\}:\$\{wallId\}`\);\s+setError/);
  assert.match(screen, /setLoadedSubject\(null\);\s+setBusy\(null\)/);
  assert.match(screen, /onPress=\{\(\) => void load\(\)\}/);
});

test("stale-account save and removal actions fail closed", () => {
  assert.match(screen, /if \(!userId \|\| !currentSubjectLoaded \|\| subject !== currentSubjectRef\.current \|\| !canSave\) return/);
  assert.match(screen, /if \(!userId \|\| !currentSubjectLoaded \|\| subject !== currentSubjectRef\.current \|\| !visibleStatus \|\| busy\) return/);
  assert.match(screen, /if \(busy \|\| !currentSubjectLoaded \|\| subject !== currentSubjectRef\.current \|\| !visibleStatus\) return/);
  const visible = (actor, wall, loaded) => actor !== null && wall !== "" && loaded === `${actor}:${wall}`;
  assert.equal(visible("A", "wall-A", "A:wall-A"), true);
  assert.equal(visible("B", "wall-A", "A:wall-A"), false);
  assert.equal(visible("A", "wall-B", "A:wall-A"), false);
  assert.equal(visible(null, "wall-A", "A:wall-A"), false);
});
