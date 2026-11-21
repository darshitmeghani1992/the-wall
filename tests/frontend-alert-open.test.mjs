import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { openNotificationWithoutWaitingForReceipt } from "../src/lib/notification-open.ts";

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("Alert navigation happens synchronously, even while receipt is still pending", async () => {
  const events = [];
  let finishReceipt;
  const pendingReceipt = new Promise((resolve) => { finishReceipt = resolve; });

  openNotificationWithoutWaitingForReceipt(
    () => events.push("navigation"),
    async () => {
      events.push("receipt-started");
      await pendingReceipt;
      events.push("receipt-finished");
    },
  );

  assert.deepEqual(events, ["navigation"]);
  await flush();
  assert.deepEqual(events, ["navigation", "receipt-started"]);
  finishReceipt();
  await flush();
  assert.deepEqual(events, ["navigation", "receipt-started", "receipt-finished"]);
});

test("a receipt rejection or synchronous throw cannot block navigation", async () => {
  const opened = [];
  openNotificationWithoutWaitingForReceipt(
    () => opened.push("rejection"),
    async () => { throw new Error("offline"); },
  );
  openNotificationWithoutWaitingForReceipt(
    () => opened.push("throw"),
    () => { throw new Error("storage closed"); },
  );
  await flush();
  assert.deepEqual(opened, ["rejection", "throw"]);
});

test("already-read Alerts navigate without calling a receipt callback", async () => {
  let opened = 0;
  openNotificationWithoutWaitingForReceipt(() => { opened += 1; });
  await flush();
  assert.equal(opened, 1);
});

test("Alerts screen dispatches navigation independently while preserving actor and focus fences", () => {
  const screen = readFileSync(new URL("../app/(tabs)/alerts.tsx", import.meta.url), "utf8");
  const openStart = screen.indexOf("function open(notification: NotificationWithActor)");
  const renderStart = screen.indexOf("\n  return (\n", openStart);
  assert.ok(openStart >= 0 && renderStart > openStart);
  const open = screen.slice(openStart, renderStart);

  assert.match(open, /notification\.user_id !== userId/);
  assert.match(open, /const token = fence\.begin\(userId\)/);
  assert.match(open, /openNotificationWithoutWaitingForReceipt\(/);
  assert.match(open, /\(\) => router\.push\(notificationRoute\(notification\)\)/);
  assert.match(open, /notification\.read \? undefined : async \(\) =>/);
  assert.match(open, /await markNotificationRead\(token\.userId, notification\.id\)/);
  assert.match(open, /if \(!fence\.isCurrent\(token, currentUserId\.current\)\) return/);
  assert.match(open, /setItems\(\(current\) => applyNotificationReadReceipts\(current, \[readId\]\)\)/);
  assert.doesNotMatch(open, /router\.push\([^\n]+\);\s*\n\s*await markNotificationRead/);
});
