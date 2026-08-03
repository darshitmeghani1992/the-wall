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
