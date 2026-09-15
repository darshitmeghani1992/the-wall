import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { PersonRow, type PersonRowIdentity } from "@/components/PersonRow";
import { Screen } from "@/components/Screen";
import { openCapturedTargetConfirmation } from "@/components/settings-management-contract";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import {
  listBlockedUsers,
  unblockUser,
  type BlockedUser,
  type BlockedUsersCursor,
} from "@/lib/blocks";
import { beginExclusiveMutation, endExclusiveMutation } from "@/lib/mutation-guard";
import { SessionFocusFence, type SessionGenerationToken } from "@/lib/session-generation";
import { colors, markColors, spacing } from "@/theme";

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const actorId = session?.user.id ?? null;
  const currentActorId = useRef(actorId);
  currentActorId.current = actorId;

  const [people, setPeople] = useState<readonly BlockedUser[]>([]);
  const [nextCursor, setNextCursor] = useState<BlockedUsersCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const loadFence = useRef(new SessionFocusFence());
  const actionFence = useRef(new SessionFocusFence());
  const loadInFlight = useRef(false);
  const mutationInFlight = useRef(false);

  const loadPage = useCallback(async (cursor: BlockedUsersCursor | null, append: boolean) => {
    if (loadInFlight.current) return;
    const token = loadFence.current.begin(actorId);
    if (!token) return;
    loadInFlight.current = true;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const result = await listBlockedUsers(token.userId, cursor);
      if (!loadFence.current.isCurrent(token, currentActorId.current)) return;
      if (result.status !== "available") {
        setLoadError(result.status === "unavailable"
          ? "Blocked users aren't available for this account."
          : "That page is no longer available. Please reload the list.");
        return;
      }
      setPeople((current) => {
        if (!append) return result.items;
        const seen = new Set(current.map((person) => person.userId));
        return [...current, ...result.items.filter((person) => !seen.has(person.userId))];
      });
      setNextCursor(result.nextCursor);
    } catch (cause: any) {
      if (loadFence.current.isCurrent(token, currentActorId.current)) {
        setLoadError(cause?.message ?? "Couldn't load blocked users. Please try again.");
      }
    } finally {
      if (loadFence.current.isCurrent(token, currentActorId.current)) {
        loadInFlight.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [actorId]);

  useFocusEffect(useCallback(() => {
    loadFence.current.focus(actorId);
    actionFence.current.focus(actorId);
    loadInFlight.current = false;
    mutationInFlight.current = false;
    setPeople([]);
    setNextCursor(null);
    setLoadError(null);
    setActionError(null);
    setBusyId(null);
    setLoadingMore(false);
    if (actorId) void loadPage(null, false);
    else setLoading(false);
    return () => {
      loadFence.current.blur();
      actionFence.current.blur();
      loadInFlight.current = false;
      endExclusiveMutation(mutationInFlight);
      setBusyId(null);
      setLoadingMore(false);
    };
  }, [actorId, loadPage]));

  function confirmUnblock(person: BlockedUser) {
    openCapturedTargetConfirmation({
      capture: () => actionFence.current.begin(actorId),
      isCurrent: (token) => actionFence.current.isCurrent(token, currentActorId.current),
      targetId: person.userId,
      open: (onConfirm) => Alert.alert(
        `Unblock ${person.displayName}?`,
        "They may be able to find and interact with you again. Past friendships and follows won't return automatically.",
        [
          { text: "Keep blocked", style: "cancel" },
          { text: "Unblock", style: "destructive", onPress: onConfirm },
        ],
      ),
      run: (token, targetId) => void unblock(targetId, token),
    });
  }

  async function unblock(personId: string, token: SessionGenerationToken) {
    if (!actionFence.current.isCurrent(token, currentActorId.current)) return;
    if (busyId || !beginExclusiveMutation(mutationInFlight)) return;
    setBusyId(personId);
    setActionError(null);
    try {
      await unblockUser(token.userId, personId);
      if (!actionFence.current.isCurrent(token, currentActorId.current)) return;
      setPeople((current) => current.filter((person) => person.userId !== personId));
    } catch (cause: any) {
      if (actionFence.current.isCurrent(token, currentActorId.current)) {
        setActionError(cause?.message ?? "Couldn't unblock that person. Please try again.");
      }
    } finally {
      if (actionFence.current.isCurrent(token, currentActorId.current)) {
        endExclusiveMutation(mutationInFlight);
        setBusyId(null);
      }
    }
  }

  return (
    <Screen dockInset={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        accessibilityState={{ disabled: busyId !== null }}
        disabled={busyId !== null}
        onPress={() => router.back()}
        style={{ minHeight: spacing.unit * 11, justifyContent: "center", alignSelf: "flex-start" }}
      >
        <Text variant="label" color={colors.outline}>‹ BACK</Text>
      </Pressable>
      <Text variant="display" style={{ marginTop: spacing.unit * 2 }}>Blocked users</Text>
      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: spacing.unit * 2 }}>
        People you block cannot view, contribute to, or notify you through The-Wall.
      </Text>

      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading blocked users" color={markColors.brandYellow} style={{ marginTop: spacing.unit * 9 }} />
      ) : loadError && people.length === 0 ? (
        <View style={{ marginTop: spacing.unit * 6, gap: spacing.unit * 3 }}>
          <Text accessibilityRole="alert" variant="body" color={colors.error}>{loadError}</Text>
          <Button label="Try again" variant="yellow" onPress={() => void loadPage(null, false)} />
        </View>
      ) : (
        <View style={{ marginTop: spacing.unit * 6 }}>
          {actionError ? <Text accessibilityRole="alert" variant="body" color={colors.error}>{actionError}</Text> : null}
          {loadError ? (
            <View style={{ gap: spacing.unit * 2, marginBottom: spacing.unit * 3 }}>
              <Text accessibilityRole="alert" variant="body" color={colors.error}>{loadError}</Text>
              <Button label="Retry page" variant="ghost" onPress={() => void loadPage(nextCursor, people.length > 0)} />
            </View>
          ) : null}
          {people.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.unit * 10 }}>
              <Text variant="headline">No blocked users</Text>
              <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: spacing.unit * 2, textAlign: "center" }}>
                Anyone you block will appear here.
              </Text>
            </View>
          ) : people.map((person) => (
            <PersonRow
              key={person.userId}
              profile={blockedProfile(person)}
              detail="Blocked"
              action="Unblock"
              disabled={busyId !== null}
              onAction={() => confirmUnblock(person)}
            />
          ))}
          {nextCursor ? (
            <View style={{ marginTop: spacing.unit * 4 }}>
              <Button
                label="Load more"
                variant="ghost"
                loading={loadingMore}
                disabled={busyId !== null}
                onPress={() => void loadPage(nextCursor, true)}
              />
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function blockedProfile(person: BlockedUser): PersonRowIdentity {
  return {
    id: person.userId,
    display_name: person.displayName,
    handle: person.handle,
    avatar_url: person.avatarUrl,
  };
}
