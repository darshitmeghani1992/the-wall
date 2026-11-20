import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// @ts-ignore Node test runner resolves the explicit source extension.
import { isMediaComposerEnabled, mediaComposerEnabledFor } from "./media-rollout.ts";

assert.equal(mediaComposerEnabledFor(undefined), false);
assert.equal(mediaComposerEnabledFor(""), false);
assert.equal(mediaComposerEnabledFor("false"), false);
assert.equal(mediaComposerEnabledFor("TRUE"), false);
assert.equal(mediaComposerEnabledFor("1"), false);
assert.equal(mediaComposerEnabledFor("true"), true);
assert.equal(isMediaComposerEnabled, false, "beta media is off without an explicit opt-in");

const composer = readFileSync("app/create.tsx", "utf8");
assert.match(composer, /canAddPhoto = isMediaComposerEnabled &&/);
assert.match(composer, /canAddAv = isMediaComposerEnabled &&/);
assert.match(composer, /isMediaComposerEnabled \|\| media\.length === 0/);
assert.match(composer, /isMediaComposerEnabled \? \(/);
assert.match(composer, /Photo, voice and video Marks are temporarily unavailable/);
