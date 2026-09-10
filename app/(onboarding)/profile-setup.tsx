import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Redirect, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuth } from "@/lib/auth";
import {
  createProfile,
  markOnboardingComplete,
  updatePersonalWallSetup,
  updateProfile,
} from "@/lib/profiles";
import { uploadImage } from "@/lib/upload";
import { clearOnboardingDraft, loadOnboardingDraft, saveOnboardingDraft } from "@/lib/onboarding";
import {
  AccountRouteFence,
  DEFAULT_ONBOARDING_DRAFT,
  type ContributionChoice,
  type OnboardingDraft,
  type WallPrivacyChoice,
  onboardingFailureMessage,
  persistOnboardingInOrder,
  snapshotOnboardingDraft,
} from "@/lib/onboarding-contract";
import { colors, markColors, radius } from "@/theme";

type Step = "basics" | "bio" | "privacy" | "contribution" | "anonymous";
const STEPS: Step[] = ["basics", "bio", "privacy", "contribution", "anonymous"];
const MAX_BIO = 160;
const MAX_AVATAR_BYTES = 6 * 1024 * 1024;

function Choice({
  selected,
  label,
  detail,
  disabled,
  onPress,
}: {
  selected: boolean;
  label: string;
  detail: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${label}. ${detail}`}
      onPress={onPress}
      disabled={disabled}
      style={{
        minHeight: 64,
        padding: 14,
        borderRadius: radius.card,
        borderWidth: 2,
        borderColor: colors.ink,
        backgroundColor: selected ? markColors.stickyYellow : colors.card,
      }}
    >
      <Text variant="headline">{selected ? "● " : "○ "}{label}</Text>
      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 4 }}>{detail}</Text>
    </Pressable>
  );
}

/** Functional setup. Each local change is durable, while completion remains a server-confirmed gate. */
export default function ProfileSetup() {
  const router = useRouter();
  const { session, profile, accountRoute, refreshAccountRoute } = useAuth();
  const userId = session?.user.id ?? null;
  const existingProfile = accountRoute === "onboarding" ? profile : null;
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(DEFAULT_ONBOARDING_DRAFT);
  const [draftReady, setDraftReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draftWarning, setDraftWarning] = useState<string | null>(null);
  const submissionInFlight = useRef(false);
  const lifecycleFence = useRef(new AccountRouteFence());
  const currentUserId = useRef(userId);
  currentUserId.current = userId;

  const step = STEPS[stepIndex];
  const cleanHandle = useMemo(
    () => draft.handle.toLowerCase().replace(/[^a-z0-9_]/g, ""),
    [draft.handle],
  );

  useEffect(() => {
    if (!userId || (accountRoute !== "missing_profile" && accountRoute !== "onboarding")) return;
    const currentLifecycleFence = lifecycleFence.current;
    const token = currentLifecycleFence.begin(userId);
    submissionInFlight.current = false;
    setBusy(false);
    setDraftReady(false);
    void loadOnboardingDraft(userId).then((stored) => {
      if (!currentLifecycleFence.isCurrent(token, currentUserId.current)) return;
      setDraft({
        ...stored,
        handle: existingProfile?.handle ?? stored.handle,
        displayName: stored.displayName || existingProfile?.display_name || "",
        bio: stored.bio || existingProfile?.bio || "",
        avatarUri: stored.avatarUri,
      });
      setDraftReady(true);
    });
    return () => currentLifecycleFence.invalidate(currentUserId.current);
  }, [accountRoute, existingProfile, userId]);

  useEffect(() => {
    if (!draftReady || !userId) return;
    const timeout = setTimeout(() => {
      void saveOnboardingDraft(userId, draft).then(
        () => setDraftWarning(null),
        () => setDraftWarning("This step couldn't be saved on this device yet."),
      );
    }, 150);
    return () => clearTimeout(timeout);
  }, [draft, draftReady, userId]);

  function patchDraft(patch: Partial<OnboardingDraft>) {
    if (submissionInFlight.current) return;
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function pickAvatar() {
    if (submissionInFlight.current) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_AVATAR_BYTES) {
        Alert.alert("That photo is too big", "Please pick an image under 6 MB.");
        return;
      }
      patchDraft({ avatarUri: asset.uri });
    } catch {
      Alert.alert("Couldn't open your photos", "Check photo access and try again.");
    }
  }

  const basicsValid = cleanHandle.length >= 3 && draft.displayName.trim().length > 0;
  const bioValid = draft.bio.length <= MAX_BIO;

  function next() {
    if (submissionInFlight.current) return;
    if (step === "basics" && !basicsValid) return;
    if (step === "bio" && !bioValid) return;
    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
  }

  async function finish() {
    if (!userId || submissionInFlight.current || !basicsValid || !bioValid) return;
    const submission = snapshotOnboardingDraft({
      ...draft,
      handle: cleanHandle,
      displayName: draft.displayName.trim(),
      bio: draft.bio.trim(),
    });
    const token = lifecycleFence.current.begin(userId);
    submissionInFlight.current = true;
    setBusy(true);
    try {
      let avatarUrl = existingProfile?.avatar_url ?? null;
      if (submission.avatarUri) avatarUrl = await uploadImage(submission.avatarUri, `avatars/${userId}`);
      if (!lifecycleFence.current.isCurrent(token, currentUserId.current)) return;

      // Ordered, retry-safe persistence: profile first, Wall settings second, completion last.
      await persistOnboardingInOrder({
        persistProfile: async () => {
          if (accountRoute === "missing_profile") {
            await createProfile({
              id: userId,
              handle: submission.handle,
              display_name: submission.displayName,
              bio: submission.bio || null,
              avatar_url: avatarUrl,
            });
          } else if (accountRoute === "onboarding") {
            if (!existingProfile) throw new Error("Your account setup isn't available. Please try again.");
            await updateProfile(userId, {
              display_name: submission.displayName,
              bio: submission.bio || null,
              avatar_url: avatarUrl,
            });
          } else {
            throw new Error("Your account state changed. Please try again.");
          }
          if (!lifecycleFence.current.isCurrent(token, currentUserId.current)) throw new Error("Account changed during setup.");
        },
        persistWall: async () => {
          await updatePersonalWallSetup(userId, {
            visibility: submission.privacy,
            contribution_policy: submission.contribution,
            allow_anonymous: submission.allowAnonymous,
          });
          if (!lifecycleFence.current.isCurrent(token, currentUserId.current)) throw new Error("Account changed during setup.");
        },
        markComplete: async () => {
          await markOnboardingComplete(userId);
        },
      });
      if (!lifecycleFence.current.isCurrent(token, currentUserId.current)) return;
      await clearOnboardingDraft(userId);
      await refreshAccountRoute();
      if (currentUserId.current === userId) router.replace("/find-people");
    } catch (cause: any) {
      try { await refreshAccountRoute(); } catch { /* The original actionable error remains primary. */ }
      if (currentUserId.current === userId) {
        Alert.alert("Setup isn't finished yet", onboardingFailureMessage(cause));
      }
    } finally {
      if (lifecycleFence.current.isCurrent(token, currentUserId.current)) {
        submissionInFlight.current = false;
        setBusy(false);
      }
    }
  }

  if (accountRoute && accountRoute !== "missing_profile" && accountRoute !== "onboarding") {
    return <Redirect href="/" />;
  }

  if (!draftReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={markColors.brandYellow} />
      </View>
    );
  }

  const initial = (draft.displayName.trim()[0] ?? "?").toUpperCase();
  return (
    <Screen dockInset={false}>
      <View style={{ paddingTop: 24, gap: 8, marginBottom: 22 }}>
        <Text variant="label" color={colors.outline}>SETUP · {stepIndex + 1}/{STEPS.length}</Text>
        <Text variant="display" style={{ fontSize: 30 }}>
          {step === "basics" ? "Make it yours" : step === "bio" ? "A little about you" : step === "privacy" ? "Who can see your Wall?" : step === "contribution" ? "Who can leave Marks?" : "Anonymous Marks"}
        </Text>
      </View>

      {step === "basics" ? (
        <View style={{ gap: 16 }}>
          <View style={{ alignItems: "center" }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose profile photo" accessibilityState={{ disabled: busy }} disabled={busy} onPress={pickAvatar}>
              <View style={{ width: 96, height: 96, borderRadius: 20, borderWidth: 2, borderColor: colors.ink, backgroundColor: markColors.brandYellow, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {draft.avatarUri ? <Image source={{ uri: draft.avatarUri }} style={{ width: "100%", height: "100%" }} /> : <Text variant="display" style={{ fontSize: 40 }}>{initial}</Text>}
              </View>
            </Pressable>
            <Text variant="label" color={colors.outline} style={{ marginTop: 10 }}>PHOTO OPTIONAL</Text>
          </View>
          <Input accessibilityLabel="Username" label="Username" prefix="@" value={draft.handle} onChangeText={(handle) => patchDraft({ handle })} autoCapitalize="none" autoCorrect={false} editable={!busy && !existingProfile} hint={cleanHandle.length > 0 && cleanHandle.length < 3 ? "At least 3 characters" : "We'll confirm your username when setup finishes."} />
          <Input accessibilityLabel="Display name" label="Display name" value={draft.displayName} onChangeText={(displayName) => patchDraft({ displayName })} editable={!busy} />
        </View>
      ) : null}

      {step === "bio" ? (
        <View style={{ gap: 6 }}>
          <Input accessibilityLabel="Bio, optional" label="Bio (optional)" value={draft.bio} onChangeText={(bio) => patchDraft({ bio })} editable={!busy} multiline maxLength={MAX_BIO + 20} error={!bioValid} style={{ minHeight: 96, textAlignVertical: "top" }} />
          <Text variant="label" color={bioValid ? colors.outline : colors.error} style={{ alignSelf: "flex-end" }}>{draft.bio.length}/{MAX_BIO}</Text>
        </View>
      ) : null}

      {step === "privacy" ? (
        <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
          <Choice disabled={busy} selected={draft.privacy === "private"} label="Private" detail="Only you and accepted friends can see your Wall." onPress={() => patchDraft({ privacy: "private" as WallPrivacyChoice })} />
          <Choice disabled={busy} selected={draft.privacy === "public"} label="Public" detail="Any signed-in person you haven't blocked can see it." onPress={() => patchDraft({ privacy: "public" as WallPrivacyChoice })} />
        </View>
      ) : null}

      {step === "contribution" ? (
        <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
          <Choice disabled={busy} selected={draft.contribution === "friends"} label="Friends only" detail="Only accepted friends can leave Marks." onPress={() => patchDraft({ contribution: "friends" as ContributionChoice })} />
          <Choice disabled={busy} selected={draft.contribution === "everyone"} label="Everyone" detail="Any eligible signed-in person can leave a Mark." onPress={() => patchDraft({ contribution: "everyone" as ContributionChoice })} />
          <Choice disabled={busy} selected={draft.contribution === "selected"} label="Approved people" detail="Only people you approve can leave Marks." onPress={() => patchDraft({ contribution: "selected" as ContributionChoice })} />
        </View>
      ) : null}

      {step === "anonymous" ? (
        <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
          <Choice disabled={busy} selected={!draft.allowAnonymous} label="Keep it off" detail="People must show their identity when they leave a Mark." onPress={() => patchDraft({ allowAnonymous: false })} />
          <Choice disabled={busy} selected={draft.allowAnonymous} label="Allow Anonymous" detail="People may hide their identity from you. The platform keeps it for safety." onPress={() => patchDraft({ allowAnonymous: true })} />
        </View>
      ) : null}

      {draftWarning ? <Text variant="body" color={colors.error} style={{ marginTop: 12 }}>{draftWarning}</Text> : null}
      <View style={{ flexDirection: "row", gap: 12, marginTop: 28, paddingBottom: 12 }}>
        {stepIndex > 0 ? <View style={{ flex: 1 }}><Button label="Back" variant="ghost" disabled={busy} onPress={() => setStepIndex((current) => current - 1)} /></View> : null}
        <View style={{ flex: 2 }}>
          <Button label={step === "anonymous" ? "Finish setup" : "Continue"} variant="yellow" disabled={step === "basics" ? !basicsValid : step === "bio" ? !bioValid : false} loading={busy} onPress={step === "anonymous" ? finish : next} />
        </View>
      </View>
    </Screen>
  );
}
