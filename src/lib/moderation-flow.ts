export type ModerationTargetAction = "none" | "remove_mark" | "suspend_user";

type ModerationActionFlow = {
  expectedActorId: string;
  reportId: string;
  targetId: string | null;
  targetAction: ModerationTargetAction;
  finalStatus: "resolved" | "dismissed";
  reason: string;
  isCurrent: () => boolean;
  removeMark: (expectedActorId: string, markId: string, reason: string) => Promise<void>;
  suspendAccount: (expectedActorId: string, userId: string, reason: string) => Promise<void>;
  resolveReport: (
    expectedActorId: string,
    reportId: string,
    status: "resolved" | "dismissed",
    reason: string,
  ) => Promise<void>;
  onComplete: (reportId: string) => void;
  onError: (cause: unknown) => void;
  onFinally: () => void;
};

/** Executes an optional target action before closing its report, fencing every continuation. */
export async function runModerationActionFlow(input: ModerationActionFlow): Promise<void> {
  if (!input.isCurrent()) return;
  try {
    if (input.targetAction === "remove_mark") {
      if (!input.targetId) throw new Error("This report no longer has a Mark target.");
      await input.removeMark(input.expectedActorId, input.targetId, input.reason);
    } else if (input.targetAction === "suspend_user") {
      if (!input.targetId) throw new Error("This report no longer has a user target.");
      await input.suspendAccount(input.expectedActorId, input.targetId, input.reason);
    }
    if (!input.isCurrent()) return;
    await input.resolveReport(
      input.expectedActorId,
      input.reportId,
      input.finalStatus,
      input.reason,
    );
    if (!input.isCurrent()) return;
    input.onComplete(input.reportId);
  } catch (cause) {
    if (input.isCurrent()) input.onError(cause);
  } finally {
    if (input.isCurrent()) input.onFinally();
  }
}
