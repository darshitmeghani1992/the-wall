import { supabase } from "./supabase";
import { mapActorBoundMutationError, runExpectedActorMutation } from "./expected-actor";
import { descendingCreatedAtIdFilter, type CreatedAtIdCursor } from "./created-at-pagination";

/**
 * Moderation / admin data layer (Master Spec §53). All privileged actions go
 * through `SECURITY DEFINER` RPCs that authorize the caller as an admin
 * server-side (migration 0017) — the client never trusts a local `is_admin`
 * flag for authority, it only uses it to decide whether to SHOW admin UI. An
 * ordinary user calling these RPCs is rejected server-side.
 */

export type ReportRow = {
  id: string;
  reporter_id: string;
  mark_id: string | null;
  reported_user_id: string | null;
  reported_wall_id: string | null;
  reason: string;
  details: string | null;
  status: "open" | "resolved" | "dismissed";
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type ModerationAction = {
  id: string;
  actor_id: string | null;
  action: "remove_mark" | "suspend_account" | "resolve_report" | "dismiss_report";
  target_mark_id: string | null;
  target_user_id: string | null;
  report_id: string | null;
  reason: string | null;
  created_at: string;
};

export type ModerationActionCursor = CreatedAtIdCursor;

export type ModerationActionPage = {
  items: ModerationAction[];
  nextCursor: ModerationActionCursor | null;
};

export const MODERATION_ACTION_PAGE_SIZE = 50;

/** Admin: remove a Mark (moderation removal — never quota-limited). */
async function runAdminMutation(
  expectedActorId: string,
  mutate: (actorId: string) => Promise<void>,
): Promise<void> {
  await runExpectedActorMutation(
    expectedActorId,
    "You need to be signed in to moderate reports.",
    async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user?.id;
    },
    mutate,
  );
}

/** Admin: remove a Mark (moderation removal — never quota-limited). */
export async function adminRemoveMark(expectedActorId: string, markId: string, reason: string): Promise<void> {
  await runAdminMutation(expectedActorId, async (actorId) => {
    const { error } = await supabase.rpc("admin_remove_mark", {
      p_expected_actor_id: actorId, p_mark_id: markId, p_reason: reason,
    });
    if (error) throw mapActorBoundMutationError(error);
  });
}

/** Admin: suspend an account (the user cannot self-reactivate). */
export async function adminSuspendAccount(expectedActorId: string, userId: string, reason: string): Promise<void> {
  await runAdminMutation(expectedActorId, async (actorId) => {
    const { error } = await supabase.rpc("admin_suspend_account", {
      p_expected_actor_id: actorId, p_user_id: userId, p_reason: reason,
    });
    if (error) throw mapActorBoundMutationError(error);
  });
}

/** Admin: resolve (or dismiss) a report. */
export async function adminResolveReport(
  expectedActorId: string,
  reportId: string,
  status: "resolved" | "dismissed",
  reason: string,
): Promise<void> {
  await runAdminMutation(expectedActorId, async (actorId) => {
    const { error } = await supabase.rpc("admin_resolve_report", {
      p_expected_actor_id: actorId, p_report_id: reportId, p_status: status, p_reason: reason,
    });
    if (error) throw mapActorBoundMutationError(error);
  });
}

/** Admin: list reports (RLS returns rows only to admins/the reporter). */
export async function listReports(expectedActorId: string, status?: ReportRow["status"]): Promise<ReportRow[]> {
  return runExpectedActorMutation(
    expectedActorId,
    "You need to be signed in to review reports.",
    async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user?.id;
    },
    async () => {
      let query = supabase.from("reports").select("*").order("created_at", { ascending: false });
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ReportRow[];
    },
  );
}

/** Admin: a deterministic page of the moderation action log (RLS is admin-only). */
export async function listModerationActions(
  expectedActorId: string,
  cursor?: ModerationActionCursor,
): Promise<ModerationActionPage> {
  return runExpectedActorMutation(
    expectedActorId,
    "You need to be signed in to review moderation history.",
    async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user?.id;
    },
    async () => {
      let query = supabase
        .from("moderation_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(MODERATION_ACTION_PAGE_SIZE + 1);
      if (cursor) query = query.or(descendingCreatedAtIdFilter(cursor, "The moderation history cursor is invalid."));
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as ModerationAction[];
      const items = rows.slice(0, MODERATION_ACTION_PAGE_SIZE);
      const last = items.at(-1);
      return {
        items,
        nextCursor: rows.length > MODERATION_ACTION_PAGE_SIZE && last
          ? { created_at: last.created_at, id: last.id }
          : null,
      };
    },
  );
}
