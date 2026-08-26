import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Text } from "@/components/Text";
import { MarkView } from "@/components/marks/MarkView";
import {
  deleteMark,
  editMarkText,
  isWithinEditWindow,
  remainingNormalRemovals,
  removeMark,
  type MarkWithAuthor,
} from "@/lib/marks";
import {
  createReport,
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  type ReportReason,
} from "@/lib/reports";
import type { ReactionEmoji, ReactionSummary } from "@/lib/reactions";
import { colors, markColors, radius, shadow, spacing } from "@/theme";

type Panel = "detail" | "edit" | "delete" | "remove" | "report";

type Props = {
  mark: MarkWithAuthor | null;
  viewerId?: string;
  wallOwnerId?: string;
  wallHandle?: string | null;
  reactions?: ReactionSummary;
  shareable?: boolean;
  onToggleReaction?: (emoji: ReactionEmoji) => void;
  onClose: () => void;
  onMarkUpdated: (markId: string, text: string) => void;
  onMarkRemoved: (markId: string) => void;
};

function errorMessage(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause ?? "");
  if (message.includes("MARK_EDIT_WINDOW")) return "The 10-minute edit window has closed.";
  if (message.includes("MARK_REMOVAL_QUOTA")) return "You have used your three standard removals for this 30-day period.";
  if (message.includes("MARK_ACTION_NOT_ALLOWED")) return "This action is no longer available. Refresh the Wall and try again.";
  return "That didn't work. Check your connection and try again.";
}

/** Full Mark context and its permission-aware actions (Master Spec §30–§33). */
export function MarkDetailModal({
  mark,
  viewerId,
  wallOwnerId,
  wallHandle,
  reactions,
  shareable = false,
  onToggleReaction,
  onClose,
  onMarkUpdated,
  onMarkRemoved,
}: Props) {
  const [panel, setPanel] = useState<Panel>("detail");
  const [editText, setEditText] = useState("");
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [allowanceLoading, setAllowanceLoading] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSender = Boolean(mark && viewerId && mark.author_id === viewerId);
  const isOwner = Boolean(mark && viewerId && wallOwnerId === viewerId);
  const canEdit = Boolean(mark && isSender && isWithinEditWindow(mark));
  const hasActions = canEdit || (isOwner && !isSender) || !isSender;

  useEffect(() => {
    setPanel("detail");
    setEditText(mark?.text ?? "");
    setReason(null);
    setDetails("");
    setRemaining(null);
    setAllowanceLoading(false);
    setReportSubmitted(false);
    setError(null);
  }, [mark?.id, mark?.text]);

  const heading = useMemo(() => {
    if (panel === "edit") return "Edit your Mark";
    if (panel === "delete") return "Delete this Mark?";
    if (panel === "remove") return "Remove from your Wall?";
    if (panel === "report") return isOwner ? "Report and remove" : "Report this Mark";
    return "Mark details";
  }, [isOwner, panel]);

  if (!mark || mark.secret) return null;

  function go(next: Panel) {
    setError(null);
    setPanel(next);
    if (next === "remove" && remaining === null && viewerId) {
      void loadAllowance();
    }
  }

  async function loadAllowance() {
    if (!viewerId) return;
    setAllowanceLoading(true);
    setError(null);
    try {
      setRemaining(await remainingNormalRemovals(viewerId));
    } catch {
      setRemaining(null);
      setError("We couldn't check your removal allowance. Try again before removing this Mark.");
    } finally {
      setAllowanceLoading(false);
    }
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    const next = editText.trim();
    if (!next) {
      setError("A Mark can't be empty.");
      return;
    }
    await run(async () => {
      await editMarkText(mark.id, next);
      onMarkUpdated(mark.id, next);
      setPanel("detail");
    });
  }

  async function confirmDelete() {
    await run(async () => {
      await deleteMark(mark.id);
      onMarkRemoved(mark.id);
      onClose();
    });
  }

  async function confirmRemoval() {
    await run(async () => {
      await removeMark(mark.id, "normal");
      onMarkRemoved(mark.id);
      onClose();
    });
  }

  async function submitReport() {
    if (!reason) {
      setError("Choose a reason before submitting.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!reportSubmitted) {
        await createReport({ markId: mark.id, reason, details });
        setReportSubmitted(true);
      }
      if (!isOwner) {
        onClose();
        return;
      }
      try {
        await removeMark(mark.id, "safety");
        onMarkRemoved(mark.id);
        onClose();
      } catch {
        setError("Your report was submitted, but the Mark couldn't be removed. Try removing it again from your Wall.");
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View
            style={{
              minHeight: 60,
              paddingHorizontal: spacing.sideMargin,
              borderBottomWidth: 1,
              borderBottomColor: colors.outlineVariant,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Pressable
              onPress={panel === "detail" ? onClose : () => go("detail")}
              disabled={busy}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={panel === "detail" ? "Close Mark details" : "Back to Mark details"}
              style={{ minWidth: 60, minHeight: 44, justifyContent: "center" }}
            >
              <Text variant="label" color={colors.outline}>{panel === "detail" ? "CLOSE" : "‹ BACK"}</Text>
            </Pressable>
            <Text variant="headline" style={{ fontSize: 18 }}>{heading}</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: spacing.sideMargin, paddingBottom: 48 }}
          >
            {panel === "detail" ? (
              <>
                <View style={{ width: "100%", maxWidth: 430, alignSelf: "center", paddingTop: 10 }}>
                  <MarkView
                    mark={mark}
                    shareable={shareable}
                    wallHandle={wallHandle}
                    reactions={reactions}
                    onToggleReaction={onToggleReaction}
                  />
                </View>
                {hasActions ? (
                  <View
                    style={[
                      {
                        marginTop: 24,
                        padding: 16,
                        backgroundColor: colors.card,
                        borderWidth: 2,
                        borderColor: colors.ink,
                        borderRadius: radius.card,
                        gap: 4,
                      },
                      shadow.mark,
                    ]}
                  >
                    <Text variant="label" color={colors.outline} style={{ marginBottom: 6 }}>MARK ACTIONS</Text>
                    {canEdit ? <ActionRow label="Edit Mark" note="Available for 10 minutes" onPress={() => go("edit")} /> : null}
                    {canEdit ? <ActionRow label="Delete Mark" note="Permanently removes your Mark" danger onPress={() => go("delete")} /> : null}
                    {isOwner && !isSender ? <ActionRow label="Remove from Wall" note="Uses one standard removal" onPress={() => go("remove")} /> : null}
                    {!isSender ? <ActionRow label="Report Mark" note="Send it to the safety team" danger onPress={() => go("report")} /> : null}
                  </View>
                ) : null}
              </>
            ) : null}

            {panel === "edit" ? (
              <>
                <Text variant="body" color={colors.onSurfaceVariant}>You can edit the words, while the original media stays attached.</Text>
                <TextInput
                  value={editText}
                  onChangeText={setEditText}
                  multiline
                  maxLength={500}
                  autoFocus
                  accessibilityLabel="Mark text"
                  style={{
                    minHeight: 180,
                    marginTop: 18,
                    padding: 16,
                    textAlignVertical: "top",
                    backgroundColor: mark.color ?? markColors.stickyYellow,
                    color: colors.ink,
                    borderWidth: 2,
                    borderColor: colors.ink,
                    borderRadius: radius.card,
                    fontSize: 20,
                  }}
                />
                <Text variant="label" color={colors.outline} style={{ textAlign: "right", marginTop: 6 }}>{editText.length}/500</Text>
                <View style={{ marginTop: 20 }}><Button label="Save changes" variant="yellow" loading={busy} onPress={saveEdit} /></View>
              </>
            ) : null}

            {panel === "delete" ? (
              <ConfirmPanel
                body="This permanently deletes your Mark. This can't be undone."
                busy={busy}
                action="Delete Mark"
                onConfirm={confirmDelete}
              />
            ) : null}

            {panel === "remove" ? (
              <>
                <ConfirmPanel
                  body={allowanceLoading ? "Checking your rolling 30-day allowance…" : remaining === null ? "Check your allowance before removing this Mark." : `You have ${remaining} of 3 standard removals left. This Mark will disappear from your Wall.`}
                  busy={busy || allowanceLoading}
                  disabled={remaining === 0 || remaining === null}
                  action="Remove Mark"
                  onConfirm={confirmRemoval}
                />
                {!allowanceLoading && remaining === null ? (
                  <View style={{ marginTop: 14 }}><Button label="Check allowance again" variant="ghost" onPress={loadAllowance} /></View>
                ) : null}
                {remaining === 0 ? (
                  <View style={{ marginTop: 18 }}>
                    <Text variant="body" color={colors.onSurfaceVariant}>If this Mark is abusive or unsafe, report it instead. Safety removals are never limited.</Text>
                    <View style={{ marginTop: 14 }}><Button label="Report this Mark" variant="ghost" onPress={() => go("report")} /></View>
                  </View>
                ) : null}
              </>
            ) : null}

            {panel === "report" ? (
              <>
                <Text variant="body" color={colors.onSurfaceVariant}>Choose the reason that best describes the problem.</Text>
                <View style={{ gap: 8, marginTop: 18 }}>
                  {REPORT_REASONS.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => setReason(item)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: reason === item }}
                      style={{
                        minHeight: 50,
                        paddingHorizontal: 14,
                        borderWidth: 2,
                        borderColor: reason === item ? colors.ink : colors.outlineVariant,
                        borderRadius: radius.card,
                        backgroundColor: reason === item ? markColors.neonGreen : colors.card,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text variant="body">{REPORT_REASON_LABELS[item]}</Text>
                      <Text variant="label">{reason === item ? "SELECTED" : ""}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={details}
                  onChangeText={setDetails}
                  multiline
                  maxLength={500}
                  placeholder="Add details (optional)"
                  placeholderTextColor={colors.outline}
                  accessibilityLabel="Optional report details"
                  style={{
                    minHeight: 120,
                    marginTop: 16,
                    padding: 14,
                    textAlignVertical: "top",
                    backgroundColor: colors.card,
                    color: colors.ink,
                    borderWidth: 2,
                    borderColor: colors.outlineVariant,
                    borderRadius: radius.card,
                    fontSize: 16,
                  }}
                />
                <View style={{ marginTop: 20 }}>
                  <Button
                    label={isOwner && reportSubmitted ? "Retry removing Mark" : isOwner ? "Submit report & remove" : "Submit report"}
                    variant="primary"
                    loading={busy}
                    onPress={submitReport}
                  />
                </View>
              </>
            ) : null}

            {error ? <Text variant="body" color={colors.error} accessibilityRole="alert" style={{ marginTop: 16 }}>{error}</Text> : null}
            {busy ? <ActivityIndicator color={markColors.brandYellow} style={{ marginTop: 14 }} /> : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function ActionRow({ label, note, danger = false, onPress }: { label: string; note: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ minHeight: 64, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, justifyContent: "center" }}
    >
      <Text variant="headline" color={danger ? colors.error : colors.ink} style={{ fontSize: 17 }}>{label}</Text>
      <Text variant="body" color={colors.outline} style={{ fontSize: 13, marginTop: 2 }}>{note}</Text>
    </Pressable>
  );
}

function ConfirmPanel({ body, busy, disabled = false, action, onConfirm }: { body: string; busy: boolean; disabled?: boolean; action: string; onConfirm: () => void }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text variant="body" color={colors.onSurfaceVariant}>{body}</Text>
      <View style={{ marginTop: 22 }}>
        <Button label={action} variant="primary" loading={busy} disabled={disabled} onPress={onConfirm} />
      </View>
    </View>
  );
}
