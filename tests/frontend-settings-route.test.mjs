import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Settings names only the canonical account gate after deactivation", () => {
  const source = readFileSync(new globalThis.URL("../app/settings.tsx", import.meta.url), "utf8");

  assert.match(source, /navigateToCanonicalGate: \(\) => router\.replace\("\/"\)/);
  assert.doesNotMatch(source, /account-status/, "the deleted profile-derived account route cannot return");
});
