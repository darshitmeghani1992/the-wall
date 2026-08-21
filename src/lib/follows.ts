import { supabase } from "./supabase";
import { track } from "./analytics";

/**
 * Followers (Master Spec §17, §66). Following is one-way and only works on a
 * PUBLIC Personal Wall; it grants NO write permission and never bypasses privacy
 * or blocking — all enforced server-side by migration 0014 (the insert policy
 * checks the target wall is public, both accounts active, and the pair isn't
 * blocked; blocking removes follow rows). This layer is thin data access.
 */

/** Follow a user (their Personal Wall must be public). Throws on a blocked/ineligible target. */
export async function followUser(followedId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in.");
  const { error } = await supabase.from("follows").insert({ follower_id: uid, followed_id: followedId });
  if (error) throw error;
  track("Follow Created", { followed_id: followedId });
}

/** Unfollow a user. */
export async function unfollowUser(followedId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in.");
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", uid)
    .eq("followed_id", followedId);
  if (error) throw error;
}

/** Is `followerId` currently following `followedId`? */
export async function isFollowing(followerId: string, followedId: string): Promise<boolean> {
  const { data } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("followed_id", followedId)
    .maybeSingle();
  return !!data;
}

/** Follower / following counts for a user (counts are world-readable, §106). */
export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("followed_id", userId),
    supabase.from("follows").select("followed_id", { count: "exact", head: true }).eq("follower_id", userId),
  ]);
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}
