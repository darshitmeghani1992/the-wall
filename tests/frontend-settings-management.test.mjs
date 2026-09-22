/* eslint-disable import/namespace -- Node's type-stripping test runner loads this TypeScript module directly. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canManageApprovedWriters,
  openCapturedTargetConfirmation,
  personalSettingsChanged,
  selectedWriterExplanation,
} from "../src/components/settings-management-contract.ts";

const selectedPrivate = {
  visibility: "private",
  contributionPolicy: "selected",
  allowAnonymous: true,
};

test("personal settings dirty state compares all atomically saved fields", () => {
  assert.equal(personalSettingsChanged(selectedPrivate, selectedPrivate), false);
  assert.equal(personalSettingsChanged(selectedPrivate, { ...selectedPrivate, visibility: "public" }), true);
  assert.equal(personalSettingsChanged(selectedPrivate, { ...selectedPrivate, contributionPolicy: "friends" }), true);
  assert.equal(personalSettingsChanged(selectedPrivate, { ...selectedPrivate, allowAnonymous: false }), true);
});

test("approved-writer management is gated by the server-confirmed saved policy", () => {
  assert.equal(canManageApprovedWriters(selectedPrivate), true);
  assert.equal(canManageApprovedWriters({ ...selectedPrivate, contributionPolicy: "friends" }), false);
  assert.equal(canManageApprovedWriters(null), false);
});

test("selected and private settings explain the friendship visibility boundary", () => {
  assert.equal(selectedWriterExplanation(selectedPrivate), "Only approved friends can write on your private Wall.");
  assert.equal(
    selectedWriterExplanation({ ...selectedPrivate, visibility: "public" }),
    "Only people you approve can write on your Wall.",
  );
  assert.equal(selectedWriterExplanation({ ...selectedPrivate, contributionPolicy: "everyone" }), null);
});

test("permission-sensitive screens keep independent load, search, and action fences", () => {
  const approvedSource = readFileSync(new globalThis.URL("../app/approved-writers.tsx", import.meta.url), "utf8");
  assert.match(approvedSource, /loadFence/);
  assert.match(approvedSource, /searchFence/);
  assert.match(approvedSource, /actionFence/);

  const blockedSource = readFileSync(new globalThis.URL("../app/blocked-users.tsx", import.meta.url), "utf8");
  assert.match(blockedSource, /loadFence/);
  assert.match(blockedSource, /actionFence/);
  assert.doesNotMatch(blockedSource, /router\.push\(`\/person\//, "blocked rows must not navigate to profiles");
});

test("Settings exposes and registers both management entry routes", () => {
  const settingsSource = readFileSync(new globalThis.URL("../app/settings.tsx", import.meta.url), "utf8");
  const layoutSource = readFileSync(new globalThis.URL("../app/_layout.tsx", import.meta.url), "utf8");

  assert.match(settingsSource, /router\.push\("\/personal-wall-settings"\)/);
  assert.match(settingsSource, /router\.push\("\/blocked-users"\)/);
  assert.match(layoutSource, /name="personal-wall-settings"/);
  assert.match(layoutSource, /name="approved-writers"/);
  assert.match(layoutSource, /name="blocked-users"/);
});

test("Personal Wall settings protects navigation with an unsaved-change confirmation", () => {
  const source = readFileSync(new globalThis.URL("../app/personal-wall-settings.tsx", import.meta.url), "utf8");
  assert.match(source, /beforeRemove/);
  assert.match(source, /Discard unsaved changes\?/);
  assert.match(source, /canManageApprovedWriters\(saved\)/);
});

test("a confirmation captured under one actor cannot dispatch after an actor switch", () => {
  const actorToken = { actorId: "actor-a", generation: 1 };
  let currentActorId = "actor-a";
  let confirm;
  const runs = [];

  openCapturedTargetConfirmation({
    capture: () => actorToken,
    isCurrent: (token) => token.actorId === currentActorId,
    targetId: "target-a",
    open: (callback) => { confirm = callback; },
    run: (token, targetId) => runs.push([token.actorId, targetId]),
  });

  currentActorId = "actor-b";
  confirm();
  assert.deepEqual(runs, []);
});

test("a current confirmation dispatches the originally captured target", () => {
  const actorToken = { actorId: "actor-a", generation: 1 };
  let confirm;
  const runs = [];

  openCapturedTargetConfirmation({
    capture: () => actorToken,
    isCurrent: () => true,
    targetId: "target-a",
    open: (callback) => { confirm = callback; },
    run: (token, targetId) => runs.push([token.actorId, targetId]),
  });

  confirm();
  assert.deepEqual(runs, [["actor-a", "target-a"]]);
});
