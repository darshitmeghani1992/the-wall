export type OptionalResult<T> =
  | Readonly<{ available: true; value: T }>
  | Readonly<{ available: false }>;

/**
 * Settles noncritical enrichment without allowing its failure to hide the
 * primary content a screen can still safely render.
 */
export async function settleOptional<T>(task: PromiseLike<T>): Promise<OptionalResult<T>> {
  try {
    return { available: true, value: await task };
  } catch {
    return { available: false };
  }
}
