/** Every draft and submit lock belongs to the authenticated writer and exact navigation target.
 * The React key remounts editor state before effects run; server authorization is still authoritative.
 */
export type ComposerTarget = Readonly<{
  wallId?: string | null;
  recipientId?: string | null;
  handle?: string | null;
  sharedWallId?: string | null;
  wallName?: string | null;
}>;

/** Revisions reject delayed native dialog callbacks, even after A → B → A navigation. */
export class ComposerScopeLease {
  private key: string | null = null;
  private revision = 0;

  capture(key: string): number {
    if (this.key !== key) {
      this.key = key;
      this.revision += 1;
    }
    return this.revision;
  }

  isCurrent(revision: number): boolean {
    return revision === this.revision;
  }

  invalidate(): void {
    this.key = null;
    this.revision += 1;
  }
}

export function composerScopeKey(actorId: string | null, target: ComposerTarget): string {
  return JSON.stringify([
    actorId ?? null,
    target.wallId ?? null,
    target.recipientId ?? null,
    target.handle ?? null,
    target.sharedWallId ?? null,
    target.wallName ?? null,
  ]);
}
