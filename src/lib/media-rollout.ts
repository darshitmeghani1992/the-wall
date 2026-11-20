/**
 * Beta feature gate. Media upload is fail-closed until the C2/C3 processor,
 * scheduler, auth gateway and server-side kind controls are independently verified.
 * Expo inlines EXPO_PUBLIC_* at build time; this flag is not a security boundary.
 * PostgreSQL RLS and media_kind_controls remain the authoritative boundary.
 */
export function mediaComposerEnabledFor(value: string | undefined): boolean {
  return value === "true";
}

export const isMediaComposerEnabled = mediaComposerEnabledFor(process.env.EXPO_PUBLIC_MEDIA_MARKS_ENABLED);
