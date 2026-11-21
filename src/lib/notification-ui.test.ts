import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { appendUniqueNotifications, applyNotificationReadReceipts, relativeNotificationTime } from "./notification-ui.ts";

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

test("overlapping or duplicated Alert pages never render the same Alert twice", () => {
  const oldest = { id: "oldest", read: false };
  const boundary = { id: "boundary", read: true };
  const one = { id: "one", read: false };
  const two = { id: "two", read: false };
  const original = [boundary, oldest];

  const merged = appendUniqueNotifications(original, [
    boundary, one, one, two, two, oldest,
  ]);
  assert.deepEqual(merged, [boundary, oldest, one, two]);
  assert.equal(merged[0], boundary, "the existing row object is preserved");
  assert.equal(merged[2], one, "the first copy in the incoming page is preserved");
  assert.deepEqual(original, [boundary, oldest], "the previous page remains immutable");
  assert.deepEqual(appendUniqueNotifications(merged, [one, two, one]), merged);
});

test("older Alert pages append in order without duplicate rows", () => {
  const current = [{ id: "newest", read: true }, { id: "boundary", read: true }];
  const older = [{ id: "boundary", read: true }, { id: "older", read: false }];
  assert.deepEqual(appendUniqueNotifications(current, older), [current[0], current[1], older[1]]);
});
