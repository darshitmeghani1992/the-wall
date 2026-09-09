import { supabase } from "./supabase";
import { track } from "./analytics";

/**
 * Reporting (Master Spec §52). A user files a report against exactly one target —
 * a Mark, a user, or a Shared Wall — with a reason from the fixed vocabulary and
 * optional details. Reports are real moderation records (RLS + constraints in
 * migration 0017): the reporter reads their own; admins read all; resolution is
 * admin-only. This layer is thin data access.
 */

export const REPORT_REASONS = [
  "harassment",
  "hate",
  "sexual",
  "spam",
  "impersonation",
  "privacy",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Human labels for the report reasons (picker order = REPORT_REASONS). */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  harassment: "Harassment",
  hate: "Hate or abuse",
  sexual: "Sexual or inappropriate content",
  spam: "Spam",
  impersonation: "Impersonation",
  privacy: "Privacy",
  other: "Other",
};

type ReportTarget =
  | { markId: string; userId?: never; wallId?: never }
  | { userId: string; markId?: never; wallId?: never }
  | { wallId: string; markId?: never; userId?: never };

/** File a report against exactly one target. Throws if not signed in / invalid. */
export async function createReport(
  input: ReportTarget & { reason: ReportReason; details?: string },
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("You need to be signed in to report.");

  const { error } = await supabase.from("reports").insert({
    reporter_id: uid,
    mark_id: input.markId ?? null,
    reported_user_id: input.userId ?? null,
    reported_wall_id: input.wallId ?? null,
    reason: input.reason,
    details: input.details?.trim() || null,
  });
  if (error) throw error;

  track("Report Submitted", {
    reason: input.reason,
    target: input.markId ? "mark" : input.userId ? "user" : "wall",
  });
}
