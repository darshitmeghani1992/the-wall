import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// @ts-ignore Node test runner resolves the explicit source extension.
import { accountDeletionEnabledFor, isAccountDeletionEnabled } from "./account-deletion-availability.ts";

assert.equal(accountDeletionEnabledFor(undefined), false);
assert.equal(accountDeletionEnabledFor(""), false);
assert.equal(accountDeletionEnabledFor("false"), false);
assert.equal(accountDeletionEnabledFor("TRUE"), false);
assert.equal(accountDeletionEnabledFor("1"), false);
assert.equal(accountDeletionEnabledFor("true"), true);
assert.equal(isAccountDeletionEnabled, false, "deletion defaults off before hosted 0031 approval");

const statusSource = readFileSync("app/settings.tsx", "utf8");
const deletionSource = readFileSync("app/delete-account.tsx", "utf8");
assert.match(statusSource, /isAccountDeletionEnabled\s*\?/);
assert.match(statusSource, /Permanent deletion is temporarily unavailable/);
assert.match(deletionSource, /if \(!isAccountDeletionEnabled\)/);
assert.match(deletionSource, /No deletion has been scheduled/);
assert.match(deletionSource, /if \(!isAccountDeletionEnabled \|\| !actorId/);
