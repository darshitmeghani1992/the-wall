import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { normalizeSharedWallSearch, parsePendingSharedWallInvite, parseSharedWallAction, parseSharedWallCapabilities, parseSharedWallSettings, toSharedWallIlikePattern } from "./shared-wall-contract.ts";

const WALL = "33333333-3333-4333-8333-333333333333";

assert.deepEqual(parseSharedWallCapabilities({
  status: "available", wall_type: "shared", is_owner: false, can_view: true,
  can_contribute: false, join_state: "owner_approval_required", can_join: false,
}), {
  status: "available", wallType: "shared", isOwner: false, canView: true,
  canContribute: false, joinState: "owner_approval_required", canJoin: false,
});
assert.equal(parseSharedWallCapabilities({ status: "unavailable" }), null);
assert.throws(() => parseSharedWallCapabilities({ status: "unavailable", reason: "private" }));
assert.throws(() => parseSharedWallCapabilities({
  status: "available", wall_type: "shared", is_owner: false, can_view: true,
  can_contribute: false, join_state: "member", can_join: true,
}));

assert.deepEqual(parseSharedWallAction({ status: "joined", wall_id: WALL }, WALL), { status: "joined", wallId: WALL });
assert.deepEqual(parseSharedWallAction({ status: "unavailable" }, WALL), { status: "unavailable" });
for (const status of ["already_member", "invited", "already_invited", "accepted", "declined", "removed", "revoked", "left", "owner_action_required", "deleted", "confirmation_mismatch"] as const) {
  assert.deepEqual(parseSharedWallAction({ status, wall_id: WALL }, WALL), { status, wallId: WALL });
}
assert.throws(() => parseSharedWallAction({ status: "joined" }, WALL));
assert.throws(() => parseSharedWallAction({ status: "joined", wall_id: "other-wall" }, WALL), /requested Wall/);
assert.throws(() => parseSharedWallAction({ status: "unavailable", wall_id: WALL }, WALL));

assert.deepEqual(parseSharedWallSettings({
  status: "updated", wall_id: WALL, name: "Crew", visibility: "private",
  open_join: false, allow_anonymous: true,
}, WALL), {
  status: "updated", wallId: WALL, name: "Crew", visibility: "private",
  openJoin: false, allowAnonymous: true,
});
assert.deepEqual(parseSharedWallSettings({ status: "invalid_input" }, WALL), { status: "invalid_input" });
assert.throws(() => parseSharedWallSettings({ status: "updated", wall_id: "other-wall", name: "Crew", visibility: "private", open_join: false, allow_anonymous: true }, WALL), /requested Wall/);

assert.deepEqual(parsePendingSharedWallInvite({
  status: "available", wall_id: WALL, wall_name: "Crew", visibility: "private",
  owner_display_name: "Ari",
}, WALL), {
  status: "available", wallId: WALL, wallName: "Crew", visibility: "private", ownerDisplayName: "Ari",
});
assert.deepEqual(parsePendingSharedWallInvite({ status: "unavailable" }, WALL), { status: "unavailable" });
assert.throws(() => parsePendingSharedWallInvite({ status: "available", wall_id: "other-wall", wall_name: "Crew", visibility: "private", owner_display_name: "Ari" }, WALL), /requested Wall/);
assert.throws(() => parsePendingSharedWallInvite({
  status: "available", wall_id: WALL, wall_name: "Crew", visibility: "private",
  owner_display_name: "Ari", owner_id: "hidden",
}, WALL));

assert.equal(normalizeSharedWallSearch(`  ${"x".repeat(80)}  `).length, 60);
assert.equal(toSharedWallIlikePattern("100%_crew\\trip"), "%100\\%\\_crew\\\\trip%");

console.log("shared wall contract: strict shapes, join state, preview privacy, and literal search passed");
