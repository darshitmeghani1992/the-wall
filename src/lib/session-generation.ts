export type SessionGenerationToken = Readonly<{ generation: number; userId: string }>;

/**
 * Focus + session fence for asynchronous client work. A token becomes stale
 * after a newer operation, blur, sign-out, or account switch, preventing a
 * previous screen/account result from repainting or navigating.
 */
export class SessionFocusFence {
  private generation = 0;
  private focused = false;
  private userId: string | null = null;

  focus(userId: string | null): void {
    this.generation += 1;
    this.focused = true;
    this.userId = userId;
  }

  blur(): void {
    this.generation += 1;
    this.focused = false;
    this.userId = null;
  }

  begin(userId: string | null): SessionGenerationToken | null {
    if (!this.focused || !userId || this.userId !== userId) return null;
    this.generation += 1;
    return { generation: this.generation, userId };
  }

  isCurrent(token: SessionGenerationToken, currentUserId: string | null): boolean {
    return this.focused
      && token.generation === this.generation
      && token.userId === this.userId
      && token.userId === currentUserId;
  }
}
