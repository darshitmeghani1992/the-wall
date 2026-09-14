import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("Person block and unblock mutations bind actor and target and fence UI outcomes", () => {
  const source = read("../app/person/[id].tsx");

  assert.match(source, /blockUser\(subjectToken\.userId, targetId\)/);
  assert.match(source, /unblockUser\(subjectToken\.userId, targetId\)/);
  assert.ok(
    source.match(/actionFence\.current\.isCurrent\(subjectToken, currentUserId\.current\)/g)?.length >= 6,
    "success, error and finally paths retain subject checks for both actions",
  );
  assert.ok(
    source.match(/targetRouteFence\.current\.isCurrent\(targetToken, currentPersonId\.current\)/g)?.length >= 10,
    "confirmation, success, error and finally paths retain target checks",
  );
});

test("User reports bind actor and target and fence every UI outcome", () => {
  const source = read("../app/report-user/[id].tsx");

  assert.match(source, /createReport\(subjectToken\.userId,/);
  assert.ok(source.match(/subjectFence\.current\.isCurrent\(subjectToken, currentActorId\.current\)/g)?.length >= 4);
  assert.ok(source.match(/targetFence\.current\.isCurrent\(targetToken, currentTargetId\.current\)/g)?.length >= 4);
});

test("Mark reports pass the viewer captured by the open modal", () => {
  const source = read("../src/components/marks/MarkDetailModal.tsx");
  assert.match(source, /createReport\(viewerId, \{ markId, reason, details \}\)/);
});
