import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { parseBlockedUsersResult } from "./blocked-users-contract.ts";

const USER = "11111111-1111-4111-8111-111111111111";
const BLOCKED_AT = "2026-09-15T00:00:00+00:00";
const item = {
  user_id: USER,
  display_name: "Alice",
  handle: "alice",
  avatar_url: null,
  blocked_at: BLOCKED_AT,
};

assert.deepEqual(parseBlockedUsersResult({
  status: "available",
  items: [item],
  next_cursor: { blocked_at: BLOCKED_AT, user_id: USER },
}), {
  status: "available",
  items: [{
    userId: USER,
    displayName: "Alice",
    handle: "alice",
    avatarUrl: null,
    blockedAt: BLOCKED_AT,
  }],
  nextCursor: { blockedAt: BLOCKED_AT, userId: USER },
});
assert.deepEqual(
  parseBlockedUsersResult({ status: "available", items: [], next_cursor: null }),
  { status: "available", items: [], nextCursor: null },
);
assert.deepEqual(parseBlockedUsersResult({ status: "unavailable" }), { status: "unavailable" });
assert.deepEqual(parseBlockedUsersResult({ status: "invalid_input" }), { status: "invalid_input" });

assert.throws(() => parseBlockedUsersResult({ status: "unavailable", reason: "inactive" }), /wasn't valid/);
assert.throws(() => parseBlockedUsersResult({ status: "available", items: [], next_cursor: null, actor_id: USER }), /wasn't valid/);
assert.throws(() => parseBlockedUsersResult({ status: "available", items: [{ ...item, bio: "private" }], next_cursor: null }), /wasn't valid/);
assert.throws(() => parseBlockedUsersResult({ status: "available", items: [{ ...item, user_id: "bad" }], next_cursor: null }), /wasn't valid/);
assert.doesNotThrow(() => parseBlockedUsersResult({
  status: "available",
  items: [{ ...item, user_id: "00000000-0000-0000-0000-000000000000" }],
  next_cursor: null,
}), "all canonical PostgreSQL UUID values remain valid");
assert.throws(() => parseBlockedUsersResult({ status: "available", items: [{ ...item, blocked_at: "yesterday" }], next_cursor: null }), /wasn't valid/);
assert.throws(() => parseBlockedUsersResult({
  status: "available",
  items: [{ ...item, blocked_at: "2026-02-30T00:00:00Z" }],
  next_cursor: null,
}), /wasn't valid/, "JavaScript-normalized impossible dates are rejected");
assert.throws(() => parseBlockedUsersResult({
  status: "available",
  items: [{ ...item, blocked_at: "2026-02-29T00:00:00Z" }],
  next_cursor: null,
}), /wasn't valid/, "February 29 is rejected in a non-leap year");
assert.doesNotThrow(() => parseBlockedUsersResult({
  status: "available",
  items: [{ ...item, blocked_at: "2024-02-29T23:59:59.123456-05:30" }],
  next_cursor: null,
}), "a real leap day with fractional seconds and a valid offset is accepted");
for (const invalidTimestamp of [
  "2026-13-01T00:00:00Z",
  "2026-04-31T00:00:00Z",
  "2026-01-01T24:00:00Z",
  "2026-01-01T00:60:00Z",
  "2026-01-01T00:00:60Z",
  "2026-01-01T00:00:00+24:00",
  "2026-01-01T00:00:00+05:60",
] as const) {
  assert.throws(() => parseBlockedUsersResult({
    status: "available",
    items: [{ ...item, blocked_at: invalidTimestamp }],
    next_cursor: null,
  }), /wasn't valid/, `${invalidTimestamp} is semantically invalid`);
}
assert.throws(() => parseBlockedUsersResult({
  status: "available",
  items: Array.from({ length: 21 }, () => item),
  next_cursor: null,
}), /wasn't valid/);
assert.throws(() => parseBlockedUsersResult({
  status: "available",
  items: [],
  next_cursor: { blocked_at: BLOCKED_AT, user_id: USER },
}), /wasn't valid/);
assert.throws(() => parseBlockedUsersResult({
  status: "available",
  items: [item],
  next_cursor: { blocked_at: BLOCKED_AT, user_id: "22222222-2222-4222-8222-222222222222" },
}), /wasn't valid/);

console.log("blocked-users contract: exact privacy shape, pagination, UUID, and semantic timestamp checks passed");
