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
assert.equal(
  notificationRoute(row({ kind: "shared_wall_invite_accepted" })),
  `/shared/${WALL}`,
);
assert.equal(
  notificationRoute(row({ kind: "shared_wall_ownership_transferred" })),
  `/shared/${WALL}`,
);
assert.equal(
  notificationRoute(row({ kind: "shared_wall_ownership_transferred", wall_id: null })),
  "/(tabs)/alerts",
);

// Never turn malformed/stale notification references into a nested route,
// alternate query parameter, or an unverified destination. Valid Wall routes
// can still open without a malformed focused-Mark parameter.
assert.equal(
  notificationRoute(row({ kind: "friend_accept", actor_id: "../settings?private=1" })),
  "/(tabs)/discover",
);
assert.equal(
  notificationRoute(row({ kind: "shared_wall_invite", wall_id: "bad/../other" })),
  "/(tabs)/alerts",
);
assert.equal(
  notificationRoute(row({ kind: "shared_wall_invite_accepted", wall_id: "not-uuid" })),
  "/(tabs)/alerts",
);
assert.equal(
  notificationRoute(row({ kind: "shared_wall_mark", wall_id: "bad?id=1" })),
  "/(tabs)/alerts",
);
assert.equal(
  notificationRoute(row({ kind: "shared_wall_mark", wall_type: "shared", mark_id: "1&secret=yes" })),
  `/shared/${WALL}`,
);
assert.equal(
  notificationRoute(row({ wall_type: "shared", wall_id: "../person/abc" })),
  "/(tabs)/alerts",
);
assert.equal(
  notificationRoute(row({ wall_owner_id: "owner?focusMark=wrong" })),
  "/(tabs)/alerts",
);
assert.equal(
  notificationRoute(row({ mark_id: "abc&secret=true" })),
  "/(tabs)/home",
);
assert.equal(
  notificationRoute(row({ kind: "friend_accepted", actor_id: OTHER_OWNER.toUpperCase() })),
  `/person/${OTHER_OWNER.toUpperCase()}`,
  "case-insensitive UUID references remain usable",
);
assert.equal(
  notificationRoute(row({ wall_type: "personal", user_id: "bad", wall_owner_id: OTHER_OWNER })),
  `/person/${OTHER_OWNER}?focusMark=${MARK}`,
  "a valid wall owner can still route to its profile when recipient metadata is missing",
);

console.log("notification route contract: 21 destination boundaries passed");
