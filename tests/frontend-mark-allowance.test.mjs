import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SessionFocusFence } from "../src/lib/session-generation.ts";
import { TargetRouteFence } from "../src/lib/relationship-ui.ts";

const modal = readFileSync(new URL("../src/components/marks/MarkDetailModal.tsx", import.meta.url), "utf8");

test("removal allowance checks are tied to account, Mark and request generation", () => {
  const start = modal.indexOf("  async function loadAllowance()");
  const end = modal.indexOf("  async function run(", start);
  assert.ok(start >= 0 && end > start, "allowance function must remain defined before guarded Mark actions");
  const code = modal.slice(start, end);

  assert.match(code, /const subjectToken = subjectFence\.current\.begin\(viewerId\)/);
  assert.match(code, /const markToken = markFence\.current\.capture\(markId\)/);
  assert.match(code, /const requestToken = \+\+allowanceRequest\.current/);
  assert.match(code, /requestToken === allowanceRequest\.current\s*&& subjectFence\.current\.isCurrent\(subjectToken, currentViewerId\.current\)\s*&& markFence\.current\.isCurrent\(markToken, currentMarkId\.current\)/);
  assert.match(code, /const count = await remainingNormalRemovals\(subjectToken\.userId\);\s*if \(isCurrent\(\)\) setRemaining\(count\)/);
  assert.match(code, /catch \{\s*if \(isCurrent\(\)\) \{\s*setRemaining\(null\);\s*setError\(/);
  assert.match(code, /finally \{\s*if \(isCurrent\(\)\) setAllowanceLoading\(false\)/);
});

test("every entry refreshes allowance and leaving panel invalidates pending response", () => {
  const go = modal.slice(modal.indexOf("  function go("), modal.indexOf("  async function loadAllowance()"));
  assert.match(go, /if \(next === "remove" && viewerId\) \{[\s\S]*setRemaining\(null\);\s*void loadAllowance\(\)/);
  assert.match(go, /else \{[\s\S]*allowanceRequest\.current \+= 1;\s*setAllowanceLoading\(false\)/);
  assert.match(modal, /activeMarkFence\.focus\(mark\?\.id \?\? null\);[\s\S]*allowanceRequest\.current \+= 1/);
});

test("captured allowance completion cannot cross user switches, target switches or unmount", async () => {
  const user = new SessionFocusFence();
  const target = new TargetRouteFence();
  user.focus("account-A");
  target.focus("mark-X");
  const u = user.begin("account-A");
  const m = target.capture("mark-X");
  assert.ok(u && m);
  const current = (userId, markId) => user.isCurrent(u, userId) && target.isCurrent(m, markId);
  assert.equal(current("account-A", "mark-X"), true);

  await Promise.resolve();
  target.focus("mark-Y");
  assert.equal(current("account-A", "mark-Y"), false);
  user.focus("account-B");
  assert.equal(current("account-B", "mark-Y"), false);
  user.blur();
  target.blur();
  assert.equal(current("account-B", "mark-Y"), false);
});

test("a newer same-account request supersedes older allowance completion", () => {
  const user = new SessionFocusFence();
  const target = new TargetRouteFence();
  user.focus("account-A");
  target.focus("mark-X");
  const previous = user.begin("account-A");
  const markToken = target.capture("mark-X");
  const latest = user.begin("account-A");
  assert.ok(previous && latest && markToken);
  assert.equal(user.isCurrent(previous, "account-A"), false);
  assert.equal(user.isCurrent(latest, "account-A"), true);
});
