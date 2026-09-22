import type { ContributionPolicy, Visibility } from "./types";

export const PEOPLE_SEARCH_MAX_LENGTH = 64;

export type FriendActionKind = "send" | "accept" | "decline" | "cancel" | "unfriend";
export type RelationshipUiState = "none" | "outgoing" | "incoming" | "friends";

export type FriendAction = Readonly<{
  kind: FriendActionKind;
  label: string;
  destructive?: boolean;
}>;

export type TargetRouteToken = Readonly<{ generation: number; targetId: string }>;
export type OtherWallAvailability = "available" | "private" | "unavailable";

/**
 * Keeps deferred native callbacks (for example an Alert confirmation) bound to
 * the route that opened them. Expo may reuse this screen for person A → B, so a
 * same-session user id fence alone is not sufficient.
 */
export class TargetRouteFence {
  private generation = 0;
  private targetId: string | null = null;

  focus(targetId: string | null): void {
    this.generation += 1;
    this.targetId = targetId;
  }

  blur(): void {
    this.generation += 1;
    this.targetId = null;
  }

  capture(targetId: string): TargetRouteToken | null {
    if (this.targetId !== targetId) return null;
    return { generation: this.generation, targetId };
  }

  isCurrent(token: TargetRouteToken, currentTargetId: string | null): boolean {
    return token.generation === this.generation
      && token.targetId === this.targetId
      && token.targetId === currentTargetId;
  }
}

/** Keep a failed read distinct from a successful RLS-hidden zero-row read. */
export function classifyOtherWallAvailability(input: {
  readFailed: boolean;
  hasReadableWall: boolean;
  hasCapabilities: boolean;
}): OtherWallAvailability {
  if (input.readFailed) return "unavailable";
  if (!input.hasReadableWall) return "private";
  return input.hasCapabilities ? "available" : "unavailable";
}

/**
 * Search stays deliberately bounded before it reaches PostgREST. Percent and
 * underscore are escaped so they remain literal user input rather than an
 * accidental match-all wildcard.
 */
export function normalizePeopleSearchQuery(input: string): string {
  return Array.from(input.trim().replace(/^@/, ""))
    .slice(0, PEOPLE_SEARCH_MAX_LENGTH)
    .join("");
}

export function toIlikeContainsPattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`;
}

export function friendActionsFor(state: RelationshipUiState): readonly FriendAction[] {
  switch (state) {
    case "none":
      return [{ kind: "send", label: "Add friend" }];
    case "outgoing":
      return [{ kind: "cancel", label: "Cancel" }];
    case "incoming":
      return [
        { kind: "accept", label: "Accept" },
        { kind: "decline", label: "Decline" },
      ];
    case "friends":
      return [{ kind: "unfriend", label: "Unfriend", destructive: true }];
  }
}

export function isFollowEligible(visibility: Visibility | null): boolean {
  return visibility === "public";
}

export function contributionUnavailableCopy(
  policy: ContributionPolicy | null,
  relationship: RelationshipUiState,
): string {
  switch (policy) {
    case "friends":
      return relationship === "outgoing"
        ? "They need to accept your friend request before you can leave a Mark."
        : relationship === "incoming"
          ? "Accept their friend request to leave a Mark."
          : "Be friends to leave a Mark here.";
    case "selected":
      return "Only people approved by the Wall owner can leave Marks here.";
    case "nobody":
      return "This Wall isn't accepting Marks right now.";
    case "everyone":
    case null:
      return "You can't leave a Mark on this Wall right now.";
  }
}
