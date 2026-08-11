import { useState } from "react";
import { View, Pressable } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { MarkCard } from "@/components/MarkCard";
import { Text } from "@/components/Text";
import { Icon } from "@/components/Icon";
import { colors, markColors, TILT_LOUD } from "@/theme";
import type { MarkWithAuthor } from "@/lib/marks";
import type { MarkType } from "@/lib/types";

/** Attribution line ("— Sofia" / "— anonymous"), Space-Mono uppercase. */
function AuthorLine({ mark }: { mark: MarkWithAuthor }) {
  const name = mark.anonymous ? "anonymous" : (mark.author?.display_name ?? "someone");
  return (
    <Text variant="label" color={colors.outline} style={{ marginTop: 10 }}>
      — {name}
    </Text>
  );
}

/** A dashed/striped stand-in for photos & doodles before an image loads. */
function Placeholder({ label, height = 130 }: { label: string; height?: number }) {
  return (
    <View
      style={{
        height,
        backgroundColor: "#e9e5da",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 2,
      }}
    >
      <Text variant="label" color="#a9a396">
        {label}
      </Text>
    </View>
  );
}

/** Secret: covered until tapped, then the text is revealed (blur lifts). */
function SecretMark({ mark }: { mark: MarkWithAuthor }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <Pressable onPress={() => setRevealed((r) => !r)}>
      <View style={{ position: "relative" }}>
        <Text variant="mark" color={markColors.secretOnPurple}>
          {mark.text}
        </Text>
        {!revealed ? (
          <BlurView
            intensity={22}
            tint="dark"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 4,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name="hidden" size={14} color={markColors.secretOnPurple} />
              <Text variant="label" color={markColors.secretOnPurple}>
                TAP TO REVEAL
              </Text>
            </View>
          </BlurView>
        ) : null}
      </View>
      <AuthorLine mark={mark} />
    </Pressable>
  );
}

/** Poll: the question + each option as a hard-bordered bar (voting: Phase 5). */
function PollMark({ mark }: { mark: MarkWithAuthor }) {
  const payload = mark.payload as { question?: string; options?: string[] } | null;
  const options = payload?.options ?? [];
  return (
    <View>
      <Text variant="headline" style={{ marginBottom: 10 }}>
        {payload?.question ?? mark.text}
      </Text>
      {options.map((opt, i) => (
        <View
          key={i}
          style={{
            borderWidth: 2,
            borderColor: colors.ink,
            borderRadius: 4,
            paddingVertical: 8,
            paddingHorizontal: 10,
            marginBottom: 8,
          }}
        >
          <Text variant="body" style={{ fontWeight: "600" }}>
            {opt}
          </Text>
        </View>
      ))}
      <AuthorLine mark={mark} />
    </View>
  );
}

/** Prediction: locked (with unlock date) until its time passes, then revealed. */
function PredictionMark({ mark }: { mark: MarkWithAuthor }) {
  const payload = mark.payload as { unlock_at?: string } | null;
  const unlockAt = payload?.unlock_at ? new Date(payload.unlock_at) : null;
  const locked = unlockAt ? unlockAt.getTime() > Date.now() : false;

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name={locked ? "lock" : "unlock"} size={13} color={colors.outline} />
        <Text variant="label" color={colors.outline}>
          PREDICTION
        </Text>
      </View>
      {locked ? (
        <Text variant="mark" color={colors.onSurfaceVariant} style={{ marginTop: 8 }}>
          Unlocks {unlockAt?.toLocaleDateString()}
        </Text>
      ) : (
        <Text variant="mark" style={{ marginTop: 8 }}>
          {mark.text}
        </Text>
      )}
      <AuthorLine mark={mark} />
    </View>
  );
}

/** Photo / Memory: a polaroid frame with the image and a caption below. */
function PhotoMark({ mark }: { mark: MarkWithAuthor }) {
  return (
    <View>
      <View style={{ backgroundColor: "#fff", padding: 6, borderRadius: 2 }}>
        {mark.media_url ? (
          <Image
            source={{ uri: mark.media_url }}
            style={{ width: "100%", height: 150, borderRadius: 1 }}
            contentFit="cover"
          />
        ) : (
          <Placeholder label="PHOTO" height={150} />
        )}
      </View>
      {mark.text ? (
        <Text variant="mark" style={{ fontSize: 16, marginTop: 8 }}>
          {mark.text}
        </Text>
      ) : null}
      <AuthorLine mark={mark} />
    </View>
  );
}

/** Award: dark card, gold badge, the award title + note. */
function AwardMark({ mark }: { mark: MarkWithAuthor }) {
  const payload = mark.payload as { award?: string } | null;
  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: markColors.awardGoldFrom,
          borderWidth: 2,
          borderColor: "#6b6400",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <Icon name="award" size={26} color="#3a2f00" />
      </View>
      <Text variant="headline" color="#f2f1ec" style={{ textAlign: "center" }}>
        {payload?.award ?? mark.text ?? "Award"}
      </Text>
      <Text variant="label" color="#c8c6c5" style={{ marginTop: 8 }}>
        — {mark.anonymous ? "anonymous" : (mark.author?.display_name ?? "someone")}
      </Text>
    </View>
  );
}

/** Doodle: the drawing image on a paper card. */
function DoodleMark({ mark }: { mark: MarkWithAuthor }) {
  return (
    <View>
      {mark.media_url ? (
        <Image
          source={{ uri: mark.media_url }}
          style={{ width: "100%", height: 150, borderRadius: 2 }}
          contentFit="contain"
        />
      ) : (
        <Placeholder label="DOODLE" height={150} />
      )}
      <AuthorLine mark={mark} />
    </View>
  );
}

/** Sticky / Roast: plain text mark; roast is larger and always ink-bordered. */
function TextMark({ mark, roast }: { mark: MarkWithAuthor; roast?: boolean }) {
  return (
    <View>
      <Text
        variant="mark"
        color={roast ? "#3a1400" : colors.ink}
        style={roast ? { fontSize: 22, fontWeight: "700" } : undefined}
      >
        {mark.text}
      </Text>
      <AuthorLine mark={mark} />
    </View>
  );
}

/**
 * Background + border + fastener chrome per mark type. A fastener is a signal,
 * not wallpaper (VD §3): only the higher-emotion types wear one; quiet types
 * (sticky/poll/prediction/doodle) let shadow + tilt carry the "pinned" feeling.
 */
function chromeFor(type: MarkType, color: string | null) {
  switch (type) {
    case "roast":
      return { bg: markColors.roastOrange, bordered: true, fastener: "tape" as const };
    case "secret":
      return { bg: markColors.secretPurple, bordered: false, fastener: "tape" as const };
    case "memory":
    case "photo":
      return { bg: colors.card, bordered: false, fastener: "tape" as const };
    case "award":
      return { bg: "#232221", bordered: false, fastener: "tape" as const };
    case "poll":
      return { bg: markColors.memoryCream, bordered: false, fastener: "none" as const };
    case "prediction":
      return { bg: markColors.skyBlue, bordered: false, fastener: "none" as const };
    case "doodle":
      return { bg: colors.card, bordered: false, fastener: "none" as const };
    case "sticky":
    default:
      return { bg: color ?? markColors.stickyYellow, bordered: false, fastener: "none" as const };
  }
}

/**
 * Renders one Mark of any type inside a tilted, pinned MarkCard. This is the
 * switchboard the wall's masonry calls for every item.
 *
 * `isOwn` demotes the owner's own Mark to the middle elevation tier (quieter
 * than others' Marks) — Principle 2, and the visual reading of the seed's
 * "not the loud, repeatable hero" guardrail (AC-8). `settleDelay` staggers the
 * card's SETTLE entrance on a populated wall's first paint.
 */
export function MarkView({
  mark,
  dropIn,
  isOwn,
  settleDelay,
}: {
  mark: MarkWithAuthor;
  dropIn?: boolean;
  isOwn?: boolean;
  settleDelay?: number;
}) {
  const chrome = chromeFor(mark.type, mark.color);

  let inner: React.ReactNode;
  switch (mark.type) {
    case "secret":
      inner = <SecretMark mark={mark} />;
      break;
    case "poll":
      inner = <PollMark mark={mark} />;
      break;
    case "prediction":
      inner = <PredictionMark mark={mark} />;
      break;
    case "photo":
    case "memory":
      inner = <PhotoMark mark={mark} />;
      break;
    case "award":
      inner = <AwardMark mark={mark} />;
      break;
    case "doodle":
      inner = <DoodleMark mark={mark} />;
      break;
    case "roast":
      inner = <TextMark mark={mark} roast />;
      break;
    default:
      inner = <TextMark mark={mark} />;
  }

  return (
    <MarkCard
      id={mark.id}
      background={chrome.bg}
      bordered={chrome.bordered}
      fastener={chrome.fastener}
      tier={isOwn ? "seed" : "mark"}
      tiltAmplitude={mark.type === "roast" ? TILT_LOUD : undefined}
      dropIn={dropIn}
      settleDelay={settleDelay}
    >
      {inner}
    </MarkCard>
  );
}

/** Rough per-type height so the 2-column masonry can balance itself. */
export function estimateMarkHeight(mark: MarkWithAuthor): number {
  const base: Record<MarkType, number> = {
    sticky: 110,
    roast: 130,
    secret: 120,
    memory: 220,
    photo: 220,
    award: 150,
    poll: 170,
    doodle: 200,
    prediction: 120,
  };
  const textBump = Math.min(80, Math.floor((mark.text?.length ?? 0) / 24) * 20);
  return (base[mark.type] ?? 120) + textBump;
}
