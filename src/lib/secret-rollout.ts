/**
 * Beta-only visibility fence for Secret Mark composer mode. A Secret Mark's
 * 1-hour promise requires a verified recurring `expire_secret_marks()` job.
 * Keep creation UI OFF until DevOps proves the scheduler and its monitoring.
 * This is not a database security control; atomic reveal and RLS remain server-side.
 */
export function secretComposerEnabledFor(flag: string | undefined): boolean {
  return flag === "true";
}

export const isSecretComposerEnabled = secretComposerEnabledFor(process.env.EXPO_PUBLIC_SECRET_MARKS_ENABLED);
