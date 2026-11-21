import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screen = readFileSync(new URL("../app/(tabs)/alerts.tsx", import.meta.url), "utf8");

test("Alerts screen fails closed on a pre-focus account switch and guards all visible histories", () => {
  assert.match(screen, /const currentActorLoaded = Boolean\(userId\) && loadedActorId\.current === userId/);
  assert.match(screen, /const visibleItems = currentActorLoaded \? items : \[\]/);
  assert.match(screen, /const visibleError = currentActorLoaded \? error : null/);
  assert.match(screen, /const visibleDetailsError = currentActorLoaded \? detailsError : null/);
  assert.match(screen, /const visibleOlderError = currentActorLoaded \? olderError : null/);
  assert.match(screen, /const visibleNextCursor = currentActorLoaded \? nextCursor : null/);
  assert.match(screen, /loading \|\| \(Boolean\(userId\) && !currentActorLoaded\)/);
  assert.match(screen, /visibleItems\.map\(\(notification\) =>/);
  assert.match(screen, /visibleItems\.length === 0/);

  const visible = (actor, loaded, rows) => actor && loaded === actor ? rows : [];
  const alice = [{ id: "alice-private-alert" }];
  assert.deepEqual(visible("alice", "alice", alice), alice);
  assert.deepEqual(visible("bob", "alice", alice), []);
  assert.deepEqual(visible(null, "alice", alice), []);
});

test("current actor success and failure settle separately; unread receipts remain scoped", () => {
  assert.match(screen, /loadedActorId\.current = null;\s+setItems\(\[\]\);\s+setNextCursor\(null\)/);
  assert.match(screen, /loadedActorId\.current = token\.userId;\s+setItems\(page\.items\)/);
  assert.match(screen, /if \(fence\.isCurrent\(token, currentUserId\.current\)\) \{[\s\S]*?loadedActorId\.current = token\.userId;\s+setError\(cause/);
  assert.match(screen, /loadedActorId\.current !== userId \|\| !nextCursor/);
  assert.match(screen, /!currentActorLoaded \|\| currentUserId\.current !== userId \|\| notification\.user_id !== userId/);
  assert.match(screen, /await markAllNotificationsRead\(token\.userId\)/);
  assert.match(screen, /await markNotificationRead\(token\.userId, notification\.id\)/);
  assert.match(screen, /loadedActorId\.current = null;\s+if \(!userId\)/);
  assert.match(screen, /pageLoadToken\.current = null;\s+loadedActorId\.current = null;\s+setItems\(\[\]\)/);
});
