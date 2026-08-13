import { useEffect, useRef } from "react";
import { useReducedMotion } from "react-native-reanimated";
import { subscribeToWall, type MarkWithAuthor } from "@/lib/marks";
import { motionTokens } from "@/theme";

/**
 * Subscribes to a wall's realtime Marks and reveals them in a paced, bundled way
 * so a burst of near-simultaneous arrivals "cascades" instead of dropping ten at
 * once. `onReveal` is called once per Mark, when it should appear (the caller
 * prepends it and flags it for the `drop` entrance).
 *
 * Pacing lives here; the per-card entrance/reduced-motion still lives in the
 * motion system (`src/theme/motion.ts`). Under reduced motion we skip the
 * artificial pacing entirely and reveal immediately — the entrance already
 * degrades to a calm fade, so there is nothing to bundle.
 *
 * The scheduler is persistent for the duration of a burst: it releases a small
 * head batch (`arrival.maxConcurrent`) at once, then one Mark every
 * `arrival.stagger` ms until the buffer drains. Because it does not reset on each
 * arrival, rapid separate realtime callbacks are still paced correctly.
 */
export function useStaggeredArrivals(
  wallId: string | undefined,
  onReveal: (mark: MarkWithAuthor) => void,
): void {
  const reduced = useReducedMotion();
  const onRevealRef = useRef(onReveal);
  onRevealRef.current = onReveal;

  useEffect(() => {
    if (!wallId) return;

    const buffer: MarkWithAuthor[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    let running = false;

    const releaseOne = () => {
      const next = buffer.shift();
      if (next) onRevealRef.current(next);
    };

    const pump = () => {
      if (buffer.length === 0) {
        running = false;
        timer = null;
        return;
      }
      releaseOne();
      timer = setTimeout(pump, motionTokens.arrival.stagger);
    };

    const start = () => {
      if (running) return;
      running = true;
      // Head burst: release up to (maxConcurrent - 1) extra Marks immediately so a
      // waiting burst feels responsive; `pump` then releases one more right away
      // and cascades the remainder one per stagger tick. The `> 1` guard keeps a
      // lone arrival snappy (it falls straight through to pump).
      for (let i = 0; i < motionTokens.arrival.maxConcurrent - 1 && buffer.length > 1; i++) {
        releaseOne();
      }
      pump();
    };

    const unsub = subscribeToWall(wallId, (mark) => {
      if (reduced) {
        onRevealRef.current(mark);
        return;
      }
      buffer.push(mark);
      start();
    });

    return () => {
      unsub();
      if (timer) clearTimeout(timer);
      buffer.length = 0;
      running = false;
    };
  }, [wallId, reduced]);
}
