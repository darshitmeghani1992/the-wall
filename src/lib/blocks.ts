import { supabase } from "./supabase";
import { track } from "./analytics";

export async function isUserBlockedByMe(userId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return false;
  const { data, error } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", uid)
    .eq("blocked_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function blockUser(userId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("You need to be signed in to block someone.");
  if (uid === userId) throw new Error("You can't block yourself.");
  const { error } = await supabase.from("blocks").insert({ blocker_id: uid, blocked_id: userId });
  if (error && error.code !== "23505") throw error;
  track("User Blocked", { blocked_id: userId });
}

export async function unblockUser(userId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("You need to be signed in to unblock someone.");
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", uid)
    .eq("blocked_id", userId);
  if (error) throw error;
  track("User Unblocked", { blocked_id: userId });
}
