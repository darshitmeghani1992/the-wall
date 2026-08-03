import { View, ScrollView, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { colors, spacing } from "@/theme";

type Props = {
  children: React.ReactNode;
  /** Scrollable body (Home, Wall, Discover…) vs full-height (Writer, Create). */
  scroll?: boolean;
  /** Add the persistent bottom-dock inset (78px) so content clears the dock. */
  dockInset?: boolean;
  padded?: boolean;
  style?: ViewStyle;
};

/**
 * Screen scaffold shared by every route: paper background, safe-area top, and
 * an optional bottom inset for the persistent dock. Body scrolls unless the
 * screen is full-height (Create / Writer / Settings go edge-to-edge).
 */
export function Screen({
  children,
  scroll = true,
  dockInset = true,
  padded = true,
  style,
}: Props) {
  const insets = useSafeAreaInsets();
  const paddingTop = insets.top;
  const paddingBottom = (dockInset ? 78 : 0) + insets.bottom;
  const paddingHorizontal = padded ? spacing.sideMargin : 0;

  const inner: ViewStyle = { paddingTop, paddingHorizontal };

  return (
    <View style={[{ flex: 1, backgroundColor: colors.surface }, style]}>
      <StatusBar style="dark" />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[inner, { paddingBottom }]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, paddingBottom }, inner]}>{children}</View>
      )}
    </View>
  );
}
