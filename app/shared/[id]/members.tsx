import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Input } from "@/components/Input";
import { PersonRow } from "@/components/PersonRow";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import { searchPeople, type PersonRelationship } from "@/lib/friendships";
import { SessionFocusFence } from "@/lib/session-generation";
import { beginExclusiveMutation, endExclusiveMutation } from "@/lib/mutation-guard";
import { getRemovedSharedWallMembers, getWall, getWallCapabilities, getWallMembers, inviteToWall, removeSharedWallMember, transferSharedWallOwnership, type RemovedWallMember, type WallMemberWithProfile } from "@/lib/walls";
import type { Wall } from "@/lib/types";
import { colors, markColors } from "@/theme";

export default function SharedWallMembersScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const wallId = String(id ?? "");
  const { session } = useAuth();
  const userId = session?.user.id;
  const [wall, setWall] = useState<Wall | null>(null);
  const [members, setMembers] = useState<WallMemberWithProfile[]>([]);
  const [removed, setRemoved] = useState<RemovedWallMember[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fence = useRef(new SessionFocusFence()).current;
  const mutationInFlight = useRef(false);
  const currentUserId = useRef<string | null>(userId ?? null);
  currentUserId.current = userId ?? null;

  const load = useCallback(async () => {
    const token = fence.begin(userId ?? null);
    if (!token || !wallId) return;
    setLoading(true); setError(null);
    try {
      const [nextWall, capabilities, nextMembers] = await Promise.all([getWall(wallId), getWallCapabilities(wallId), getWallMembers(wallId)]);
      if (!fence.isCurrent(token, currentUserId.current)) return;
      if (!nextWall || nextWall.type !== "shared" || capabilities?.wallType !== "shared" || !["owner", "member"].includes(capabilities.joinState)) {
        setError("This member list isn't available."); setWall(null); return;
      }
      const owner = capabilities.joinState === "owner";
      const nextRemoved = owner ? await getRemovedSharedWallMembers(wallId) : [];
      if (!fence.isCurrent(token, currentUserId.current)) return;
      setWall(nextWall); setMembers(nextMembers); setRemoved(nextRemoved); setIsOwner(owner);
    } catch (cause: any) {
      if (fence.isCurrent(token, currentUserId.current)) setError(cause?.message ?? "Couldn't load members.");
    } finally {
      if (fence.isCurrent(token, currentUserId.current)) setLoading(false);
    }
  }, [fence, userId, wallId]);

  useFocusEffect(useCallback(() => {
    fence.focus(userId ?? null); setWall(null); setMembers([]); setRemoved([]); setResults([]); setBusyId(null);
    if (userId && wallId) void load(); else setLoading(false);
    return () => { fence.blur(); endExclusiveMutation(mutationInFlight); setBusyId(null); };
  }, [fence, load, userId, wallId]));

  async function search() {
    if (!userId || !isOwner || !query.trim()) return;
    const token = fence.begin(userId); if (!token) return;
    setSearching(true); setError(null);
    try {
      const people = await searchPeople(userId, query);
      if (fence.isCurrent(token, currentUserId.current)) setResults(people.filter((person) => person.profile.id !== wall?.owner_id));
    } catch (cause: any) {
      if (fence.isCurrent(token, currentUserId.current)) setError(cause?.message ?? "Search didn't work.");
    } finally { if (fence.isCurrent(token, currentUserId.current)) setSearching(false); }
  }

  async function invite(personId: string) {
    if (!userId || busyId || !beginExclusiveMutation(mutationInFlight)) return;
    const token = fence.begin(userId); if (!token) { endExclusiveMutation(mutationInFlight); return; }
    setBusyId(personId); setError(null);
    try {
      const result = await inviteToWall(wallId, personId);
      if (!fence.isCurrent(token, currentUserId.current)) return;
      if (["invited", "already_invited", "already_member"].includes(result.status)) {
        setBusyId(null); void load();
      } else {
        setError("That person can't be invited right now.");
      }
    } catch (cause: any) {
      if (fence.isCurrent(token, currentUserId.current)) { setError(cause?.message ?? "Couldn't send that invitation."); setBusyId(null); }
    } finally { endExclusiveMutation(mutationInFlight); if (fence.isCurrent(token, currentUserId.current)) setBusyId(null); }
  }

  function confirmRemove(member: WallMemberWithProfile) {
    const name = member.profile?.display_name ?? "this person";
    Alert.alert(member.status === "pending" ? `Revoke ${name}'s invitation?` : `Remove ${name}?`, member.status === "accepted" ? "They won't be able to rejoin through Open Join. You can invite them back later." : "They will no longer be able to accept this invitation.", [
      { text: "Cancel", style: "cancel" },
      { text: member.status === "pending" ? "Revoke" : "Remove", style: "destructive", onPress: () => void remove(member.user_id) },
    ]);
  }

  async function remove(personId: string) {
    if (!userId || busyId || !beginExclusiveMutation(mutationInFlight)) return;
    const token = fence.begin(userId); if (!token) { endExclusiveMutation(mutationInFlight); return; }
    setBusyId(personId);
    try {
      const result = await removeSharedWallMember(wallId, personId);
      if (!fence.isCurrent(token, currentUserId.current)) return;
      if (result.status === "removed" || result.status === "revoked") {
        setBusyId(null); void load();
      } else {
        setError("That membership has already changed.");
      }
    } catch (cause: any) {
      if (fence.isCurrent(token, currentUserId.current)) { setError(cause?.message ?? "Couldn't update that member."); setBusyId(null); }
    } finally { endExclusiveMutation(mutationInFlight); if (fence.isCurrent(token, currentUserId.current)) setBusyId(null); }
  }

  function confirmTransfer(member: WallMemberWithProfile) {
    const name = member.profile?.display_name ?? "this member";
    Alert.alert(`Make ${name} the owner?`, "You will become a member. Only the new owner can transfer or delete this Wall.", [
      { text: "Cancel", style: "cancel" },
      { text: "Transfer ownership", style: "destructive", onPress: () => void transfer(member.user_id) },
    ]);
  }

  async function transfer(personId: string) {
    if (!userId || busyId || !beginExclusiveMutation(mutationInFlight)) return;
    const token = fence.begin(userId); if (!token) { endExclusiveMutation(mutationInFlight); return; }
    setBusyId(personId);
    try {
      const transferred = await transferSharedWallOwnership(wallId, personId);
      if (!fence.isCurrent(token, currentUserId.current)) return;
      if (transferred) router.replace(`/shared/${wallId}`); else { setError("Ownership couldn't be transferred. The membership may have changed."); setBusyId(null); }
    } catch (cause: any) {
      if (fence.isCurrent(token, currentUserId.current)) { setError(cause?.message ?? "Couldn't transfer ownership."); setBusyId(null); }
    } finally { endExclusiveMutation(mutationInFlight); if (fence.isCurrent(token, currentUserId.current)) setBusyId(null); }
  }

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}><Text variant="label" color={colors.outline}>‹ BACK</Text></Pressable>
      <Text variant="display" style={{ fontSize: 26, marginTop: 8 }}>{wall?.name ?? "Shared Wall"} members</Text>
      {error ? <Text accessibilityRole="alert" variant="body" color={colors.error} style={{ marginTop: 12 }}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 36 }} /> : wall ? (
        <>
          {isOwner ? <View style={{ marginTop: 20 }}><Input label="INVITE A REGISTERED USER" value={query} onChangeText={(value) => { setQuery(value); setResults([]); }} onSubmitEditing={() => void search()} placeholder="name or handle" autoCapitalize="none" returnKeyType="search" /><Pressable accessibilityRole="button" accessibilityState={{ disabled: !query.trim() || searching, busy: searching }} disabled={!query.trim() || searching} onPress={() => void search()} style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}>{searching ? <ActivityIndicator color={markColors.brandYellow} /> : <Text variant="label">SEARCH</Text>}</Pressable>{results.map((person) => <PersonRow key={person.profile.id} profile={person.profile} detail="Registered user" action="Invite" disabled={busyId === person.profile.id} onPress={() => router.push(`/person/${person.profile.id}`)} onAction={() => void invite(person.profile.id)} />)}</View> : null}

          <Section label={`ACCEPTED · ${members.filter((member) => member.status === "accepted").length}`}>
            {members.filter((member) => member.status === "accepted").map((member) => <PersonRow key={member.user_id} profile={member.profile ?? unavailableProfile(member.user_id)} detail="Member" action={isOwner ? "Remove" : undefined} secondaryAction={isOwner ? "Transfer" : undefined} disabled={busyId === member.user_id} secondaryDisabled={busyId === member.user_id || !member.profile} onPress={member.profile ? () => router.push(`/person/${member.user_id}`) : undefined} onAction={isOwner ? () => confirmRemove(member) : undefined} onSecondaryAction={isOwner ? () => confirmTransfer(member) : undefined} />)}
          </Section>
          {isOwner && members.some((member) => member.status === "pending") ? <Section label={`PENDING · ${members.filter((member) => member.status === "pending").length}`}>{members.filter((member) => member.status === "pending").map((member) => <PersonRow key={member.user_id} profile={member.profile ?? unavailableProfile(member.user_id)} detail="Invited" action="Revoke" disabled={busyId === member.user_id} onAction={() => confirmRemove(member)} />)}</Section> : null}
          {isOwner && removed.length ? <Section label={`REMOVED · ${removed.length}`}>{removed.map((member) => <PersonRow key={member.user_id} profile={member.profile ?? unavailableProfile(member.user_id)} detail="Owner approval required" action={member.profile ? "Invite back" : undefined} disabled={busyId === member.user_id} onAction={member.profile ? () => void invite(member.user_id) : undefined} />)}</Section> : null}
        </>
      ) : <Pressable accessibilityRole="button" onPress={() => void load()} style={{ minHeight: 48, justifyContent: "center" }}><Text variant="label">TRY AGAIN</Text></Pressable>}
    </Screen>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) { return <View style={{ marginTop: 24 }}><Text variant="label" color={colors.outline}>{label}</Text>{children}</View>; }
function unavailableProfile(id: string) { return { id, handle: "unavailable", display_name: "Unavailable member", avatar_url: null, bio: null, interests: null, instagram: null, tiktok: null, youtube: null, x: null, website: null, account_status: "deactivated" as const, deactivated_at: null, onboarding_completed: false, walkthrough_completed_at: null, is_admin: false, created_at: "" }; }
