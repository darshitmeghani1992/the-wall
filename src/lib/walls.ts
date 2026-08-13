import { supabase } from "./supabase";
import { track } from "./analytics";
import type { Profile, Wall } from "./types";

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

/** A membership row with its user's profile resolved (null if not readable). */
export type WallMemberWithProfile = WallMember & { profile: Profile | null };

/** A pending invite addressed to the current user, with the wall resolved. */
export type PendingInvite = WallMember & { wall: Wall | null };

/**
 * Fetch a single wall by id. Returns null when the row isn't readable — including
 * the known gap where a private SHARED wall's row is not yet SELECT-able to its
 * accepted members until migration 0009 (parallel Backend work) lands. Callers
 * MUST handle null gracefully rather than assuming a wall always resolves.
 */
export async function getWall(wallId: string): Promise<Wall | null> {
  const { data } = await supabase.from("walls").select("*").eq("id", wallId).maybeSingle();
  return (data as Wall) ?? null;
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
