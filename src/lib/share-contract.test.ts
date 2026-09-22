import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { isMarkShareable, markDeepLink, markSharePreview } from "./share-contract.ts";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { parseDeferredDestinationUrl } from "./deferred-destination-contract.ts";

const OWNER = "11111111-1111-4111-8111-111111111111";
const WALL = "22222222-2222-4222-8222-222222222222";
const MARK = "33333333-3333-4333-8333-333333333333";

assert.equal(
  markDeepLink(MARK, { kind: "personal", ownerId: OWNER }),
  `thewall://person/${OWNER}?focusMark=${MARK}`,
);
assert.equal(
  markDeepLink(MARK, { kind: "shared", wallId: WALL }),
  `thewall://shared/${WALL}?focusMark=${MARK}`,
);
assert.deepEqual(
  parseDeferredDestinationUrl(markDeepLink(MARK, { kind: "personal", ownerId: OWNER })),
  { kind: "mark", markId: MARK, container: { kind: "personal", ownerId: OWNER } },
);
assert.deepEqual(
  parseDeferredDestinationUrl(markDeepLink(MARK, { kind: "shared", wallId: WALL })),
  { kind: "mark", markId: MARK, container: { kind: "shared", wallId: WALL } },
);
assert.equal(markDeepLink("not-a-mark", { kind: "personal", ownerId: OWNER }), null);
assert.equal(markDeepLink(MARK, { kind: "personal", ownerId: "not-an-owner" }), null);
assert.equal(markDeepLink(MARK, { kind: "shared", wallId: "not-a-wall" }), null);

assert.equal(isMarkShareable({ type: "text", text: "A real Mark", secret: false }), true);
assert.equal(isMarkShareable({ type: "text", text: "   ", secret: false }), false);
for (const type of ["photo", "voice", "video"] as const) {
  assert.equal(
    isMarkShareable({ type, text: null, secret: false }),
    true,
    `${type} Marks remain shareable without a legacy public media URL`,
  );
}
assert.equal(isMarkShareable({ type: "photo", text: null, secret: true }), false);
assert.equal(markSharePreview("photo"), "📷 A photo Mark on my Wall");
assert.equal(markSharePreview("voice"), "🎙️ A voice Mark on my Wall");
assert.equal(markSharePreview("video"), "🎥 A video Mark on my Wall");

console.log("share contract: focused routes and protected-media share boundaries passed");
