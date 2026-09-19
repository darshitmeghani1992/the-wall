import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { beginExclusiveMutation, endExclusiveMutation } from "./mutation-guard.ts";

const ref = { current: false };
assert.equal(beginExclusiveMutation(ref), true);
assert.equal(beginExclusiveMutation(ref), false, "a rapid second tap is rejected before a render");
endExclusiveMutation(ref);
assert.equal(beginExclusiveMutation(ref), true, "completion releases the next deliberate action");
endExclusiveMutation(ref);

console.log("mutation guard: rapid duplicate interaction passed");
