/** A PostgREST mutation can succeed at HTTP level yet update zero rows under RLS. */
export function requireExactlyOneMarkMutation(count: number | null): void {
  if (count !== 1) throw new Error("MARK_ACTION_NOT_ALLOWED");
}
