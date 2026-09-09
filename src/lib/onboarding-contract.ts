export const ACCOUNT_ROUTES = [
  "unavailable",
  "missing_profile",
  "onboarding",
  "walkthrough",
  "ready",
  "deactivated",
  "suspended",
] as const;

export type AccountRoute = (typeof ACCOUNT_ROUTES)[number];
export type WallPrivacyChoice = "private" | "public";
export type ContributionChoice = "friends" | "everyone" | "selected";
export type PostWalkthroughDestination = "discover" | null;
export const LEGACY_ONBOARDING_DESTINATION = "/" as const;

export type OnboardingDraft = {
  handle: string;
  displayName: string;
  bio: string;
  avatarUri: string | null;
  privacy: WallPrivacyChoice;
  contribution: ContributionChoice;
  allowAnonymous: boolean;
  postWalkthroughDestination: PostWalkthroughDestination;
};

export const DEFAULT_ONBOARDING_DRAFT: OnboardingDraft = {
  handle: "",
  displayName: "",
  bio: "",
  avatarUri: null,
  privacy: "private",
  contribution: "friends",
  allowAnonymous: false,
  postWalkthroughDestination: null,
};

export function isAccountRoute(value: unknown): value is AccountRoute {
  return typeof value === "string" && (ACCOUNT_ROUTES as readonly string[]).includes(value);
}

/** Server route is the only account-state authority; a hidden profile is never treated as missing. */
export function destinationForAccountRoute(route: AccountRoute): string {
  switch (route) {
    case "missing_profile":
    case "onboarding":
      return "/profile-setup";
    case "walkthrough":
      return "/walkthrough";
    case "ready":
      return "/(tabs)/home";
    case "deactivated":
      return "/account-recovery";
    case "suspended":
    case "unavailable":
      return "/account-unavailable";
  }
}

/** A preserved external intent wins, but is consumed only after walkthrough persistence succeeds. */
export function destinationAfterWalkthrough(
  pendingHref: string | null,
  requested: PostWalkthroughDestination,
): string {
  if (pendingHref) return pendingHref;
  return requested === "discover" ? "/(tabs)/discover" : "/(tabs)/home";
}

export function walkthroughRequiresPersistence(isReplay: boolean): boolean {
  return !isReplay;
}

export function sanitizeOnboardingDraft(value: unknown): OnboardingDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_ONBOARDING_DRAFT };
  }
  const draft = value as Partial<OnboardingDraft>;
  return {
    handle: typeof draft.handle === "string" ? draft.handle : "",
    displayName: typeof draft.displayName === "string" ? draft.displayName : "",
    bio: typeof draft.bio === "string" ? draft.bio.slice(0, 160) : "",
    avatarUri: typeof draft.avatarUri === "string" ? draft.avatarUri : null,
    privacy: draft.privacy === "public" ? "public" : "private",
    contribution:
      draft.contribution === "everyone" || draft.contribution === "selected"
        ? draft.contribution
        : "friends",
    allowAnonymous: draft.allowAnonymous === true,
    postWalkthroughDestination: draft.postWalkthroughDestination === "discover" ? "discover" : null,
  };
}

/** Captures exactly what Finish was pressed with; later UI events cannot alter an in-flight write. */
export function snapshotOnboardingDraft(draft: OnboardingDraft): Readonly<OnboardingDraft> {
  return Object.freeze({ ...sanitizeOnboardingDraft(draft) });
}

export function onboardingFailureMessage(cause: unknown): string {
  if (cause && typeof cause === "object") {
    const error = cause as { code?: unknown; message?: unknown; details?: unknown };
    const context = `${String(error.message ?? "")} ${String(error.details ?? "")}`.toLowerCase();
    if (error.code === "23505" && context.includes("handle")) {
      return "That username is taken. Choose another and try again.";
    }
  }
  return cause instanceof Error && cause.message
    ? cause.message
    : "Your choices are safe. Please try again.";
}

/** Verifies the authenticated subject immediately before invoking a parameterless mutation. */
export async function runForExpectedSubject<T>(
  expectedSubject: string,
  resolveSubject: () => Promise<string | null>,
  mutate: () => Promise<T>,
): Promise<T> {
  const currentSubject = await resolveSubject();
  if (currentSubject !== expectedSubject) throw new Error("Your signed-in account changed. Please try again.");
  return mutate();
}

export type AccountRouteToken = { subject: string | null; revision: number };

/**
 * Rejects delayed bootstrap responses after sign-out or account switch. Tokens are process-local;
 * authorization remains entirely server-side.
 */
export class AccountRouteFence {
  private revision = 0;
  private subject: string | null = null;

  begin(subject: string | null): AccountRouteToken {
    this.subject = subject;
    this.revision += 1;
    return { subject, revision: this.revision };
  }

  /** A stale refresh closure is a pure no-op: it must not supersede the current account token. */
  beginIfSubjectCurrent(
    requestedSubject: string | null,
    currentSubject: string | null,
  ): AccountRouteToken | null {
    if (requestedSubject !== currentSubject) return null;
    return this.begin(requestedSubject);
  }

  invalidate(subject: string | null = null): void {
    this.subject = subject;
    this.revision += 1;
  }

  isCurrent(token: AccountRouteToken, subject: string | null): boolean {
    return token.subject === subject && token.subject === this.subject && token.revision === this.revision;
  }
}

export type OnboardingPersistenceOperations = {
  persistProfile: () => Promise<void>;
  persistWall: () => Promise<void>;
  markComplete: () => Promise<void>;
};

/** The completion bit is deliberately last so any partial failure returns to retryable onboarding. */
export async function persistOnboardingInOrder(
  operations: OnboardingPersistenceOperations,
): Promise<void> {
  await operations.persistProfile();
  await operations.persistWall();
  await operations.markComplete();
}
