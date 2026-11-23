import type { ReactNode } from "react";
import { View } from "react-native";
import { Masonry } from "@/components/Masonry";
import { groupMixedWallItems, type HydratedMixedWallItem } from "@/lib/poll-mixed-wall-presenter";
import type { MarkWithAuthor } from "@/lib/marks";
import { spacing } from "@/theme";

type Props = {
  entries: readonly HydratedMixedWallItem[];
  estimateMark: (mark: MarkWithAuthor) => number;
  renderMark: (mark: MarkWithAuthor, index: number) => ReactNode;
  renderPoll: (entry: Extract<HydratedMixedWallItem, { kind: "poll" }>, index: number) => ReactNode;
};

/** Preserve chronology while allowing Poll options to use the full device width. */
export function MixedWallSegments({ entries, estimateMark, renderMark, renderPoll }: Props) {
  return (
    <View style={{ gap: spacing.masonryGap }}>
      {groupMixedWallItems(entries).map((segment) => segment.kind === "poll"
        ? <View key={segment.key}>{renderPoll(segment.item, segment.index)}</View>
        : <Masonry key={segment.key} data={segment.entries}
          keyFor={(entry) => entry.item.id}
          estimate={(entry) => estimateMark(entry.item.mark)}
          renderItem={(entry) => renderMark(entry.item.mark, entry.index)} />)}
    </View>
  );
}
