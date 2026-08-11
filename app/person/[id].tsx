import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Masonry } from "@/components/Masonry";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { MarkView, estimateMarkHeight } from "@/components/marks/MarkView";
import { useAuth } from "@/lib/auth";
import { getRelationship, type RelationshipState } from "@/lib/friendships";
import { getWallMarks, subscribeToWall, type MarkWithAuthor } from "@/lib/marks";
import { getPersonalWall, getProfile } from "@/lib/profiles";
import type { Profile, Wall } from "@/lib/types";
import { colors, markColors, radius } from "@/theme";

export default function PersonWall() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wall, setWall] = useState<Wall | null>(null);
  const [marks, setMarks] = useState<MarkWithAuthor[]>([]);
  const [relationship, setRelationship] = useState<RelationshipState>("none");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!session?.user.id || !id) return;
      if (session.user.id === id) {
        router.replace("/wall");
        return;
      }
      setLoading(true);
      try {
        const [person, personalWall, state] = await Promise.all([
          getProfile(id),
          getPersonalWall(id),
          getRelationship(session.user.id, id),
        ]);
        if (!active) return;
        setProfile(person);
        setWall(personalWall);
        setRelationship(state);
        if (personalWall) setMarks(await getWallMarks(personalWall.id));
      } catch (cause: any) {
        if (active) setError(cause?.message ?? "Couldn't open this Wall.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id, session?.user.id, router]);

  useEffect(() => {
    if (!wall) return;
    return subscribeToWall(wall.id, (mark) => {
      setMarks((current) => current.some((item) => item.id === mark.id) ? current : [mark, ...current]);
    });
  }, [wall]);

  const canLeaveMark = useMemo(
    () => relationship === "friends" && Boolean(wall) && wall?.contribution_policy !== "nobody",
    [relationship, wall],
  );

  if (loading) return <Screen><ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 60 }} /></Screen>;

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={10} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
        <Text variant="label" color={colors.outline}>‹ BACK</Text>
      </Pressable>
      {error || !profile || !wall ? (
        <Text variant="body" color={colors.error}>{error ?? "This Wall isn't available."}</Text>
      ) : (
        <>
          <View style={{ backgroundColor: colors.ink, padding: 10, borderRadius: radius.card, marginBottom: 16 }}>
            <Text variant="label" color={markColors.brandYellow} style={{ textAlign: "center" }}>
              THIS IS @{profile.handle.toUpperCase()}'S WALL
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <View style={{ width: 58, height: 58, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, backgroundColor: markColors.brandYellow, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
              {profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={{ width: "100%", height: "100%" }} /> : <Text variant="display">{profile.display_name[0]?.toUpperCase()}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="display" style={{ fontSize: 24 }}>{profile.display_name}</Text>
              <Text variant="body" color={colors.outline}>@{profile.handle} · {marks.length} marks</Text>
            </View>
          </View>

          {canLeaveMark ? (
            <View style={{ marginBottom: 24 }}>
              <Button
                label={`Leave a Mark for @${profile.handle}`}
                variant="yellow"
                onPress={() => router.push(`/create?wallId=${wall.id}&recipientId=${profile.id}&handle=${encodeURIComponent(profile.handle)}`)}
              />
            </View>
          ) : (
            <Text variant="body" color={colors.outline} style={{ marginBottom: 24 }}>
              {relationship === "friends" ? "This Wall isn't accepting Marks right now." : "Become friends to leave a Mark here."}
            </Text>
          )}

          {marks.length ? (
            <Masonry data={marks} keyFor={(mark) => mark.id} estimate={estimateMarkHeight} renderItem={(mark) => <MarkView mark={mark} />} />
          ) : (
            <View style={{ paddingVertical: 36, alignItems: "center" }}>
              <Text variant="headline">No Marks yet</Text>
              <Text variant="body" color={colors.outline} style={{ marginTop: 6 }}>Their Wall is waiting for its first story.</Text>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
