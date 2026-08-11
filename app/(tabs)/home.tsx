import { useLocalSearchParams } from "expo-router";
import { PersonalWall } from "@/features/personal-wall/PersonalWall";

/**
 * The Home tab IS the user's real Personal Wall (Option C — wall-as-home).
 * There is no fabricated dashboard here: the old "N new Marks", fake Active
 * Game, and hardcoded Sofia sticky are gone (AC-1). All wall behaviour lives in
 * <PersonalWall/>; this tab is just its composition root.
 *
 * `justCreated` (set by the writer after a seed/new Mark) flags that Mark for
 * its DROP entrance on arrival.
 */
export default function HomeScreen() {
  const { justCreated } = useLocalSearchParams<{ justCreated?: string }>();
  return <PersonalWall justCreatedId={justCreated ? String(justCreated) : undefined} />;
}
