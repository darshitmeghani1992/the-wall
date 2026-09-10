export const STATUS_MAX_CHARACTERS = 150;

export type StatusRemovalDecision = "allow" | "block" | "confirm";

/** Synchronous removal gate shared by editor controls and native navigation. */
export class StatusRemovalGuard {
  private busy = false;
  private dirty = false;
  private approved = false;

  setDirty(dirty: boolean): void {
    this.dirty = dirty;
  }

  beginOperation(): boolean {
    if (this.busy) return false;
    this.busy = true;
    return true;
  }

  finishOperation(): void {
    this.busy = false;
  }

  approveRemoval(): void {
    this.approved = true;
  }

  shouldPreventRemoval(): boolean {
    return !this.approved && (this.busy || this.dirty);
  }

  removalDecision(): StatusRemovalDecision {
    if (this.approved) return "allow";
    if (this.busy) return "block";
    if (this.dirty) return "confirm";
    return "allow";
  }
}

export type StatusDraft = {
  body: string;
  characterCount: number;
  valid: boolean;
  error: string | null;
};

/** Mirrors PostgreSQL char_length rather than JavaScript UTF-16 code units. */
export function statusCharacterCount(value: string): number {
  return Array.from(value).length;
}

/** Normalize the owner draft to the table's 1–150 trimmed-character contract. */
export function normalizeStatusDraft(value: string): StatusDraft {
  const body = value.trim();
  const characterCount = statusCharacterCount(body);
  if (characterCount === 0) {
    return { body, characterCount, valid: false, error: "Write something for your Status." };
  }
  if (characterCount > STATUS_MAX_CHARACTERS) {
    return {
      body,
      characterCount,
      valid: false,
      error: `Keep your Status to ${STATUS_MAX_CHARACTERS} characters.`,
    };
  }
  return { body, characterCount, valid: true, error: null };
}
