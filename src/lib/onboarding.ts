/**
 * A tiny in-memory draft for the onboarding flow. Interests picked on the
 * interests screen are read by profile-setup when the user finishes. Kept
 * deliberately simple (no store library) since it lives only for one flow.
 */
export const onboardingDraft: { interests: string[] } = { interests: [] };

/** The interest tags offered on the "Choose your interests" screen. */
export const INTEREST_TAGS = [
  "Music",
  "Travel",
  "Gaming",
  "Art",
  "Sports",
  "Food",
  "Film",
  "Books",
  "Fashion",
  "Fitness",
  "Photography",
  "Memes",
  "Tech",
  "Nature",
  "Dance",
  "Pets",
] as const;
