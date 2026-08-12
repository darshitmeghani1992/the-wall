import { View } from "react-native";
import { spacing } from "@/theme";

type Props<T> = {
  data: T[];
  keyFor: (item: T) => string;
  /** Rough pixel height, used to balance the two columns. */
  estimate: (item: T) => number;
  /** `index` is the item's position in `data` (wall order) — used to stagger entrances. */
  renderItem: (item: T, index: number) => React.ReactNode;
  gap?: number;
};

/**
 * A 2-column masonry. React Native has no CSS `column-count`, so we greedily
 * place each item into whichever column is currently shorter (using an
 * estimated height per item). Order flows top-to-bottom, newest first.
 */
export function Masonry<T>({
  data,
  keyFor,
  estimate,
  renderItem,
  gap = spacing.masonryGap,
}: Props<T>) {
  const cols: { item: T; index: number }[][] = [[], []];
  const heights = [0, 0];

  data.forEach((item, index) => {
    const target = heights[0] <= heights[1] ? 0 : 1;
    cols[target].push({ item, index });
    heights[target] += estimate(item);
  });

  return (
    <View style={{ flexDirection: "row", gap }}>
      {cols.map((col, i) => (
        <View key={i} style={{ flex: 1, gap: 0 }}>
          {col.map(({ item, index }) => (
            <View key={keyFor(item)}>{renderItem(item, index)}</View>
          ))}
        </View>
      ))}
    </View>
  );
}
