import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { requireExactCount, requireMutationRow } from "./result-contract.ts";

assert.deepEqual(requireMutationRow({ id: "saved" }, "not saved"), { id: "saved" });
assert.throws(() => requireMutationRow(null, "not saved"), /not saved/, "zero-row mutation cannot look successful");
assert.equal(requireExactCount(0, "missing"), 0, "a confirmed empty result remains an accurate zero");
assert.equal(requireExactCount(12, "missing"), 12);
assert.throws(() => requireExactCount(null, "missing"), /missing/, "an indeterminate count cannot become zero");

console.log("result contract: zero-row mutations and exact counts passed");
