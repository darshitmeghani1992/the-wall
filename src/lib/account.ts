import { supabase } from "./supabase";
import { track } from "./analytics";
import { executeAccountDeactivation } from "./actor-bound-service-contract";
import { mapActorBoundMutationError } from "./expected-actor";
import { isAccountRoute, runForExpectedSubject, type AccountRoute } from "./onboarding-contract";

/**
 * Account lifecycle (Master Spec §82). Deactivation is a recoverable 30-day
 * window: while deactivated the account is not discoverable or interactable
 * (enforced server-side by migrations 0013/0027 — `is_active_account` gates
 * `can_view_wall` / `can_contribute` and the friend-request policy). Signing back
 * in and reactivating restores everything.
 *
 * The hard 30-day purge (final delete + Shared-Wall ownership transfer/delete) is
 * a scheduled backend job on hosted Supabase — see docs/BUILD_STATUS.md.
 */

/** Deactivate the signed-in account (recoverable). Reversible via `reactivateAccount`. */
export async function deactivateAccount(expectedActorId: string): Promise<void> {
  await executeAccountDeactivation(
    expectedActorId,
    {
      getActorId: async () => {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        return data.user?.id;
      },
      deactivate: async (actorId) => {
        const { error } = await supabase.rpc("deactivate_account", { p_expected_actor_id: actorId });
        if (error) throw mapActorBoundMutationError(error);
        track("Account Deactivated");
      },
    },
  );
}

/** Reactivate the signed-in account (returning within the recovery window). */
export async function reactivateAccount(expectedUserId: string): Promise<void> {
  await runForExpectedSubject(
    expectedUserId,
    async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user?.id ?? null;
    },
    async () => {
      const { error } = await supabase.rpc("reactivate_account");
      if (error) throw error;
      track("Account Reactivated");
    },
  );
}

/** Parameterless and actor-bound: callers cannot ask about another account. */
export async function getCurrentAccountRoute(): Promise<AccountRoute> {
  const { data, error } = await supabase.rpc("get_current_account_route");
  if (error) throw error;
  return isAccountRoute(data) ? data : "unavailable";
}

/** Normal completion and Skip both persist before navigation; Help replay never calls this. */
export async function completeWalkthrough(expectedUserId: string): Promise<void> {
  await runForExpectedSubject(
    expectedUserId,
    async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user?.id ?? null;
    },
    async () => {
      const completedAt = new Date().toISOString();
      const { data, error } = await supabase
        .from("profiles")
        .update({ walkthrough_completed_at: completedAt })
        .eq("id", expectedUserId)
        .select("id")
        .single();
      if (error) throw error;
      if (!data) throw new Error("Your walkthrough could not be saved.");
    },
  );
}
