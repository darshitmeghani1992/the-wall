export type SynchronousMutationRef = { current: boolean };

/** Claims an interaction synchronously, before React can schedule a re-render. */
export function beginExclusiveMutation(ref: SynchronousMutationRef): boolean {
  if (ref.current) return false;
  ref.current = true;
  return true;
}

export function endExclusiveMutation(ref: SynchronousMutationRef): void {
  ref.current = false;
}
