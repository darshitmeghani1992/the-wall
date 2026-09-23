/** Tracks which reaction IDs are claimed by the current request or already loaded. */
export class ReactionRequestTracker {
  private claims = new Map<string, symbol>();

  claim(ids: readonly string[]) {
    const token = Symbol("reaction request");
    const requested = ids.filter((id) => !this.claims.has(id));
    for (const id of requested) this.claims.set(id, token);
    return {
      ids: requested,
      // An old request cannot release IDs a newer request took after cleanup.
      abandon: () => {
        for (const id of requested) if (this.claims.get(id) === token) this.claims.delete(id);
      },
    };
  }

  has(id: string) { return this.claims.has(id); }
  clear() { this.claims.clear(); }
}
