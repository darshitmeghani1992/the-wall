import { supabase } from "./supabase";
import { track } from "./analytics";
import type { Wall } from "./types";

/**
 * Shared Walls — the PUBLIC slice, built entirely on EXISTING contracts from
 * 0001_init.sql: `walls.type='shared'`, the "walls insert self" policy
 * (owner_id = auth.uid(), any type), and `can_view_wall` / `can_contribute`,
 * which already support public walls (visibility='public', contribution
 * 'everyone'/'friends'). No schema change.
 *
 * HONEST LIMITS (reported as C2 dependencies — NOT faked here):
 *  - There is no `wall_members` table, so membership cannot be enforced
 *    client-side. This module therefore creates PUBLIC shared walls only, and
 *    can only LIST shared walls the user OWNS (a member roster needs C2 schema).
 *  - Private shared walls, invites-as-membership, member counts/avatars, and
 *    covers (no wall cover column / storage contract) are all C2.
 */

export type NewSharedWall = {
  name: string;
  /** Only 'public' is honestly supported now; 'private' needs the C2 member model. */
  visibility?: "public";
  allowAnonymous?: boolean;
};

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

/** Fetch a single wall by id (RLS "walls view" gates visibility). Null if not viewable. */
export async function getWall(wallId: string): Promise<Wall | null> {
  const { data } = await supabase.from("walls").select("*").eq("id", wallId).maybeSingle();
  return (data as Wall) ?? null;
}

/**
 * The Shared Walls the user OWNS. Non-owned public shared walls are reached via
 * their share link (there is no member roster to enumerate joined walls — C2).
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
