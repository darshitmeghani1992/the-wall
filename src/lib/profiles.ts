import { supabase } from "./supabase";
import type { Profile, Wall } from "./types";

/** Fetch the signed-in user's profile row, or null if they haven't set one up. */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return (data as Profile) ?? null;
}

/** Look up a profile by its @handle (case-insensitive). Powers handle deep links. */
export async function getProfileByHandle(handle: string): Promise<Profile | null> {
  const clean = handle.trim().replace(/^@/, "");
  if (!clean) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .ilike("handle", clean)
    .maybeSingle();
  return (data as Profile) ?? null;
}

/** The editable fields on a profile. `handle` is intentionally immutable here. */
export type ProfileUpdate = {
  display_name?: string;
  bio?: string | null;
  avatar_url?: string | null;
};

/**
 * Update the signed-in user's own profile row. Relies on the existing
 * `profiles update self` RLS policy — no schema change. Returns the fresh row.
 * The caller is responsible for refreshing any cached auth profile afterwards.
 */
export async function updateProfile(userId: string, patch: ProfileUpdate): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Profile;
}

/** Is a handle free? Case-insensitive. */
export async function isHandleAvailable(handle: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .ilike("handle", handle)
    .maybeSingle();
  return !data;
}

export type NewProfile = {
  id: string;
  handle: string;
  display_name: string;
  bio?: string | null;
  avatar_url?: string | null;
  interests?: string[];
};

/**
 * Create the profile row. A DB trigger (`profiles_personal_wall`) then creates
 * the user's Personal Wall automatically — so the client never has to.
 */
export async function createProfile(p: NewProfile): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: p.id,
      handle: p.handle.toLowerCase().replace(/^@/, ""),
      display_name: p.display_name,
      bio: p.bio ?? null,
      avatar_url: p.avatar_url ?? null,
      interests: p.interests ?? [],
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Profile;
}

/** The user's own Personal Wall (created by the DB trigger at signup). */
export async function getPersonalWall(userId: string): Promise<Wall | null> {
  const { data } = await supabase
    .from("walls")
    .select("*")
    .eq("owner_id", userId)
    .eq("type", "personal")
    .maybeSingle();
  return (data as Wall) ?? null;
}
