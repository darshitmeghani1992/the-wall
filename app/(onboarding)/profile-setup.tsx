import { useEffect, useMemo, useState } from "react";
import { View, Pressable, Alert } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { createProfile, isHandleAvailable } from "@/lib/profiles";
import { uploadImage } from "@/lib/upload";
import { onboardingDraft } from "@/lib/onboarding";
import { colors } from "@/theme";

/** Final onboarding step: claim a handle, set a display name, bio and avatar.
 *  Creating the profile row triggers the DB to spin up the Personal Wall. */
export default function ProfileSetup() {
  const router = useRouter();
  const { session, refreshProfile } = useAuth();

  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [handleFree, setHandleFree] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const cleanHandle = useMemo(
    () => handle.toLowerCase().replace(/[^a-z0-9_]/g, ""),
    [handle],
  );

  // Debounced handle availability check.
  useEffect(() => {
    if (cleanHandle.length < 3) {
      setHandleFree(null);
      return;
    }
    const t = setTimeout(async () => {
      setHandleFree(await isHandleAvailable(cleanHandle));
    }, 400);
    return () => clearTimeout(t);
  }, [cleanHandle]);

  async function pickAvatar() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled) setAvatarUri(res.assets[0].uri);
  }

  const canSubmit = cleanHandle.length >= 3 && name.trim().length > 0 && handleFree !== false;

  async function finish() {
    if (!session?.user || !canSubmit) return;
    setBusy(true);
    try {
      let avatar_url: string | null = null;
      if (avatarUri) {
        avatar_url = await uploadImage(avatarUri, `avatars/${session.user.id}`);
      }
      await createProfile({
        id: session.user.id,
        handle: cleanHandle,
        display_name: name.trim(),
        bio: bio.trim() || null,
        avatar_url,
        interests: onboardingDraft.interests,
      });
      onboardingDraft.interests = [];
      await refreshProfile();
      router.replace("/"); // gate → Home
    } catch (e: any) {
      Alert.alert("Couldn't finish setup", e?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const initial = (name.trim()[0] ?? "?").toUpperCase();

  return (
    <Screen dockInset={false}>
      <View style={{ paddingTop: 24, gap: 8, marginBottom: 22 }}>
        <Text variant="label" color={colors.outline}>
          ALMOST THERE
        </Text>
        <Text variant="display" style={{ fontSize: 30 }}>
          Set up your wall
        </Text>
      </View>

      {/* Avatar */}
      <View style={{ alignItems: "center", marginBottom: 22 }}>
        <Pressable onPress={pickAvatar}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 20,
              borderWidth: 2,
              borderColor: colors.ink,
              // Neutral until a photo is chosen — brandYellow is reserved for
              // Invite (VD §3); the identity (name/handle) is the focal point.
              backgroundColor: colors.surfaceContainerHigh,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              transform: [{ rotate: "-3deg" }],
            }}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={{ width: "100%", height: "100%" }} />
            ) : (
              <Text variant="display" style={{ fontSize: 40 }}>
                {initial}
              </Text>
            )}
          </View>
        </Pressable>
        <Text variant="label" color={colors.outline} style={{ marginTop: 10 }}>
          {avatarUri ? "TAP TO CHANGE" : "TAP TO ADD A PHOTO"}
        </Text>
      </View>

      <View style={{ gap: 16 }}>
        <View style={{ gap: 6 }}>
          <Input
            label="Username"
            prefix="@"
            placeholder="maya"
            autoCapitalize="none"
            autoCorrect={false}
            value={handle}
            onChangeText={setHandle}
            error={handleFree === false}
            hint={
              cleanHandle.length > 0 && cleanHandle.length < 3
                ? "At least 3 characters"
                : undefined
            }
          />
          {/* Availability as a color + icon + text triple — never color alone
              (accessibility, VD surface 4). */}
          {cleanHandle.length >= 3 && handleFree !== null ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon
                name={handleFree ? "check" : "close"}
                size={14}
                color={handleFree ? colors.onSurfaceVariant : colors.error}
              />
              <Text
                variant="body"
                color={handleFree ? colors.onSurfaceVariant : colors.error}
                style={{ fontSize: 13 }}
              >
                {handleFree ? "Available" : "That handle is taken"}
              </Text>
            </View>
          ) : null}
        </View>
        <Input label="Display name" placeholder="Maya" value={name} onChangeText={setName} />
        <Input
          label="Bio"
          placeholder="Say something (optional)"
          value={bio}
          onChangeText={setBio}
          multiline
          style={{ minHeight: 64, textAlignVertical: "top" }}
        />
        <View style={{ marginTop: 8 }}>
          <Button
            label="Create my wall ✦"
            variant="yellow"
            loading={busy}
            disabled={!canSubmit}
            onPress={finish}
          />
        </View>
      </View>
    </Screen>
  );
}
