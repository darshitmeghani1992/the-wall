type AccountRecoveryFlow = {
  expectedActorId: string;
  isCurrent: () => boolean;
  reactivate: (expectedActorId: string) => Promise<void>;
  refreshAccountRoute: () => Promise<void>;
  navigateToCanonicalGate: () => void;
  onError: (cause: unknown) => void;
  onFinally: () => void;
};

/** Restores an account without allowing a stale session to refresh, navigate, or update UI. */
export async function runAccountRecoveryFlow({
  expectedActorId,
  isCurrent,
  reactivate,
  refreshAccountRoute,
  navigateToCanonicalGate,
  onError,
  onFinally,
}: AccountRecoveryFlow): Promise<void> {
  if (!isCurrent()) return;
  try {
    await reactivate(expectedActorId);
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
