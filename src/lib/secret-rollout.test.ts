import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// @ts-ignore Node test runner resolves explicit source extension.
import { isSecretComposerEnabled, secretComposerEnabledFor } from "./secret-rollout.ts";

assert.equal(secretComposerEnabledFor(undefined), false);
assert.equal(secretComposerEnabledFor("false"), false);
assert.equal(secretComposerEnabledFor("1"), false);
assert.equal(secretComposerEnabledFor("TRUE"), false);
assert.equal(secretComposerEnabledFor("true"), true);
assert.equal(isSecretComposerEnabled, false, "one-hour expiry scheduler has not been provisioned in preview");
const source = readFileSync("app/create.tsx", "utf8");
assert.match(source, /canToggleSecret = isSecretComposerEnabled &&/);
assert.match(source, /!secret \|\| isSecretComposerEnabled/);
assert.match(source, /isSecretComposerEnabled \? <View/);
assert.match(source, /Secret Marks are temporarily unavailable until the one-hour expiry service is verified/);
