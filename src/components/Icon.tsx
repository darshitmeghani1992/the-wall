import { Text } from "react-native";

/**
 * Placeholder monoline icon set. The handoff ships icons as inline SVG and
 * explicitly says to swap them for an icon library (Lucide / SF Symbols) at
 * 24px / 2px stroke. This unicode-glyph stand-in keeps screens buildable now;
 * replace the mapping with real vector icons in the polish phase.
 */
export type IconName =
  | "home"
  | "grid"
  | "plus"
  | "search"
  | "person"
  | "bell"
  | "gear"
  | "chevron"
  | "game"
  | "pin";

const GLYPH: Record<IconName, string> = {
  home: "⌂",
  grid: "▦",
  plus: "＋",
  search: "⌕",
  person: "☺",
  bell: "◔",
  gear: "⚙",
  chevron: "‹",
  game: "◈",
  pin: "◉",
};

export function Icon({
  name,
  size = 24,
  color = "#0b0c0c",
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Text style={{ fontSize: size, lineHeight: size + 2, color }}>
      {GLYPH[name]}
    </Text>
  );
}
