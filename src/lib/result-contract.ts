/** Turn a silent zero-row Supabase mutation into an honest client failure. */
export function requireMutationRow<T>(data: T | null | undefined, message: string): T {
  if (data == null) throw new Error(message);
  return data;
}

/** Preserve a confirmed zero while rejecting a missing/indeterminate count. */
export function requireExactCount(count: number | null, message: string): number {
  if (typeof count !== "number") throw new Error(message);
  return count;
}
