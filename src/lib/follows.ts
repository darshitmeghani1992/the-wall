import { supabase } from "./supabase";
import { track } from "./analytics";
import type { Profile } from "./types";

/**
 * Followers (Master Spec §17, §66). Following is one-way and only works on a
 * PUBLIC Personal Wall; it grants NO write permission and never bypasses privacy
 * or blocking — all enforced server-side by migration 0014. This layer is thin
 * data access and never infers access from follow state.
 */

export async function followUser(followedId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in.");
  const { error } = await supabase.from("follows").insert({ follower_id: uid, followed_id: followedId });
  if (error) throw error;
  track("Follow Created", { followed_id: followedId });
}

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

export async function isFollowing(followerId: string, followedId: string): Promise<boolean> {
  const { data } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("followed_id", followedId)
    .maybeSingle();
  return !!data;
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("followed_id", userId),
    supabase.from("follows").select("followed_id", { count: "exact", head: true }).eq("follower_id", userId),
  ]);
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
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
