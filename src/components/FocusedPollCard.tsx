import { useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Text } from "@/components/Text";
import { createRequestId } from "@/lib/mark-writer-contract";
import type { FocusedPoll } from "@/lib/poll-focused-reader";
import {
  confirmedPollVoteMessage, isPollInteractionEnabled, isValidSelection, parsePollMutationResult, preparePollMutation,
  samePollSelection, togglePollOption, type PollAddress, type PollMutation,
} from "@/lib/poll-voting-contract";
import { colors, radius } from "@/theme";

type Props = {
  poll: FocusedPoll;
  target: PollAddress;
  isCurrent: () => boolean;
  mutate: (request: PollMutation) => Promise<unknown>;
  refresh: () => Promise<FocusedPoll | null>;
};

export function FocusedPollCard({ poll, target, isCurrent, mutate, refresh }: Props) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<FocusedPoll | null>(poll);
  const [selection, setSelection] = useState<readonly string[]>(poll.ballot?.optionIds ?? []);
  const [busy, setBusy] = useState<"vote" | "close" | "refresh" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const pending = useRef(false);
  const confirming = useRef(false);
  const priorIntent = useRef<{ vote: PollMutation | null; close: PollMutation | null }>({ vote: null, close: null });

  const canVote = Boolean(isPollInteractionEnabled && snapshot?.capabilities.canVote);
  const canClose = Boolean(isPollInteractionEnabled && snapshot?.capabilities.canClose);

  async function reload(preserveSelection: boolean, successMessage: string | null, submittedVote?: readonly string[]) {
    try {
      const latest = await refresh();
      if (!isCurrent()) return;
      setSnapshot(latest);
      setNeedsRefresh(false);
      if (latest) {
        const currentBallot = latest.ballot?.optionIds ?? [];
        setSelection((draft) => preserveSelection && isValidSelection(latest, draft) ? draft : currentBallot);
      }
      setNotice(latest && submittedVote ? confirmedPollVoteMessage(submittedVote, latest) : successMessage);
    } catch {
      if (!isCurrent()) return;
      setNeedsRefresh(true);
      setNotice(submittedVote ? "Refresh the Poll to check your current vote."
        : successMessage ? `${successMessage} Refresh to update the Poll.` : "Couldn’t refresh the Poll. Try again.");
    }
  }

  async function submit(kind: PollMutation["kind"]) {
    if (!isPollInteractionEnabled || !isCurrent() || pending.current || needsRefresh || !snapshot) return;
    const request = preparePollMutation(kind, target, snapshot, selection, priorIntent.current[kind], createRequestId);
    if (!request) return;
    pending.current = true;
    priorIntent.current[kind] = request;
    setBusy(kind);
    setNotice(null);
    try {
      const result = parsePollMutationResult(await mutate(request), request, snapshot);
      if (!isCurrent()) return;
      if (!result) throw new Error("Invalid Poll receipt");
      if (result === "confirmed") {
        priorIntent.current[kind] = null;
        if (request.kind === "vote") {
          await reload(false, null, request.args.p_option_ids);
        } else {
          await reload(false, "Poll closed.");
        }
      } else if (result === "unavailable") {
        priorIntent.current[kind] = null;
        setSnapshot(null);
        setSelection([]);
      } else if (result === "conflict" || result === "closed") {
        priorIntent.current[kind] = null;
        await reload(true, null);
        if (isCurrent()) {
          // Keep a refresh failure actionable instead of overwriting its notice.
          setNotice((current) => current ?? (result === "closed" ? "This Poll has closed." : "The Poll changed. Review it and try again."));
        }
      } else {
        setNotice(result === "request_id_reused"
          ? "This request no longer matches your selection. Refresh the Poll before trying again."
          : "Couldn’t submit that change. Check the Poll and try again.");
        if (result === "request_id_reused") {
          priorIntent.current[kind] = null;
          setNeedsRefresh(true);
        }
      }
    } catch {
      if (isCurrent()) setNotice(kind === "vote"
        ? "Couldn’t confirm your vote. Try saving the same selection again."
        : "Couldn’t confirm that the Poll closed. Try again.");
    } finally {
      pending.current = false;
      if (isCurrent()) setBusy(null);
    }
  }

  function confirmClose() {
    if (!canClose || !isCurrent() || pending.current || confirming.current || needsRefresh) return;
    confirming.current = true;
    Alert.alert("Close this Poll?", "People won’t be able to vote or change their vote after it closes.", [
      { text: "Keep open", style: "cancel", onPress: () => { confirming.current = false; } },
      { text: "Close Poll", style: "destructive", onPress: () => {
        confirming.current = false;
        if (isCurrent()) void submit("close");
      } },
    ], { cancelable: false });
  }

  async function retryRead() {
    if (!isPollInteractionEnabled || !isCurrent() || pending.current) return;
    pending.current = true;
    setBusy("refresh");
    setNotice(null);
    try {
      await reload(true, null);
    } finally {
      pending.current = false;
      if (isCurrent()) setBusy(null);
    }
  }

  if (!snapshot) return <Text accessibilityRole="alert" color={colors.outline}>This Poll is no longer available.</Text>;

  const disabled = busy !== null || needsRefresh;
  const ownSelection = snapshot.ballot?.optionIds ?? [];
  const options = snapshot.options.map((option) => {
    const checked = (canVote ? selection : ownSelection).includes(option.id);
    const row = (
      <>
        <Text style={{ flex: 1 }}>{option.label}{checked && !canVote ? " · Your choice" : ""}</Text>
        {option.count === null ? null : <Text color={colors.outline}>{option.count} {option.count === 1 ? "selection" : "selections"}</Text>}
      </>
    );
    if (!canVote) {
      return <View key={option.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 36 }}>{row}</View>;
    }
    return (
      <Pressable key={option.id} accessibilityRole={snapshot.selectionMode === "single" ? "radio" : "checkbox"}
        accessibilityState={{ checked, disabled }} accessibilityLabel={option.label} disabled={disabled}
        onPress={() => setSelection((current) => togglePollOption(snapshot, current, option.id))}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, padding: 8,
          borderColor: checked ? colors.ink : colors.outlineVariant, borderWidth: checked ? 2 : 1, borderRadius: radius.card }}>
        {row}
        {checked ? <Text accessibilityElementsHidden importantForAccessibility="no">✓</Text> : null}
      </Pressable>
    );
  });

  return (
    <View style={{ gap: 10, padding: 16, borderWidth: 1.5, borderColor: colors.ink, borderRadius: radius.card, backgroundColor: colors.card }}>
      <Text variant="label" color={colors.outline}>
        {snapshot.state === "closed" ? "Closed Poll" : "Poll"} · {snapshot.selectionMode === "single" ? "One choice" : "Multiple choices"}
      </Text>
      <Text variant="headline" accessibilityRole="header">{snapshot.question}</Text>
      <View accessibilityRole={canVote && snapshot.selectionMode === "single" ? "radiogroup" : "list"}
        accessibilityLabel="Poll options" style={{ gap: 8 }}>{options}</View>
      {snapshot.ballotTotal === null
        ? <Text color={colors.outline}>Results are unavailable.</Text>
        : <Text color={colors.outline}>{snapshot.ballotTotal} {snapshot.ballotTotal === 1 ? "ballot" : "ballots"}</Text>}
      {notice ? <Text accessibilityRole="alert" color={colors.outline}>{notice}</Text> : null}
      {canVote ? <Button label={snapshot.ballot ? "Update vote" : "Save vote"} loading={busy === "vote"}
        disabled={disabled || !isValidSelection(snapshot, selection) || samePollSelection(ownSelection, selection)}
        onPress={() => void submit("vote")} /> : null}
      {canClose ? <Button label="Close Poll" variant="ghost" loading={busy === "close"} disabled={disabled} onPress={confirmClose} /> : null}
      {needsRefresh ? <Button label="Refresh Poll" variant="ghost" loading={busy === "refresh"} disabled={busy !== null}
        onPress={() => void retryRead()} /> : null}
      <Button label="Report Poll" variant="ghost" disabled={busy !== null}
        onPress={() => {
          if (isCurrent() && !pending.current) {
            router.push({ pathname: "/report-poll/[id]", params: { id: target.markId, wallId: target.wallId } });
          }
        }} />
    </View>
  );
}
