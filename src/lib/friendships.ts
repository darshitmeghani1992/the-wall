import { supabase } from "./supabase";
import { track } from "./analytics";
import type { Friendship, Profile } from "./types";

export type RelationshipState = "none" | "outgoing" | "incoming" | "friends";

export type PersonRelationship = {
  profile: Profile;
  relationship: RelationshipState;
};

function relationshipState(friendship: Friendship | undefined, userId: string): RelationshipState {
  if (!friendship) return "none";
  if (friendship.status === "accepted") return "friends";
  return friendship.addressee_id === userId ? "incoming" : "outgoing";
}

async function getRelationships(userId: string): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id, status, created_at")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .neq("status", "blocked");
  if (error) throw error;
  return (data ?? []) as Friendship[];
}

export async function searchPeople(userId: string, handle: string): Promise<PersonRelationship[]> {
  const query = handle.trim().replace(/^@/, "");
  if (!query) return [];
  const [{ data, error }, friendships] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .ilike("handle", `%${query}%`)
      .neq("id", userId)
      .eq("account_status", "active") // §82 — deactivated accounts aren't discoverable
      .order("handle")
      .limit(20),
    getRelationships(userId),
  ]);
  if (error) throw error;
  return ((data ?? []) as Profile[]).map((profile) => ({
    profile,
    relationship: relationshipState(
      friendships.find(
        (friendship) =>
          friendship.requester_id === profile.id || friendship.addressee_id === profile.id,
      ),
      userId,
    ),
  }));
}

async function hydrateFriendships(
  userId: string,
  friendships: Friendship[],
): Promise<PersonRelationship[]> {
  const ids = friendships.map((friendship) =>
    friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id,
  );
  if (!ids.length) return [];
  const { data, error } = await supabase.from("profiles").select("*").in("id", ids);
  if (error) throw error;
  return ((data ?? []) as Profile[]).map((profile) => ({
    profile,
    relationship: relationshipState(
      friendships.find(
        (friendship) =>
          friendship.requester_id === profile.id || friendship.addressee_id === profile.id,
      ),
      userId,
    ),
  }));
}

export async function getFriends(userId: string): Promise<PersonRelationship[]> {
  const friendships = (await getRelationships(userId)).filter(
    (friendship) => friendship.status === "accepted",
  );
  return hydrateFriendships(userId, friendships);
}

export async function getIncomingRequests(userId: string): Promise<PersonRelationship[]> {
  const friendships = (await getRelationships(userId)).filter(
    (friendship) => friendship.status === "pending" && friendship.addressee_id === userId,
  );
  return hydrateFriendships(userId, friendships);
}

export async function getRelationship(userId: string, personId: string): Promise<RelationshipState> {
  const friendships = await getRelationships(userId);
  return relationshipState(
    friendships.find(
      (friendship) =>
        friendship.requester_id === personId || friendship.addressee_id === personId,
    ),
    userId,
  );
}

export async function sendFriendRequest(userId: string, personId: string): Promise<void> {
  if (userId === personId) throw new Error("You can't add yourself.");
  if ((await getRelationship(userId, personId)) !== "none") return;
  const { error } = await supabase.from("friendships").insert({
    requester_id: userId,
    addressee_id: personId,
    status: "pending",
  });
  if (error) throw error;
  track("Friend Request Sent", {});
}

export async function acceptFriendRequest(userId: string, requesterId: string): Promise<void> {
  const { data, error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("requester_id", requesterId)
    .eq("addressee_id", userId)
    .eq("status", "pending")
    .select("requester_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That request is no longer available.");
  track("Friend Request Accepted", {});
}

export async function declineFriendRequest(userId: string, requesterId: string): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("requester_id", requesterId)
    .eq("addressee_id", userId)
    .eq("status", "pending");
  if (error) throw error;
}
