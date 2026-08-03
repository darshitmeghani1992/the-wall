import PostHog from "posthog-react-native";

/**
 * Thin analytics layer. Every feature emits its events through `track()` (see
 * docs/10_Analytics.md). If no PostHog key is configured the calls are no-ops,
 * so analytics never blocks development or crashes a build without a key.
 */
const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

const client: PostHog | null = key ? new PostHog(key, { host }) : null;

// PostHog wants JSON-serializable property values.
type Props = Record<string, string | number | boolean | null>;

export function track(event: string, properties?: Props) {
  client?.capture(event, properties);
}

export function identify(distinctId: string, properties?: Props) {
  client?.identify(distinctId, properties);
}
