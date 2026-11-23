import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { isMarkShareable, markDeepLink, markSharePreview, personalWallDeepLink, sharedWallDeepLink } from "./share-contract.ts";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { parseDeferredDestinationUrl } from "./deferred-destination-contract.ts";

const OWNER = "11111111-1111-4111-8111-111111111111";
const WALL = "22222222-2222-4222-8222-222222222222";
const MARK = "33333333-3333-4333-8333-333333333333";

assert.equal(personalWallDeepLink("maya"), "thewall://u/maya");
assert.equal(personalWallDeepLink("  MaYa_27  "), "thewall://u/maya_27");
assert.deepEqual(parseDeferredDestinationUrl(personalWallDeepLink("MaYa")), {
  kind: "personal_handle", handle: "maya",
});
for (const invalid of [
  null, undefined, "", "ab", "@maya", "ma/ya", "ma\\\\ya", "maya?focusMark=bad",
  "maya#fragment", "ma ya", "m%2Faya", "maya\\nfriend", "a".repeat(9_000),
]) {
  assert.equal(personalWallDeepLink(invalid), null, `must not create unopenable handle link: ${String(invalid).slice(0, 30)}`);
}

const mixedCaseWall = "DeAdBeEf-abcd-4123-8123-123456789abc";
assert.equal(sharedWallDeepLink(WALL), `thewall://s/${WALL}`);
assert.deepEqual(parseDeferredDestinationUrl(sharedWallDeepLink(mixedCaseWall)), {
  kind: "shared_wall", wallId: mixedCaseWall.toLowerCase(),
});
assert.equal(sharedWallDeepLink(""), null);
assert.equal(sharedWallDeepLink("not-a-wall"), null);

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
