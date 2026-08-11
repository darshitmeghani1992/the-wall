import { Redirect } from "expo-router";

/**
 * Legacy `/wall` route. The Personal Wall is now the Home tab (Option C —
 * wall-as-home), so this is a thin redirect kept only so anything still
 * referencing `/wall` keeps working. Two-way door: the wall body was extracted
 * verbatim into `src/features/personal-wall/PersonalWall.tsx`.
 *
 * Note: `?justCreated=` params are intentionally not forwarded — the writer now
 * routes straight to `/home?justCreated=` (the consolidated surface), so the
 * DROP plays there and no code needs this route for that flow.
 */
export default function WallRedirect() {
  return <Redirect href="/home" />;
}
