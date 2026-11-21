import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Node's strip-types test runner uses the source extension.
import { requireExactlyOneMarkMutation } from "./mark-mutation-confirmation.ts";

test("a confirmed single Mark mutation is accepted", () => {
  assert.doesNotThrow(() => requireExactlyOneMarkMutation(1));
});

test("denied, missing and ambiguous Mark mutations never report success", () => {
  for (const count of [null, 0, 2, -1]) {
    assert.throws(() => requireExactlyOneMarkMutation(count), /MARK_ACTION_NOT_ALLOWED/);
  }
});
