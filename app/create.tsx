import { useEffect, useMemo, useState } from "react";
import { View, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { MarkView } from "@/components/marks/MarkView";
import { useAuth } from "@/lib/auth";
import { getPersonalWall } from "@/lib/profiles";
import { getWall } from "@/lib/walls";
import { createMark, type MarkWithAuthor } from "@/lib/marks";
import { track } from "@/lib/analytics";
import { uploadMedia, MEDIA_LIMITS } from "@/lib/upload";
import { useVoiceRecorder, formatDuration, MAX_VOICE_MS, MAX_VIDEO_MS } from "@/lib/recording";
import type { MarkType } from "@/lib/types";
import { colors, markColors, radius, shadow, stickySwatches } from "@/theme";

/**
 * The single integrated Mark composer (Master Spec §21). Opens ready for text and
 * offers inline media — Photo, Voice, Video — with Secret and Anonymous as MODES
 * (toggles), never a "pick a type" step. A Mark always targets someone else's
 * Personal Wall (recipient) or a Shared Wall the user belongs to.
 *
 * Content type is derived from what's attached (text / photo / voice / video).
 * Secret is text-only for now: its protected payload is the text (moved to the
 * RLS-gated side table server-side); protecting media needs signed storage (a
 * later slice), so attaching media clears Secret rather than leak the file.
 */
const MAX_TEXT = 500;

type MediaKind = "photo" | "voice" | "video";
type MediaDraft = { kind: MediaKind; uri: string; mime: string; durationMs?: number };

const KIND_TO_TYPE: Record<MediaKind, MarkType> = { photo: "photo", voice: "voice", video: "video" };
const KIND_TO_UPLOAD: Record<MediaKind, keyof typeof MEDIA_LIMITS> = {
  photo: "image",
  voice: "audio",
  video: "video",
};

/** One identity/mode choice card ("Post as me" / "Anonymous"). */
function Choice({
  active,
  disabled,
  onPress,
  title,
  subtitle,
}: {
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={`${title}, ${subtitle}`}
      style={{
        flex: 1,
        borderWidth: 2,
        borderColor: colors.ink,
        borderRadius: radius.card,
        paddingVertical: 12,
        paddingHorizontal: 12,
        backgroundColor: active ? colors.ink : colors.card,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text variant="headline" style={{ fontSize: 15 }} color={active ? colors.surface : colors.ink}>
        {title}
      </Text>
      <Text variant="label" color={active ? markColors.brandYellow : colors.outline} style={{ marginTop: 2 }}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

/** A compact attachment button in the composer's media row. */
function AttachButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: 1,
        minHeight: 44,
        borderWidth: 1.5,
        borderColor: colors.ink,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text variant="label" color={colors.ink}>{label}</Text>
    </Pressable>
  );
}

export default function Composer() {
  const router = useRouter();
  const { wallId: targetWallId, recipientId, handle, sharedWallId, wallName } =
    useLocalSearchParams<{
      wallId?: string;
      recipientId?: string;
      handle?: string;
      sharedWallId?: string;
      wallName?: string;
    }>();
  const sharedMode = Boolean(sharedWallId);
  const targetLabel = sharedMode ? wallName ?? "a Shared Wall" : `@${handle}`;
  const { session, profile } = useAuth();
  const currentUserId = session?.user.id;

  const [text, setText] = useState("");
  const [color, setColor] = useState<string>(stickySwatches[0]);
  const [anonymous, setAnonymous] = useState(false);
  const [secret, setSecret] = useState(false);
  const [media, setMedia] = useState<MediaDraft | null>(null);
  const [wallId, setWallId] = useState<string | null>(null);
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "posting">("idle");
  const busy = phase !== "idle";
  const recorder = useVoiceRecorder();
  const recording = recorder.phase === "recording";

  // Resolve + validate the target wall (RLS still enforces contribution on insert).
  useEffect(() => {
    let active = true;
    (async () => {
      if (sharedMode) {
        if (!sharedWallId) return;
        const target = await getWall(sharedWallId);
        if (!active) return;
        if (!target || target.type !== "shared") {
          setTargetError("That Shared Wall is no longer available.");
          return;
        }
        setAllowAnonymous(target.allow_anonymous);
        if (!target.allow_anonymous) setAnonymous(false);
        setWallId(target.id);
        return;
      }
      if (!currentUserId || !recipientId || !targetWallId || recipientId === currentUserId) {
        if (active) setTargetError("Choose another person's Wall before writing a Mark.");
        return;
      }
      const target = await getPersonalWall(recipientId);
      if (!active) return;
      if (!target || target.id !== targetWallId) {
        setTargetError("That recipient and Wall no longer match.");
        return;
      }
      setAllowAnonymous(target.allow_anonymous);
      if (!target.allow_anonymous) setAnonymous(false);
      setWallId(target.id);
    })().catch((cause: any) => {
      if (active) setTargetError(cause?.message ?? "Couldn't verify this Wall.");
    });
    return () => {
      active = false;
    };
  }, [currentUserId, recipientId, targetWallId, sharedMode, sharedWallId]);

  const overLimit = text.length > MAX_TEXT;
  const hasContent = text.trim().length > 0 || !!media;
  const canSubmit = !!wallId && !overLimit && hasContent && !recording && !(secret && !!media);
  const markType: MarkType = media ? KIND_TO_TYPE[media.kind] : "text";

  /** Attach media, clearing Secret (media secrecy is a later slice). */
  function attach(draft: MediaDraft) {
    setMedia(draft);
    setSecret(false);
  }

  async function pickPhoto(fromCamera: boolean) {
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Camera off", "Enable camera access in Settings to add a photo.");
        return;
      }
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (res.canceled) return;
    const asset = res.assets[0];
    const mime = asset.mimeType ?? "image/jpeg";
    if (asset.fileSize && asset.fileSize > MEDIA_LIMITS.image) {
      Alert.alert("That photo is too big", "Please pick an image under 6 MB.");
      return;
    }
    attach({ kind: "photo", uri: asset.uri, mime });
  }

  async function pickVideo(fromCamera: boolean) {
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Camera off", "Enable camera access in Settings to record a video.");
        return;
      }
    }
    const opts = {
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: Math.round(MAX_VIDEO_MS / 1000), // 30s cap at capture time
      quality: 0.8 as const,
    };
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled) return;
    const asset = res.assets[0];
    const durationMs = typeof asset.duration === "number" ? asset.duration : undefined;
    // Guard picked-from-library clips that exceed the cap (videoMaxDuration only
    // bounds capture, not library selection).
    if (durationMs && durationMs > MAX_VIDEO_MS + 1500) {
      Alert.alert("Video too long", "Video Marks are up to 30 seconds. Please trim it and try again.");
      return;
    }
    attach({ kind: "video", uri: asset.uri, mime: asset.mimeType ?? "video/mp4", durationMs });
  }

  async function toggleVoice() {
    if (recording) {
      const clip = await recorder.stop();
      if (clip) attach({ kind: "voice", uri: clip.uri, mime: clip.mime, durationMs: clip.durationMs });
      return;
    }
    await recorder.start();
  }

  async function removeMedia() {
    if (media?.kind === "voice") await recorder.reset();
    setMedia(null);
  }

  // Live preview via the real MarkView. Secret is previewed as visible content
  // (the sender composes it), not the locked shell.
  const preview = useMemo<MarkWithAuthor>(
    () => ({
      id: "preview",
      wall_id: wallId ?? "",
      author_id: currentUserId ?? null,
      type: markType,
      text: text.trim() || (media ? "" : "your Mark…"),
      color: markType === "text" ? color : null,
      anonymous,
      secret: false,
      media_url: media?.uri ?? null,
      payload: media?.durationMs ? { durationMs: media.durationMs } : null,
      rotation: 0,
      pinned: false,
      status: "active",
      created_at: new Date().toISOString(),
      author: anonymous
        ? null
        : {
            id: currentUserId ?? "me",
            display_name: profile?.display_name ?? "You",
            avatar_url: profile?.avatar_url ?? null,
            handle: profile?.handle ?? "you",
          },
    }),
    [markType, text, color, anonymous, media, wallId, currentUserId, profile],
  );

  function confirmDiscard() {
    if (!hasContent && !recording) {
      router.back();
      return;
    }
    Alert.alert("Discard Mark?", "Your Mark won't be saved.", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: async () => {
          if (recording) await recorder.reset();
          router.back();
        },
      },
    ]);
  }

  async function submit() {
    if (!canSubmit || !wallId) return;
    try {
      let mediaUrl: string | null = null;
      if (media) {
        setPhase("uploading");
        try {
          mediaUrl = await uploadMedia(media.uri, `marks/${wallId}`, media.mime, KIND_TO_UPLOAD[media.kind]);
        } catch (e: any) {
          Alert.alert("Upload failed", e?.message ?? "We couldn't upload that. Check your connection and try again.");
          setPhase("idle");
          return;
        }
      }
      setPhase("posting");
      const mark = await createMark({
        wallId,
        type: markType,
        text: text.trim() || null,
        color: markType === "text" ? color : null,
        anonymous,
        secret,
        mediaUrl,
        payload: media?.durationMs ? { durationMs: media.durationMs } : null,
      });
      if (sharedMode) track("Shared Wall Mark Created", { wall_id: wallId, mark_type: markType });
      if (router.canDismiss()) router.dismissAll();
      router.push(
        sharedMode
          ? `/shared/${sharedWallId}?justCreated=${mark.id}`
          : `/person/${recipientId}?justCreated=${mark.id}`,
      );
    } catch (e: any) {
      Alert.alert("Couldn't post that", e?.message ?? "Please try again in a moment.");
      setPhase("idle");
    }
  }

  if (targetError) {
    return (
      <Screen scroll={false} dockInset={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Text variant="headline">This Mark needs a recipient</Text>
          <Text variant="body" color={colors.error} style={{ textAlign: "center" }}>{targetError}</Text>
          <Button label="Choose a person" onPress={() => router.replace("/people-picker")} />
        </View>
      </Screen>
    );
  }

  const canToggleSecret = !media && !busy;

  return (
    <Screen dockInset={false}>
      {/* Header: Cancel · New Mark · Post */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, marginBottom: 16 }}>
        <Pressable onPress={confirmDiscard} hitSlop={10} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text variant="label" color={colors.outline}>CANCEL</Text>
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text variant="display" style={{ fontSize: 20 }}>New Mark</Text>
          <Text variant="label" color={colors.outline}>
            {sharedMode ? `ON ${targetLabel}` : `FOR ${targetLabel}`}
          </Text>
        </View>
        <Pressable
          onPress={submit}
          disabled={!canSubmit || busy}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit || busy }}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text variant="label" color={!canSubmit || busy ? colors.outlineVariant : colors.ink}>
            {phase === "uploading" ? "UPLOADING…" : phase === "posting" ? "POSTING…" : "POST"}
          </Text>
        </Pressable>
      </View>

      {/* Attached media preview (with change/remove) */}
      {media ? (
        <View style={{ marginBottom: 14 }}>
          <MarkView mark={preview} />
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 4 }}>
            {media.kind === "photo" ? (
              <Pressable onPress={() => pickPhoto(false)} hitSlop={8}>
                <Text variant="label" color={colors.outline}>CHANGE</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={removeMedia} hitSlop={8}>
              <Text variant="label" color={colors.error}>REMOVE</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Text / caption field */}
      <View
        style={[
          {
            backgroundColor: colors.card,
            borderWidth: 2,
            borderColor: colors.ink,
            borderRadius: radius.card,
            padding: 14,
            minHeight: media ? 70 : 140,
          },
          shadow.mark,
        ]}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={media ? "add a caption…" : "leave a little note…"}
          placeholderTextColor={colors.outline}
          multiline
          maxLength={MAX_TEXT + 1}
          autoFocus={!media}
          style={{
            fontFamily: "Bricolage-Bold",
            fontSize: media ? 17 : 20,
            lineHeight: 26,
            color: colors.ink,
            minHeight: media ? 44 : 110,
            textAlignVertical: "top",
          }}
        />
      </View>
      <Text
        variant="label"
        color={overLimit ? colors.error : text.length > MAX_TEXT - 40 ? markColors.roastOrange : colors.outline}
        style={{ alignSelf: "flex-end", marginTop: 6 }}
      >
        {text.length}/{MAX_TEXT}
      </Text>

      {/* Inline media attachments / recorder */}
      {recording ? (
        <View
          style={{
            marginTop: 14,
            borderWidth: 2,
            borderColor: colors.ink,
            borderRadius: radius.card,
            padding: 16,
            alignItems: "center",
            gap: 12,
            backgroundColor: markColors.skyBlue,
          }}
        >
          <Text variant="display" style={{ fontSize: 26 }}>{formatDuration(recorder.elapsedMs)}</Text>
          <Text variant="label" color={colors.outline}>RECORDING · UP TO {Math.round(MAX_VOICE_MS / 1000)}s</Text>
          <Button label="Stop ■" variant="primary" onPress={toggleVoice} />
        </View>
      ) : !media ? (
        <View style={{ gap: 10, marginTop: 14 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <AttachButton label="＋ Photo" onPress={() => pickPhoto(false)} disabled={busy} />
            <AttachButton label="Camera" onPress={() => pickPhoto(true)} disabled={busy} />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <AttachButton label="🎙 Voice" onPress={toggleVoice} disabled={busy} />
            <AttachButton label="🎬 Video" onPress={() => pickVideo(true)} disabled={busy} />
          </View>
          {recorder.denied ? (
            <Text variant="label" color={colors.error}>
              Microphone access is off — enable it in Settings to record a voice Mark.
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Color — text Marks only */}
      {markType === "text" ? (
        <View style={{ marginTop: 18 }}>
          <Text variant="label" color={colors.outline} style={{ marginBottom: 10 }}>COLOR</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {stickySwatches.map((sw) => {
              const on = sw === color;
              return (
                <Pressable
                  key={sw}
                  onPress={() => setColor(sw)}
                  accessibilityRole="button"
                  accessibilityLabel={`Card color${on ? ", selected" : ""}`}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.sticky,
                    backgroundColor: sw,
                    borderWidth: on ? 3 : 1,
                    borderColor: colors.ink,
                  }}
                />
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Identity — an explicit choice, not a buried switch. */}
      <View style={{ marginTop: 20 }}>
        <Text variant="label" color={colors.outline} style={{ marginBottom: 10 }}>WHO'S THIS FROM?</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Choice
            active={!anonymous}
            disabled={busy}
            onPress={() => setAnonymous(false)}
            title="Post as me"
            subtitle={`@${profile?.handle ?? "you"}`}
          />
          <Choice
            active={anonymous}
            disabled={busy || !allowAnonymous}
            onPress={() => setAnonymous(true)}
            title="Anonymous"
            subtitle={allowAnonymous ? "Name hidden" : "Not allowed here"}
          />
        </View>
      </View>

      {/* Secret — a privacy mode; may coexist with Anonymous. Text-only for now. */}
      <View style={{ marginTop: 16 }}>
        <Pressable
          onPress={() => setSecret((s) => !s)}
          disabled={!canToggleSecret}
          accessibilityRole="switch"
          accessibilityState={{ checked: secret, disabled: !canToggleSecret }}
          accessibilityLabel="Secret Mark — only the recipient can open it, once, within an hour"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderWidth: 2,
            borderColor: secret ? colors.ink : colors.outlineVariant,
            borderRadius: radius.card,
            padding: 14,
            backgroundColor: secret ? markColors.secretPurple : colors.card,
            opacity: canToggleSecret ? 1 : 0.6,
          }}
        >
          <Text style={{ fontSize: 20 }}>{secret ? "🔒" : "🔓"}</Text>
          <View style={{ flex: 1 }}>
            <Text variant="headline" style={{ fontSize: 15 }} color={secret ? markColors.secretOnPurple : colors.ink}>
              Secret Mark
            </Text>
            <Text variant="label" color={secret ? markColors.secretOnPurple : colors.outline} style={{ marginTop: 2 }}>
              {media
                ? "Text-only for now"
                : secret
                  ? "Only they can open it — once, within an hour"
                  : "Hide the content until they open it"}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Live preview (text Marks; media previews above) */}
      {!media && !recording ? (
        <>
          <Text variant="label" color={colors.outline} style={{ marginTop: 20, marginBottom: 12 }}>PREVIEW</Text>
          <View style={{ alignItems: "center" }}>
            <View style={{ width: "70%" }}>
              <MarkView mark={preview} />
            </View>
          </View>
          {secret ? (
            <Text variant="label" color={colors.outline} style={{ textAlign: "center", marginTop: 6 }}>
              🔒 THEY'LL SEE A LOCKED SHELL UNTIL THEY OPEN IT
            </Text>
          ) : null}
        </>
      ) : null}

      <View style={{ marginTop: 18, marginBottom: 8 }}>
        {wallId === null && currentUserId ? (
          <ActivityIndicator color={markColors.brandYellow} />
        ) : (
          <Button
            label={
              phase === "uploading"
                ? "Uploading…"
                : phase === "posting"
                  ? "Posting…"
                  : secret
                    ? "Post Secret Mark 🔒"
                    : "Leave a Mark ✦"
            }
            variant="primary"
            loading={busy}
            disabled={!canSubmit}
            onPress={submit}
          />
        )}
      </View>
    </Screen>
  );
}
