import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modal = readFileSync(new URL(
  "../src/components/marks/MarkDetailModal.tsx", import.meta.url,
), "utf8");

test("Mark edit and delete route through the guarded action before applying success", () => {
  assert.match(modal, /async function saveEdit\(\)[\s\S]*?await run\(async \(isCurrent\) => \{\s*await editMarkText\(markId, next\);\s*if \(!isCurrent\(\)\) return;\s*onMarkUpdated\(markId, next\);\s*if \(isCurrent\(\)\) setPanel\("detail"\);/);
  assert.match(modal, /async function confirmDelete\(\) \{\s*await run\(async \(isCurrent\) => \{\s*await deleteMark\(markId\);\s*if \(!isCurrent\(\)\) return;\s*onMarkRemoved\(markId\);\s*if \(isCurrent\(\)\) onClose\(\);/);
});

test("Mark actions reserve the request synchronously and fence failures and cleanup", () => {
  const start = modal.indexOf("  async function run(");
  const end = modal.indexOf("  async function saveEdit()", start);
  assert.ok(start >= 0 && end > start);
  const run = modal.slice(start, end);

  assert.match(run, /if \(!viewerId \|\| actionInFlight\.current\) return;/);
  assert.match(run, /subjectFence\.current\.isCurrent\(subjectToken, currentViewerId\.current\)\s*&& markFence\.current\.isCurrent\(markToken, currentMarkId\.current\)/);
  assert.match(run, /actionInFlight\.current = true;\s*setBusy\(true\);\s*setError\(null\);\s*try \{\s*await action\(isCurrent\)/);
  assert.match(run, /catch \(cause\) \{\s*if \(isCurrent\(\)\) setError\(errorMessage\(cause\)\);/);
  assert.match(run, /finally \{\s*if \(isCurrent\(\)\) \{\s*actionInFlight\.current = false;\s*setBusy\(false\);/);
});
