import { supabase } from "./supabase";
import { track } from "./analytics";
import { requireExactCount, requireMutationRow } from "./result-contract";

/**
 * Followers (Master Spec §17, §66). Following is one-way and only works on a
 * PUBLIC Personal Wall; it grants NO write permission and never bypasses privacy
 * or blocking — all enforced server-side by migration 0014 (the insert policy
 * checks the target wall is public, both accounts active, and the pair isn't
 * blocked; blocking removes follow rows). This layer is thin data access.
 */

/** Follow a user (their Personal Wall must be public). Throws on a blocked/ineligible target. */
export async function followUser(followerId: string, followedId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in.");
  if (uid !== followerId) throw new Error("Your session changed. Please try again.");
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
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in.");
  if (uid !== followerId) throw new Error("Your session changed. Please try again.");
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

/** Is `followerId` currently following `followedId`? */
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

/** Follower / following counts for a user (counts are world-readable, §106). */
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
