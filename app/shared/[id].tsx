import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PersonRow } from "@/components/PersonRow";
import { Masonry } from "@/components/Masonry";
import { MarkView, estimateMarkHeight } from "@/components/marks/MarkView";
import { MarkDetailModal } from "@/components/marks/MarkDetailModal";
import { useAuth } from "@/lib/auth";
import { searchPeople, type PersonRelationship } from "@/lib/friendships";
import {
  deleteSharedWall,
  getWall,
  getWallMembers,
  inviteToWall,
  leaveSharedWall,
  removeWallMember,
  transferSharedWallOwnership,
  type WallMemberWithProfile,
} from "@/lib/walls";
import { getWallMarks, type MarkWithAuthor } from "@/lib/marks";
import { getProfile } from "@/lib/profiles";
import { useStaggeredArrivals } from "@/hooks/useStaggeredArrivals";
import { useWallReactions } from "@/hooks/useWallReactions";
import { inviteToSharedWall, shareSharedWall } from "@/lib/share";
import type { Profile, Wall } from "@/lib/types";
import { colors, markColors, radius } from "@/theme";

export default function SharedWallScreen() {
  const router = useRouter();
  const { id, justCreated } = useLocalSearchParams<{ id: string; justCreated?: string }>();
  const justCreatedId = justCreated ? String(justCreated) : null;
  const { session } = useAuth();
  const [wall, setWall] = useState<Wall | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [marks, setMarks] = useState<MarkWithAuthor[]>([]);
  const [members, setMembers] = useState<WallMemberWithProfile[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<PersonRelationship[]>([]);
  const [memberBusyId, setMemberBusyId] = useState<string | null>(null);
  const [memberSearching, setMemberSearching] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMark, setSelectedMark] = useState<MarkWithAuthor | null>(null);
  const dropIds = useRef<Set<string>>(new Set(justCreatedId ? [justCreatedId] : []));

  const isOwner = Boolean(wall && session?.user.id === wall.owner_id);
  const isAcceptedMember = members.some((member) => member.user_id === session?.user.id && member.status === "accepted");

  const refreshMembers = useCallback(async (wallId: string) => {
    try {
      setMembers(await getWallMembers(wallId));
    } catch {
      setMembers([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const w = await getWall(id);
        if (!active) return;
        if (!w || w.type !== "shared") {
          setError("This Shared Wall isn't available.");
          return;
        }
        setWall(w);
        const [ownerProfile, ms, roster] = await Promise.all([
          getProfile(w.owner_id),
          getWallMarks(w.id),
          getWallMembers(w.id).catch(() => []),
        ]);
        if (!active) return;
        setOwner(ownerProfile);
        setMarks(ms);
        setMembers(roster);
      } catch (cause: any) {
        if (active) setError(cause?.message ?? "Couldn't open this Shared Wall.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  useStaggeredArrivals(wall?.id, (mark) => {
    dropIds.current.add(mark.id);
    setMarks((current) => (current.some((item) => item.id === mark.id) ? current : [mark, ...current]));
  });

  const { summaries, toggle } = useWallReactions(marks, session?.user.id);
  const canLeaveMark = Boolean(wall) && (isOwner || wall?.visibility === "public" || isAcceptedMember);

  async function searchMembers() {
    if (!session?.user.id || !memberQuery.trim()) return;
    setMemberSearching(true);
    try {
      setMemberResults(await searchPeople(session.user.id, memberQuery));
    } catch (cause: any) {
      Alert.alert("Couldn't search", cause?.message ?? "Please try again.");
    } finally {
      setMemberSearching(false);
    }
  }

  async function invitePerson(personId: string) {
    if (!wall) return;
    setMemberBusyId(personId);
    try {
      await inviteToWall(wall.id, personId);
      await refreshMembers(wall.id);
      setMemberResults((current) => current.filter((item) => item.profile.id !== personId));
    } catch (cause: any) {
      Alert.alert("Couldn't invite them", cause?.message ?? "They may already have an invite.");
    } finally {
      setMemberBusyId(null);
    }
  }

  function confirmRemove(member: WallMemberWithProfile) {
    if (!wall) return;
    const name = member.profile?.display_name ?? "this member";
    Alert.alert("Remove member?", `${name} will lose access to this Shared Wall.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setMemberBusyId(member.user_id);
          try {
            await removeWallMember(wall.id, member.user_id);
            await refreshMembers(wall.id);
          } catch (cause: any) {
            Alert.alert("Couldn't remove them", cause?.message ?? "Please try again.");
          } finally {
            setMemberBusyId(null);
          }
        },
      },
    ]);
  }

  function confirmTransfer(member: WallMemberWithProfile) {
    if (!wall || !member.profile || member.status !== "accepted") return;
    const nextOwner = member.profile;
    Alert.alert(
      "Transfer ownership?",
      `${nextOwner.display_name} will become the owner. You'll remain an accepted member, and only they will be able to manage or delete this Wall.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Transfer",
          onPress: async () => {
            setMemberBusyId(member.user_id);
            try {
              await transferSharedWallOwnership(wall.id, member.user_id);
              setWall({ ...wall, owner_id: member.user_id });
              setOwner(nextOwner);
              await refreshMembers(wall.id);
            } catch (cause: any) {
              Alert.alert("Couldn't transfer ownership", cause?.message ?? "Please try again.");
            } finally {
              setMemberBusyId(null);
            }
          },
        },
      ],
    );
  }

  function manageMember(member: WallMemberWithProfile) {
    if (member.status !== "accepted") {
      confirmRemove(member);
      return;
    }
    const name = member.profile?.display_name ?? "Member";
    Alert.alert(name, "Manage this member's access.", [
      { text: "Cancel", style: "cancel" },
      { text: "Make owner", onPress: () => confirmTransfer(member) },
      { text: "Remove", style: "destructive", onPress: () => confirmRemove(member) },
    ]);
  }

  function confirmLeave() {
    if (!wall) return;
    Alert.alert("Leave this Shared Wall?", "You'll lose access if the Wall is private. The owner can invite you again later.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          setLifecycleBusy(true);
          try {
            await leaveSharedWall(wall.id);
            router.replace("/(tabs)/walls");
          } catch (cause: any) {
            Alert.alert("Couldn't leave", cause?.message ?? "Please try again.");
          } finally {
            setLifecycleBusy(false);
          }
        },
      },
    ]);
  }

  function confirmDelete() {
    if (!wall) return;
    Alert.alert(
      "Delete this Shared Wall?",
      `"${wall.name}" and its Marks will be permanently deleted. This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Wall",
          style: "destructive",
          onPress: async () => {
            setLifecycleBusy(true);
            try {
              await deleteSharedWall(wall.id);
              router.replace("/(tabs)/walls");
            } catch (cause: any) {
              Alert.alert("Couldn't delete the Wall", cause?.message ?? "Please try again.");
            } finally {
              setLifecycleBusy(false);
            }
          },
        },
      ],
    );
  }

  if (loading) return <Screen><ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 60 }} /></Screen>;

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back" style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
        <Text variant="label" color={colors.outline}>‹ BACK</Text>
      </Pressable>

      {error || !wall ? (
        <Text variant="body" color={colors.error} style={{ marginTop: 12 }}>{error ?? "This Shared Wall isn't available."}</Text>
      ) : (
        <>
          <View style={{ backgroundColor: colors.ink, padding: 10, borderRadius: radius.card, marginTop: 8, marginBottom: 16 }}>
            <Text variant="label" color={markColors.brandYellow} style={{ textAlign: "center" }}>
              SHARED WALL · {wall.visibility.toUpperCase()}
            </Text>
          </View>

          <Text variant="display" style={{ fontSize: 26 }}>{wall.name}</Text>
          <Text variant="body" color={colors.outline} style={{ marginTop: 4 }}>
            {owner ? `Started by ${owner.display_name}` : "Shared Wall"} · {marks.length} marks · {members.filter((m) => m.status === "accepted").length} members
          </Text>

          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 16, marginBottom: 16 }}>
            {canLeaveMark ? (
              <Button label={`Leave a Mark on ${wall.name}`} variant="yellow" onPress={() => router.push(`/create?sharedWallId=${wall.id}&wallName=${encodeURIComponent(wall.name)}`)} />
            ) : null}
            {wall.visibility === "public" ? (
              <>
                <Button label="Invite" variant="primary" onPress={() => inviteToSharedWall(wall.id, wall.name)} />
                <Button label="Share ↗" variant="ghost" onPress={() => shareSharedWall(wall.id, wall.name)} />
              </>
            ) : null}
          </View>

          {isOwner && wall.visibility === "private" ? (
            <View style={{ borderWidth: 2, borderColor: colors.ink, borderRadius: radius.card, padding: 14, marginBottom: 22 }}>
              <Text variant="headline">Members</Text>
              <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: 3, marginBottom: 12 }}>
                Search by handle. Access begins only after the person accepts the invite.
              </Text>
              <Input
                prefix="@"
                value={memberQuery}
                onChangeText={setMemberQuery}
                onSubmitEditing={searchMembers}
                placeholder="handle"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              <Pressable onPress={searchMembers} disabled={!memberQuery.trim() || memberSearching} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
                {memberSearching ? <ActivityIndicator color={markColors.brandYellow} /> : <Text variant="label">SEARCH TO INVITE</Text>}
              </Pressable>

              {memberResults.map(({ profile }) => {
                const existing = members.find((m) => m.user_id === profile.id);
                const action = existing ? (existing.status === "accepted" ? "Member" : "Invited") : "Invite";
                return (
                  <PersonRow
                    key={profile.id}
                    profile={profile}
                    action={action}
                    disabled={memberBusyId === profile.id || Boolean(existing)}
                    onPress={() => router.push(`/person/${profile.id}`)}
                    onAction={existing ? undefined : () => invitePerson(profile.id)}
                  />
                );
              })}

              {members.length ? (
                <View style={{ marginTop: 12 }}>
                  <Text variant="label" color={colors.outline}>CURRENT ACCESS</Text>
                  {members.map((member) => member.profile ? (
                    <PersonRow
                      key={member.user_id}
                      profile={member.profile}
                      action={member.status === "accepted" ? "Manage" : "Revoke"}
                      disabled={memberBusyId === member.user_id}
                      onPress={() => router.push(`/person/${member.user_id}`)}
                      onAction={() => manageMember(member)}
                    />
                  ) : null)}
                </View>
              ) : null}
            </View>
          ) : null}

          {(isOwner || isAcceptedMember) ? (
            <View style={{ borderTopWidth: 1, borderTopColor: colors.outlineVariant, paddingTop: 14, marginBottom: 20 }}>
              {isOwner ? (
                <Pressable disabled={lifecycleBusy} onPress={confirmDelete} style={{ minHeight: 44, justifyContent: "center" }}>
                  <Text variant="label" color={colors.error}>DELETE SHARED WALL</Text>
                </Pressable>
              ) : (
                <Pressable disabled={lifecycleBusy} onPress={confirmLeave} style={{ minHeight: 44, justifyContent: "center" }}>
                  <Text variant="label" color={colors.error}>LEAVE SHARED WALL</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {marks.length ? (
            <Masonry
              data={marks}
              keyFor={(mark) => mark.id}
              estimate={estimateMarkHeight}
              renderItem={(mark, index) => (
                <MarkView
                  mark={mark}
                  enter={dropIds.current.has(mark.id) ? "drop" : "settle"}
                  enterIndex={index}
                  highlight={mark.id === justCreatedId}
                  reactions={summaries[mark.id]}
                  onToggleReaction={(emoji) => toggle(mark.id, emoji)}
                  onOpenDetail={() => setSelectedMark(mark)}
                />
              )}
            />
          ) : (
            <View style={{ paddingVertical: 36, alignItems: "center" }}>
              <Text variant="headline">No Marks yet</Text>
              <Text variant="body" color={colors.outline} style={{ marginTop: 6, textAlign: "center" }}>Be the first to leave a Mark on {wall.name}.</Text>
            </View>
          )}

          <MarkDetailModal
            mark={selectedMark}
            viewerId={session?.user.id}
            wallOwnerId={wall.owner_id}
            reactions={selectedMark ? summaries[selectedMark.id] : undefined}
            onToggleReaction={selectedMark ? (emoji) => toggle(selectedMark.id, emoji) : undefined}
            onClose={() => setSelectedMark(null)}
            onMarkUpdated={(markId, text) => {
              setMarks((current) => current.map((item) => item.id === markId ? { ...item, text } : item));
              setSelectedMark((current) => current?.id === markId ? { ...current, text } : current);
            }}
            onMarkRemoved={(markId) => setMarks((current) => current.filter((item) => item.id !== markId))}
          />
        </>
      )}
    </Screen>
  );
}
