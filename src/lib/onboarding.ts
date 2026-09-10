import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_ONBOARDING_DRAFT,
  sanitizeOnboardingDraft,
  type OnboardingDraft,
} from "./onboarding-contract";

const DRAFT_PREFIX = "the-wall:onboarding-draft:v2";
const mutations = new Map<string, Promise<void>>();

function draftKey(userId: string): string {
  return `${DRAFT_PREFIX}:${userId}`;
}

function enqueue(userId: string, mutation: () => Promise<void>): Promise<void> {
  const prior = mutations.get(userId) ?? Promise.resolve();
  const next = prior.catch(() => undefined).then(mutation);
  mutations.set(userId, next);
  return next.finally(() => {
    if (mutations.get(userId) === next) mutations.delete(userId);
  });
}

/** Persisted convenience only. Supabase remains the source of truth for completed setup. */
export async function loadOnboardingDraft(userId: string): Promise<OnboardingDraft> {
  try {
    await (mutations.get(userId) ?? Promise.resolve()).catch(() => undefined);
    const stored = await AsyncStorage.getItem(draftKey(userId));
    return stored ? sanitizeOnboardingDraft(JSON.parse(stored)) : { ...DEFAULT_ONBOARDING_DRAFT };
  } catch {
    return { ...DEFAULT_ONBOARDING_DRAFT };
  }
}

export async function saveOnboardingDraft(userId: string, draft: OnboardingDraft): Promise<void> {
  const serialized = JSON.stringify(sanitizeOnboardingDraft(draft));
  await enqueue(userId, () => AsyncStorage.setItem(draftKey(userId), serialized));
}

export async function clearOnboardingDraft(userId: string): Promise<void> {
  await enqueue(userId, () => AsyncStorage.removeItem(draftKey(userId)));
}
