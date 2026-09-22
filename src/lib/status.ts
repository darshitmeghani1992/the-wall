import { normalizeStatusDraft } from "./status-contract";
import { supabase } from "./supabase";

export type WallStatusRecord = {
  wall_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

const STATUS_COLUMNS = "wall_id, body, created_at, updated_at";

function parseStatus(value: unknown, wallId: string): WallStatusRecord | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The Status response wasn't valid.");
  }
  const row = value as Record<string, unknown>;
  if (
    row.wall_id !== wallId
    || typeof row.body !== "string"
    || typeof row.created_at !== "string"
    || typeof row.updated_at !== "string"
  ) {
    throw new Error("The Status response wasn't valid.");
  }
  return row as WallStatusRecord;
}

/** Null deliberately means absent or not RLS-readable. */
export async function getWallStatus(wallId: string): Promise<WallStatusRecord | null> {
  const { data, error } = await supabase
    .from("wall_statuses")
    .select(STATUS_COLUMNS)
    .eq("wall_id", wallId)
    .maybeSingle();
  if (error) throw error;
  return parseStatus(data, wallId);
}

/** Owner-only create/replace. A returned row is required before reporting success. */
export async function saveWallStatus(wallId: string, input: string): Promise<WallStatusRecord> {
  const draft = normalizeStatusDraft(input);
  if (!draft.valid) throw new Error(draft.error ?? "That Status isn't valid.");

  const { data, error } = await supabase
    .from("wall_statuses")
    .upsert({ wall_id: wallId, body: draft.body }, { onConflict: "wall_id" })
    .select(STATUS_COLUMNS)
    .single();
  if (error) throw error;
  const confirmed = parseStatus(data, wallId);
  if (!confirmed || confirmed.body !== draft.body) {
    throw new Error("Your Status wasn't saved. Try again.");
  }
  return confirmed;
}

/** Owner-only removal. Zero affected rows is not allowed to look successful. */
export async function removeWallStatus(wallId: string): Promise<void> {
  const { data, error } = await supabase
    .from("wall_statuses")
    .delete()
    .eq("wall_id", wallId)
    .select("wall_id")
    .maybeSingle();
  if (error) throw error;
  if (!data || data.wall_id !== wallId) {
    throw new Error("That Status is no longer available. Refresh and try again.");
  }
}
