import type { PersonalWallSettingsPatch } from "@/lib/personal-wall-settings";

export type PersonalSettingsDraft = PersonalWallSettingsPatch;

export function personalSettingsChanged(
  saved: PersonalSettingsDraft | null,
  draft: PersonalSettingsDraft,
): boolean {
  return saved !== null && (
    saved.visibility !== draft.visibility
    || saved.contributionPolicy !== draft.contributionPolicy
    || saved.allowAnonymous !== draft.allowAnonymous
  );
}

/** The roster route is available only from the last server-confirmed policy. */
export function canManageApprovedWriters(saved: PersonalSettingsDraft | null): boolean {
  return saved?.contributionPolicy === "selected";
}

export function selectedWriterExplanation(draft: PersonalSettingsDraft): string | null {
  if (draft.contributionPolicy !== "selected") return null;
  return draft.visibility === "private"
    ? "Only approved friends can write on your private Wall."
    : "Only people you approve can write on your Wall.";
}

/**
 * Captures both actor and target before a native confirmation dialog opens.
 * The dialog callback revalidates that captured subject before dispatching.
 */
export function openCapturedTargetConfirmation<Token>({
  capture,
  isCurrent,
  targetId,
  open,
  run,
}: {
  capture: () => Token | null;
  isCurrent: (token: Token) => boolean;
  targetId: string;
  open: (onConfirm: () => void) => void;
  run: (token: Token, targetId: string) => void;
}): void {
  const token = capture();
  if (!token || !isCurrent(token)) return;
  open(() => {
    if (!isCurrent(token)) return;
    run(token, targetId);
  });
}
