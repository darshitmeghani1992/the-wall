import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Alert queries and receipts are bound to the expected authenticated recipient", () => {
  const source = read("src/lib/notifications.ts");
  assert.match(source, /listNotifications\(expectedActorId/);
  assert.match(source, /markNotificationRead\([\s\S]*expectedActorId/);
  assert.match(source, /markAllNotificationsRead\(expectedActorId/);
  assert.equal((source.match(/requireExpectedActor\(/g) ?? []).length, 3);
  assert.match(source, /\.eq\("id", notificationId\)[\s\S]*\.eq\("user_id", userId\)[\s\S]*\.select\("id"\)/);
  assert.match(source, /requireMutationRow\(data, "That Alert is no longer available\."\)/);
  assert.match(source, /\.eq\("user_id", userId\)[\s\S]*\.eq\("read", false\)[\s\S]*\.select\("id"\)/);
});

test("Alerts reconcile only returned receipt IDs while the account fence is current", () => {
  const screen = read("app/(tabs)/alerts.tsx");
  assert.match(screen, /await markAllNotificationsRead\(token\.userId\)/);
  assert.match(screen, /await markNotificationRead\(token\.userId, notification\.id\)/);
  assert.equal((screen.match(/applyNotificationReadReceipts/g) ?? []).length, 3);
  assert.match(screen, /if \(!fence\.isCurrent\(token, currentUserId\.current\)\) return;[\s\S]*setItems/);
  assert.match(screen, /relativeNotificationTime/);
});

test("the empty Alerts state provides approved forward actions", () => {
  const screen = read("app/(tabs)/alerts.tsx");
  assert.match(screen, /No Alerts yet/);
  assert.match(screen, /label="Go to My Wall"[\s\S]*router\.push\("\/\(tabs\)\/home"\)/);
  assert.match(screen, /label="Discover people"[\s\S]*router\.push\("\/\(tabs\)\/discover"\)/);
});
