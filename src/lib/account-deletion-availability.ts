/**
 * Temporary beta capability gate while migration 0031, the scheduler, and
 * permanent deletion worker remain undeployed. This is user-facing honesty,
 * NOT a security boundary: the server still owns permission and lifecycle rules.
 * Enable only after the Founder-approved hosted lifecycle is certified.
 * Beta creator capability is frozen OFF even when EXPO_PUBLIC_* says true;
 * an approved source change is required to lift this hold.
 */
export function accountDeletionEnabledFor(_value: string | undefined): boolean {
  // Do not promise deletion without separately approved 0031 + purge worker.
  // A build variable cannot substitute for Founder/Reviewer/QA lifecycle proof.
  return false;
}

export const isAccountDeletionEnabled = accountDeletionEnabledFor(
  process.env.EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED,
);
