import { supabase } from "./supabase";
import { track } from "./analytics";
import type { Profile, Wall } from "./types";
import { requireExactCount } from "./result-contract";
import {
  normalizeSharedWallSearch,
  parsePendingSharedWallInvite,
  parseSharedWallAction,
  parseSharedWallCapabilities,
  parseSharedWallSettings,
  toSharedWallIlikePattern,
  type PendingSharedWallInvite,
  type SharedWallActionResult,
  type SharedWallCapabilitiesContract,
  type SharedWallSettingsResult,
} from "./shared-wall-contract";

/** Shared Wall client data over the shipped walls, membership, and P0 RLS contracts. */

export type NewSharedWall = {
  name: string;
  visibility?: "public" | "private";
  openJoin?: boolean;
  allowAnonymous?: boolean;
};

/**
 * Shared-wall membership data layer. Migration 0026 makes every mutation
 * actor-bound and RPC-only. Client checks shape the experience; database locks,
 * RLS, tombstones, and RPC result contracts remain the authorization boundary.
 */

export type WallMemberRole = "member";
export type WallMemberStatus = "pending" | "accepted";

export interface WallMember {
  wall_id: string;
  user_id: string;
  role: WallMemberRole;
  status: WallMemberStatus;
  created_at: string;
}

export type WallCapabilities = SharedWallCapabilitiesContract | {
  status: "available";
  wallType: "personal";
  isOwner: boolean;
  canView: true;
  canContribute: boolean;
};

/** A membership row with its user's profile resolved (null if not readable). */
export type WallMemberWithProfile = WallMember & { profile: Profile | null };

export type PublicSharedWall = Wall & { owner: Profile | null };
export type RemovedWallMember = { user_id: string; removed_at: string; profile: Profile | null };

/**
 * Create a Shared Wall owned by the signed-in user. Safe defaults are private
 * and invite-only. The database remains the authority for every invariant.
 */
export async function createSharedWall(input: NewSharedWall): Promise<Wall> {
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) throw new Error("You need to be signed in to create a Shared Wall.");

  const name = input.name.trim();
  if (!name) throw new Error("Give your Shared Wall a name.");
  if (Array.from(name).length > 60) throw new Error("Keep the Shared Wall name to 60 characters.");

  const visibility = input.visibility ?? "private";
  const openJoin = visibility === "public" && input.openJoin === true;
  const { data, error } = await supabase
    .from("walls")
    .insert({
      owner_id: uid,
      type: "shared",
      name,
      visibility,
      open_join: openJoin,
      contribution_policy: "everyone",
      allow_anonymous: input.allowAnonymous ?? true,
    })
    .select("*")
    .single();
  if (error) throw error;

  track("Shared Wall Created", {
    wall_id: (data as Wall).id,
    visibility,
    open_join: openJoin,
    allow_anonymous: input.allowAnonymous ?? true,
  });
  return data as Wall;
}

/**
 * Fetch a single RLS-readable wall by id. Null deliberately conflates missing
 * and unauthorized so callers cannot turn the read into a privacy oracle.
 */
export async function getWall(wallId: string): Promise<Wall | null> {
  const { data, error } = await supabase.from("walls").select("*").eq("id", wallId).maybeSingle();
  if (error) throw error;
  return (data as Wall) ?? null;
}

/**
 * Resolve another person's Personal Wall without turning a transport failure
 * into a false "private" state. A successful zero-row RLS response remains
 * null, deliberately conflating private and missing; actual query errors throw.
 */
export async function getReadablePersonalWall(ownerId: string): Promise<Wall | null> {
  const { data, error } = await supabase
    .from("walls")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("type", "personal")
    .maybeSingle();
  if (error) throw error;
  return (data as Wall | null) ?? null;
}

/** Auth-bound, non-enumerating capability result from the shipped P0 RPC. */
export async function getWallCapabilities(wallId: string): Promise<WallCapabilities | null> {
  const { data, error } = await supabase.rpc("get_wall_capabilities", { p_wall_id: wallId });
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  if (value.status === "unavailable") {
    if (Object.keys(value).length !== 1) throw new Error("The Wall capability response wasn't valid.");
    return null;
  }
  if (value.wall_type === "shared") return parseSharedWallCapabilities(value);
  if (
    value.status !== "available"
    || value.wall_type !== "personal"
    || typeof value.is_owner !== "boolean"
    || value.can_view !== true
    || typeof value.can_contribute !== "boolean"
  ) {
    throw new Error("The Wall capability response wasn't valid.");
  }
  return {
    status: "available",
    wallType: value.wall_type,
    isOwner: value.is_owner,
    canView: true,
    canContribute: value.can_contribute,
  };
}

/** Bounded, literal-safe public Shared-Wall discovery. */
export async function searchPublicSharedWalls(input: string): Promise<PublicSharedWall[]> {
  const query = normalizeSharedWallSearch(input);
  if (!query) return [];
  const { data, error } = await supabase
    .from("walls")
    .select("*")
    .eq("type", "shared")
    .eq("visibility", "public")
    .ilike("name", toSharedWallIlikePattern(query))
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  const walls = (data ?? []) as Wall[];
  const ownerIds = Array.from(new Set(walls.map((wall) => wall.owner_id)));
  const profiles: Record<string, Profile> = {};
  if (ownerIds.length) {
    const profileResult = await supabase.from("profiles").select("*").in("id", ownerIds);
    if (profileResult.error) throw profileResult.error;
    for (const profile of (profileResult.data ?? []) as Profile[]) profiles[profile.id] = profile;
  }
  return walls.map((wall) => ({ ...wall, owner: profiles[wall.owner_id] ?? null }));
}

/**
 * The Shared Walls the user owns. Joined walls are composed separately from the
 * accepted membership rows by `getAccessibleSharedWalls`.
 */
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

/**
 * Shared Walls available in the My Wall switcher: walls the caller owns plus
 * walls where their membership is accepted. Every read still goes through RLS;
 * membership is a discovery key, never a client-side authorization decision.
 * Duplicate owner/member results are collapsed by wall id.
 */
export async function getAccessibleSharedWalls(userId: string): Promise<Wall[]> {
  const [owned, membershipResult] = await Promise.all([
    getOwnedSharedWalls(userId),
    supabase
      .from("wall_members")
      .select("wall_id")
      .eq("user_id", userId)
      .eq("status", "accepted"),
  ]);

  if (membershipResult.error) throw membershipResult.error;

  const ownedIds = new Set(owned.map((wall) => wall.id));
  const joinedIds = Array.from(
    new Set(
      (membershipResult.data ?? [])
        .map((membership) => membership.wall_id)
        .filter((wallId): wallId is string => Boolean(wallId) && !ownedIds.has(wallId)),
    ),
  );

  let joined: Wall[] = [];
  if (joinedIds.length > 0) {
    const { data, error } = await supabase
      .from("walls")
      .select("*")
      .in("id", joinedIds)
      .eq("type", "shared");
    if (error) throw error;
    joined = (data ?? []) as Wall[];
  }

  return [...owned, ...joined]
    .filter((wall, index, walls) => walls.findIndex((candidate) => candidate.id === wall.id) === index)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Count only public Shared Walls owned by another person. Private Walls are
 * excluded even when the current viewer is independently entitled to see one;
 * this profile statistic is a public catalogue count, not a relationship view.
 */
export async function getPublicSharedWallCount(ownerId: string): Promise<number> {
  const { count, error } = await supabase
    .from("walls")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("type", "shared")
    .eq("visibility", "public");
  if (error) throw error;
  return requireExactCount(count, "The public Wall count wasn't available.");
}

/**
 * Roster for a shared wall: the `wall_members` rows this caller may read (per RLS)
 * with each member's profile hydrated in one query. Excludes the owner, whose
 * ownership is sourced from `walls.owner_id`, not a membership row (ADR-009).
 */
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

/**
 * Owner-only registered-user invitation through the actor-bound 0026 RPC.
 * A share-sheet link is deliberately not a membership invitation.
 */
export async function inviteToWall(wallId: string, userId: string): Promise<SharedWallActionResult> {
  const { data, error } = await supabase.rpc("invite_shared_wall_member", {
    p_wall_id: wallId,
    p_target_user_id: userId,
  });
  if (error) throw error;
  const result = parseSharedWallAction(data, wallId);
  if (result.status === "invited") {
    track("Shared Wall Invite Sent", { wall_id: wallId, invitee_id: userId });
  }
  return result;
}

/** Invited-user-only accept/decline through the actor-bound 0026 RPC. */
export async function respondToWallInvite(wallId: string, accept: boolean): Promise<SharedWallActionResult> {
  const { data, error } = await supabase.rpc("respond_shared_wall_invite", {
    p_wall_id: wallId,
    p_accept: accept,
  });
  if (error) throw error;
  return parseSharedWallAction(data, wallId);
}

export async function joinSharedWall(wallId: string): Promise<SharedWallActionResult> {
  const { data, error } = await supabase.rpc("join_shared_wall", { p_wall_id: wallId });
  if (error) throw error;
  return parseSharedWallAction(data, wallId);
}

export async function getPendingSharedWallInvite(wallId: string): Promise<PendingSharedWallInvite> {
  const { data, error } = await supabase
    .rpc("get_my_pending_shared_wall_invite", { p_wall_id: wallId });
  if (error) throw error;
  return parsePendingSharedWallInvite(data, wallId);
}

export async function removeSharedWallMember(wallId: string, userId: string): Promise<SharedWallActionResult> {
  const { data, error } = await supabase.rpc("remove_shared_wall_member", {
    p_wall_id: wallId,
    p_target_user_id: userId,
  });
  if (error) throw error;
  return parseSharedWallAction(data, wallId);
}

export async function leaveSharedWall(wallId: string): Promise<SharedWallActionResult> {
  const { data, error } = await supabase.rpc("leave_shared_wall", { p_wall_id: wallId });
  if (error) throw error;
  return parseSharedWallAction(data, wallId);
}

export async function updateSharedWallSettings(input: {
  wallId: string;
  name: string;
  visibility: "public" | "private";
  openJoin: boolean;
  allowAnonymous: boolean;
}): Promise<SharedWallSettingsResult> {
  const { data, error } = await supabase.rpc("update_shared_wall_settings", {
    p_wall_id: input.wallId,
    p_name: input.name,
    p_visibility: input.visibility,
    p_open_join: input.openJoin,
    p_allow_anonymous: input.allowAnonymous,
  });
  if (error) throw error;
  return parseSharedWallSettings(data, input.wallId);
}

export async function deleteSharedWall(wallId: string, expectedName: string): Promise<SharedWallActionResult> {
  const { data, error } = await supabase.rpc("delete_shared_wall", {
    p_wall_id: wallId,
    p_expected_name: expectedName,
  });
  if (error) throw error;
  return parseSharedWallAction(data, wallId);
}

export async function transferSharedWallOwnership(wallId: string, targetUserId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("transfer_shared_wall_ownership", {
    p_wall_id: wallId,
    p_target_user_id: targetUserId,
  });
  if (error) throw error;
  if (typeof data !== "boolean") throw new Error("The ownership transfer response wasn't valid.");
  return data;
}

export async function getRemovedSharedWallMembers(wallId: string): Promise<RemovedWallMember[]> {
  const { data, error } = await supabase.rpc("list_removed_shared_wall_members", { p_wall_id: wallId });
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("The removed-member response wasn't valid.");
  const rows = data.map((value) => {
    if (!value || typeof value !== "object" || typeof value.user_id !== "string" || typeof value.removed_at !== "string") {
      throw new Error("The removed-member response wasn't valid.");
    }
    return { user_id: value.user_id, removed_at: value.removed_at };
  });
  const ids = rows.map((row) => row.user_id);
  const profiles: Record<string, Profile> = {};
  if (ids.length) {
    const profileResult = await supabase.from("profiles").select("*").in("id", ids);
    if (profileResult.error) throw profileResult.error;
    for (const profile of (profileResult.data ?? []) as Profile[]) profiles[profile.id] = profile;
  }
  return rows.map((row) => ({ ...row, profile: profiles[row.user_id] ?? null }));
}
