import { supabase } from "./supabase";
import { track } from "./analytics";

/**
 * Account lifecycle (Master Spec §82). Deactivation is a recoverable 30-day
 * window: while deactivated the account is not discoverable or interactable
 * (enforced server-side by migration 0013 — `is_active_account` gates
 * `can_view_wall` / `can_contribute` and the friend-request policy). Signing back
 * in and reactivating restores everything.
 *
 * The hard 30-day purge (final delete + Shared-Wall ownership transfer/delete) is
 * a scheduled backend job on hosted Supabase — see docs/BUILD_STATUS.md.
 */

/** Deactivate the signed-in account (recoverable). Reversible via `reactivateAccount`. */
export async function deactivateAccount(): Promise<void> {
  const { error } = await supabase.rpc("deactivate_account");
  if (error) throw error;
  track("Account Deactivated");
}

/** Reactivate the signed-in account (returning within the recovery window). */
export async function reactivateAccount(): Promise<void> {
  const { error } = await supabase.rpc("reactivate_account");
  if (error) throw error;
  track("Account Reactivated");
}
