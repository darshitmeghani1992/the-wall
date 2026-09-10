import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import { SessionFocusFence } from "@/lib/session-generation";
import { beginExclusiveMutation, endExclusiveMutation } from "@/lib/mutation-guard";
import { getPendingSharedWallInvite, respondToWallInvite } from "@/lib/walls";
import type { PendingSharedWallInvite } from "@/lib/shared-wall-contract";
import { colors, markColors, radius } from "@/theme";

export default function SharedWallInviteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const wallId = String(id ?? "");
  const { session } = useAuth();
  const userId = session?.user.id;
  const [invite, setInvite] = useState<PendingSharedWallInvite>({ status: "unavailable" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const fence = useRef(new SessionFocusFence()).current;
  const mutationInFlight = useRef(false);
  const currentUserId = useRef<string | null>(userId ?? null);
  currentUserId.current = userId ?? null;

  const load = useCallback(async () => {
    const token = fence.begin(userId ?? null);
    if (!token || !wallId) return;
    setLoading(true); setError(null);
    try {
      const next = await getPendingSharedWallInvite(wallId);
      if (fence.isCurrent(token, currentUserId.current)) setInvite(next);
    } catch (cause: any) {
      if (fence.isCurrent(token, currentUserId.current)) setError(cause?.message ?? "Couldn't check this invitation.");
    } finally {
      if (fence.isCurrent(token, currentUserId.current)) setLoading(false);
    }
  }, [fence, userId, wallId]);

  useFocusEffect(useCallback(() => {
    fence.focus(userId ?? null); setInvite({ status: "unavailable" }); setDeclined(false); setBusy(null);
    if (userId && wallId) void load(); else setLoading(false);
    return () => { fence.blur(); endExclusiveMutation(mutationInFlight); setBusy(null); };
  }, [fence, load, userId, wallId]));

  async function respond(accept: boolean) {
    if (!userId || busy || invite.status !== "available" || !beginExclusiveMutation(mutationInFlight)) return;
    const token = fence.begin(userId);
    if (!token) { endExclusiveMutation(mutationInFlight); return; }
    setBusy(accept ? "accept" : "decline"); setError(null);
    try {
      const result = await respondToWallInvite(wallId, accept);
      if (!fence.isCurrent(token, currentUserId.current)) return;
      if (accept && result.status === "accepted") router.replace(`/shared/${wallId}`);
      else if (!accept && result.status === "declined") { setInvite({ status: "unavailable" }); setDeclined(true); }
      else { setInvite({ status: "unavailable" }); setError("That invitation is no longer available."); }
    } catch (cause: any) {
      if (fence.isCurrent(token, currentUserId.current)) setError(cause?.message ?? "That invitation is no longer available.");
    } finally {
      endExclusiveMutation(mutationInFlight);
      if (fence.isCurrent(token, currentUserId.current)) setBusy(null);
    }
  }

  if (loading) return <Screen><ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 60 }} /></Screen>;
  return (
    <Screen>
      <Text variant="display" style={{ fontSize: 26, marginTop: 24 }}>Shared Wall invite</Text>
      <View style={{ marginTop: 18, padding: 18, borderWidth: 2, borderColor: colors.ink, borderRadius: radius.card, backgroundColor: colors.card }}>
        {invite.status === "available" ? (
          <>
            <Text variant="headline">{invite.wallName}</Text>
            <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 8 }}>
              {invite.ownerDisplayName} invited you to this {invite.visibility} Shared Wall. Accept to join and see what your crew leaves there.
            </Text>
            <View style={{ gap: 10, marginTop: 18 }}>
              <Button label="Accept invite" variant="yellow" loading={busy === "accept"} onPress={() => void respond(true)} />
              <Button label="Decline" variant="ghost" loading={busy === "decline"} onPress={() => void respond(false)} />
            </View>
          </>
        ) : (
          <>
            <Text variant="headline">{declined ? "Invitation declined" : "This invitation isn't available anymore."}</Text>
            <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 8 }}>{declined ? "You won't be added to this Shared Wall." : "It may have been accepted, revoked, or the Shared Wall was removed."}</Text>
            <View style={{ gap: 10, marginTop: 18 }}><Button label="Back to Alerts" variant="primary" onPress={() => router.replace("/(tabs)/alerts")} /><Button label="My Wall" variant="ghost" onPress={() => router.replace("/(tabs)/home")} /></View>
          </>
        )}
      </View>
      {error ? <Text accessibilityRole="alert" variant="body" color={colors.error} style={{ marginTop: 14 }}>{error}</Text> : null}
    </Screen>
  );
}
