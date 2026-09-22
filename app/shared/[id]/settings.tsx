import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Switch, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import { SessionFocusFence } from "@/lib/session-generation";
import { beginExclusiveMutation, endExclusiveMutation } from "@/lib/mutation-guard";
import { deleteSharedWall, getWall, getWallCapabilities, updateSharedWallSettings } from "@/lib/walls";
import { colors, markColors, radius } from "@/theme";

export default function SharedWallSettingsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const wallId = String(id ?? "");
  const { session } = useAuth();
  const userId = session?.user.id;
  const [name, setName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [openJoin, setOpenJoin] = useState(false);
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteName, setDeleteName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fence = useRef(new SessionFocusFence()).current;
  const mutationInFlight = useRef(false);
  const currentUserId = useRef<string | null>(userId ?? null);
  currentUserId.current = userId ?? null;

  const load = useCallback(async () => {
    const token = fence.begin(userId ?? null); if (!token || !wallId) return;
    setLoading(true); setError(null);
    try {
      const [wall, capabilities] = await Promise.all([getWall(wallId), getWallCapabilities(wallId)]);
      if (!fence.isCurrent(token, currentUserId.current)) return;
      if (!wall || wall.type !== "shared" || capabilities?.wallType !== "shared" || capabilities.joinState !== "owner") { setError("These settings aren't available."); return; }
      setName(wall.name); setOriginalName(wall.name); setVisibility(wall.visibility === "public" ? "public" : "private"); setOpenJoin(wall.visibility === "public" && wall.open_join); setAllowAnonymous(wall.allow_anonymous);
    } catch (cause: any) { if (fence.isCurrent(token, currentUserId.current)) setError(cause?.message ?? "Couldn't load settings."); }
    finally { if (fence.isCurrent(token, currentUserId.current)) setLoading(false); }
  }, [fence, userId, wallId]);

  useFocusEffect(useCallback(() => { fence.focus(userId ?? null); setBusy(null); if (userId && wallId) void load(); else setLoading(false); return () => { fence.blur(); endExclusiveMutation(mutationInFlight); setBusy(null); }; }, [fence, load, userId, wallId]));

  async function save() {
    if (!userId || busy || !name.trim() || !beginExclusiveMutation(mutationInFlight)) return;
    const token = fence.begin(userId); if (!token) { endExclusiveMutation(mutationInFlight); return; }
    setBusy("save"); setError(null);
    try {
      const result = await updateSharedWallSettings({ wallId, name, visibility, openJoin: visibility === "public" && openJoin, allowAnonymous });
      if (!fence.isCurrent(token, currentUserId.current)) return;
      if (result.status === "updated") { setName(result.name); setOriginalName(result.name); setVisibility(result.visibility); setOpenJoin(result.openJoin); setAllowAnonymous(result.allowAnonymous); Alert.alert("Saved", "Shared Wall settings are up to date."); }
      else setError(result.status === "invalid_input" ? "Check the Wall name and privacy settings." : "These settings are no longer available.");
    } catch (cause: any) { if (fence.isCurrent(token, currentUserId.current)) setError(cause?.message ?? "Couldn't save settings."); }
    finally { endExclusiveMutation(mutationInFlight); if (fence.isCurrent(token, currentUserId.current)) setBusy(null); }
  }

  async function remove(expectedName: string) {
    if (!userId || busy || !beginExclusiveMutation(mutationInFlight)) return;
    const token = fence.begin(userId); if (!token) { endExclusiveMutation(mutationInFlight); return; }
    setBusy("delete"); setError(null);
    try {
      const result = await deleteSharedWall(wallId, expectedName);
      if (!fence.isCurrent(token, currentUserId.current)) return;
      if (result.status === "deleted") router.replace("/(tabs)/home");
      else { setBusy(null); setError(result.status === "confirmation_mismatch" ? "The name didn't match. The Wall was not deleted." : "This Wall is no longer available."); }
    } catch (cause: any) { if (fence.isCurrent(token, currentUserId.current)) { setBusy(null); setError(cause?.message ?? "Couldn't delete this Wall."); } }
    finally { endExclusiveMutation(mutationInFlight); if (fence.isCurrent(token, currentUserId.current)) setBusy(null); }
  }

  return <Screen>
    <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}><Text variant="label" color={colors.outline}>‹ BACK</Text></Pressable>
    <Text variant="display" style={{ fontSize: 26, marginTop: 8 }}>Wall settings</Text>
    {error ? <Text accessibilityRole="alert" variant="body" color={colors.error} style={{ marginTop: 12 }}>{error}</Text> : null}
    {loading ? <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 36 }} /> : originalName ? <>
      <View style={{ marginTop: 20 }}><Input label="NAME" value={name} onChangeText={setName} maxLength={60} /></View>
      <Text variant="label" color={colors.outline} style={{ marginTop: 22, marginBottom: 10 }}>WHO CAN SEE IT</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 8 }}>{(["private", "public"] as const).map((choice) => <Pressable key={choice} accessibilityRole="radio" accessibilityState={{ selected: visibility === choice }} onPress={() => { setVisibility(choice); if (choice === "private") setOpenJoin(false); }} style={{ flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.ink, borderRadius: radius.card, backgroundColor: visibility === choice ? colors.ink : colors.card }}><Text variant="label" color={visibility === choice ? markColors.brandYellow : colors.ink}>{choice.toUpperCase()}</Text></Pressable>)}</View>
      {visibility === "public" ? <Toggle label="Open Join" value={openJoin} onValueChange={setOpenJoin} /> : null}
      <Toggle label="Anonymous Marks" value={allowAnonymous} onValueChange={setAllowAnonymous} />
      <View style={{ marginTop: 26, gap: 12 }}><Button label="Save settings" variant="yellow" loading={busy === "save"} disabled={!name.trim()} onPress={() => void save()} /><Button label="Delete Shared Wall" variant="ghost" loading={busy === "delete"} onPress={() => { setConfirmingDelete(true); setDeleteName(""); }} /></View>
      {confirmingDelete ? <View accessibilityRole="alert" style={{ marginTop: 20, padding: 14, borderWidth: 1.5, borderColor: colors.error, borderRadius: radius.card }}><Text variant="headline" color={colors.error}>Delete permanently?</Text><Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 6, marginBottom: 12 }}>Type “{originalName}” exactly. This deletes the Wall and its Marks.</Text><Input label="WALL NAME" value={deleteName} onChangeText={setDeleteName} autoCapitalize="none" /><View style={{ gap: 8, marginTop: 12 }}><Button label="Confirm delete" variant="primary" disabled={deleteName !== originalName} loading={busy === "delete"} onPress={() => void remove(deleteName)} /><Button label="Keep Wall" variant="ghost" onPress={() => { setConfirmingDelete(false); setDeleteName(""); }} /></View></View> : null}
    </> : <Button label="Try again" variant="yellow" onPress={() => void load()} />}
  </Screen>;
}

function Toggle({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) { return <View style={{ flexDirection: "row", alignItems: "center", marginTop: 20 }}><Text variant="headline" style={{ flex: 1 }}>{label}</Text><Switch accessibilityLabel={label} value={value} onValueChange={onValueChange} trackColor={{ false: colors.outlineVariant, true: markColors.brandYellow }} thumbColor={colors.ink} /></View>; }
