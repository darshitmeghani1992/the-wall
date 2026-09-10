import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, Switch, View } from "react-native";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import { createSharedWall } from "@/lib/walls";
import { SessionFocusFence } from "@/lib/session-generation";
import { beginExclusiveMutation, endExclusiveMutation } from "@/lib/mutation-guard";
import { colors, markColors, radius } from "@/theme";

type Visibility = "public" | "private";

export default function CreateSharedWallScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const currentUserId = useRef(userId);
  currentUserId.current = userId;
  const fence = useRef(new SessionFocusFence()).current;
  const mutationInFlight = useRef(false);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [openJoin, setOpenJoin] = useState(false);
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = Boolean(userId && name.trim().length > 0 && !submitting);

  useFocusEffect(useCallback(() => {
    fence.focus(userId);
    return () => { fence.blur(); endExclusiveMutation(mutationInFlight); setSubmitting(false); };
  }, [fence, userId]));

  useEffect(() => navigation.addListener("beforeRemove", (event) => {
    if (mutationInFlight.current) event.preventDefault();
  }), [navigation]);

  async function submit() {
    if (!canSubmit || !userId || !beginExclusiveMutation(mutationInFlight)) return;
    const token = fence.begin(userId);
    if (!token) { endExclusiveMutation(mutationInFlight); return; }
    setSubmitting(true);
    try {
      const wall = await createSharedWall({ name, visibility, openJoin, allowAnonymous });
      if (!fence.isCurrent(token, currentUserId.current)) return;
      endExclusiveMutation(mutationInFlight);
      router.replace(`/shared/${wall.id}`);
    } catch (cause: any) {
      if (fence.isCurrent(token, currentUserId.current)) {
        Alert.alert("Couldn't create that", cause?.message ?? "Please try again.");
        setSubmitting(false);
      }
    } finally {
      endExclusiveMutation(mutationInFlight);
    }
  }

  function chooseVisibility(next: Visibility) {
    setVisibility(next);
    if (next === "private") setOpenJoin(false);
  }

  return (
    <Screen dockInset={false}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, marginBottom: 18 }}>
        <Text variant="display" style={{ fontSize: 24 }}>Start a Shared Wall</Text>
        <Pressable disabled={submitting} accessibilityState={{ disabled: submitting }} onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={{ minHeight: 44, justifyContent: "center", opacity: submitting ? 0.45 : 1 }}>
          <Text variant="label" color={colors.outline}>CLOSE</Text>
        </Pressable>
      </View>
      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginBottom: 18 }}>
        A place your crew can fill together — for a trip, class, team, or group of friends.
      </Text>
      <Input label="NAME" value={name} onChangeText={setName} placeholder="Goa Trip '26" autoFocus maxLength={60} />

      <Text variant="label" color={colors.outline} style={{ marginTop: 22, marginBottom: 10 }}>WHO CAN SEE IT</Text>
      <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
        {(["private", "public"] as const).map((choice) => {
          const selected = visibility === choice;
          return (
            <Pressable
              key={choice}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${choice === "private" ? "Private" : "Public"} Shared Wall`}
              onPress={() => chooseVisibility(choice)}
              style={{ borderWidth: selected ? 2 : 1, borderColor: colors.ink, borderRadius: radius.card, padding: 14, backgroundColor: selected ? colors.ink : colors.card }}
            >
              <Text variant="headline" color={selected ? colors.surface : colors.ink}>{choice === "private" ? "Private" : "Public"}</Text>
              <Text variant="body" color={selected ? markColors.brandYellow : colors.outline} style={{ marginTop: 3 }}>
                {choice === "private" ? "Only accepted members can see it." : "Anyone signed in can view it."}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {visibility === "public" ? <SettingToggle label="Open Join" detail="Let registered users join without waiting for an invitation." value={openJoin} onValueChange={setOpenJoin} /> : null}
      <SettingToggle label="Anonymous Marks" detail="Let members hide their name when they leave a Mark." value={allowAnonymous} onValueChange={setAllowAnonymous} />
      <View style={{ marginTop: 26 }}>
        <Button label="Create Shared Wall" variant="yellow" loading={submitting} disabled={!canSubmit} onPress={() => void submit()} />
      </View>
    </Screen>
  );
}

function SettingToggle({ label, detail, value, onValueChange }: { label: string; detail: string; value: boolean; onValueChange: (next: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 20 }}>
      <View style={{ flex: 1 }}>
        <Text variant="headline">{label}</Text>
        <Text variant="body" color={colors.outline} style={{ fontSize: 13, marginTop: 2 }}>{detail}</Text>
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onValueChange} trackColor={{ false: colors.outlineVariant, true: markColors.brandYellow }} thumbColor={colors.ink} />
    </View>
  );
}
