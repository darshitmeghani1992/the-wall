import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { applyNotificationReadReceipts, relativeNotificationTime } from "./notification-ui.ts";

const now = Date.parse("2026-09-17T12:00:00.000Z");

test("relative Alert time clamps future clocks and handles invalid data safely", () => {
  assert.equal(relativeNotificationTime("2026-09-17T12:01:00.000Z", now), "just now");
  assert.equal(relativeNotificationTime("not-a-date", now), "recently");
  assert.equal(relativeNotificationTime("2026-09-17T11:59:30.000Z", now), "just now");
  assert.equal(relativeNotificationTime("2026-09-17T11:42:00.000Z", now), "18m");
  assert.equal(relativeNotificationTime("2026-09-17T08:00:00.000Z", now), "4h");
  assert.equal(relativeNotificationTime("2026-09-14T12:00:00.000Z", now), "3d");
});

test("receipt reconciliation changes only exact returned unread rows", () => {
  const rows = [
    { id: "a", read: false, body: "one" },
    { id: "b", read: false, body: "two" },
    { id: "c", read: true, body: "three" },
  ];
  const next = applyNotificationReadReceipts(rows, ["b", "c", "missing"]);
  assert.deepEqual(next, [
    rows[0],
    { id: "b", read: true, body: "two" },
    rows[2],
  ]);
  assert.equal(next[0], rows[0]);
  assert.equal(next[2], rows[2]);
  assert.deepEqual(applyNotificationReadReceipts(rows, []), rows);
});

