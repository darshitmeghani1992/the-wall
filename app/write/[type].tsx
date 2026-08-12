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
import type { MarkType } from "@/lib/types";
import { colors, markColors, radius, shadow, stickySwatches } from "@/theme";

const MAX_TEXT = 500;
const MAX_CAPTION = 200;
/** Keep in step with upload.ts's MAX_PROFILE_IMAGE (6 MB). */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const SUPPORTED: MarkType[] = ["sticky", "roast", "secret", "memory"];

const COPY: Record<string, { title: string; placeholder: string }> = {
  sticky: { title: "Write a Sticky", placeholder: "leave a little note…" },
  roast: { title: "Roast them", placeholder: "lovingly savage…" },
  secret: { title: "Leave a Secret", placeholder: "shhh… only revealed on tap" },
  memory: { title: "Share a Memory", placeholder: "add a caption…" },
};

/** One of the two identity options ("Post as me" / "Anonymous"). */
function IdentityChoice({
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

export default function Writer() {
  const router = useRouter();
  const {
    type: rawType,
    wallId: targetWallId,
    recipientId,
    handle,
    sharedWallId,
    wallName,
  } = useLocalSearchParams<{
    type: string;
    wallId?: string;
    recipientId?: string;
    handle?: string;
    sharedWallId?: string;
    wallName?: string;
  }>();
  const type = (rawType ?? "sticky") as MarkType;
  // A Mark targets either a person's Wall (recipient) or a Shared Wall.
  const sharedMode = Boolean(sharedWallId);
  const targetLabel = sharedMode ? wallName ?? "a Shared Wall" : `@${handle}`;
  const { session, profile } = useAuth();
  const currentUserId = session?.user.id;

  const isPhoto = type === "memory" || type === "photo";
  const isSticky = type === "sticky";
  const maxLen = isPhoto ? MAX_CAPTION : MAX_TEXT;

  const [text, setText] = useState(""); // note text, or caption in photo mode
  const [color, setColor] = useState<string>(stickySwatches[0]);
  const [anonymous, setAnonymous] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>("image/jpeg");
  const [wallId, setWallId] = useState<string | null>(null);
  // Recipient's wall setting; when false the server trigger rejects anonymous marks.
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [targetError, setTargetError] = useState<string | null>(null);
  // idle → (uploading photo →) posting → idle. Drives progress + button copy.
  const [phase, setPhase] = useState<"idle" | "uploading" | "posting">("idle");
  const busy = phase !== "idle";

  useEffect(() => {
    let active = true;
    (async () => {
      // Shared Wall target: verify it exists and is a shared wall; RLS still
      // enforces contribution on insert.
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
      // This wall forbids anonymous marks — force "Post as me" so we never
      // submit a mark the server-side trigger would reject.
      if (!target.allow_anonymous) setAnonymous(false);
      setWallId(target.id);
    })().catch((cause: any) => {
      if (active) setTargetError(cause?.message ?? "Couldn't verify this Wall.");
    });
    return () => { active = false; };
  }, [currentUserId, recipientId, targetWallId, sharedMode, sharedWallId]);

  const copy = COPY[type] ?? COPY.sticky;
  const overLimit = text.length > maxLen;
  const canSubmit =
    !!wallId && !overLimit && (isPhoto ? !!imageUri : text.trim().length > 0);

  /** Validate a picked asset (type + size) before we accept it into the preview. */
  function acceptAsset(asset: ImagePicker.ImagePickerAsset): boolean {
    const mime = asset.mimeType ?? "image/jpeg";
    if (!mime.startsWith("image/")) {
      Alert.alert("Unsupported file", "Please choose a photo (JPG or PNG).");
      return false;
    }
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
      Alert.alert("That photo is too big", "Please pick an image under 6 MB.");
      return false;
    }
    setImageMime(mime);
    setImageUri(asset.uri);
    return true;
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
      Alert.alert("Camera off", "Enable camera access in Settings to snap a memory.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!res.canceled) acceptAsset(res.assets[0]);
  }

  // Live preview, rendered with the real MarkView.
  const preview = useMemo<MarkWithAuthor>(
    () => ({
      id: "preview",
      wall_id: wallId ?? "",
      author_id: currentUserId ?? null,
      type,
      text: text.trim() || (isPhoto ? "" : copy.placeholder),
      color: isSticky ? color : null,
      anonymous,
      media_url: isPhoto ? imageUri : null,
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
    [type, text, color, anonymous, isSticky, isPhoto, imageUri, wallId, currentUserId, profile, copy.placeholder],
  );

  async function submit() {
    if (!canSubmit || !wallId) return;
    try {
      let mediaUrl: string | null = null;
      if (isPhoto && imageUri) {
        setPhase("uploading");
        try {
          mediaUrl = await uploadImage(imageUri, `marks/${wallId}`, imageMime);
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
        type,
        text: text.trim() || null,
        color: isSticky ? color : null,
        anonymous,
        mediaUrl,
      });
      if (sharedMode) {
        track("Shared Wall Mark Created", { wall_id: wallId, mark_type: type });
      }
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

  if (!SUPPORTED.includes(type)) {
    return (
      <Screen scroll={false} dockInset={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Text variant="headline">This mark type is coming soon</Text>
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </Screen>
    );
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
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, marginBottom: 18 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text variant="label" color={colors.outline}>‹ BACK</Text>
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text variant="display" style={{ fontSize: 22 }}>{copy.title}</Text>
          <Text variant="label" color={colors.outline}>
            {sharedMode ? `ON ${targetLabel}` : `FOR ${targetLabel}`}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Photo picker (memory/photo) */}
      {isPhoto ? (
        <View style={{ marginBottom: 16 }}>
          {imageUri ? (
            <Pressable onPress={pickFromLibrary}>
              <MarkView mark={preview} />
              <Text variant="label" color={colors.outline} style={{ textAlign: "center", marginTop: -6 }}>
                TAP THE PHOTO TO CHANGE
              </Text>
            </Pressable>
          ) : (
            <View
              style={{
                borderWidth: 2,
                borderColor: colors.ink,
                borderStyle: "dashed",
                borderRadius: radius.card,
                paddingVertical: 26,
                paddingHorizontal: 16,
                alignItems: "center",
                gap: 14,
                backgroundColor: colors.surfaceContainerLow,
              }}
            >
              <Text variant="headline">Add a photo</Text>
              <View style={{ flexDirection: "row", gap: 12, alignSelf: "stretch" }}>
                <View style={{ flex: 1 }}>
                  <Button label="Library" variant="primary" onPress={pickFromLibrary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Camera" variant="yellow" onPress={takePhoto} />
                </View>
              </View>
            </View>
          )}
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
            minHeight: isPhoto ? 70 : 140,
          },
          shadow.mark,
        ]}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={copy.placeholder}
          placeholderTextColor={colors.outline}
          multiline
          maxLength={maxLen + 1}
          autoFocus={!isPhoto}
          style={{
            fontFamily: "Bricolage-Bold",
            fontSize: isPhoto ? 17 : 20,
            lineHeight: 26,
            color: colors.ink,
            minHeight: isPhoto ? 44 : 110,
            textAlignVertical: "top",
          }}
        />
      </View>
      <Text
        variant="label"
        color={overLimit ? colors.error : colors.outline}
        style={{ alignSelf: "flex-end", marginTop: 6 }}
      >
        {text.length}/{maxLen}
      </Text>

      {/* Color picker — Sticky only */}
      {isSticky ? (
        <View style={{ marginTop: 16 }}>
          <Text variant="label" color={colors.outline} style={{ marginBottom: 10 }}>COLOR</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {stickySwatches.map((sw) => {
              const on = sw === color;
              return (
                <Pressable
                  key={sw}
                  onPress={() => setColor(sw)}
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
      <View style={{ marginTop: 22 }}>
        <Text variant="label" color={colors.outline} style={{ marginBottom: 10 }}>WHO'S THIS FROM?</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <IdentityChoice
            active={!anonymous}
            disabled={busy}
            onPress={() => setAnonymous(false)}
            title="Post as me"
            subtitle={`@${profile?.handle ?? "you"}`}
          />
          <IdentityChoice
            active={anonymous}
            disabled={busy || !allowAnonymous}
            onPress={() => setAnonymous(true)}
            title="Anonymous"
            subtitle={allowAnonymous ? "Name hidden" : "Not allowed here"}
          />
        </View>
        <Text variant="body" color={colors.onSurfaceVariant} style={{ fontSize: 13, marginTop: 8 }}>
          {!allowAnonymous
            ? "This Wall doesn't accept anonymous Marks — you'll post as you."
            : anonymous
              ? "Your name and avatar won't show on this Mark."
              : "This Mark will show your name and avatar."}
        </Text>
      </View>

      {/* Live preview (text marks; photo mode previews above) */}
      {!isPhoto ? (
        <>
          <Text variant="label" color={colors.outline} style={{ marginTop: 22, marginBottom: 12 }}>PREVIEW</Text>
          <View style={{ alignItems: "center" }}>
            <View style={{ width: "70%" }}>
              <MarkView mark={preview} />
            </View>
          </View>
        </>
      ) : null}

      <View style={{ marginTop: 16, marginBottom: 8 }}>
        {wallId === null && currentUserId ? (
          <ActivityIndicator color={markColors.brandYellow} />
        ) : (
          <Button
            label={
              phase === "uploading"
                ? "Uploading photo…"
                : phase === "posting"
                  ? "Posting…"
                  : "Stick it on the Wall ✦"
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
