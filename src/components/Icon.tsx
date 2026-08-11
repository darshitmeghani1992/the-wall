import { Feather } from "@expo/vector-icons";

/**
 * The app icon set. Real monoline vectors from Feather (`@expo/vector-icons`) —
 * clean 24px / 2px-stroke, matching the intended "Lucide / SF Symbols" language.
 *
 * The public API (`name`, `size`, `color`) and the `IconName` union are the
 * stable contract every call site depends on; only the internal Feather mapping
 * below changes if the icon set is ever swapped again. Names are semantic to the
 * product, not to Feather, so a future set can be dropped in the same way.
 */
export type IconName =
  // chrome / navigation
  | "home"
  | "grid"
  | "plus"
  | "search"
  | "person"
  | "bell"
  | "gear"
  | "chevron"
  | "game"
  | "pin"
  // content chrome (mark types, empty state, invite) — replaces emoji-as-chrome
  | "award"
  | "lock"
  | "unlock"
  | "hidden"
  | "invite"
  | "share"
  | "edit"
  | "close"
  | "check"
  | "star";

/** Semantic name → the actual Feather glyph name. */
const FEATHER: Record<IconName, React.ComponentProps<typeof Feather>["name"]> = {
  home: "home",
  grid: "grid",
  plus: "plus",
  search: "search",
  person: "user",
  bell: "bell",
  gear: "settings",
  chevron: "chevron-left",
  game: "play",
  pin: "map-pin",
  award: "award",
  lock: "lock",
  unlock: "unlock",
  hidden: "eye-off",
  invite: "user-plus",
  share: "share-2",
  edit: "edit-3",
  close: "x",
  check: "check",
  star: "star",
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
  return <Feather name={FEATHER[name]} size={size} color={color} />;
}
