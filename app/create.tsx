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
import { uploadImage } from "@/lib/upload";
import { colors, markColors, radius, shadow, stickySwatches } from "@/theme";

/**
 * The single integrated Mark composer (Master Spec §21). Opens ready for text and
 * offers inline media; Secret and Anonymous are MODES (toggles), never a "pick a
 * type" step. A Mark always targets someone else's Personal Wall (recipient) or a
 * Shared Wall the user belongs to — never the user's own Personal Wall.
 *
 * Content type is derived from what's attached: `photo` when an image is present,
 * otherwise `text`. Voice/Video attachments arrive in the media slice; their
 * buttons are intentionally absent until they actually record.
 *
 * Secret is text-only for now: a Secret's protected payload is the text (moved to
 * the RLS-gated side table server-side). Protecting media for Secret Marks needs
 * signed/protected storage (media slice), so we disable Secret while a photo is
 * attached rather than leak the image via the base row.
 */
const MAX_TEXT = 500;
/** Keep in step with upload.ts's MAX_PROFILE_IMAGE (6 MB). */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

type PhotoDraft = { uri: string; mime: string };

/** One identity/mode choice card ("Post as me" / "Anonymous", or the Secret one). */
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
  const [photo, setPhoto] = useState<PhotoDraft | null>(null);
  const [wallId, setWallId] = useState<string | null>(null);
  // Recipient's wall setting; when false the server rejects anonymous marks.
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [targetError, setTargetError] = useState<string | null>(null);
  // idle → (uploading photo →) posting → idle. Drives progress + button copy.
  const [phase, setPhase] = useState<"idle" | "uploading" | "posting">("idle");
  const busy = phase !== "idle";

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
  const hasContent = text.trim().length > 0 || !!photo;
  const canSubmit = !!wallId && !overLimit && hasContent && !(secret && !!photo);
  const markType = photo ? ("photo" as const) : ("text" as const);

  /** Validate a picked asset (type + size) before accepting it into the preview. */
  function acceptAsset(asset: ImagePicker.ImagePickerAsset): void {
    const mime = asset.mimeType ?? "image/jpeg";
    if (!mime.startsWith("image/")) {
      Alert.alert("Unsupported file", "Please choose a photo (JPG or PNG).");
      return;
    }
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
      Alert.alert("That photo is too big", "Please pick an image under 6 MB.");
      return;
    }
    setPhoto({ uri: asset.uri, mime });
    // A photo can't be Secret yet (protected media is a later slice) — clear it so
    // we never post a "secret" mark whose image would sit unprotected on the row.
    setSecret(false);
  }

  async function pickFromLibrary() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!res.canceled) acceptAsset(res.assets[0]);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera off", "Enable camera access in Settings to add a photo.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!res.canceled) acceptAsset(res.assets[0]);
  }

  // Live preview via the real MarkView. Secret is previewed as visible content
  // (the sender composes it) with a badge below, not as the locked shell.
  const preview = useMemo<MarkWithAuthor>(
    () => ({
      id: "preview",
      wall_id: wallId ?? "",
      author_id: currentUserId ?? null,
      type: markType,
      text: text.trim() || (photo ? "" : "your Mark…"),
      color: markType === "text" ? color : null,
      anonymous,
      secret: false,
      media_url: photo?.uri ?? null,
      payload: null,
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
    [markType, text, color, anonymous, photo, wallId, currentUserId, profile],
  );

  function confirmDiscard() {
    if (!hasContent) {
      router.back();
      return;
    }
    Alert.alert("Discard Mark?", "Your Mark won't be saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => router.back() },
    ]);
  }

  async function submit() {
    if (!canSubmit || !wallId) return;
    try {
      let mediaUrl: string | null = null;
      if (photo) {
        setPhase("uploading");
        try {
          mediaUrl = await uploadImage(photo.uri, `marks/${wallId}`, photo.mime);
        } catch (e: any) {
          Alert.alert(
            "Photo upload failed",
            e?.message ?? "We couldn't upload that photo. Check your connection and try again.",
          );
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

      {/* Attached photo preview (with a way to change/remove it) */}
      {photo ? (
        <View style={{ marginBottom: 14 }}>
          <MarkView mark={preview} />
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 4 }}>
            <Pressable onPress={pickFromLibrary} hitSlop={8}>
              <Text variant="label" color={colors.outline}>CHANGE</Text>
            </Pressable>
            <Pressable onPress={() => setPhoto(null)} hitSlop={8}>
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
            minHeight: photo ? 70 : 140,
          },
          shadow.mark,
        ]}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={photo ? "add a caption…" : "leave a little note…"}
          placeholderTextColor={colors.outline}
          multiline
          maxLength={MAX_TEXT + 1}
          autoFocus={!photo}
          style={{
            fontFamily: "Bricolage-Bold",
            fontSize: photo ? 17 : 20,
            lineHeight: 26,
            color: colors.ink,
            minHeight: photo ? 44 : 110,
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

      {/* Inline media attachments (Photos now; Voice/Video arrive in the media slice) */}
      {!photo ? (
        <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <Button label="＋ Photo" variant="ghost" onPress={pickFromLibrary} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Camera" variant="ghost" onPress={takePhoto} />
          </View>
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
          disabled={busy || !!photo}
          accessibilityRole="switch"
          accessibilityState={{ checked: secret, disabled: busy || !!photo }}
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
            opacity: busy || !!photo ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 20 }}>{secret ? "🔒" : "🔓"}</Text>
          <View style={{ flex: 1 }}>
            <Text variant="headline" style={{ fontSize: 15 }} color={secret ? markColors.secretOnPurple : colors.ink}>
              Secret Mark
            </Text>
            <Text variant="label" color={secret ? markColors.secretOnPurple : colors.outline} style={{ marginTop: 2 }}>
              {photo
                ? "Not available with a photo yet"
                : secret
                  ? "Only they can open it — once, within an hour"
                  : "Hide the content until they open it"}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Live preview (text Marks; photo mode previews above) */}
      {!photo ? (
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
                ? "Uploading photo…"
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
