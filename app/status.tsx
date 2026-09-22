import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { UNSTABLE_usePreventRemove as usePreventRemove } from "@react-navigation/native";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import { SessionFocusFence } from "@/lib/session-generation";
import { getWallCapabilities } from "@/lib/walls";
import { normalizeStatusDraft, StatusRemovalGuard, statusCharacterCount } from "@/lib/status-contract";
import {
  getWallStatus,
  removeWallStatus,
  saveWallStatus,
  type WallStatusRecord,
} from "@/lib/status";
import { colors, markColors } from "@/theme";

/** Owner-only Status editor. Backend confirmation always precedes close/success. */
export default function StatusScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  type RemovalAction = Parameters<typeof navigation.dispatch>[0];
  const { wallId: wallIdParam } = useLocalSearchParams<{ wallId?: string }>();
  const wallId = String(wallIdParam ?? "");
  const { session } = useAuth();
  const userId = session?.user.id;
  const [status, setStatus] = useState<WallStatusRecord | null>(null);
  const [body, setBody] = useState("");
  const [originalBody, setOriginalBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"saving" | "removing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const fence = useRef(new SessionFocusFence()).current;
  const removalGuard = useRef(new StatusRemovalGuard()).current;
  const pendingRemovalAction = useRef<RemovalAction | null>(null);
  const pendingConfirmedClose = useRef(false);
  const promptOpen = useRef(false);
  const [removalRevision, setRemovalRevision] = useState(0);
  const currentUserId = useRef<string | null>(userId ?? null);
  currentUserId.current = userId ?? null;

  const load = useCallback(async () => {
    const token = fence.begin(userId ?? null);
    if (!token || !wallId) return;
    setLoading(true);
    setError(null);
    setLoadFailed(false);
    try {
      const [nextStatus, capabilities] = await Promise.all([
        getWallStatus(wallId),
        getWallCapabilities(wallId),
      ]);
      if (!fence.isCurrent(token, currentUserId.current)) return;
      if (!capabilities || capabilities.wallType !== "personal" || !capabilities.isOwner) {
        setLoadFailed(true);
        setError("This Status isn't available.");
        return;
      }
      const nextBody = nextStatus?.body ?? "";
      setStatus(nextStatus);
      setBody(nextBody);
      setOriginalBody(nextBody);
    } catch (cause: any) {
      if (fence.isCurrent(token, currentUserId.current)) {
        setError(cause?.message ?? "Couldn't load your Status.");
        setLoadFailed(true);
      }
    } finally {
      if (fence.isCurrent(token, currentUserId.current)) setLoading(false);
    }
  }, [fence, userId, wallId]);

  useFocusEffect(
    useCallback(() => {
      fence.focus(userId ?? null);
      setStatus(null);
      setBody("");
      setOriginalBody("");
      setBusy(null);
      setError(null);
      setLoadFailed(false);
      if (!userId || !wallId) {
        setLoading(false);
        setError("This Status isn't available.");
        setLoadFailed(true);
      } else {
        void load();
      }
      return () => {
        fence.blur();
        setStatus(null);
        setBody("");
        setOriginalBody("");
        setBusy(null);
        setError(null);
        setLoadFailed(false);
        setLoading(true);
      };
    }, [fence, load, userId, wallId]),
  );

  const draft = normalizeStatusDraft(body);
  const inputCount = statusCharacterCount(body);
  const changed = draft.body !== originalBody;
  const canSave = !loading && !busy && !loadFailed && draft.valid && changed;
  removalGuard.setDirty(changed);

  const queueApprovedRemoval = useCallback((action?: RemovalAction) => {
    removalGuard.approveRemoval();
    pendingRemovalAction.current = action ?? null;
    pendingConfirmedClose.current = !action;
    setRemovalRevision((revision) => revision + 1);
  }, [removalGuard]);

  const confirmDiscard = useCallback((action?: RemovalAction) => {
    if (promptOpen.current) return;
    promptOpen.current = true;
    Alert.alert("Discard Status changes?", "Your changes haven't been saved.", [
      { text: "Keep editing", style: "cancel", onPress: () => { promptOpen.current = false; } },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          promptOpen.current = false;
          queueApprovedRemoval(action);
        },
      },
    ]);
  }, [queueApprovedRemoval]);

  useEffect(
    () => navigation.addListener("beforeRemove", (event) => {
      if (removalGuard.removalDecision() === "block") event.preventDefault();
    }),
    [navigation, removalGuard],
  );

  usePreventRemove(removalGuard.shouldPreventRemoval(), ({ data }) => {
    if (removalGuard.removalDecision() === "confirm") confirmDiscard(data.action);
  });

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  }, [router]);

  useEffect(() => {
    if (removalRevision === 0) return;
    const action = pendingRemovalAction.current;
    if (action) {
      pendingRemovalAction.current = null;
      navigation.dispatch(action);
      return;
    }
    if (pendingConfirmedClose.current) {
      pendingConfirmedClose.current = false;
      close();
    }
  }, [close, navigation, removalRevision]);

  function requestClose() {
    const decision = removalGuard.removalDecision();
    if (decision === "block") return;
    if (decision === "confirm") confirmDiscard();
    else close();
  }

  async function save() {
    if (!userId || !canSave) return;
    if (!removalGuard.beginOperation()) return;
    const token = fence.begin(userId);
    if (!token) {
      removalGuard.finishOperation();
      return;
    }
    setBusy("saving");
    setError(null);
    try {
      const confirmed = await saveWallStatus(wallId, draft.body);
      if (!fence.isCurrent(token, currentUserId.current)) return;
      setStatus(confirmed);
      setBody(confirmed.body);
      setOriginalBody(confirmed.body);
      removalGuard.finishOperation();
      queueApprovedRemoval();
    } catch (cause: any) {
      if (fence.isCurrent(token, currentUserId.current)) {
        setError(cause?.message ?? "Couldn't save your Status. Try again.");
      }
    } finally {
      removalGuard.finishOperation();
      if (fence.isCurrent(token, currentUserId.current)) setBusy(null);
    }
  }

  async function remove() {
    if (!userId || !status || busy) return;
    if (!removalGuard.beginOperation()) return;
    const token = fence.begin(userId);
    if (!token) {
      removalGuard.finishOperation();
      return;
    }
    setBusy("removing");
    setError(null);
    try {
      await removeWallStatus(wallId);
      if (!fence.isCurrent(token, currentUserId.current)) return;
      setStatus(null);
      setBody("");
      setOriginalBody("");
      removalGuard.finishOperation();
      queueApprovedRemoval();
    } catch (cause: any) {
      if (fence.isCurrent(token, currentUserId.current)) {
        setError(cause?.message ?? "Couldn't remove your Status. Try again.");
      }
    } finally {
      removalGuard.finishOperation();
      if (fence.isCurrent(token, currentUserId.current)) setBusy(null);
    }
  }

  function confirmRemove() {
    if (busy || !status) return;
    Alert.alert("Remove Status?", "It will disappear from your Personal Wall.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void remove() },
    ]);
  }

  return (
    <Screen dockInset={false}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
        <Text variant="display" style={{ fontSize: 26 }}>{status ? "Edit Status" : "Set a Status"}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close Status editor"
          disabled={Boolean(busy)}
          onPress={requestClose}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text variant="label" color={colors.outline}>CLOSE</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 60 }} />
      ) : (
        <View style={{ gap: 16, marginTop: 22 }}>
          <Input
            label="Your Status"
            accessibilityLabel="Your Status"
            placeholder="What should your people know?"
            value={body}
            onChangeText={setBody}
            editable={!busy && !loadFailed}
            multiline
            textAlignVertical="top"
            style={{ minHeight: 132, paddingTop: 14 }}
            error={!draft.valid && body.length > 0}
            hint={draft.error ?? "A prompt, thought, or mood for your Wall."}
          />
          <Text
            accessibilityLiveRegion="polite"
            variant="label"
            color={inputCount > 150 ? colors.error : colors.outline}
            style={{ textAlign: "right", marginTop: -10 }}
          >
            {inputCount}/150
          </Text>

          {error ? (
            <View style={{ gap: 8 }}>
              <Text accessibilityRole="alert" variant="body" color={colors.error}>{error}</Text>
              {loadFailed ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void load()}
                  disabled={Boolean(busy)}
                  style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}
                >
                  <Text variant="label">RELOAD STATUS</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <Button
            label={status ? "Save Status" : "Set Status"}
            variant="yellow"
            loading={busy === "saving"}
            disabled={!canSave}
            onPress={() => void save()}
          />
          {status ? (
            <Button
              label="Remove Status"
              variant="ghost"
              loading={busy === "removing"}
              disabled={Boolean(busy)}
              onPress={confirmRemove}
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}
