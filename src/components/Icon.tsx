import Svg, { Circle, Line, Path, Polyline, Rect } from "react-native-svg";

/** Product-owned 24px monoline icon set. Decorative only; parent controls carry labels. */
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

export function Icon({
  name,
  size = 24,
  color = "#0b0c0c",
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const common = { stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
      {name === "home" ? <><Path {...common} d="M3 11.5 12 4l9 7.5" /><Path {...common} d="M5.5 10.5V21h13V10.5" /><Path {...common} d="M9.5 21v-6h5v6" /></> : null}
      {name === "grid" ? <><Rect {...common} x="3" y="3" width="7" height="7" rx="1" /><Rect {...common} x="14" y="3" width="7" height="7" rx="1" /><Rect {...common} x="3" y="14" width="7" height="7" rx="1" /><Rect {...common} x="14" y="14" width="7" height="7" rx="1" /></> : null}
      {name === "plus" ? <><Line {...common} x1="12" y1="5" x2="12" y2="19" /><Line {...common} x1="5" y1="12" x2="19" y2="12" /></> : null}
      {name === "search" ? <><Circle {...common} cx="10.5" cy="10.5" r="6.5" /><Line {...common} x1="15.5" y1="15.5" x2="21" y2="21" /></> : null}
      {name === "person" ? <><Circle {...common} cx="12" cy="8" r="4" /><Path {...common} d="M4.5 21c.8-4.1 3.3-6 7.5-6s6.7 1.9 7.5 6" /></> : null}
      {name === "bell" ? <><Path {...common} d="M6 9a6 6 0 0 1 12 0c0 6 2.5 6.5 2.5 6.5h-17S6 15 6 9Z" /><Path {...common} d="M10 19a2.2 2.2 0 0 0 4 0" /></> : null}
      {name === "gear" ? <><Circle {...common} cx="12" cy="12" r="3" /><Path {...common} d="M19 13.5v-3l-2-.7-.6-1.4.9-1.9-2.1-2.1-1.9.9-1.4-.6-.7-2h-3l-.7 2-1.4.6-1.9-.9-2.1 2.1.9 1.9-.6 1.4-2 .7v3l2 .7.6 1.4-.9 1.9 2.1 2.1 1.9-.9 1.4.6.7 2h3l.7-2 1.4-.6 1.9.9 2.1-2.1-.9-1.9.6-1.4 2-.7Z" /></> : null}
      {name === "chevron" ? <Polyline {...common} points="15 18 9 12 15 6" /> : null}
      {name === "game" ? <><Path {...common} d="M7.5 8h9a5 5 0 0 1 4.6 6.9l-1.2 3A2 2 0 0 1 16.4 18l-1.6-2H9.2l-1.6 2a2 2 0 0 1-3.5-.1l-1.2-3A5 5 0 0 1 7.5 8Z" /><Line {...common} x1="8" y1="11" x2="8" y2="15" /><Line {...common} x1="6" y1="13" x2="10" y2="13" /><Circle fill={color} cx="16" cy="12" r="1" /><Circle fill={color} cx="18.5" cy="14.5" r="1" /></> : null}
      {name === "pin" ? <><Circle {...common} cx="12" cy="8" r="4" /><Path {...common} d="M12 12v9" /><Path {...common} d="m9.5 18 2.5 3 2.5-3" /></> : null}
    </Svg>
  );
}
