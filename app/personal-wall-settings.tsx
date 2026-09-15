import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Switch, View } from "react-native";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import {
  canManageApprovedWriters,
  personalSettingsChanged,
  selectedWriterExplanation,
  type PersonalSettingsDraft,
} from "@/components/settings-management-contract";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import { beginExclusiveMutation, endExclusiveMutation } from "@/lib/mutation-guard";
import {
  getPersonalWallSettings,
  updatePersonalWallSettings,
  type PersonalWallSettings,
} from "@/lib/personal-wall-settings";
import { SessionFocusFence } from "@/lib/session-generation";
import { border, colors, markColors, radius, spacing } from "@/theme";

const initialDraft: PersonalSettingsDraft = {
  visibility: "private",
  contributionPolicy: "friends",
  allowAnonymous: true,
};

export default function PersonalWallSettingsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const actorId = session?.user.id ?? null;
  const currentActorId = useRef(actorId);
  currentActorId.current = actorId;

  const [saved, setSaved] = useState<PersonalWallSettings | null>(null);
  const [draft, setDraft] = useState<PersonalSettingsDraft>(initialDraft);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFence = useRef(new SessionFocusFence());
  const actionFence = useRef(new SessionFocusFence());
  const mutationInFlight = useRef(false);
  const loadedActorId = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const allowBackRef = useRef(false);

  const dirty = personalSettingsChanged(saved, draft);
  dirtyRef.current = loadedActorId.current === actorId && dirty;

  const load = useCallback(async () => {
    const token = loadFence.current.begin(actorId);
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const next = await getPersonalWallSettings(token.userId);
      if (!loadFence.current.isCurrent(token, currentActorId.current)) return;
      setSaved(next);
      setDraft({
        visibility: next.visibility,
        contributionPolicy: next.contributionPolicy,
        allowAnonymous: next.allowAnonymous,
      });
      loadedActorId.current = token.userId;
    } catch (cause: any) {
      if (loadFence.current.isCurrent(token, currentActorId.current)) {
        setError(cause?.message ?? "Couldn't load your Wall settings.");
      }
    } finally {
      if (loadFence.current.isCurrent(token, currentActorId.current)) setLoading(false);
    }
  }, [actorId]);

  useFocusEffect(useCallback(() => {
    loadFence.current.focus(actorId);
    actionFence.current.focus(actorId);
    mutationInFlight.current = false;
    setBusy(false);
    allowBackRef.current = false;

    if (loadedActorId.current !== actorId) {
      loadedActorId.current = null;
      setSaved(null);
      setDraft(initialDraft);
      setError(null);
      if (actorId) void load();
      else setLoading(false);
    }

    return () => {
      loadFence.current.blur();
      actionFence.current.blur();
      endExclusiveMutation(mutationInFlight);
      setBusy(false);
    };
  }, [actorId, load]));

  useEffect(() => navigation.addListener("beforeRemove", (event) => {
    if (allowBackRef.current || !dirtyRef.current) return;
    event.preventDefault();
    Alert.alert(
      "Discard unsaved changes?",
      "Your Personal Wall settings haven't been saved.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            allowBackRef.current = true;
            navigation.dispatch(event.data.action);
          },
        },
      ],
    );
  }), [navigation]);

  async function save() {
    if (!actorId || !saved || !dirty || !beginExclusiveMutation(mutationInFlight)) return;
    const token = actionFence.current.begin(actorId);
    if (!token) {
      endExclusiveMutation(mutationInFlight);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await updatePersonalWallSettings(token.userId, draft);
      if (!actionFence.current.isCurrent(token, currentActorId.current)) return;
      setSaved(next);
      setDraft({
        visibility: next.visibility,
        contributionPolicy: next.contributionPolicy,
        allowAnonymous: next.allowAnonymous,
      });
      dirtyRef.current = false;
      Alert.alert("Saved", "Your Personal Wall settings are up to date.");
    } catch (cause: any) {
      if (actionFence.current.isCurrent(token, currentActorId.current)) {
        setError(cause?.message ?? "Couldn't save your Wall settings. Please try again.");
      }
    } finally {
      if (actionFence.current.isCurrent(token, currentActorId.current)) {
        endExclusiveMutation(mutationInFlight);
        setBusy(false);
      }
    }
  }

  const explanation = selectedWriterExplanation(draft);

  return (
    <Screen dockInset={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => router.back()}
        style={{
          minHeight: spacing.unit * 11,
          justifyContent: "center",
          alignSelf: "flex-start",
          opacity: busy ? 0.5 : 1,
        }}
      >
        <Text variant="label" color={colors.outline}>‹ BACK</Text>
      </Pressable>
      <Text variant="display" style={{ marginTop: spacing.unit * 2 }}>Personal Wall settings</Text>
      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: spacing.unit * 2 }}>
        Choose who can see your Wall and leave Marks on it.
      </Text>

      {loading ? (
        <ActivityIndicator
          accessibilityLabel="Loading Personal Wall settings"
          color={markColors.brandYellow}
          style={{ marginTop: spacing.unit * 9 }}
        />
      ) : !saved ? (
        <View style={{ marginTop: spacing.unit * 6, gap: spacing.unit * 3 }}>
          <Text accessibilityRole="alert" variant="body" color={colors.error}>
            {error ?? "These settings aren't available."}
          </Text>
          <Button label="Try again" variant="yellow" onPress={() => void load()} />
        </View>
      ) : (
        <>
          {error ? (
            <Text accessibilityRole="alert" variant="body" color={colors.error} style={{ marginTop: spacing.unit * 4 }}>
              {error}
            </Text>
          ) : null}

          <ChoiceGroup
            label="WHO CAN SEE YOUR WALL"
            value={draft.visibility}
            disabled={busy}
            choices={[
              { value: "private", label: "Private", detail: "Only you and accepted friends can see it." },
              { value: "public", label: "Public", detail: "Anyone can see it." },
            ]}
            onChange={(visibility) => setDraft((current) => ({ ...current, visibility }))}
          />

          <ChoiceGroup
            label="WHO CAN LEAVE MARKS"
            value={draft.contributionPolicy}
            disabled={busy}
            choices={[
              { value: "friends", label: "Friends", detail: "Accepted friends can write." },
              { value: "everyone", label: "Everyone", detail: "Anyone who can see your Wall can write." },
              { value: "selected", label: "Selected people", detail: "Only people you approve can write." },
            ]}
            onChange={(contributionPolicy) => setDraft((current) => ({ ...current, contributionPolicy }))}
          />

          {explanation ? (
            <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: spacing.unit * 3 }}>
              {explanation}
            </Text>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.unit * 6 }}>
            <View style={{ flex: 1, paddingRight: spacing.unit * 3 }}>
              <Text variant="headline">Anonymous Marks</Text>
              <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: spacing.unit }}>
                Let writers hide their name when leaving a Mark.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Allow anonymous Marks"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              style={{ minWidth: spacing.unit * 11, minHeight: spacing.unit * 11 }}
              value={draft.allowAnonymous}
              onValueChange={(allowAnonymous) => setDraft((current) => ({ ...current, allowAnonymous }))}
              trackColor={{ false: colors.outlineVariant, true: markColors.brandYellow }}
              thumbColor={colors.ink}
            />
          </View>

          <View style={{ marginTop: spacing.unit * 7, gap: spacing.unit * 3 }}>
            <Button
              label="Save settings"
              variant="yellow"
              loading={busy}
              disabled={!dirty}
              onPress={() => void save()}
            />
            {canManageApprovedWriters(saved) ? (
              <Button
                label="Manage approved writers"
                variant="ghost"
                disabled={busy}
                onPress={() => router.push("/approved-writers")}
              />
            ) : null}
          </View>
        </>
      )}
    </Screen>
  );
}

function ChoiceGroup<T extends string>({
  label,
  value,
  choices,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  choices: readonly { value: T; label: string; detail: string }[];
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <View style={{ marginTop: spacing.unit * 6 }}>
      <Text variant="label" color={colors.outline} style={{ marginBottom: spacing.unit * 2 }}>{label}</Text>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.unit * 2 }}>
        {choices.map((choice) => {
          const selected = value === choice.value;
          return (
            <Pressable
              key={choice.value}
              accessibilityRole="radio"
              accessibilityLabel={choice.label}
              accessibilityHint={choice.detail}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(choice.value)}
              style={{
                minHeight: spacing.unit * 14,
                justifyContent: "center",
                paddingHorizontal: spacing.unit * 4,
                paddingVertical: spacing.unit * 2,
                borderWidth: border.width,
                borderColor: colors.ink,
                borderRadius: radius.card,
                backgroundColor: selected ? colors.ink : colors.card,
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <Text variant="headline" color={selected ? markColors.brandYellow : colors.ink}>{choice.label}</Text>
              <Text
                variant="body"
                color={selected ? colors.surfaceContainerHigh : colors.onSurfaceVariant}
                style={{ marginTop: spacing.unit }}
              >
                {choice.detail}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
