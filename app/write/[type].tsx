import { useEffect, useMemo, useState } from "react";
import { View, TextInput, Pressable, Switch, Alert, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { MarkView } from "@/components/marks/MarkView";
import { useAuth } from "@/lib/auth";
import { getPersonalWall } from "@/lib/profiles";
import { createMark, type MarkWithAuthor } from "@/lib/marks";
import { uploadImage } from "@/lib/upload";
import type { MarkType } from "@/lib/types";
import { colors, markColors, radius, shadow, stickySwatches } from "@/theme";

const MAX_TEXT = 500;
const MAX_CAPTION = 200;

const SUPPORTED: MarkType[] = ["sticky", "roast", "secret", "memory"];

const COPY: Record<string, { title: string; placeholder: string }> = {
  sticky: { title: "Write a Sticky", placeholder: "leave a little note…" },
  roast: { title: "Roast them", placeholder: "lovingly savage…" },
  secret: { title: "Leave a Secret", placeholder: "shhh… only revealed on tap" },
  memory: { title: "Share a Memory", placeholder: "add a caption…" },
};

export default function Writer() {
  const router = useRouter();
  const { type: rawType, wallId: targetWallId, recipientId, handle } = useLocalSearchParams<{
    type: string;
    wallId?: string;
    recipientId?: string;
    handle?: string;
  }>();
  const type = (rawType ?? "sticky") as MarkType;
  const { session, profile } = useAuth();
  const currentUserId = session?.user.id;

  const isPhoto = type === "memory" || type === "photo";
  const isSticky = type === "sticky";
  const maxLen = isPhoto ? MAX_CAPTION : MAX_TEXT;

  const [text, setText] = useState(""); // note text, or caption in photo mode
  const [color, setColor] = useState<string>(stickySwatches[0]);
  const [anonymous, setAnonymous] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [wallId, setWallId] = useState<string | null>(null);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
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
      setWallId(target.id);
    })().catch((cause: any) => {
      if (active) setTargetError(cause?.message ?? "Couldn't verify this Wall.");
    });
    return () => { active = false; };
  }, [currentUserId, recipientId, targetWallId]);

  const copy = COPY[type] ?? COPY.sticky;
  const overLimit = text.length > maxLen;
  const canSubmit =
    !!wallId && !overLimit && (isPhoto ? !!imageUri : text.trim().length > 0);

  async function pickFromLibrary() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!res.canceled) setImageUri(res.assets[0].uri);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera off", "Enable camera access in Settings to snap a memory.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!res.canceled) setImageUri(res.assets[0].uri);
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
    setBusy(true);
    try {
      let mediaUrl: string | null = null;
      if (isPhoto && imageUri) {
        mediaUrl = await uploadImage(imageUri, `marks/${wallId}`);
      }
      const mark = await createMark({
        wallId,
        type,
        text: text.trim() || null,
        color: isSticky ? color : null,
        anonymous,
        mediaUrl,
      });
      if (router.canDismiss()) router.dismissAll();
      router.push(`/person/${recipientId}?justCreated=${mark.id}`);
    } catch (e: any) {
      Alert.alert("Couldn't post that", e?.message ?? "Please try again.");
    } finally {
      setBusy(false);
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
          <Text variant="label" color={colors.outline}>FOR @{handle}</Text>
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

      {/* Anonymous toggle */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 20,
          paddingVertical: 6,
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text variant="headline" style={{ fontSize: 16 }}>Post anonymously</Text>
          <Text variant="body" color={colors.onSurfaceVariant} style={{ fontSize: 13 }}>
            Your name won't show on this mark.
          </Text>
        </View>
        <Switch
          value={anonymous}
          onValueChange={setAnonymous}
          trackColor={{ false: colors.surfaceContainerHigh, true: markColors.neonGreen }}
          thumbColor={colors.surface}
        />
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
            label={busy && isPhoto ? "Posting…" : "Stick it on the Wall ✦"}
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
