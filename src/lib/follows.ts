import { supabase } from "./supabase";
import { track } from "./analytics";
import { requireExactCount, requireMutationRow } from "./result-contract";
import { requireExpectedActor } from "./expected-actor";
import type { Profile } from "./types";

/**
 * Followers (Master Spec §17, §66). Following is one-way and only works on a
 * PUBLIC Personal Wall; it grants NO write permission and never bypasses privacy
 * or blocking — all enforced server-side by migration 0014. This layer is thin
 * data access and never infers access from follow state.
 */

/** Follow a user (their Personal Wall must be public). Throws on a blocked/ineligible target. */
export async function followUser(followerId: string, followedId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = requireExpectedActor(followerId, auth.user?.id, "Not signed in.");
  const { data, error } = await supabase
    .from("follows")
    .insert({ follower_id: uid, followed_id: followedId })
    .select("followed_id")
    .maybeSingle();
  if (error) throw error;
  requireMutationRow(data, "The follow wasn't saved. Please try again.");
  track("Follow Created", { followed_id: followedId });
}

/** Unfollow a user. */
export async function unfollowUser(followerId: string, followedId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = requireExpectedActor(followerId, auth.user?.id, "Not signed in.");
  const { data, error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", uid)
    .eq("followed_id", followedId)
    .select("followed_id")
    .maybeSingle();
  if (error) throw error;
  requireMutationRow(data, "That follow is no longer available.");
}

export async function isFollowing(followerId: string, followedId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("followed_id", followedId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("followed_id", userId),
    supabase.from("follows").select("followed_id", { count: "exact", head: true }).eq("follower_id", userId),
  ]);
  if (followers.error) throw followers.error;
  if (following.error) throw following.error;
  return {
    followers: requireExactCount(followers.count, "The follower count wasn't available."),
    following: requireExactCount(following.count, "The following count wasn't available."),
  };
}

async function profilesForIds(ids: string[]): Promise<Profile[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("profiles").select("*").in("id", ids);
  if (error) throw error;
  const rows = (data ?? []) as Profile[];
  const byId = new Map(rows.map((profile) => [profile.id, profile]));
  return ids.map((id) => byId.get(id)).filter((profile): profile is Profile => Boolean(profile));
}

/** Ordered newest-first list of people following `userId`. */
export async function getFollowers(userId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id, created_at")
    .eq("followed_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return profilesForIds((data ?? []).map((row) => row.follower_id));
}

/** Ordered newest-first list of people `userId` follows. */
export async function getFollowing(userId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("followed_id, created_at")
    .eq("follower_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return profilesForIds((data ?? []).map((row) => row.followed_id));
}
