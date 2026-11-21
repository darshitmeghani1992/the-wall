import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("received Marks share an exact focused destination instead of only the enclosing Wall", () => {
  const home = read("app/(tabs)/home.tsx");
  const markView = read("src/components/marks/MarkView.tsx");
  const share = read("src/lib/share.ts");

  assert.equal(
    (home.match(/shareDestination=\{userId \? \{ kind: "personal", ownerId: userId \} : undefined\}/g) ?? []).length,
    3,
    "the Wall card, linked focus card, and detail modal receive the exact Personal Wall owner",
  );
  assert.match(markView, /markDeepLink\(mark\.id, shareDestination\)/);
  assert.match(markView, /shareMark\(mark, wallHandle, destination\)/);
  assert.match(share, /const deepLink = markDeepLink\(mark\.id, destination\)/);
  assert.doesNotMatch(share, /mark\.media_url/);
});

test("every Personal Wall share path depends on the validated link, not raw handle truthiness", () => {
  const share = read("src/lib/share.ts");
  const contract = read("src/lib/share-contract.ts");
  assert.match(share, /return personalWallDeepLink\(handle\);/);
  assert.equal((share.match(/const safeHandle = link\?\.slice\("thewall:\/\/u\/".length\)/g) ?? []).length, 3);
  assert.equal((share.match(/has_handle: Boolean\(safeHandle\)/g) ?? []).length, 3);
  assert.doesNotMatch(share, /has_handle: Boolean\(handle\)/);
  assert.match(contract, /function personalWallDeepLink/);
});
