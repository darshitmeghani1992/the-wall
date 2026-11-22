/* eslint-disable import/namespace -- Node contract runner strips TS types. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SessionFocusFence } from "../src/lib/session-generation.ts";

const source = readFileSync(new URL("../app/shared/create.tsx", import.meta.url), "utf8");

test("Shared Wall creation form remounts when authenticated actor changes", () => {
  assert.match(source, /return <CreateSharedWallEditor key=\{userId \?\? "signed-out"\} userId=\{userId\} \/>/);
  assert.match(source, /function CreateSharedWallEditor\(\{ userId \}: \{ userId: string \| null \}\)/);
  const scope = (actor) => actor ?? "signed-out";
  assert.notEqual(scope("A"), scope("B"));
  assert.notEqual(scope("A"), scope(null));
  assert.equal(scope("A"), scope("A"));
});

test("submissions are actor-fenced and an old callback cannot navigate another actor", () => {
  assert.match(source, /const token = fence\.begin\(userId\)/);
  assert.match(source, /if \(!fence\.isCurrent\(token, currentUserId\.current\)\) return/);
  assert.match(source, /if \(fence\.isCurrent\(token, currentUserId\.current\)\) \{\s+endExclusiveMutation\(mutationInFlight\)/);
  const fence = new SessionFocusFence();
  fence.focus("A");
  const pending = fence.begin("A");
  assert.ok(pending);
  fence.blur();
  fence.focus("B");
  assert.equal(fence.isCurrent(pending, "B"), false);
});
