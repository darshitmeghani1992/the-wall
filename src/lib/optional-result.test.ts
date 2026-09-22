import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { settleOptional } from "./optional-result.ts";

async function main() {
  const primary = Promise.resolve(["mark-a"]);
  const enrichment = settleOptional(Promise.reject(new Error("count unavailable")));
  const [marks, count] = await Promise.all([primary, enrichment]);

  assert.deepEqual(marks, ["mark-a"], "primary content survives an enrichment failure");
  assert.deepEqual(count, { available: false }, "failure remains distinct from a real zero");

  const available = await settleOptional(Promise.resolve(0));
  assert.deepEqual(available, { available: true, value: 0 }, "a real zero remains available data");

  console.log("optional result contract: primary isolation and exact zero passed");
}

void main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : "optional result contract failed");
  process.exitCode = 1;
});
