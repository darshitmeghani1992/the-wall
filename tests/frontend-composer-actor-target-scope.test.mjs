/* eslint-disable import/namespace -- Node loads this dependency-free TypeScript module directly. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ComposerScopeLease, composerScopeKey } from "../src/lib/composer-scope.ts";

const personal = { wallId: "wall-one", recipientId: "user-one", handle: "one" };
const shared = { sharedWallId: "shared-one", wallName: "Friends" };

test("composer keys remain stable for the same actor and exact destination", () => {
  assert.equal(composerScopeKey("actor-a", personal), composerScopeKey("actor-a", { ...personal }));
  assert.equal(composerScopeKey(null, {}), composerScopeKey(null, { wallId: undefined }));
});

test("new account or changed Wall/recipient/shared-invite gets a distinct editor identity", () => {
  const original = composerScopeKey("actor-a", personal);
  for (const [actor, destination] of [
    ["actor-b", personal],
    [null, personal],
    ["actor-a", { ...personal, wallId: "wall-two" }],
    ["actor-a", { ...personal, recipientId: "user-two" }],
    ["actor-a", { ...personal, handle: "renamed" }],
    ["actor-a", shared],
    ["actor-a", { ...shared, sharedWallId: "shared-two" }],
    ["actor-a", { ...shared, wallName: "Family" }],
  ]) {
    assert.notEqual(composerScopeKey(actor, destination), original);
  }
});

test("dialog callback leases reject stale actor/target changes, including ABA and unmount", () => {
  const lease = new ComposerScopeLease();
  const a = composerScopeKey("actor-a", personal);
  const b = composerScopeKey("actor-b", personal);
  const first = lease.capture(a);
  assert.equal(lease.isCurrent(first), true);
  const second = lease.capture(b);
  assert.equal(lease.isCurrent(first), false);
  assert.equal(lease.isCurrent(second), true);
  const third = lease.capture(a);
  assert.notEqual(third, first);
  assert.equal(lease.isCurrent(first), false);
  assert.equal(lease.isCurrent(third), true);
  lease.invalidate();
  assert.equal(lease.isCurrent(third), false);
});

test("composer wrapper keys its child before editor draft hooks initialize", () => {
  const source = readFileSync(new URL("../app/create.tsx", import.meta.url), "utf8");
  assert.match(source, /export default function Composer\(\) \{/);
  assert.match(source, /const \{ session \} = useAuth\(\)/);
  assert.match(source, /const scopeKey = composerScopeKey\(session\?\.user\.id \?\? null, \{/);
  assert.match(source, /wallId, recipientId, handle, sharedWallId, wallName,/);
  assert.match(source, /return <ComposerSession key=\{scopeKey\} isCurrentScope=/);
  assert.match(source, /function ComposerSession\(\{ isCurrentScope \}/);
  assert.ok(source.includes('const [text, setText] = useState("");'));
  assert.match(source, /clearProtectedMediaResumeScope\(currentUserId, sessionGeneration\)/);
});

test("stale Composer confirmations do not navigate after identity switch or slow cleanup", () => {
  const source = readFileSync(new URL("../app/create.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(!isCurrentScope\(\) \|\| submissionLocked\) return/);
  assert.match(source, /if \(isCurrentScope\(\)\) navigation\.dispatch\(data\.action\)/);
  assert.match(source, /if \(isCurrentScope\(\)\) router\.back\(\)/);
  assert.match(source, /if \(!isCurrentScope\(\) \|\| !canSubmit/);
  assert.match(source, /const isCurrent = \(\) => isCurrentScope\(\) && token === lifecycleRef\.current/);
});
