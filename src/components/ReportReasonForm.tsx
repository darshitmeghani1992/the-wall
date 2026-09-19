import { Pressable, View } from "react-native";
import { Input } from "@/components/Input";
import { Text } from "@/components/Text";
import {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
} from "@/lib/reports";
import { colors, radius } from "@/theme";

export function ReportReasonForm({
  reason,
  details,
  disabled,
  onReasonChange,
  onDetailsChange,
}: {
  reason: ReportReason | null;
  details: string;
  disabled: boolean;
  onReasonChange: (reason: ReportReason) => void;
  onDetailsChange: (details: string) => void;
}) {
  return (
    <>
      <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
        {REPORT_REASONS.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="radio"
            accessibilityState={{ selected: reason === item, disabled }}
            disabled={disabled}
            onPress={() => onReasonChange(item)}
            style={{
              borderWidth: reason === item ? 2 : 1,
              borderColor: colors.ink,
              borderRadius: radius.card,
              padding: 14,
              opacity: disabled ? 0.55 : 1,
            }}
          >
            <Text variant="headline">{REPORT_REASON_LABELS[item]}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: 18 }}>
        <Input
          label="DETAILS · OPTIONAL"
          value={details}
          editable={!disabled}
          onChangeText={onDetailsChange}
          multiline
          maxLength={500}
          placeholder="Tell us what happened"
        />
      </View>
    </>
  );
}

