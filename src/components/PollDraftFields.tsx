import { Pressable, View } from "react-native";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Text } from "@/components/Text";
import {
  appendPollOption,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_LIMIT,
  POLL_QUESTION_LIMIT,
  removePollOption,
  validatePollDraft,
  type PollDraft,
  type PollSelectionMode,
} from "@/lib/poll-composer-contract";
import { colors, radius } from "@/theme";

type Props = {
  draft: PollDraft;
  disabled: boolean;
  updateDraft: (update: (draft: PollDraft) => PollDraft) => void;
};

const modes: readonly { value: PollSelectionMode; label: string }[] = [
  { value: "single", label: "One choice" },
  { value: "multiple", label: "Multiple choices" },
];

export function PollDraftFields({ draft, disabled, updateDraft }: Props) {
  const validation = validatePollDraft(draft).status;
  const error = validation === "duplicate_options" ? "Use a different label for each option."
    : validation === "question_too_long" ? `Keep the question to ${POLL_QUESTION_LIMIT} characters.`
    : validation === "option_too_long" ? `Keep each option to ${POLL_OPTION_LIMIT} characters.`
    : null;

  return (
    <View style={{ gap: 14 }}>
      <Text color={colors.outline}>Enter a question and two to six options.</Text>
      <Input label="Poll question" value={draft.question} multiline editable={!disabled}
        maxLength={POLL_QUESTION_LIMIT * 2}
        onChangeText={(question) => updateDraft((current) => ({ ...current, question }))} />
      <View accessibilityRole="radiogroup" accessibilityLabel="Number of choices per vote" style={{ flexDirection: "row", gap: 10 }}>
        {modes.map(({ value, label }) => {
          const checked = value === draft.selectionMode;
          return (
            <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked, disabled }}
              accessibilityLabel={label} disabled={disabled}
              onPress={() => updateDraft((current) => ({ ...current, selectionMode: value }))}
              style={{ flex: 1, minHeight: 44, padding: 10, justifyContent: "center", borderWidth: checked ? 2 : 1,
                borderRadius: radius.card, borderColor: colors.ink, backgroundColor: checked ? colors.ink : colors.card }}>
              <Text variant="headline" color={checked ? colors.white : colors.ink}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {draft.options.map(({ id, label }, index) => (
        <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Input label={`Option ${index + 1}`} value={label} editable={!disabled}
              maxLength={POLL_OPTION_LIMIT * 2}
              onChangeText={(text) => updateDraft((current) => ({
                ...current,
                options: current.options.map((option) => option.id === id ? { ...option, label: text } : option),
              }))} />
          </View>
          {draft.options.length > POLL_MIN_OPTIONS ? (
            <Button label={`Remove option ${index + 1}`} variant="ghost" disabled={disabled}
              onPress={() => updateDraft((current) => removePollOption(current, id))} />
          ) : null}
        </View>
      ))}
      {draft.options.length < POLL_MAX_OPTIONS ? (
        <Button label="Add option" variant="ghost" disabled={disabled}
          onPress={() => updateDraft(appendPollOption)} />
      ) : null}
      {error ? <Text accessibilityRole="alert" color={colors.error}>{error}</Text> : null}
    </View>
  );
}
