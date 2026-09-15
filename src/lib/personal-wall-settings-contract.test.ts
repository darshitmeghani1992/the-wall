import assert from "node:assert/strict";
// @ts-ignore Dependency-free Node runner requires the built-in module import.
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/personal-wall-settings.ts", "utf8");
const settingsUpdate = source.slice(
  source.indexOf("export async function updatePersonalWallSettings("),
  source.indexOf("async function requireOwnedPersonalWall("),
);
assert.match(settingsUpdate, /requireActor\(expectedActorId\)/, "settings save has an expected-actor preflight");
assert.match(settingsUpdate, /visibility: patch\.visibility/);
assert.match(settingsUpdate, /contribution_policy: patch\.contributionPolicy/);
assert.match(settingsUpdate, /allow_anonymous: patch\.allowAnonymous/);
assert.match(settingsUpdate, /\.eq\("owner_id", actorId\)/);
assert.match(settingsUpdate, /\.eq\("type", "personal"\)/);
assert.match(settingsUpdate, /\.maybeSingle\(\)/, "zero-row settings updates cannot look successful");
assert.doesNotMatch(settingsUpdate, /select\("\*"\)/, "settings reads only its canonical columns");

const approvedList = source.slice(
  source.indexOf("export async function listApprovedWriters("),
  source.indexOf("export async function addApprovedWriter("),
);
assert.match(approvedList, /select\("user_id, added_at"\)/, "association identity is retained separately");
assert.match(approvedList, /select\("id, display_name, handle, avatar_url"\)/, "profile hydration is minimal");
assert.match(approvedList, /profile: identityById\.get\(row\.user_id\) \?\? null/, "RLS-hidden profiles do not erase associations");
assert.doesNotMatch(approvedList, /select\("\*"\)/, "approved-writer hydration cannot pull extra PII");

const approvedAdd = source.slice(
  source.indexOf("export async function addApprovedWriter("),
  source.indexOf("export async function removeApprovedWriter("),
);
assert.match(approvedAdd, /error\?\.code === "23505"/, "only a unique conflict maps to already-approved");
assert.match(approvedAdd, /requireMutationRow/, "insert requires the returned association row");

const approvedRemove = source.slice(source.indexOf("export async function removeApprovedWriter("));
assert.match(approvedRemove, /requireMutationRow/, "remove requires an exact returned association row");
assert.match(approvedRemove, /That approved writer is no longer available\./);

const profilesSource = readFileSync("src/lib/profiles.ts", "utf8");
const onboardingUpdate = profilesSource.slice(
  profilesSource.indexOf("export async function updatePersonalWallSetup("),
  profilesSource.indexOf("/** Final ordered write."),
);
assert.match(onboardingUpdate, /updatePersonalWallSettings\(userId/, "onboarding delegates to the canonical settings writer");
assert.doesNotMatch(onboardingUpdate, /\.from\("walls"\)\.update/, "onboarding cannot keep a parallel settings write path");

console.log("personal-wall settings contract: actor fence, exact rows, minimal hydration, and onboarding delegation passed");
