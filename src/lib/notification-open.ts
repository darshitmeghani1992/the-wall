/**
 * Alerts are navigational actions. A best-effort read receipt must not hold
 * the screen open while Auth/network is slow or offline.
 *
 * The receipt is scheduled after navigation, so synchronous receipt failures
 * are caught as well as rejected promises. Only the caller owns account/focus
 * fencing and may update visible read state after a confirmed server result.
 */
export function openNotificationWithoutWaitingForReceipt(
  navigate: () => void,
  markRead?: () => Promise<void>,
): void {
  navigate();
  if (markRead) {
    void Promise.resolve().then(markRead).catch(() => {
      // Navigation succeeded independently; refetch on the next Alerts focus.
    });
  }
}
