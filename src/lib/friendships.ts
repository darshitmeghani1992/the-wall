import { supabase } from "./supabase";
import { track } from "./analytics";
import type { Friendship, Profile } from "./types";
import { normalizePeopleSearchQuery, toIlikeContainsPattern } from "./relationship-ui";
import { requireMutationRow } from "./result-contract";

export type RelationshipState = "none" | "outgoing" | "incoming" | "friends";
export type FollowState = "unavailable" | "not_following" | "following";

export type PersonRelationship = {
  profile: Profile;
  relationship: RelationshipState;
  follow: FollowState;
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

export async function searchPeople(userId: string, input: string): Promise<PersonRelationship[]> {
  const query = normalizePeopleSearchQuery(input);
  if (!query) return [];
  const pattern = toIlikeContainsPattern(query);
  // Keep the two fields as separate typed filters rather than interpolating
  // untrusted input into PostgREST's raw `.or()` expression language.
  const [handleResult, nameResult, friendships] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .ilike("handle", pattern)
      .neq("id", userId)
      .eq("account_status", "active")
      .order("handle")
      .limit(20),
    supabase
      .from("profiles")
      .select("*")
      .ilike("display_name", pattern)
      .neq("id", userId)
      .eq("account_status", "active")
      .order("display_name")
      .limit(20),
    getRelationships(userId),
  ]);
  if (handleResult.error) throw handleResult.error;
  if (nameResult.error) throw nameResult.error;

  const profiles = [...(handleResult.data ?? []), ...(nameResult.data ?? [])]
    .filter((profile, index, rows) => rows.findIndex((row) => row.id === profile.id) === index)
    .sort((a, b) => a.handle.localeCompare(b.handle))
    .slice(0, 20) as Profile[];

  return hydratePeople(userId, profiles, friendships);
}

async function hydratePeople(
  userId: string,
  profiles: Profile[],
  friendships: Friendship[],
): Promise<PersonRelationship[]> {
  const ids = profiles.map((profile) => profile.id);
  if (!ids.length) return [];

  const [wallsResult, followsResult] = await Promise.all([
    supabase
      .from("walls")
      .select("owner_id")
      .in("owner_id", ids)
      .eq("type", "personal")
      .eq("visibility", "public"),
    supabase
      .from("follows")
      .select("followed_id")
      .eq("follower_id", userId)
      .in("followed_id", ids),
  ]);
  if (wallsResult.error) throw wallsResult.error;
  if (followsResult.error) throw followsResult.error;

  const publicOwners = new Set((wallsResult.data ?? []).map((wall) => wall.owner_id));
  const followedIds = new Set((followsResult.data ?? []).map((follow) => follow.followed_id));

  return profiles.map((profile) => ({
    profile,
    relationship: relationshipState(
      friendships.find(
        (friendship) =>
          friendship.requester_id === profile.id || friendship.addressee_id === profile.id,
      ),
      userId,
    ),
    follow: publicOwners.has(profile.id)
      ? followedIds.has(profile.id) ? "following" : "not_following"
      : "unavailable",
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
  return hydratePeople(userId, (data ?? []) as Profile[], friendships);
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
  if ((await getRelationship(userId, personId)) !== "none") {
    throw new Error("That relationship has already changed. Refresh and try again.");
  }
  const { data, error } = await supabase
    .from("friendships")
    .insert({ requester_id: userId, addressee_id: personId, status: "pending" })
    .select("requester_id")
    .maybeSingle();
  if (error) throw error;
  requireMutationRow(data, "The friend request wasn't sent. Please try again.");
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
  requireMutationRow(data, "That request is no longer available.");
  track("Friend Request Accepted", {});
}

export async function declineFriendRequest(userId: string, requesterId: string): Promise<void> {
  const { data, error } = await supabase
    .from("friendships")
    .delete()
    .eq("requester_id", requesterId)
    .eq("addressee_id", userId)
    .eq("status", "pending")
    .select("requester_id")
    .maybeSingle();
  if (error) throw error;
  requireMutationRow(data, "That request is no longer available.");
}

export async function cancelFriendRequest(userId: string, addresseeId: string): Promise<void> {
  const { data, error } = await supabase
    .from("friendships")
    .delete()
    .eq("requester_id", userId)
    .eq("addressee_id", addresseeId)
    .eq("status", "pending")
    .select("requester_id")
    .maybeSingle();
  if (error) throw error;
  requireMutationRow(data, "That request is no longer available.");
}

export async function unfriend(userId: string, personId: string): Promise<void> {
  const friendships = await getRelationships(userId);
  const friendship = friendships.find(
    (row) => row.status === "accepted"
      && (row.requester_id === personId || row.addressee_id === personId),
  );
  if (!friendship) throw new Error("That friendship is no longer available.");

  const { data, error } = await supabase
    .from("friendships")
    .delete()
    .eq("requester_id", friendship.requester_id)
    .eq("addressee_id", friendship.addressee_id)
    .eq("status", "accepted")
    .select("requester_id")
    .maybeSingle();
  if (error) throw error;
  requireMutationRow(data, "That friendship is no longer available.");
}
