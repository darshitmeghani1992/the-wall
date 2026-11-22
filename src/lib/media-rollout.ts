/**
 * Beta feature gate. Media upload is fail-closed until the C2/C3 processor,
 * scheduler, auth gateway and server-side kind controls are independently verified.
 * Expo inlines EXPO_PUBLIC_* at build time; this flag is not a security boundary.
 * Beta creator capability is frozen OFF even when EXPO_PUBLIC_* says true;
 * an approved source change is required to lift this hold.
 * PostgreSQL RLS and media_kind_controls remain the authoritative boundary.
 */
export function mediaComposerEnabledFor(_value: string | undefined): boolean {
  // Private-beta hold is intentionally non-overridable by an EAS/Expo flag.
  // Re-enable only via a reviewed code change after real C2/C3/device proof.
  return false;
}

export const isMediaComposerEnabled = mediaComposerEnabledFor(process.env.EXPO_PUBLIC_MEDIA_MARKS_ENABLED);
