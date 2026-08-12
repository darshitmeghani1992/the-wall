import { useMemo, useState } from "react";
import { View, Pressable, Alert, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/lib/auth";
import { updateProfile } from "@/lib/profiles";
import { uploadImage } from "@/lib/upload";
import { colors, markColors } from "@/theme";

const MAX_BIO = 160;
/** Keep in step with upload.ts's MAX_PROFILE_IMAGE (6 MB). */
const MAX_AVATAR_BYTES = 6 * 1024 * 1024;

/**
 * Edit profile (modal). Change avatar (uploaded to `avatars/{uid}`, which
 * SEC-001 storage RLS allows), display name, and bio. The @handle is shown but
 * immutable here — changing a handle is a separate concern (backend dependency).
 *
 * Real states only: a busy state while uploading/saving, inline validation, and
 * a real error surfaced from Supabase — no optimistic "Saved!" that could lie.
 */
export default function ProfileEdit() {
  const router = useRouter();
  const { session, profile, refreshProfile } = useAuth();

  const [name, setName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  // `avatarUri` holds a freshly-picked local image awaiting upload; when null we
  // keep whatever avatar the profile already has.
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");

  const busy = phase !== "idle";
  const trimmedName = name.trim();
  const bioOver = bio.length > MAX_BIO;
  const nameEmpty = trimmedName.length === 0;
  const canSave = !busy && !nameEmpty && !bioOver;

  const shownAvatar = avatarUri ?? profile?.avatar_url ?? null;
  const initial = useMemo(
    () => (trimmedName[0] ?? profile?.display_name?.[0] ?? "?").toUpperCase(),
    [trimmedName, profile?.display_name],
  );

  async function pickAvatar() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_AVATAR_BYTES) {
      Alert.alert("That photo is too big", "Please pick an image under 6 MB.");
      return;
    }
    setAvatarUri(asset.uri);
  }

  async function save() {
    if (!session?.user || !canSave) return;
    try {
      let avatar_url: string | undefined;
      if (avatarUri) {
        setPhase("uploading");
        avatar_url = await uploadImage(avatarUri, `avatars/${session.user.id}`);
      }
      setPhase("saving");
      await updateProfile(session.user.id, {
        display_name: trimmedName,
        bio: bio.trim() || null,
        ...(avatar_url ? { avatar_url } : {}),
      });
      await refreshProfile();
      if (router.canGoBack()) router.back();
      else router.replace("/profile");
    } catch (e: any) {
      Alert.alert("Couldn't save your profile", e?.message ?? "Please try again.");
    } finally {
      setPhase("idle");
    }
  }

  return (
    <Screen dockInset={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 16,
          marginBottom: 20,
        }}
      >
        <Text variant="display" style={{ fontSize: 26 }}>Edit profile</Text>
        <Pressable onPress={() => router.back()} disabled={busy} hitSlop={10} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text variant="label" color={colors.outline}>CLOSE</Text>
        </Pressable>
      </View>

      {/* Avatar */}
      <View style={{ alignItems: "center", marginBottom: 24 }}>
        <Pressable onPress={pickAvatar} disabled={busy} accessibilityRole="button" accessibilityLabel="Change profile photo">
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 20,
              borderWidth: 2,
              borderColor: colors.ink,
              backgroundColor: markColors.brandYellow,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              transform: [{ rotate: "-3deg" }],
            }}
          >
            {phase === "uploading" ? (
              <ActivityIndicator color={colors.ink} />
            ) : shownAvatar ? (
              <Image source={{ uri: shownAvatar }} style={{ width: "100%", height: "100%" }} />
            ) : (
              <Text variant="display" style={{ fontSize: 40 }}>{initial}</Text>
            )}
          </View>
        </Pressable>
        <Text variant="label" color={colors.outline} style={{ marginTop: 10 }}>
          {phase === "uploading" ? "UPLOADING…" : shownAvatar ? "TAP TO CHANGE" : "TAP TO ADD A PHOTO"}
        </Text>
      </View>

      <View style={{ gap: 16 }}>
        <Input
          label="Display name"
          placeholder="Your name"
          value={name}
          onChangeText={setName}
          editable={!busy}
          error={nameEmpty}
          hint={nameEmpty ? "A display name is required" : undefined}
        />

        <View style={{ gap: 6 }}>
          <Input
            label="Bio"
            placeholder="Say something (optional)"
            value={bio}
            onChangeText={setBio}
            editable={!busy}
            multiline
            maxLength={MAX_BIO + 20}
            error={bioOver}
            style={{ minHeight: 72, textAlignVertical: "top" }}
          />
          <Text
            variant="label"
            color={bioOver ? colors.error : colors.outline}
            style={{ alignSelf: "flex-end" }}
          >
            {bio.length}/{MAX_BIO}
          </Text>
        </View>

        {/* Handle — display only (immutable here). */}
        <View style={{ gap: 6 }}>
          <Text variant="label" color={colors.outline}>USERNAME</Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surfaceContainer,
              borderRadius: 5,
              borderWidth: 1,
              borderColor: colors.outlineVariant,
              paddingHorizontal: 14,
              paddingVertical: 13,
            }}
          >
            <Text variant="mark" color={colors.outline}>@{profile?.handle ?? ""}</Text>
          </View>
          <Text variant="body" color={colors.outline} style={{ fontSize: 13 }}>
            Your handle can't be changed here.
          </Text>
        </View>

        <View style={{ marginTop: 8 }}>
          <Button
            label={phase === "uploading" ? "Uploading photo…" : phase === "saving" ? "Saving…" : "Save changes"}
            variant="primary"
            loading={busy}
            disabled={!canSave}
            onPress={save}
          />
        </View>
      </View>
    </Screen>
  );
}
