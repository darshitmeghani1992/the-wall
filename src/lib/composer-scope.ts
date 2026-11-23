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

type ComposerWall = Readonly<{ id: string; type: "personal" | "shared"; allow_anonymous: boolean }>;

type ResolvedComposerTarget =
  | { status: "ready"; wall: ComposerWall }
  | { status: "unavailable" | "retryable"; message: string };

export async function resolveComposerTarget(
  actorId: string | null | undefined,
  { sharedWallId, recipientId, wallId }: ComposerTarget,
  getSharedWall: (wallId: string) => Promise<ComposerWall | null>,
  getPersonalWall: (recipientId: string) => Promise<ComposerWall | null>,
): Promise<ResolvedComposerTarget> {
  if (!actorId) {
    return { status: "unavailable", message: "Choose another person's Wall before writing a Mark." };
  }

  try {
    if (sharedWallId) {
      const wall = await getSharedWall(sharedWallId);
      return wall?.type === "shared" && wall.id === sharedWallId
        ? { status: "ready", wall }
        : { status: "unavailable", message: "That Shared Wall is no longer available." };
    }
    if (!recipientId || !wallId || recipientId === actorId) {
      return { status: "unavailable", message: "Choose another person's Wall before writing a Mark." };
    }
    const wall = await getPersonalWall(recipientId);
    return wall?.type === "personal" && wall.id === wallId
      ? { status: "ready", wall }
      : { status: "unavailable", message: "That recipient and Wall no longer match." };
  } catch {
    return { status: "retryable", message: "Couldn't verify this Wall. Check your connection and try again." };
  }
}
