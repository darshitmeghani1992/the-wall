import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("successful Settings deactivation re-enters the canonical account route", () => {
  const source = readFileSync(new URL("../app/settings.tsx", import.meta.url), "utf8");
  const refreshIndex = source.indexOf("await refreshAccountRoute()");
  const routeIndex = source.indexOf('router.replace("/")', refreshIndex);

  assert.ok(refreshIndex >= 0, "Settings refreshes the server-derived account route after deactivation");
  assert.ok(routeIndex > refreshIndex, "Settings enters the canonical gate only after route refresh completes");
  assert.doesNotMatch(source, /account-status/, "the deleted profile-derived account route cannot return");
});
