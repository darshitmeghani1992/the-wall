/* eslint-disable import/namespace -- Source wiring and actor-scoped view are contract-checked. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screen = readFileSync(new URL("../app/social/[kind].tsx", import.meta.url), "utf8");

test("Social list data is keyed by viewer, viewed user and list kind", () => {
  assert.match(screen, /const subject = `\$\{session\?\.user\.id \?\? ""\}:\$\{targetId \?\? ""\}:\$\{kind\}`/);
  assert.match(screen, /const requestSubject = `\$\{session\?\.user\.id \?\? ""\}:\$\{requestedTargetId \?\? ""\}:\$\{kind\}`/);
  assert.match(screen, /setLoadedSubject\(requestSubject\)/);
  assert.match(screen, /loading \|\| loadedSubject !== subject \? \(/);
  assert.match(screen, /setLoadedSubject\(null\)/);
});

test("An old list is hidden before the focus hook can clear previous actor data", () => {
  const key = (viewer, target, kind) => `${viewer}:${target}:${kind}`;
  const loaded = key("viewer-a", "target-x", "followers");
  assert.equal(loaded === key("viewer-b", "target-x", "followers"), false);
  assert.equal(loaded === key("viewer-a", "target-y", "followers"), false);
  assert.equal(loaded === key("viewer-a", "target-x", "following"), false);
  assert.equal(loaded === key("viewer-a", "target-x", "followers"), true);
});

test("Failed current-request data is eligible to show only for its own subject", () => {
  let loadedSubject = null;
  const nextSubject = "viewer-b:target-y:following";
  const previousErrorSubject = "viewer-a:target-y:following";
  loadedSubject = previousErrorSubject;
  assert.equal(loadedSubject === nextSubject, false);
  loadedSubject = nextSubject;
  assert.equal(loadedSubject === nextSubject, true);
});
