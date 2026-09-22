import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { descendingCreatedAtIdFilter } from "./created-at-pagination.ts";

const ID = "11111111-1111-4111-8111-111111111111";

test("descending keyset cursor produces the exact two-column boundary", () => {
  assert.equal(
    descendingCreatedAtIdFilter({ created_at: "2026-09-22T10:11:12.123456+00:00", id: ID }, "invalid"),
    `created_at.lt.2026-09-22T10:11:12.123456+00:00,and(created_at.eq.2026-09-22T10:11:12.123456+00:00,id.lt.${ID})`,
  );
});

test("descending keyset cursor rejects malformed, impossible, and injectable values", () => {
  for (const cursor of [
    { created_at: "2026-02-30T00:00:00Z", id: ID },
    { created_at: "2026-09-22T10:11:12Z,read.eq.false", id: ID },
    { created_at: "2026-09-22T10:11:12Z", id: `${ID})` },
    { created_at: "not-a-time", id: ID },
  ]) assert.throws(() => descendingCreatedAtIdFilter(cursor, "invalid cursor"), /invalid cursor/);
});
