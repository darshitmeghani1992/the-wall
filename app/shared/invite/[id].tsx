import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import { SessionFocusFence } from "@/lib/session-generation";
import {
  acceptWallMembership,
  declineWallMembership,
  getMyWallMembership,
  getWall,
  type WallMember,
} from "@/lib/walls";
import type { Wall } from "@/lib/types";
import { colors, markColors, radius } from "@/theme";

type InviteState = {
  membership: WallMember | null;
  wall: Wall | null;
};

/** Guarded decision surface for pending, accepted, revoked, and deleted invites. */
export default function SharedWallInviteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const wallId = String(id ?? "");
  const { session } = useAuth();
  const userId = session?.user.id;
  const [state, setState] = useState<InviteState>({ membership: null, wall: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const fence = useRef(new SessionFocusFence()).current;
  const currentUserId = useRef<string | null>(userId ?? null);
  currentUserId.current = userId ?? null;

  const load = useCallback(async () => {
    const token = fence.begin(userId ?? null);
    if (!token || !wallId) return;
    setLoading(true);
    setError(null);
    try {
      const membership = await getMyWallMembership(wallId, token.userId);
      if (!fence.isCurrent(token, currentUserId.current)) return;
      const wall = membership ? await getWall(wallId) : null;
      if (!fence.isCurrent(token, currentUserId.current)) return;
      setState({ membership, wall });
    } catch (cause: any) {
      if (fence.isCurrent(token, currentUserId.current)) {
        setError(cause?.message ?? "Couldn't check this invitation.");
      }
    } finally {
      if (fence.isCurrent(token, currentUserId.current)) setLoading(false);
    }
  }, [fence, userId, wallId]);

  useFocusEffect(
    useCallback(() => {
      fence.focus(userId ?? null);
      setState({ membership: null, wall: null });
      setDeclined(false);
      setBusy(null);
      if (!userId || !wallId) {
        setLoading(false);
      } else {
        void load();
      }
      return () => {
        fence.blur();
        setState({ membership: null, wall: null });
        setError(null);
        setBusy(null);
        setLoading(true);
      };
    }, [fence, load, userId, wallId]),
  );

  async function accept() {
    if (!userId || busy || state.membership?.status !== "pending") return;
    const token = fence.begin(userId);
    if (!token) return;
    setBusy("accept");
    setError(null);
    try {
      await acceptWallMembership(wallId);
      if (!fence.isCurrent(token, currentUserId.current)) return;
      router.replace(`/shared/${wallId}`);
    } catch (cause: any) {
      if (!fence.isCurrent(token, currentUserId.current)) return;
      setError(cause?.message ?? "That invitation is no longer available.");
      setBusy(null);
      void load();
    } finally {
      if (fence.isCurrent(token, currentUserId.current)) setBusy(null);
    }
  }

  async function decline() {
    if (!userId || busy || state.membership?.status !== "pending") return;
    const token = fence.begin(userId);
    if (!token) return;
    setBusy("decline");
    setError(null);
    try {
      await declineWallMembership(wallId);
      if (!fence.isCurrent(token, currentUserId.current)) return;
      setState({ membership: null, wall: null });
      setDeclined(true);
    } catch (cause: any) {
      if (!fence.isCurrent(token, currentUserId.current)) return;
      setError(cause?.message ?? "That invitation is no longer available.");
      setBusy(null);
      void load();
    } finally {
      if (fence.isCurrent(token, currentUserId.current)) setBusy(null);
    }
  }

  if (loading) {
    return <Screen><ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 60 }} /></Screen>;
  }

  const pending = state.membership?.status === "pending";
  const accepted = state.membership?.status === "accepted";
  const privacy = state.wall?.visibility === "public" ? "Public" : state.wall ? "Private" : null;

  return (
    <Screen>
      <Text variant="display" style={{ fontSize: 26, marginTop: 24 }}>Shared Wall invite</Text>
      <View
        style={{
          marginTop: 18,
          padding: 18,
          borderWidth: 2,
          borderColor: colors.ink,
          borderRadius: radius.card,
          backgroundColor: colors.card,
        }}
      >
        {pending ? (
          <>
            <Text variant="headline">{state.wall?.name ?? "You've been invited to a Shared Wall"}</Text>
            <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 8 }}>
              {privacy ? `${privacy} Shared Wall. ` : ""}Accept to join and see what your crew leaves there.
            </Text>
            <View style={{ gap: 10, marginTop: 18 }}>
              <Button label="Accept invite" variant="yellow" loading={busy === "accept"} onPress={() => void accept()} />
              <Button label="Decline" variant="ghost" loading={busy === "decline"} onPress={() => void decline()} />
            </View>
          </>
        ) : accepted && state.wall ? (
          <>
            <Text variant="headline">You&apos;re already a member of {state.wall.name}.</Text>
            <View style={{ marginTop: 18 }}>
              <Button label="Open Shared Wall" variant="yellow" onPress={() => router.replace(`/shared/${wallId}`)} />
            </View>
          </>
        ) : (
          <>
            <Text variant="headline">{declined ? "Invitation declined" : "This invitation isn't available anymore."}</Text>
            <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 8 }}>
              {declined ? "You won't be added to this Shared Wall." : "It may have been revoked, or the Shared Wall was removed."}
            </Text>
            <View style={{ gap: 10, marginTop: 18 }}>
              <Button label="Back to Alerts" variant="primary" onPress={() => router.replace("/(tabs)/alerts")} />
              <Button label="My Wall" variant="ghost" onPress={() => router.replace("/(tabs)/home")} />
            </View>
          </>
        )}
      </View>
      {error ? (
        <Text accessibilityRole="alert" variant="body" color={colors.error} style={{ marginTop: 14 }}>
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}
