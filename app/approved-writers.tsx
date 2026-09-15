import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PersonRow, type PersonRowIdentity } from "@/components/PersonRow";
import { Screen } from "@/components/Screen";
import { openCapturedTargetConfirmation } from "@/components/settings-management-contract";
import { Text } from "@/components/Text";
import { useAuth } from "@/lib/auth";
import { searchPeople, type PersonRelationship } from "@/lib/friendships";
import { beginExclusiveMutation, endExclusiveMutation } from "@/lib/mutation-guard";
import {
  addApprovedWriter,
  getPersonalWallSettings,
  listApprovedWriters,
  removeApprovedWriter,
  type PersonalWallSettings,
} from "@/lib/personal-wall-settings";
import { normalizePeopleSearchQuery } from "@/lib/relationship-ui";
import { SessionFocusFence, type SessionGenerationToken } from "@/lib/session-generation";
import { colors, markColors, spacing } from "@/theme";

type ApprovedWriterRow = Awaited<ReturnType<typeof listApprovedWriters>>[number];

export default function ApprovedWritersScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const actorId = session?.user.id ?? null;
  const currentActorId = useRef(actorId);
  currentActorId.current = actorId;

  const [settings, setSettings] = useState<PersonalWallSettings | null>(null);
  const [writers, setWriters] = useState<readonly ApprovedWriterRow[]>([]);
  const [query, setQuery] = useState("");
  const currentQuery = useRef(query);
  currentQuery.current = query;
  const [results, setResults] = useState<PersonRelationship[]>([]);
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadFence = useRef(new SessionFocusFence());
  const searchFence = useRef(new SessionFocusFence());
  const actionFence = useRef(new SessionFocusFence());
  const mutationInFlight = useRef(false);

  const load = useCallback(async () => {
    const token = loadFence.current.begin(actorId);
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const nextSettings = await getPersonalWallSettings(token.userId);
      if (!loadFence.current.isCurrent(token, currentActorId.current)) return;
      setSettings(nextSettings);
      if (nextSettings.contributionPolicy !== "selected") {
        setWriters([]);
        return;
      }
      const nextWriters = await listApprovedWriters(token.userId, nextSettings.wallId);
      if (!loadFence.current.isCurrent(token, currentActorId.current)) return;
      setWriters(nextWriters);
    } catch (cause: any) {
      if (loadFence.current.isCurrent(token, currentActorId.current)) {
        setLoadError(cause?.message ?? "Couldn't load approved writers.");
      }
    } finally {
      if (loadFence.current.isCurrent(token, currentActorId.current)) setLoading(false);
    }
  }, [actorId]);

  useFocusEffect(useCallback(() => {
    loadFence.current.focus(actorId);
    searchFence.current.focus(actorId);
    actionFence.current.focus(actorId);
    mutationInFlight.current = false;
    setSettings(null);
    setWriters([]);
    setQuery("");
    setResults([]);
    setSearchedQuery(null);
    setLoadError(null);
    setSearchError(null);
    setActionError(null);
    setBusyId(null);
    setSearching(false);
    if (actorId) void load();
    else setLoading(false);
    return () => {
      loadFence.current.blur();
      searchFence.current.blur();
      actionFence.current.blur();
      endExclusiveMutation(mutationInFlight);
      setBusyId(null);
      setSearching(false);
    };
  }, [actorId, load]));

  async function search() {
    const normalized = normalizePeopleSearchQuery(query);
    const token = searchFence.current.begin(actorId);
    if (!token || settings?.contributionPolicy !== "selected" || !normalized) {
      setResults([]);
      setSearchedQuery(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const next = await searchPeople(token.userId, normalized);
      if (!searchFence.current.isCurrent(token, currentActorId.current)) return;
      if (normalizePeopleSearchQuery(currentQuery.current) !== normalized) return;
      setResults(next.filter((person) => person.profile.id !== token.userId));
      setSearchedQuery(normalized);
    } catch (cause: any) {
      if (searchFence.current.isCurrent(token, currentActorId.current)) {
        setSearchError(cause?.message ?? "Search didn't work. Please try again.");
      }
    } finally {
      if (searchFence.current.isCurrent(token, currentActorId.current)) setSearching(false);
    }
  }

  async function refreshRosterWithActionFence(
    token: NonNullable<ReturnType<SessionFocusFence["begin"]>>,
  ) {
    if (!settings) return;
    const next = await listApprovedWriters(token.userId, settings.wallId);
    if (!actionFence.current.isCurrent(token, currentActorId.current)) return;
    setWriters(next);
  }

  async function add(personId: string) {
    if (!settings || busyId || !beginExclusiveMutation(mutationInFlight)) return;
    const token = actionFence.current.begin(actorId);
    if (!token) {
      endExclusiveMutation(mutationInFlight);
      return;
    }
    setBusyId(personId);
    setActionError(null);
    try {
      await addApprovedWriter(token.userId, settings.wallId, personId);
      if (!actionFence.current.isCurrent(token, currentActorId.current)) return;
      await refreshRosterWithActionFence(token);
    } catch (cause: any) {
      if (actionFence.current.isCurrent(token, currentActorId.current)) {
        setActionError(cause?.message ?? "Couldn't approve that writer. Please try again.");
      }
    } finally {
      if (actionFence.current.isCurrent(token, currentActorId.current)) {
        endExclusiveMutation(mutationInFlight);
        setBusyId(null);
      }
    }
  }

  function confirmRemove(writer: ApprovedWriterRow) {
    const name = writer.profile?.display_name ?? "this person";
    openCapturedTargetConfirmation({
      capture: () => actionFence.current.begin(actorId),
      isCurrent: (token) => actionFence.current.isCurrent(token, currentActorId.current),
      targetId: writer.userId,
      open: (onConfirm) => Alert.alert(
        `Remove ${name}?`,
        "They won't be able to leave new Marks unless you approve them again.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: onConfirm },
        ],
      ),
      run: (token, targetId) => void remove(targetId, token),
    });
  }

  async function remove(personId: string, token: SessionGenerationToken) {
    if (!actionFence.current.isCurrent(token, currentActorId.current)) return;
    if (!settings || busyId || !beginExclusiveMutation(mutationInFlight)) return;
    setBusyId(personId);
    setActionError(null);
    try {
      await removeApprovedWriter(token.userId, settings.wallId, personId);
      if (!actionFence.current.isCurrent(token, currentActorId.current)) return;
      await refreshRosterWithActionFence(token);
    } catch (cause: any) {
      if (actionFence.current.isCurrent(token, currentActorId.current)) {
        setActionError(cause?.message ?? "Couldn't remove that writer. Please try again.");
      }
    } finally {
      if (actionFence.current.isCurrent(token, currentActorId.current)) {
        endExclusiveMutation(mutationInFlight);
        setBusyId(null);
      }
    }
  }

  const approvedIds = new Set(writers.map((writer) => writer.userId));

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
      <Text variant="display" style={{ marginTop: spacing.unit * 2 }}>Approved writers</Text>
      <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: spacing.unit * 2 }}>
        Choose who may leave Marks when your Wall is set to Selected people.
      </Text>

      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading approved writers" color={markColors.brandYellow} style={{ marginTop: spacing.unit * 9 }} />
      ) : loadError || !settings ? (
        <View style={{ marginTop: spacing.unit * 6, gap: spacing.unit * 3 }}>
          <Text accessibilityRole="alert" variant="body" color={colors.error}>
            {loadError ?? "Approved writers aren't available."}
          </Text>
          <Button label="Try again" variant="yellow" onPress={() => void load()} />
        </View>
      ) : settings.contributionPolicy !== "selected" ? (
        <View style={{ marginTop: spacing.unit * 6, gap: spacing.unit * 3 }}>
          <Text variant="headline">Selected people is off</Text>
          <Text variant="body" color={colors.onSurfaceVariant}>
            Save Selected people in Personal Wall settings before managing this list.
          </Text>
          <Button label="Back to Wall settings" variant="yellow" onPress={() => router.back()} />
        </View>
      ) : (
        <>
          <View style={{ marginTop: spacing.unit * 6 }}>
            <Input
              label="FIND A PERSON"
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setResults([]);
                setSearchedQuery(null);
                setSearchError(null);
              }}
              onSubmitEditing={() => void search()}
              placeholder="name or handle"
              autoCapitalize="none"
              returnKeyType="search"
              editable={!searching && busyId === null}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search for an approved writer"
              accessibilityState={{ disabled: !query.trim() || searching || busyId !== null, busy: searching }}
              disabled={!query.trim() || searching || busyId !== null}
              onPress={() => void search()}
              style={{ minHeight: spacing.unit * 11, justifyContent: "center", alignItems: "center" }}
            >
              {searching ? <ActivityIndicator color={markColors.brandYellow} /> : <Text variant="label">SEARCH</Text>}
            </Pressable>
            {searchError ? <Text accessibilityRole="alert" variant="body" color={colors.error}>{searchError}</Text> : null}
            {searchedQuery && !searchError && results.length === 0 ? (
              <Text variant="body" color={colors.onSurfaceVariant}>No people found for “{searchedQuery}”.</Text>
            ) : null}
            {results.map((person) => (
              <PersonRow
                key={person.profile.id}
                profile={person.profile}
                detail={approvedIds.has(person.profile.id) ? "Approved writer" : "Registered user"}
                action={approvedIds.has(person.profile.id) ? "Approved" : "Add"}
                disabled={busyId !== null || approvedIds.has(person.profile.id)}
                onPress={() => router.push(`/person/${person.profile.id}`)}
                onAction={approvedIds.has(person.profile.id) ? undefined : () => void add(person.profile.id)}
              />
            ))}
          </View>

          {actionError ? (
            <Text accessibilityRole="alert" variant="body" color={colors.error} style={{ marginTop: spacing.unit * 4 }}>
              {actionError}
            </Text>
          ) : null}

          <View style={{ marginTop: spacing.unit * 7 }}>
            <Text variant="label" color={colors.outline}>APPROVED · {writers.length}</Text>
            {writers.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: spacing.unit * 10 }}>
                <Text variant="headline">No approved writers yet</Text>
                <Text variant="body" color={colors.onSurfaceVariant} style={{ marginTop: spacing.unit * 2, textAlign: "center" }}>
                  Search above to choose who can leave Marks.
                </Text>
              </View>
            ) : writers.map((writer) => (
              <PersonRow
                key={writer.userId}
                profile={writer.profile ?? unavailableIdentity(writer.userId)}
                detail={writer.profile ? "Approved writer" : "Approval can still be removed"}
                action="Remove"
                disabled={busyId !== null}
                onPress={writer.profile ? () => router.push(`/person/${writer.userId}`) : undefined}
                onAction={() => confirmRemove(writer)}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

function unavailableIdentity(id: string): PersonRowIdentity {
  return {
    id,
    display_name: "Unavailable person",
    handle: "unavailable",
    avatar_url: null,
  };
}
