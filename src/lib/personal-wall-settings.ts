import { requireExpectedActor } from "./expected-actor";
import { requireMutationRow } from "./result-contract";
import { supabase } from "./supabase";

export type PersonalWallSettings = Readonly<{
  wallId: string;
  visibility: "public" | "private";
  contributionPolicy: "friends" | "everyone" | "selected";
  allowAnonymous: boolean;
}>;

/** All three values are saved together so the screen cannot partially apply. */
export type PersonalWallSettingsPatch = Readonly<{
  visibility: PersonalWallSettings["visibility"];
  contributionPolicy: PersonalWallSettings["contributionPolicy"];
  allowAnonymous: boolean;
}>;

export type ApprovedWriterIdentity = Readonly<{
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
}>;

export type ApprovedWriter = Readonly<{
  userId: string;
  addedAt: string;
  /** Null preserves the approval row when bilateral profile RLS hides identity. */
  profile: ApprovedWriterIdentity | null;
}>;

type PersonalWallSettingsRow = {
  id: string;
  visibility: unknown;
  contribution_policy: unknown;
  allow_anonymous: unknown;
};

function settingsFromRow(row: PersonalWallSettingsRow): PersonalWallSettings {
  if (
    (row.visibility !== "public" && row.visibility !== "private")
    || !["friends", "everyone", "selected"].includes(String(row.contribution_policy))
    || typeof row.allow_anonymous !== "boolean"
  ) throw new Error("The Personal Wall settings weren't valid.");
  return {
    wallId: row.id,
    visibility: row.visibility,
    contributionPolicy: row.contribution_policy as PersonalWallSettings["contributionPolicy"],
    allowAnonymous: row.allow_anonymous,
  };
}

function validatePatch(patch: PersonalWallSettingsPatch): void {
  if (
    (patch.visibility !== "public" && patch.visibility !== "private")
    || !["friends", "everyone", "selected"].includes(patch.contributionPolicy)
    || typeof patch.allowAnonymous !== "boolean"
  ) throw new Error("Choose valid Personal Wall settings.");
}

async function requireActor(expectedActorId: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  return requireExpectedActor(
    expectedActorId,
    auth.user?.id,
    "You need to be signed in to manage your Personal Wall.",
  );
}

export async function getPersonalWallSettings(
  expectedActorId: string,
): Promise<PersonalWallSettings> {
  const actorId = await requireActor(expectedActorId);
  const { data, error } = await supabase
    .from("walls")
    .select("id, visibility, contribution_policy, allow_anonymous")
    .eq("owner_id", actorId)
    .eq("type", "personal")
    .maybeSingle();
  if (error) throw error;
  return settingsFromRow(requireMutationRow(data, "Your Personal Wall is no longer available."));
}

export async function updatePersonalWallSettings(
  expectedActorId: string,
  patch: PersonalWallSettingsPatch,
): Promise<PersonalWallSettings> {
  validatePatch(patch);
  const actorId = await requireActor(expectedActorId);
  const { data, error } = await supabase
    .from("walls")
    .update({
      visibility: patch.visibility,
      contribution_policy: patch.contributionPolicy,
      allow_anonymous: patch.allowAnonymous,
    })
    .eq("owner_id", actorId)
    .eq("type", "personal")
    .select("id, visibility, contribution_policy, allow_anonymous")
    .maybeSingle();
  if (error) throw error;
  return settingsFromRow(requireMutationRow(data, "Your Personal Wall settings weren't saved."));
}

async function requireOwnedPersonalWall(expectedActorId: string, wallId: string): Promise<string> {
  const actorId = await requireActor(expectedActorId);
  const { data, error } = await supabase
    .from("walls")
    .select("id")
    .eq("id", wallId)
    .eq("owner_id", actorId)
    .eq("type", "personal")
    .maybeSingle();
  if (error) throw error;
  const wall = requireMutationRow(data, "That Personal Wall is no longer available.");
  if ((wall as { id?: unknown }).id !== wallId) {
    throw new Error("The Personal Wall didn't match the requested Wall.");
  }
  return actorId;
}

export async function listApprovedWriters(
  expectedActorId: string,
  wallId: string,
): Promise<readonly ApprovedWriter[]> {
  await requireOwnedPersonalWall(expectedActorId, wallId);
  const { data: associations, error } = await supabase
    .from("approved_writers")
    .select("user_id, added_at")
    .eq("wall_id", wallId)
    .order("added_at", { ascending: false })
    .order("user_id", { ascending: false });
  if (error) throw error;

  const rows = (associations ?? []) as { user_id: string; added_at: string }[];
  const userIds = rows.map((row) => row.user_id);
  if (userIds.length === 0) return [];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, handle, avatar_url")
    .in("id", userIds);
  if (profilesError) throw profilesError;

  const identityById = new Map(
    ((profiles ?? []) as ApprovedWriterIdentity[]).map((profile) => [profile.id, profile]),
  );
  return rows.map((row) => ({
    userId: row.user_id,
    addedAt: row.added_at,
    profile: identityById.get(row.user_id) ?? null,
  }));
}

export async function addApprovedWriter(
  expectedActorId: string,
  wallId: string,
  targetUserId: string,
): Promise<"added" | "already_approved"> {
  await requireOwnedPersonalWall(expectedActorId, wallId);
  const { data, error } = await supabase
    .from("approved_writers")
    .insert({ wall_id: wallId, user_id: targetUserId })
    .select("wall_id, user_id, added_at")
    .maybeSingle();
  if (error?.code === "23505") return "already_approved";
  if (error) throw error;
  const added = requireMutationRow(data, "That person couldn't be approved. Please try again.");
  if (
    (added as { wall_id?: unknown }).wall_id !== wallId
    || (added as { user_id?: unknown }).user_id !== targetUserId
  ) throw new Error("The approved writer didn't match the requested account.");
  return "added";
}

export async function removeApprovedWriter(
  expectedActorId: string,
  wallId: string,
  targetUserId: string,
): Promise<"removed"> {
  await requireOwnedPersonalWall(expectedActorId, wallId);
  const { data, error } = await supabase
    .from("approved_writers")
    .delete()
    .eq("wall_id", wallId)
    .eq("user_id", targetUserId)
    .select("wall_id, user_id")
    .maybeSingle();
  if (error) throw error;
  const removed = requireMutationRow(data, "That approved writer is no longer available.");
  if (
    (removed as { wall_id?: unknown }).wall_id !== wallId
    || (removed as { user_id?: unknown }).user_id !== targetUserId
  ) throw new Error("The removed writer didn't match the requested account.");
  return "removed";
}
