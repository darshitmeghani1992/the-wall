import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { colors, type, type TypeVariant } from "@/theme";

type Props = RNTextProps & {
  /** Type-scale variant from the design system. Defaults to "body". */
  variant?: TypeVariant;
  color?: string;
};

/**
 * The single text primitive for the app. Applies the design-system type scale
 * (Bricolage / Geist / Space Mono) so screens never hand-roll font families.
 */
export function Text({
  variant = "body",
  color = colors.ink,
  style,
  ...rest
}: Props) {
  return <RNText {...rest} style={[type[variant], { color }, style]} />;
}
