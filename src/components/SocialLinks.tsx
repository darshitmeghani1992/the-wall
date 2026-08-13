import { Linking, Pressable, View } from "react-native";
import { Text } from "@/components/Text";
import { colors } from "@/theme";
import type { Profile } from "@/lib/types";

/**
 * Light, uncluttered display of a profile's optional social links (0007). Renders
 * ONLY the platforms the user actually filled in — no empty slots, no LinkedIn-
 * style grid. Each provided link is a compact, tappable chip that opens the
 * resolved URL.
 *
 * Values are stored as raw trimmed strings (a handle or a full URL — ADR-011
 * leaves format to the client). `resolveUrl` normalises either form into an
 * openable https URL. Note (R-D1): links are user-provided and unvalidated beyond
 * a trim; opening them is the OS's decision and the destination is shown by the
 * platform. Kept intentionally minimal for MVP.
 */
type Platform = "instagram" | "tiktok" | "youtube" | "x" | "website";

const LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  website: "Website",
};

/** Base handle URL per platform when the user entered a bare handle, not a URL. */
const HANDLE_BASE: Record<Exclude<Platform, "website">, string> = {
  instagram: "https://instagram.com/",
  tiktok: "https://tiktok.com/@",
  youtube: "https://youtube.com/@",
  x: "https://x.com/",
};

const ORDER: Platform[] = ["instagram", "tiktok", "youtube", "x", "website"];

function resolveUrl(platform: Platform, raw: string): string {
  const value = raw.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (platform === "website") return `https://${value}`;
  return HANDLE_BASE[platform] + value.replace(/^@/, "");
}

export function SocialLinks({ profile }: { profile: Profile }) {
  const links = ORDER.map((platform) => ({ platform, value: profile[platform] }))
    .filter((l): l is { platform: Platform; value: string } => Boolean(l.value?.trim()));

  if (links.length === 0) return null;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {links.map(({ platform, value }) => (
        <Pressable
          key={platform}
          onPress={() => {
            void Linking.openURL(resolveUrl(platform, value));
          }}
          accessibilityRole="link"
          accessibilityLabel={`Open ${LABELS[platform]}`}
          hitSlop={6}
          style={{
            minHeight: 32,
            justifyContent: "center",
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: colors.ink,
          }}
        >
          <Text variant="label" color={colors.ink}>
            {LABELS[platform]} ↗
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
