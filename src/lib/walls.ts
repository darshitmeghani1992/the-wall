import { supabase } from "./supabase";
import { track } from "./analytics";
import type { Profile, Wall } from "./types";
import { requireExactCount } from "./result-contract";

/** Shared Wall client data over the shipped walls, membership, and P0 RLS contracts. */

export type NewSharedWall = {
  name: string;
  /** Only 'public' is honestly supported now; 'private' needs the C2 member model. */
  visibility?: "public";
  allowAnonymous?: boolean;
};

/**
 * Shared-wall membership data layer — consumes the C2 `wall_members` contract
 * (migration 0005 / ADR-009). The RLS policies in 0005 are the real authorization
 * boundary; every client-side check here is UX convenience only:
 *   • invite   → RLS "wall_members invite owner": ONLY the wall owner, target wall
 *                MUST be `type='shared'`, row MUST start pending/member.
 *   • accept   → RLS "wall_members accept self" + transition guard: ONLY the
 *                invited user, ONLY pending→accepted.
 *   • roster   → RLS "wall_members read": your own rows, the owner sees all,
 *                accepted members see co-members.
 *
 * A rejected write surfaces as a thrown Supabase error, not a silent success.
 */

export type WallMemberRole = "owner" | "member";
export type WallMemberStatus = "pending" | "accepted";

export interface WallMember {
  wall_id: string;
  user_id: string;
  role: WallMemberRole;
  status: WallMemberStatus;
  created_at: string;
}

export type WallCapabilities = {
  status: "available";
  wallType: "personal" | "shared";
  isOwner: boolean;
  canView: true;
  canContribute: boolean;
};

/** A membership row with its user's profile resolved (null if not readable). */
export type WallMemberWithProfile = WallMember & { profile: Profile | null };

/** A pending invite addressed to the current user, with the wall resolved. */
export type PendingInvite = WallMember & { wall: Wall | null };

/**
 * Create a public Shared Wall owned by the signed-in user. Contribution is
 * 'everyone' so any viewer can leave a Mark (matches `can_contribute` for a
 * public wall). Returns the created row.
 */
export async function createSharedWall(input: NewSharedWall): Promise<Wall> {
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) throw new Error("You need to be signed in to create a Shared Wall.");

  const name = input.name.trim();
  if (!name) throw new Error("Give your Shared Wall a name.");

  const { data, error } = await supabase
    .from("walls")
    .insert({
      owner_id: uid,
      type: "shared",
      name,
      // Public only for now — see file header. Private is a C2 member-model dep.
      visibility: "public",
      contribution_policy: "everyone",
      allow_anonymous: input.allowAnonymous ?? true,
    })
    .select("*")
    .single();
  if (error) throw error;

  track("Shared Wall Created", { wall_id: (data as Wall).id, allow_anonymous: input.allowAnonymous ?? true });
  return data as Wall;
}

/**
 * Fetch a single RLS-readable wall by id. Null deliberately conflates missing
 * and unauthorized so callers cannot turn the read into a privacy oracle.
 */
export async function getWall(wallId: string): Promise<Wall | null> {
  const { data } = await supabase.from("walls").select("*").eq("id", wallId).maybeSingle();
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
  if (value.status === "unavailable") return null;
  if (
    value.status !== "available"
    || (value.wall_type !== "personal" && value.wall_type !== "shared")
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

/** The caller's own membership row, visible through existing wall_members RLS. */
export async function getMyWallMembership(
  wallId: string,
  userId: string,
): Promise<WallMember | null> {
  const { data, error } = await supabase
    .from("wall_members")
    .select("wall_id, user_id, role, status, created_at")
    .eq("wall_id", wallId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as WallMember | null) ?? null;
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
    const { data: profileRows } = await supabase.from("profiles").select("*").in("id", ids);
    for (const p of (profileRows ?? []) as Profile[]) profiles[p.id] = p;
  }

  return members.map((m) => ({ ...m, profile: profiles[m.user_id] ?? null }));
}

/**
 * Owner-only invite (UX-gated here; RLS-enforced in 0005). Inserts a pending
 * `member` membership for `userId` on `wallId`. Emits the `Shared Wall Invite
 * Sent` analytics event on success only. Throws if RLS rejects (e.g. caller
 * isn't the owner, or the wall isn't shared).
 */
export async function inviteToWall(wallId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("wall_members")
    .insert({ wall_id: wallId, user_id: userId, role: "member", status: "pending" });
  if (error) throw error;
  track("Shared Wall Invite Sent", { wall_id: wallId, invitee_id: userId });
}

/**
 * Invited-user-only accept (UX-gated here; RLS + transition guard enforce it in
 * 0005). Flips the caller's own pending row to accepted. Throws a friendly error
 * when no pending invite exists for the caller on this wall (already accepted,
 * revoked, or never invited).
 */
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
}

/** Decline a pending invite through the shipped self-delete RLS contract. */
export async function declineWallMembership(wallId: string): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) throw new Error("You need to be signed in to decline an invite.");

  const { data, error } = await supabase
    .from("wall_members")
    .delete()
    .eq("wall_id", wallId)
    .eq("user_id", uid)
    .eq("status", "pending")
    .select("wall_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That invite is no longer available.");
}

/**
 * Pending invites addressed to `userId`, each with its wall resolved. The wall may
 * come back null (see `getWall` — private shared wall rows aren't member-readable
 * until 0009); the invite itself is still valid and acceptable, so it is kept in
 * the list with `wall: null` rather than dropped.
 */
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
