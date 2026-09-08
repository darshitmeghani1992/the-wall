import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { notificationRoute, type NotificationRouteInput } from "./notification-route.ts";

const RECIPIENT = "11111111-1111-4111-8111-111111111111";
const OTHER_OWNER = "22222222-2222-4222-8222-222222222222";
const WALL = "33333333-3333-4333-8333-333333333333";
const MARK = "44444444-4444-4444-8444-444444444444";

function row(overrides: Partial<NotificationRouteInput>): NotificationRouteInput {
  return {
    user_id: RECIPIENT,
    kind: "reaction",
    actor_id: null,
    mark_id: MARK,
    wall_id: WALL,
    wall_type: "personal",
    wall_owner_id: RECIPIENT,
    ...overrides,
  };
}

assert.equal(notificationRoute(row({})), `/(tabs)/home?focusMark=${MARK}`);
assert.equal(
  notificationRoute(row({ wall_owner_id: OTHER_OWNER })),
  `/person/${OTHER_OWNER}?focusMark=${MARK}`,
  "a reaction follows its containing Personal Wall, not the Alert recipient",
);
assert.equal(
  notificationRoute(row({ wall_type: "shared", wall_owner_id: OTHER_OWNER })),
  `/shared/${WALL}?focusMark=${MARK}`,
);
assert.equal(
  notificationRoute(row({ wall_type: null, wall_owner_id: null })),
  "/(tabs)/alerts",
  "deleted or inaccessible Wall metadata has a graceful fallback",
);
assert.equal(
  notificationRoute(row({ kind: "shared_wall_invite" })),
  `/shared/invite/${WALL}`,
  "an invitation routes to a guarded decision surface",
);
assert.equal(
  notificationRoute(row({ kind: "shared_wall_invite", wall_id: null })),
  "/(tabs)/alerts",
);
assert.equal(
  notificationRoute(row({ kind: "friend_accepted", actor_id: OTHER_OWNER })),
  `/person/${OTHER_OWNER}`,
);
assert.equal(notificationRoute(row({ kind: "unknown" })), "/(tabs)/alerts");

console.log("notification route contract: 8 destination boundaries passed");
