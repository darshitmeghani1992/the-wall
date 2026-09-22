import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the explicit source extension.
import { SessionFocusFence } from "./session-generation.ts";

type Deferred = { promise: Promise<string[]>; resolve: (walls: string[]) => void };

function deferred(): Deferred {
  let resolve!: (walls: string[]) => void;
  const promise = new Promise<string[]>((done) => { resolve = done; });
  return { promise, resolve };
}

async function main() {
  const fence = new SessionFocusFence();
  fence.focus("user-a");
  const first = fence.begin("user-a")!;
  const second = fence.begin("user-a")!;
  assert.equal(fence.isCurrent(first, "user-a"), false, "a newer load supersedes the old response");
  assert.equal(fence.isCurrent(second, "user-a"), true);

  let effects = 0;
  const blurred = deferred();
  const blurToken = fence.begin("user-a")!;
  const afterBlur = blurred.promise.then(() => {
    if (fence.isCurrent(blurToken, "user-a")) effects += 1;
  });
  fence.blur();
  blurred.resolve(["accepted"]);
  await afterBlur;
  assert.equal(effects, 0, "a delayed operation cannot navigate or update after blur");

  fence.focus("user-a");
  const switched = deferred();
  const switchToken = fence.begin("user-a")!;
  let currentUserId: string | null = "user-a";
  const afterSwitch = switched.promise.then(() => {
    if (fence.isCurrent(switchToken, currentUserId)) effects += 1;
  });
  fence.blur();
  currentUserId = "user-b";
  fence.focus(currentUserId);
  switched.resolve(["old-account-wall"]);
  await afterSwitch;
  assert.equal(effects, 0, "an old account cannot resurrect state after a switch");

  const signedOut = deferred();
  const signOutToken = fence.begin("user-b")!;
  const afterSignOut = signedOut.promise.then(() => {
    if (fence.isCurrent(signOutToken, currentUserId)) effects += 1;
  });
  currentUserId = null;
  fence.blur();
  signedOut.resolve(["private-wall"]);
  await afterSignOut;
  assert.equal(effects, 0, "sign-out blocks delayed state and navigation");

  let visibleWalls = ["existing"];
  const refresh = async (next: string[]) => {
    fence.focus("user-a");
    const token = fence.begin("user-a")!;
    const response = deferred();
    const completion = response.promise.then((walls) => {
      if (fence.isCurrent(token, "user-a")) visibleWalls = walls;
    });
    response.resolve(next);
    await completion;
    fence.blur();
  };
  await refresh(["existing", "accepted"]);
  assert.deepEqual(visibleWalls, ["existing", "accepted"], "focus after invite acceptance adds the Wall");
  await refresh(["existing"]);
  assert.deepEqual(visibleWalls, ["existing"], "focus after membership revocation removes the Wall");

  console.log("session focus contract: overlap, blur, switch, sign-out, accept, and revoke passed");
}

void main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : "session generation contract failed");
  process.exitCode = 1;
});
