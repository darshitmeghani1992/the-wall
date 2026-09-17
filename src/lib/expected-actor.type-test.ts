import { blockUser, unblockUser } from "./blocks";
import { deactivateAccount, reactivateAccount } from "./account";
import { followUser, unfollowUser } from "./follows";
import { removeMark } from "./marks";
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
export type DeactivationRequiresExpectedActor = Assert<Equal<Parameters<typeof deactivateAccount>["length"], 1>>;
export type ReactivationRequiresExpectedActor = Assert<Equal<Parameters<typeof reactivateAccount>["length"], 1>>;
export type MarkRemovalRequiresExpectedActor = Assert<Equal<Parameters<typeof removeMark>["length"], 3>>;
