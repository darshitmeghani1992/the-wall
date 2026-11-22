/**
 * Beta-only visibility fence for Secret Mark composer mode. A Secret Mark's
 * 1-hour promise requires a verified recurring `expire_secret_marks()` job.
 * Keep creation UI OFF until DevOps proves the scheduler and its monitoring.
 * Beta creator capability is frozen OFF even when EXPO_PUBLIC_* says true;
 * an approved source change is required to lift this hold.
 * This is not a database security control; atomic reveal and RLS remain server-side.
 */
export function secretComposerEnabledFor(_flag: string | undefined): boolean {
  // Never advertise the one-hour Secret guarantee without verified hosted cron.
  // An inherited build flag alone cannot remove this private-beta hold.
  return false;
}

export const isSecretComposerEnabled = secretComposerEnabledFor(process.env.EXPO_PUBLIC_SECRET_MARKS_ENABLED);
