import { useEffect, useMemo, useState } from "react";
import { View, TextInput, Pressable, Switch, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { MarkView } from "@/components/marks/MarkView";
import { useAuth } from "@/lib/auth";
import { getPersonalWall } from "@/lib/profiles";
import { createMark, type MarkWithAuthor } from "@/lib/marks";
import type { MarkType } from "@/lib/types";
import { colors, markColors, radius, shadow, stickySwatches } from "@/theme";

const MAX = 500;

// This slice covers the text mark types. Others get their own writer screens.
const SUPPORTED: MarkType[] = ["sticky", "roast", "secret"];

const COPY: Record<string, { title: string; placeholder: string }> = {
  sticky: { title: "Write a Sticky", placeholder: "leave a little note…" },
  roast: { title: "Roast them", placeholder: "lovingly savage…" },
  secret: { title: "Leave a Secret", placeholder: "shhh… only revealed on tap" },
};

export default function Writer() {
  const router = useRouter();
  const { type: rawType } = useLocalSearchParams<{ type: string }>();
  const type = (rawType ?? "sticky") as MarkType;
  const { session, profile } = useAuth();

  const [text, setText] = useState("");
  const [color, setColor] = useState<string>(stickySwatches[0]);
  const [anonymous, setAnonymous] = useState(false);
  const [wallId, setWallId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session?.user) getPersonalWall(session.user.id).then((w) => setWallId(w?.id ?? null));
  }, [session?.user?.id]);

  const copy = COPY[type] ?? COPY.sticky;
  const isSticky = type === "sticky";
  const canSubmit = text.trim().length > 0 && text.length <= MAX && !!wallId;

  // Live preview mark, rendered with the real MarkView so it looks exactly like
  // it will on the wall.
  const preview = useMemo<MarkWithAuthor>(
    () => ({
      id: "preview",
      wall_id: wallId ?? "",
      author_id: session?.user?.id ?? null,
      type,
      text: text.trim() || copy.placeholder,
      color: isSticky ? color : null,
      anonymous,
      media_url: null,
      payload: null,
      rotation: 0,
      pinned: false,
      status: "active",
      created_at: new Date().toISOString(),
      author: anonymous
        ? null
        : {
            id: session?.user?.id ?? "me",
            display_name: profile?.display_name ?? "You",
            avatar_url: profile?.avatar_url ?? null,
            handle: profile?.handle ?? "you",
          },
    }),
    [type, text, color, anonymous, isSticky, wallId, session?.user?.id, profile, copy.placeholder],
  );

  async function submit() {
    if (!canSubmit || !wallId) return;
    setBusy(true);
    try {
      const mark = await createMark({
        wallId,
        type,
        text: text.trim(),
        color: isSticky ? color : null,
        anonymous,
      });
      if (router.canDismiss()) router.dismissAll();
      router.push(`/wall?justCreated=${mark.id}`);
    } catch (e: any) {
      Alert.alert("Couldn't post that", e?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!SUPPORTED.includes(type)) {
    return (
      <Screen scroll={false} dockInset={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Text variant="headline">This mark type is coming soon</Text>
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const overLimit = text.length > MAX;

  return (
    <Screen dockInset={false}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, marginBottom: 18 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text variant="label" color={colors.outline}>‹ BACK</Text>
        </Pressable>
        <Text variant="display" style={{ fontSize: 22 }}>{copy.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Paper textarea */}
      <View
        style={[
          {
            backgroundColor: colors.card,
            borderWidth: 2,
            borderColor: colors.ink,
            borderRadius: radius.card,
            padding: 14,
            minHeight: 140,
          },
          shadow.mark,
        ]}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={copy.placeholder}
          placeholderTextColor={colors.outline}
          multiline
          maxLength={MAX + 1}
          autoFocus
          style={{
            fontFamily: "Bricolage-Bold",
            fontSize: 20,
            lineHeight: 26,
            color: colors.ink,
            minHeight: 110,
            textAlignVertical: "top",
          }}
        />
      </View>
      <Text
        variant="label"
        color={overLimit ? colors.error : colors.outline}
        style={{ alignSelf: "flex-end", marginTop: 6 }}
      >
        {text.length}/{MAX}
      </Text>

      {/* Color picker — Sticky only */}
      {isSticky ? (
        <View style={{ marginTop: 16 }}>
          <Text variant="label" color={colors.outline} style={{ marginBottom: 10 }}>COLOR</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {stickySwatches.map((sw) => {
              const on = sw === color;
              return (
                <Pressable
                  key={sw}
                  onPress={() => setColor(sw)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.sticky,
                    backgroundColor: sw,
                    borderWidth: on ? 3 : 1,
                    borderColor: colors.ink,
                  }}
                />
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Anonymous toggle */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 20,
          paddingVertical: 6,
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text variant="headline" style={{ fontSize: 16 }}>Post anonymously</Text>
          <Text variant="body" color={colors.onSurfaceVariant} style={{ fontSize: 13 }}>
            Your name won't show on this mark.
          </Text>
        </View>
        <Switch
          value={anonymous}
          onValueChange={setAnonymous}
          trackColor={{ false: colors.surfaceContainerHigh, true: markColors.neonGreen }}
          thumbColor={colors.surface}
        />
      </View>

      {/* Live preview */}
      <Text variant="label" color={colors.outline} style={{ marginTop: 22, marginBottom: 12 }}>PREVIEW</Text>
      <View style={{ alignItems: "center" }}>
        <View style={{ width: "70%" }}>
          <MarkView mark={preview} />
        </View>
      </View>

      <View style={{ marginTop: 8, marginBottom: 8 }}>
        {wallId === null && session?.user ? (
          <ActivityIndicator color={markColors.brandYellow} />
        ) : (
          <Button label="Stick it on the Wall ✦" variant="primary" loading={busy} disabled={!canSubmit} onPress={submit} />
        )}
      </View>
    </Screen>
  );
}
