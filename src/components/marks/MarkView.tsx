import { useEffect, useRef, useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Audio, Video, ResizeMode } from "expo-av";
import { MarkCard } from "@/components/MarkCard";
import { Text } from "@/components/Text";
import { colors, markColors, radius, type EnterMode } from "@/theme";
import { revealSecret, type MarkWithAuthor } from "@/lib/marks";
import { isMarkShareable, shareMark } from "@/lib/share";
import { formatDuration } from "@/lib/recording";
import { REACTION_EMOJIS, type ReactionEmoji, type ReactionSummary } from "@/lib/reactions";
import type { MarkType } from "@/lib/types";

/** Voice/Video Marks stash their clip length (ms) on payload for the UI. */
function markDurationMs(mark: MarkWithAuthor): number | null {
  const d = (mark.payload as { durationMs?: unknown } | null)?.durationMs;
  return typeof d === "number" && d > 0 ? d : null;
}

/** The display label for a Mark's author — anonymous Marks read "Anonymous". */
function authorName(mark: MarkWithAuthor): string {
  return mark.anonymous ? "Anonymous" : mark.author?.display_name ?? "someone";
}

/** Attribution line ("— Sofia" / "— Anonymous"), Space-Mono uppercase. */
function AuthorLine({ mark }: { mark: MarkWithAuthor }) {
  return (
    <Text variant="label" color={colors.outline} style={{ marginTop: 10 }}>
      — {authorName(mark)}
    </Text>
  );
}

/** A quiet "share this Mark" affordance shown for received, shareable Marks. */
function ShareRow({ mark, wallHandle }: { mark: MarkWithAuthor; wallHandle?: string | null }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Share this Mark from ${authorName(mark)}`}
      onPress={() => {
        void shareMark(mark, wallHandle);
      }}
      hitSlop={8}
      style={{ marginTop: 10, alignSelf: "flex-start", minHeight: 32, justifyContent: "center" }}
    >
      <Text variant="label" color={colors.outline}>SHARE ↗</Text>
    </Pressable>
  );
}

/**
 * Subtle reactions strip: any reactions already on the Mark (emoji + count,
 * tappable to toggle your own), plus a "＋" that opens the fixed 5-emoji picker.
 * Deliberately small — reactions accent a Mark, they never dominate the wall.
 * Long-pressing the Mark opens the same picker (see MarkCard `onLongPress`).
 */
function ReactionBar({
  summary,
  open,
  onOpenChange,
  onToggle,
}: {
  summary: ReactionSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (emoji: ReactionEmoji) => void;
}) {
  const active = REACTION_EMOJIS.filter((e) => (summary.counts[e] ?? 0) > 0);

  return (
    <View style={{ marginTop: 10, gap: 8 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        {active.map((emoji) => {
          const mine = summary.mine === emoji;
          return (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityState={{ selected: mine }}
              accessibilityLabel={`${mine ? "Remove your" : "Add"} ${emoji} reaction, ${summary.counts[emoji]} so far`}
              onPress={() => onToggle(emoji)}
              hitSlop={6}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                minHeight: 26,
                paddingHorizontal: 8,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: mine ? colors.ink : colors.outlineVariant,
                backgroundColor: mine ? markColors.brandYellow : colors.surfaceContainer,
              }}
            >
              <Text style={{ fontSize: 12 }}>{emoji}</Text>
              <Text variant="label" color={colors.ink}>
                {summary.counts[emoji]}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? "Close reaction picker" : "Add a reaction"}
          onPress={() => onOpenChange(!open)}
          hitSlop={6}
          style={{
            minHeight: 26,
            minWidth: 30,
            paddingHorizontal: 8,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: colors.outlineVariant,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text variant="label" color={colors.outline}>
            {open ? "×" : "＋"}
          </Text>
        </Pressable>
      </View>

      {open ? (
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {REACTION_EMOJIS.map((emoji) => {
            const mine = summary.mine === emoji;
            return (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityState={{ selected: mine }}
                accessibilityLabel={`React with ${emoji}`}
                onPress={() => {
                  onToggle(emoji);
                  onOpenChange(false);
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.card,
                  borderWidth: mine ? 2 : 1,
                  borderColor: mine ? colors.ink : colors.outlineVariant,
                  backgroundColor: mine ? markColors.brandYellow : colors.card,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 18 }}>{emoji}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/** A quiet stand-in for media before it loads (photo/voice/video). */
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

/**
 * Secret Mark. Privacy is SERVER-enforced, not client-blurred (ADR-008): the true
 * content lives in the RLS-gated `mark_secrets` table and the base `marks.text` is
 * NULL for secrets, so a non-owner never has the content on the client at all.
 *
 * Distinction from Anonymous: a Secret hides the *content* while the author stays
 * visible (AuthorLine below); Anonymous hides the *author* while the content is
 * shown. A Mark can be both (author hidden AND content hidden) — the owner reading
 * the content still learns nothing about an anonymous author, because `mark_secrets`
 * carries no author identity.
 *
 * `isWallOwner` is UX gating only — it decides whether we even offer to open. It
 * is NOT the security boundary: the `reveal_secret` RPC is (0010 / ADR-010). For a
 * non-owner we render a static locked state and NEVER call the RPC. For the owner,
 * a tap performs the ONE-TIME reveal with honest loading / consumed / expired /
 * error states. Opening is a one-way door: after a successful reveal the content is
 * shown for this session only; a later attempt returns `consumed` (§27.3), and past
 * the 1-hour window it returns `expired` (§27.4 / §111).
 */
type SecretPhase = "locked" | "loading" | "revealed" | "consumed" | "expired" | "empty" | "error";

function SecretMark({ mark, isWallOwner }: { mark: MarkWithAuthor; isWallOwner: boolean }) {
  const [phase, setPhase] = useState<SecretPhase>("locked");
  const [content, setContent] = useState<string | null>(null);

  async function reveal() {
    // Terminal states never re-fetch; only "locked" (or a retryable "error") opens.
    if (phase === "loading" || phase === "revealed" || phase === "consumed" || phase === "expired") return;
    setPhase("loading");
    try {
      const res = await revealSecret(mark.id);
      if (res.ok && res.content && res.content.length > 0) {
        setContent(res.content);
        setPhase("revealed");
      } else if (res.reason === "consumed") {
        setPhase("consumed");
      } else if (res.reason === "expired") {
        setPhase("expired");
      } else if (res.reason === "ok" || res.reason === "missing") {
        // Authorized but nothing to show (genuinely empty / already-cleaned-up).
        setPhase("empty");
      } else {
        // not_authorized should not happen behind the owner gate — treat as error.
        setPhase("error");
      }
    } catch {
      setPhase("error");
    }
  }

  // Non-owner: a static, non-interactive locked panel. No content, no fetch.
  if (!isWallOwner) {
    return (
      <View accessibilityLabel="Secret Mark. Only the wall owner can open this.">
        <View style={secretPanel}>
          <Text variant="label" color={markColors.secretOnPurple}>
            🔒 ONLY YOU CAN OPEN THIS
          </Text>
        </View>
        <AuthorLine mark={mark} />
      </View>
    );
  }

  // Owner: tap to open ONCE, with honest loading / consumed / expired / error states.
  const revealed = phase === "revealed";
  const terminal = revealed || phase === "consumed" || phase === "expired";
  const label =
    phase === "loading"
      ? "OPENING…"
      : phase === "consumed"
        ? "🔒 ALREADY OPENED"
        : phase === "expired"
          ? "🔒 THIS SECRET EXPIRED"
          : phase === "empty"
            ? "NOTHING TO SHOW"
            : phase === "error"
              ? "COULDN'T OPEN — TAP TO RETRY"
              : "🔓 TAP TO OPEN ONCE";
  const a11y =
    revealed
      ? "Secret Mark, opened"
      : phase === "consumed"
        ? "Secret Mark, already opened — it can only be opened once"
        : phase === "expired"
          ? "Secret Mark, expired"
          : "Open this Secret Mark once — only you can see it";

  return (
    <Pressable
      onPress={reveal}
      disabled={phase === "loading" || terminal}
      accessibilityRole="button"
      accessibilityLabel={a11y}
    >
      {revealed ? (
        <Text variant="mark" color={markColors.secretOnPurple}>
          {content}
        </Text>
      ) : (
        <View style={secretPanel}>
          {phase === "loading" ? (
            <ActivityIndicator color={markColors.secretOnPurple} />
          ) : (
            <Text
              variant="label"
              color={phase === "error" ? colors.error : markColors.secretOnPurple}
            >
              {label}
            </Text>
          )}
        </View>
      )}
      <AuthorLine mark={mark} />
    </Pressable>
  );
}

const secretPanel = {
  minHeight: 56,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  borderRadius: 4,
  paddingVertical: 12,
};

/** Photo Mark: a polaroid frame with the image and an optional caption below. */
function PhotoMark({ mark }: { mark: MarkWithAuthor }) {
  return (
    <View>
      <View style={{ backgroundColor: "#fff", padding: 6, borderRadius: 2 }}>
        {mark.media_url ? (
          <Image
            source={{ uri: mark.media_url }}
            style={{ width: "100%", height: 180, borderRadius: 1, backgroundColor: colors.surfaceContainerHigh }}
            contentFit="contain"
          />
        ) : (
          <Placeholder label="PHOTO" height={180} />
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

/**
 * Voice Mark: a compact play/pause control + duration. Loads the clip lazily on
 * first play and unloads it on unmount so we never leak an audio player. Device
 * playback is verified on a physical device (final QA pending).
 */
function VoiceMark({ mark }: { mark: MarkWithAuthor }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const durationMs = markDurationMs(mark);

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, []);

  async function toggle() {
    if (!mark.media_url) return;
    try {
      if (!soundRef.current) {
        setLoading(true);
        const { sound } = await Audio.Sound.createAsync({ uri: mark.media_url });
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlaying(false);
            void sound.setPositionAsync(0);
          }
        });
        setLoading(false);
      }
      if (playing) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setPlaying(true);
      }
    } catch {
      setLoading(false);
      setPlaying(false);
    }
  }

  return (
    <View>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={`${playing ? "Pause" : "Play"} voice Mark${durationMs ? `, ${formatDuration(durationMs)}` : ""}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.ink,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {loading ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={{ fontSize: 18, color: colors.surface }}>{playing ? "❙❙" : "▶"}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="label" color={colors.ink}>VOICE MARK</Text>
          <Text variant="label" color={colors.outline}>
            {durationMs ? formatDuration(durationMs) : "tap to play"}
          </Text>
        </View>
      </Pressable>
      {mark.text ? (
        <Text variant="mark" style={{ fontSize: 16, marginTop: 8 }}>
          {mark.text}
        </Text>
      ) : null}
      <AuthorLine mark={mark} />
    </View>
  );
}

/** Video Mark: the clip with native controls + an optional caption below. */
function VideoMark({ mark }: { mark: MarkWithAuthor }) {
  const durationMs = markDurationMs(mark);
  return (
    <View>
      {mark.media_url ? (
        <Video
          source={{ uri: mark.media_url }}
          style={{ width: "100%", height: 180, borderRadius: 2, backgroundColor: "#000" }}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
        />
      ) : (
        <Placeholder label="VIDEO" height={180} />
      )}
      {durationMs ? (
        <Text variant="label" color={colors.outline} style={{ marginTop: 6 }}>
          {formatDuration(durationMs)}
        </Text>
      ) : null}
      {mark.text ? (
        <Text variant="mark" style={{ fontSize: 16, marginTop: 8 }}>
          {mark.text}
        </Text>
      ) : null}
      <AuthorLine mark={mark} />
    </View>
  );
}

/** Text Mark: plain text on a tactile colored card (color chosen in the composer). */
function TextMark({ mark }: { mark: MarkWithAuthor }) {
  return (
    <View>
      <Text variant="mark" color={colors.ink}>
        {mark.text}
      </Text>
      <AuthorLine mark={mark} />
    </View>
  );
}

/**
 * Background + border + fastener chrome for a Mark. Secret Marks always wear the
 * purple locked treatment regardless of content type; otherwise chrome is by
 * content type (text cards carry the composer color; photos sit on a plain card).
 */
function chromeFor(mark: MarkWithAuthor) {
  if (mark.secret) {
    return { bg: markColors.secretPurple, bordered: false, fastener: "pin" as const };
  }
  switch (mark.type) {
    case "photo":
      return { bg: colors.card, bordered: false, fastener: "pin" as const };
    case "voice":
      return { bg: markColors.skyBlue, bordered: false, fastener: "pin" as const };
    case "video":
      return { bg: colors.card, bordered: false, fastener: "pin" as const };
    case "text":
    default:
      return { bg: mark.color ?? markColors.stickyYellow, bordered: false, fastener: "pin" as const };
  }
}

/**
 * Renders one Mark of any type inside a tilted, pinned MarkCard. This is the
 * switchboard the wall's masonry calls for every item.
 *
 * `enter`/`enterIndex`/`highlight` drive the motion system (drop-in for a fresh
 * Mark, staggered settle on wall load, a highlight pulse for the just-posted
 * one). `shareable` opts a Mark into a "Share ↗" affordance — only shown on the
 * owner's own Wall for received, non-Secret Marks.
 *
 * `isWallOwner` is passed true only when the signed-in viewer owns this wall (the
 * secret recipient). It is UX gating for the Secret reveal affordance ONLY — the
 * real confidentiality boundary is server-side RLS on `mark_secrets`, not this
 * flag. Defaults to false so every other-wall render is locked by default.
 *
 * `reactions` + `onToggleReaction` opt a Mark into the subtle reactions strip.
 * When wired, tapping the "＋" or long-pressing the Mark opens the picker; the
 * whole reaction round-trip (optimistic + realtime) is owned by the parent via
 * `useWallReactions`, not this presentational component.
 */
export function MarkView({
  mark,
  enter = "none",
  enterIndex = 0,
  highlight = false,
  shareable = false,
  wallHandle,
  isWallOwner = false,
  reactions,
  onToggleReaction,
  onOpenDetail,
}: {
  mark: MarkWithAuthor;
  enter?: EnterMode;
  enterIndex?: number;
  highlight?: boolean;
  shareable?: boolean;
  wallHandle?: string | null;
  isWallOwner?: boolean;
  reactions?: ReactionSummary;
  onToggleReaction?: (emoji: ReactionEmoji) => void;
  onOpenDetail?: () => void;
}) {
  const chrome = chromeFor(mark);
  const canShare = shareable && isMarkShareable(mark);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Reactions are opt-in and never applied to a preview (no callback wired).
  const canReact = Boolean(onToggleReaction);

  // Secret is a MODE, not a content type: a Secret Mark of any content type shows
  // the locked shell / one-time reveal, never the underlying text or media.
  let inner: React.ReactNode;
  if (mark.secret) {
    inner = <SecretMark mark={mark} isWallOwner={isWallOwner} />;
  } else {
    switch (mark.type) {
      case "photo":
        inner = <PhotoMark mark={mark} />;
        break;
      case "voice":
        inner = <VoiceMark mark={mark} />;
        break;
      case "video":
        inner = <VideoMark mark={mark} />;
        break;
      case "text":
      default:
        inner = <TextMark mark={mark} />;
    }
  }

  return (
    <MarkCard
      id={mark.id}
      background={chrome.bg}
      bordered={chrome.bordered}
      fastener={chrome.fastener}
      enter={enter}
      enterIndex={enterIndex}
      highlight={highlight}
      onPress={!mark.secret ? onOpenDetail : undefined}
      accessibilityLabel={!mark.secret ? `Open Mark from ${authorName(mark)}` : undefined}
      onLongPress={canReact ? () => setPickerOpen((o) => !o) : undefined}
    >
      {inner}
      {canShare ? <ShareRow mark={mark} wallHandle={wallHandle} /> : null}
      {canReact ? (
        <ReactionBar
          summary={reactions ?? { counts: {}, mine: null }}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onToggle={onToggleReaction!}
        />
      ) : null}
    </MarkCard>
  );
}

/** Rough per-type height so the 2-column masonry can balance itself. */
export function estimateMarkHeight(mark: MarkWithAuthor): number {
  // Secret shells are a fixed compact height (content is hidden until revealed).
  if (mark.secret) return 120;
  const base: Record<MarkType, number> = {
    text: 110,
    photo: 250,
    voice: 120,
    video: 220,
  };
  const textBump = Math.min(80, Math.floor((mark.text?.length ?? 0) / 24) * 20);
  return (base[mark.type] ?? 120) + textBump;
}
