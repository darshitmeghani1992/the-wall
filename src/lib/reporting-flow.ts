export type UserReportFlowInput<TReason extends string> = {
  expectedActorId: string;
  targetUserId: string;
  reason: TReason;
  details: string;
  alreadyReported: boolean;
  blockAfterReport: boolean;
  isCurrent: () => boolean;
  createReport: (
    expectedActorId: string,
    input: { userId: string; reason: TReason; details: string },
  ) => Promise<void>;
  blockUser: (expectedActorId: string, targetUserId: string) => Promise<void>;
  onReportSubmitted: () => void;
  onComplete: (blocked: boolean) => void;
  onBlockError: (cause: unknown) => void;
  onError: (cause: unknown) => void;
  onFinally: () => void;
};

/**
 * Coordinates report → optional block without ever submitting the same report
 * twice after a partial failure. Every continuation remains caller-fenced to
 * the account and target snapshot that opened the flow.
 */
export async function runUserReportFlow<TReason extends string>({
  expectedActorId,
  targetUserId,
  reason,
  details,
  alreadyReported,
  blockAfterReport,
  isCurrent,
  createReport,
  blockUser,
  onReportSubmitted,
  onComplete,
  onBlockError,
  onError,
  onFinally,
}: UserReportFlowInput<TReason>): Promise<void> {
  if (!isCurrent()) return;
  try {
    if (!alreadyReported) {
      await createReport(expectedActorId, { userId: targetUserId, reason, details });
      if (!isCurrent()) return;
      onReportSubmitted();
    }

    if (!isCurrent()) return;
    if (!blockAfterReport) {
      onComplete(false);
      return;
    }

    try {
      await blockUser(expectedActorId, targetUserId);
      if (isCurrent()) onComplete(true);
    } catch (cause) {
      if (isCurrent()) onBlockError(cause);
    }
  } catch (cause) {
    if (isCurrent()) onError(cause);
  } finally {
    if (isCurrent()) onFinally();
  }
}

