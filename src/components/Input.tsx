import { useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { colors, fontFamily, radius } from "@/theme";
import { Text } from "./Text";

type Props = TextInputProps & {
  label?: string;
  /** Small helper / error line under the field. */
  hint?: string;
  error?: boolean;
  /** Fixed prefix shown inside the field (e.g. "@" for a handle). */
  prefix?: string;
};

/**
 * A paper-grain text field with a 1–2px ink border that thickens on focus
 * (handoff §Buttons & Inputs). Uses the expression font for typed content so
 * writing on the wall feels handwritten.
 */
export function Input({ label, hint, error, prefix, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="label" color={colors.outline}>
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.card,
          borderRadius: radius.card,
          borderWidth: focused ? 2 : 1,
          borderColor: error ? colors.error : focused ? colors.ink : colors.outlineVariant,
          paddingHorizontal: 14,
        }}
      >
        {prefix ? (
          <Text variant="mark" color={colors.outline} style={{ marginRight: 2 }}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          placeholderTextColor={colors.outline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            {
              flex: 1,
              paddingVertical: 13,
              fontFamily: fontFamily.display,
              fontSize: 18,
              color: colors.ink,
            },
            style,
          ]}
          {...rest}
        />
      </View>
      {hint ? (
        <Text variant="body" color={error ? colors.error : colors.outline} style={{ fontSize: 13 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
