import type { ReportReason } from "@/lib/reports";

type GuardedFlowCallbacks = {
  isCurrent: () => boolean;
  onError: (cause: unknown) => void;
  onFinally: () => void;
};

type SettingsDeactivationFlow = GuardedFlowCallbacks & {
  expectedActorId: string;
  deactivate: (expectedActorId: string) => Promise<void>;
  refreshAccountRoute: () => Promise<void>;
  navigateToCanonicalGate: () => void;
};

/** Runs the Settings mutation without allowing a stale account to refresh or navigate. */
export async function runSettingsDeactivationFlow({
  expectedActorId,
  isCurrent,
  deactivate,
  refreshAccountRoute,
  navigateToCanonicalGate,
  onError,
  onFinally,
}: SettingsDeactivationFlow): Promise<void> {
  if (!isCurrent()) return;
  try {
    await deactivate(expectedActorId);
    if (!isCurrent()) return;
    await refreshAccountRoute();
    if (!isCurrent()) return;
    navigateToCanonicalGate();
  } catch (cause) {
    if (isCurrent()) onError(cause);
  } finally {
    if (isCurrent()) onFinally();
  }
}

type MarkReportRemovalFlow = GuardedFlowCallbacks & {
  expectedActorId: string;
  markId: string;
  reason: ReportReason;
  details: string;
  alreadyReported: boolean;
  removeAfterReport: boolean;
  createReport: (
    expectedActorId: string,
    input: { markId: string; reason: ReportReason; details: string },
  ) => Promise<void>;
  removeMark: (expectedActorId: string, markId: string, reason: "safety") => Promise<void>;
  onReportSubmitted: () => void;
  onMarkRemoved: (markId: string) => void;
  onClose: () => void;
  onRemovalError: () => void;
};

/**
 * Runs report -> optional safety removal while fencing every continuation to
 * the account and Mark generation captured by the caller.
 */
export async function runMarkReportRemovalFlow({
  expectedActorId,
  markId,
  reason,
  details,
  alreadyReported,
  removeAfterReport,
  isCurrent,
  createReport,
  removeMark,
  onReportSubmitted,
  onMarkRemoved,
  onClose,
  onRemovalError,
  onError,
  onFinally,
}: MarkReportRemovalFlow): Promise<void> {
  if (!isCurrent()) return;
  try {
    if (!alreadyReported) {
      await createReport(expectedActorId, { markId, reason, details });
      if (!isCurrent()) return;
      onReportSubmitted();
    }
    if (!isCurrent()) return;
    if (!removeAfterReport) {
      onClose();
      return;
    }
    try {
      await removeMark(expectedActorId, markId, "safety");
      if (!isCurrent()) return;
      onMarkRemoved(markId);
      if (!isCurrent()) return;
      onClose();
    } catch {
      if (isCurrent()) onRemovalError();
    }
  } catch (cause) {
    if (isCurrent()) onError(cause);
  } finally {
    if (isCurrent()) onFinally();
  }
}
