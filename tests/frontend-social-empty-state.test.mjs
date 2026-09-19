import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("empty follower and following lists provide a forward action", () => {
  const screen = read("app/social/[kind].tsx");
  assert.match(screen, /No one here yet/);
  assert.match(screen, /label="Discover people"[\s\S]*router\.push\("\/\(tabs\)\/discover"\)/);
});
