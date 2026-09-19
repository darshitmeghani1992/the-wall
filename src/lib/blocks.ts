import { supabase } from "./supabase";
import { track } from "./analytics";
import { mapActorBoundMutationError, requireExpectedActor } from "./expected-actor";
import { requireMutationRow } from "./result-contract";
import { parseBlockedUsersResult } from "./blocked-users-contract";
import type { BlockedUsersCursor, BlockedUsersResult } from "./blocked-users-contract";

export type { BlockedUser, BlockedUsersCursor, BlockedUsersResult } from "./blocked-users-contract";

export async function listBlockedUsers(
  expectedActorId: string,
  cursor: BlockedUsersCursor | null = null,
): Promise<BlockedUsersResult> {
  const { data: auth } = await supabase.auth.getUser();
  const actorId = requireExpectedActor(
    expectedActorId,
    auth.user?.id,
    "You need to be signed in to manage blocked users.",
  );
  const { data, error } = await supabase.rpc("list_my_blocked_users", {
    p_expected_actor_id: actorId,
    p_before_blocked_at: cursor?.blockedAt ?? null,
    p_before_user_id: cursor?.userId ?? null,
  });
  if (error) throw mapActorBoundMutationError(error);
  return parseBlockedUsersResult(data);
}

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

export async function blockUser(expectedActorId: string, userId: string): Promise<void> {
  if (expectedActorId === userId) throw new Error("You can't block yourself.");
  const { data: auth } = await supabase.auth.getUser();
  const uid = requireExpectedActor(
    expectedActorId,
    auth.user?.id,
    "You need to be signed in to block someone.",
  );
  const { error } = await supabase.from("blocks").insert({ blocker_id: uid, blocked_id: userId });
  if (error && error.code !== "23505") throw error;
  track("User Blocked", { blocked_id: userId });
}

export async function unblockUser(expectedActorId: string, userId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = requireExpectedActor(
    expectedActorId,
    auth.user?.id,
    "You need to be signed in to unblock someone.",
  );
  const { data, error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", uid)
    .eq("blocked_id", userId)
    .select("blocked_id")
    .maybeSingle();
  if (error) throw error;
  const removed = requireMutationRow(data, "That blocked user is no longer available.");
  if ((removed as { blocked_id?: unknown }).blocked_id !== userId) {
    throw new Error("The unblocked user didn't match the requested account.");
  }
  track("User Unblocked", { blocked_id: userId });
}
