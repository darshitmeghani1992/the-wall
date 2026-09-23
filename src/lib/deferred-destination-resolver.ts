import type { DeferredDestination, DeferredScreenIdentity } from "./deferred-destination-contract.ts";

export type DeferredResolution =
  | { status: "available"; href: string; exactTarget: DeferredScreenIdentity }
  | { status: "terminal_unavailable" }
  | { status: "retryable_failure" };

export type DeferredResolverOperations = {
  profileByHandle?(handle: string): Promise<{ id: string } | null>;
  personalWall?(ownerId: string): Promise<{ id: string } | null>;
  sharedWall?(wallId: string): Promise<{ id: string } | null>;
  invitation?(wallId: string): Promise<{ status: "available" } | { status: "unavailable" }>;
  wallMark?(wallId: string, markId: string): Promise<{ id: string } | null>;
};

function operation<K extends keyof DeferredResolverOperations>(
  operations: DeferredResolverOperations,
  key: K,
): NonNullable<DeferredResolverOperations[K]> {
  const selected = operations[key];
  if (!selected) throw new Error(`Missing deferred resolver operation: ${key}`);
  return selected as NonNullable<DeferredResolverOperations[K]>;
}

/**
 * The only deferred-recovery absence/error classifier. A typed absence is terminal; an exception
 * is retryable. Authorization still belongs to the injected server/RLS reads.
 */
export async function resolveDeferredDestination(
  destination: DeferredDestination,
  subject: string,
  operations: DeferredResolverOperations,
): Promise<DeferredResolution> {
  try {
    switch (destination.kind) {
      case "personal_handle": {
        const profile = await operation(operations, "profileByHandle")(destination.handle);
        if (!profile) return { status: "terminal_unavailable" };
        const exactTarget: DeferredScreenIdentity = { kind: "personal", ownerId: profile.id, focusMarkId: null };
        return {
          status: "available",
          href: profile.id === subject ? "/(tabs)/home" : `/person/${profile.id}`,
          exactTarget,
        };
      }
      case "personal_user": {
        const wall = await operation(operations, "personalWall")(destination.userId);
        if (!wall) return { status: "terminal_unavailable" };
        return {
          status: "available",
          href: destination.userId === subject ? "/(tabs)/home" : `/person/${destination.userId}`,
          exactTarget: { kind: "personal", ownerId: destination.userId, focusMarkId: null },
        };
      }
      case "shared_wall": {
        const wall = await operation(operations, "sharedWall")(destination.wallId);
        if (!wall) return { status: "terminal_unavailable" };
        return {
          status: "available",
          href: `/shared/${destination.wallId}`,
          exactTarget: { kind: "shared", wallId: destination.wallId, focusMarkId: null },
        };
      }
      case "shared_invite": {
        const invite = await operation(operations, "invitation")(destination.wallId);
        if (invite.status !== "available") return { status: "terminal_unavailable" };
        return {
          status: "available",
          href: `/shared/invite/${destination.wallId}`,
          exactTarget: { kind: "shared_invite", wallId: destination.wallId },
        };
      }
      case "mark": {
        const wall = destination.container.kind === "personal"
          ? await operation(operations, "personalWall")(destination.container.ownerId)
          : await operation(operations, "sharedWall")(destination.container.wallId);
        if (!wall) return { status: "terminal_unavailable" };
        const mark = await operation(operations, "wallMark")(wall.id, destination.markId);
        if (!mark || mark.id !== destination.markId) return { status: "terminal_unavailable" };
        if (destination.container.kind === "personal") {
          const ownerId = destination.container.ownerId;
          return {
            status: "available",
            href: `${ownerId === subject ? "/(tabs)/home" : `/person/${ownerId}`}?focusMark=${destination.markId}`,
            exactTarget: { kind: "personal", ownerId, focusMarkId: destination.markId },
          };
        }
        return {
          status: "available",
          href: `/shared/${destination.container.wallId}?focusMark=${destination.markId}`,
          exactTarget: { kind: "shared", wallId: destination.container.wallId, focusMarkId: destination.markId },
        };
      }
    }
  } catch {
    return { status: "retryable_failure" };
  }
}
