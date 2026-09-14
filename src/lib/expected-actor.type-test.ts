import { blockUser, unblockUser } from "./blocks";
import { followUser, unfollowUser } from "./follows";
import { createReport } from "./reports";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false;
type Assert<Value extends true> = Value;

export type FollowRequiresExpectedActor = Assert<Equal<Parameters<typeof followUser>["length"], 2>>;
export type UnfollowRequiresExpectedActor = Assert<Equal<Parameters<typeof unfollowUser>["length"], 2>>;
export type BlockRequiresExpectedActor = Assert<Equal<Parameters<typeof blockUser>["length"], 2>>;
export type UnblockRequiresExpectedActor = Assert<Equal<Parameters<typeof unblockUser>["length"], 2>>;
export type ReportRequiresExpectedActor = Assert<Equal<Parameters<typeof createReport>["length"], 2>>;
