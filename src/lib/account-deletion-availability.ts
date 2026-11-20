/**
 * Temporary beta capability gate while migration 0031, the scheduler, and
 * permanent deletion worker remain undeployed. This is user-facing honesty,
 * NOT a security boundary: the server still owns permission and lifecycle rules.
 * Enable only after the Founder-approved hosted lifecycle is certified.
 */
export function accountDeletionEnabledFor(value: string | undefined): boolean {
  return value === "true";
}

export const isAccountDeletionEnabled = accountDeletionEnabledFor(
  process.env.EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED,
);
