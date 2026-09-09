import { supabase } from "./supabase";
import { track } from "./analytics";
import type { Profile, Wall } from "./types";

export type NewSharedWall = {
  name: string;
  visibility?: "public" | "private";
  allowAnonymous?: boolean;
};

export type WallMemberRole = "owner" | "member";
export type WallMemberStatus = "pending" | "accepted";

export interface WallMember {
  wall_id: string;
  user_id: string;
  role: WallMemberRole;
  status: WallMemberStatus;
  created_at: string;
}

export type WallMemberWithProfile = WallMember & { profile: Profile | null };
export type PendingInvite = WallMember & { wall: Wall | null };

export async function createSharedWall(input: NewSharedWall): Promise<Wall> {
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) throw new Error("You need to be signed in to create a Shared Wall.");

  const name = input.name.trim();
  if (!name) throw new Error("Give your Shared Wall a name.");
  const visibility = input.visibility ?? "public";

  const { data, error } = await supabase
    .from("walls")
    .insert({
      owner_id: uid,
      type: "shared",
      name,
      visibility,
      contribution_policy: visibility === "public" ? "everyone" : "nobody",
      allow_anonymous: input.allowAnonymous ?? true,
    })
    .select("*")
    .single();
  if (error) throw error;

  track("Shared Wall Created", {
    wall_id: (data as Wall).id,
    visibility,
    allow_anonymous: input.allowAnonymous ?? true,
  });
  return data as Wall;
}

export async function getWall(wallId: string): Promise<Wall | null> {
  const { data, error } = await supabase.from("walls").select("*").eq("id", wallId).maybeSingle();
  if (error) throw error;
  return (data as Wall) ?? null;
}

export async function getOwnedSharedWalls(userId: string): Promise<Wall[]> {
  const { data, error } = await supabase
    .from("walls")
    .select("*")
    .eq("owner_id", userId)
    .eq("type", "shared")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Wall[];
}

export async function getJoinedSharedWalls(userId: string): Promise<Wall[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from("wall_members")
    .select("wall_id, created_at")
    .eq("user_id", userId)
    .eq("status", "accepted")
    .order("created_at", { ascending: false });
  if (membershipError) throw membershipError;
  const ids = (memberships ?? []).map((row) => row.wall_id);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("walls")
    .select("*")
    .in("id", ids)
    .eq("type", "shared");
  if (error) throw error;

  const byId = new Map(((data ?? []) as Wall[]).map((wall) => [wall.id, wall]));
  return ids.map((id) => byId.get(id)).filter((wall): wall is Wall => Boolean(wall));
}

export async function getWallMembers(wallId: string): Promise<WallMemberWithProfile[]> {
  const { data, error } = await supabase
    .from("wall_members")
    .select("wall_id, user_id, role, status, created_at")
    .eq("wall_id", wallId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const members = (data ?? []) as WallMember[];

  const ids = Array.from(new Set(members.map((m) => m.user_id)));
  const profiles: Record<string, Profile> = {};
  if (ids.length) {
    const { data: profileRows, error: profileError } = await supabase.from("profiles").select("*").in("id", ids);
    if (profileError) throw profileError;
    for (const p of (profileRows ?? []) as Profile[]) profiles[p.id] = p;
  }

  return members.map((m) => ({ ...m, profile: profiles[m.user_id] ?? null }));
}

export async function inviteToWall(wallId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("wall_members")
    .insert({ wall_id: wallId, user_id: userId, role: "member", status: "pending" });
  if (error) throw error;
  track("Shared Wall Invite Sent", { wall_id: wallId, invitee_id: userId });
}

export async function removeWallMember(wallId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("wall_members")
    .delete()
    .eq("wall_id", wallId)
    .eq("user_id", userId);
  if (error) throw error;
  track("Shared Wall Member Removed", { wall_id: wallId, member_id: userId });
}

export async function leaveSharedWall(wallId: string): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) throw new Error("You need to be signed in to leave a Shared Wall.");
  await removeWallMember(wallId, uid);
  track("Shared Wall Left", { wall_id: wallId });
}

export async function transferSharedWallOwnership(wallId: string, targetUserId: string): Promise<void> {
  const { data, error } = await supabase.rpc("transfer_shared_wall_ownership", {
    p_wall_id: wallId,
    p_target_user_id: targetUserId,
  });
  if (error) throw error;
  if (data !== true) throw new Error("Ownership can only be transferred to an active accepted member.");
  track("Shared Wall Ownership Transferred", { wall_id: wallId, target_user_id: targetUserId });
}

export async function deleteSharedWall(wallId: string): Promise<void> {
  const { error } = await supabase
    .from("walls")
    .delete()
    .eq("id", wallId)
    .eq("type", "shared");
  if (error) throw error;
  track("Shared Wall Deleted", { wall_id: wallId });
}

export async function acceptWallMembership(wallId: string): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) throw new Error("You need to be signed in to accept an invite.");

  const { data, error } = await supabase
    .from("wall_members")
    .update({ status: "accepted" })
    .eq("wall_id", wallId)
    .eq("user_id", uid)
    .eq("status", "pending")
    .select("wall_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That invite is no longer available.");
  track("Shared Wall Invite Accepted", { wall_id: wallId });
}

export async function getPendingInvites(userId: string): Promise<PendingInvite[]> {
  const { data, error } = await supabase
    .from("wall_members")
    .select("wall_id, user_id, role, status, created_at")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const invites = (data ?? []) as WallMember[];

  const walls = await Promise.all(invites.map((inv) => getWall(inv.wall_id)));
  return invites.map((inv, i) => ({ ...inv, wall: walls[i] }));
}
