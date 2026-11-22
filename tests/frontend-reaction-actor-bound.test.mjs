import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const reactions = readFileSync(new URL("../src/lib/reactions.ts", import.meta.url), "utf8");
const hook = readFileSync(new URL("../src/hooks/useWallReactions.ts", import.meta.url), "utf8");

const setReaction = reactions.split("export async function setReaction(")[1]?.split("export async function removeReaction(")[0] ?? "";
const removeReaction = reactions.split("export async function removeReaction(")[1]?.split("export async function toggleReaction(")[0] ?? "";
const toggleReaction = reactions.split("export async function toggleReaction(")[1] ?? "";

test("reaction add is bound to the initiating actor after Auth resolves", () => {
  assert.match(setReaction, /expectedActorId:\s*string/);
  assert.match(setReaction, /await supabase\.auth\.getUser\(\)/);
  assert.match(setReaction, /if \(authError\) throw authError/);
  assert.match(setReaction, /requireExpectedActor\(\s*expectedActorId,\s*authData\.user\?\.id/);
  assert.match(setReaction, /\.upsert\(\{ mark_id: markId, user_id: uid, emoji \}/);
});

test("reaction remove cannot silently succeed on logout or zero-row RLS denial", () => {
  assert.match(removeReaction, /expectedActorId:\s*string/);
  assert.match(removeReaction, /if \(authError\) throw authError/);
  assert.match(removeReaction, /requireExpectedActor\(\s*expectedActorId,\s*authData\.user\?\.id/);
  assert.doesNotMatch(removeReaction, /if \(!uid\) return/);
  assert.match(removeReaction, /\.delete\(\)[\s\S]*?\.eq\("user_id", uid\)[\s\S]*?\.select\("mark_id"\)\s*\.maybeSingle\(\)/);
  assert.match(removeReaction, /if \(data\?\.mark_id !== markId\) throw new Error\("REACTION_ACTION_NOT_ALLOWED"\)/);
});

test("toggle routes both reaction operations through expected actor", () => {
  assert.match(toggleReaction, /expectedActorId:\s*string/);
  assert.match(toggleReaction, /await removeReaction\(expectedActorId, markId\)/);
  assert.match(toggleReaction, /await setReaction\(expectedActorId, markId, emoji\)/);
});

test("optimistic updates do not start from signed-out or replaced account", () => {
  assert.match(hook, /if \(!userId \|\| currentUserId\.current !== userId \|\| mutationLeases\.current\.has\(markId\)\) return/);
  assert.match(hook, /toggleReaction\(userId, markId, emoji, prev\)/);
  assert.match(hook, /\[refresh, userId\]/);
});

test("reaction optimism rolls back when neither write nor offline refresh succeeds", () => {
  assert.match(hook, /const mutationLeases = useRef\(new Map<string, symbol>\(\)\)/);
  assert.match(hook, /mutationLeases\.current\.has\(markId\)/);
  assert.match(hook, /mutationLeases\.current\.set\(markId, lease\)/);
  assert.match(hook, /\.catch\(\(\) => \{[\s\S]*?mutationLeases\.current\.get\(markId\) !== lease[\s\S]*?setSummaries\(\(cur\) => \(\{ \.\.\.cur, \[markId\]: current \}\)\)/);
  assert.match(hook, /void refresh\(markId\)\.catch\(\(\) => \{/);
  assert.match(hook, /\.finally\(\(\) => \{[\s\S]*?mutationLeases\.current\.get\(markId\) === lease[\s\S]*?mutationLeases\.current\.delete\(markId\)/);
  assert.match(hook, /mutationLeases\.current\.clear\(\)/);
});
