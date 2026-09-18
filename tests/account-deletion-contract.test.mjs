/* eslint-disable import/namespace -- Node loads this dependency-free TypeScript module directly. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseAccountDeletionRequest,
  parseCurrentAccountDeletion,
} from "../src/lib/account-deletion-contract.ts";

const scheduled = {
  status: "scheduled",
  requested_at: "2026-09-18T10:00:00.000Z",
  purge_after: "2026-10-18T10:00:00.000Z",
};

test("deletion responses accept only the exact server envelope", () => {
  assert.deepEqual(parseAccountDeletionRequest(scheduled), {
    status: "scheduled",
    requestedAt: scheduled.requested_at,
    purgeAfter: scheduled.purge_after,
  });
  assert.deepEqual(parseAccountDeletionRequest({
    status: "owner_action_required",
    owned_shared_wall_count: 2,
  }), { status: "owner_action_required", ownedSharedWallCount: 2 });
  assert.deepEqual(parseAccountDeletionRequest({ status: "invalid_confirmation" }), {
    status: "invalid_confirmation",
  });
  assert.throws(
    () => parseAccountDeletionRequest({ ...scheduled, unexpected: true }),
    /invalid/,
  );
  assert.throws(
    () => parseAccountDeletionRequest({ status: "owner_action_required", owned_shared_wall_count: 0 }),
    /invalid/,
  );
  assert.throws(
    () => parseAccountDeletionRequest({
      ...scheduled,
      purge_after: "2026-09-17T10:00:00.000Z",
    }),
    /invalid/,
  );
});

test("current deletion status is narrow and actor-relative", () => {
  assert.deepEqual(parseCurrentAccountDeletion({ status: "none" }), { status: "none" });
  assert.equal(parseCurrentAccountDeletion(scheduled).status, "scheduled");
  assert.throws(() => parseCurrentAccountDeletion({ status: "none", user_id: "other" }), /invalid/);
});

test("delete-account screen requires strong confirmation and names destructive scope", () => {
  const source = readFileSync("app/delete-account.tsx", "utf8");
  assert.match(source, /confirmation !== "DELETE"/);
  assert.match(source, /requestAccountDeletion\(token\.userId, confirmation\)/);
  assert.match(source, /Every Mark you authored/);
  assert.match(source, /Resolve Shared Wall ownership/);
  assert.match(source, /refreshAccountRoute\(\)/);
});

test("recovery tells scheduled deletion apart from ordinary deactivation", () => {
  const source = readFileSync("app/account-recovery.tsx", "utf8");
  assert.match(source, /getCurrentAccountDeletion\(\)/);
  assert.match(source, /Cancel deletion and restore/);
  assert.match(source, /deletion\.purgeAfter/);
});
