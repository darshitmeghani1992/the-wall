import { supabase } from "./supabase";
import type { Profile } from "./types";

/**
 * Approved Writers (Master Spec §15, §50). Relevant only when a Wall's
 * contribution policy is 'selected'. Only the wall OWNER manages the list
 * (enforced by migration 0015 RLS); an approved writer may write even without
 * friendship, but **private visibility wins** (a non-friend approved writer still
 * can't write to a private wall — server-enforced in `can_contribute`). Approval
 * grants no friendship, follow, or private-Wall viewing. This layer is thin data
 * access.
 */

/** Owner: approve a user to write on this Wall. Throws if not owner / blocked. */
export async function addApprovedWriter(wallId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("approved_writers").insert({ wall_id: wallId, user_id: userId });
  if (error) throw error;
}

/** Owner: revoke a user's approval. */
export async function removeApprovedWriter(wallId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("approved_writers")
    .delete()
    .eq("wall_id", wallId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Is this user an approved writer on the Wall? */
export async function isApprovedWriter(wallId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("approved_writers")
    .select("user_id")
    .eq("wall_id", wallId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/** Owner: list the approved writers (their profiles) for a Wall. */
export async function listApprovedWriters(wallId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("approved_writers")
    .select("user_id")
    .eq("wall_id", wallId);
  if (error) throw error;
  const ids = (data ?? []).map((r) => (r as { user_id: string }).user_id);
  if (!ids.length) return [];
  const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
  return (profiles ?? []) as Profile[];
}
