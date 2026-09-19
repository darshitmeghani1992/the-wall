import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  MediaFailureEpisode,
  MarkMediaReadError,
  RuntimeUnloadRegistration,
  protectedMediaCache,
  requestProtectedMedia,
  type MediaCacheIdentity,
  type ProtectedMediaItem,
  type ProtectedMediaManifest,
} from "@/lib/mark-media";
import type { MarkWithAuthor } from "@/lib/marks";

type MediaPhase = "idle" | "loading" | "ready" | "unavailable";

type Result = {
  phase: MediaPhase;
  items: ProtectedMediaItem[];
  /** Native media errors deliberately carry no URL/parser detail. */
  reportMediaFailure: () => void;
  setPlaying: (playing: boolean) => void;
  registerUnload: (unload: (() => void | Promise<void>) | null) => void;
};

/**
 * Reads protected Mark media only while its surface is active. The shared cache
 * deduplicates wall/detail requests but is bound to subject + session generation.
 */
export function useMarkMedia(mark: MarkWithAuthor, visible = true): Result {
  const { session, sessionGeneration, mediaAppActive } = useAuth();
  const [phase, setPhase] = useState<MediaPhase>("idle");
  const [manifest, setManifest] = useState<ProtectedMediaManifest | null>(null);
  const [playing, setPlayingState] = useState(false);
  const mounted = useRef(true);
  const operation = useRef(0);
  const failureEpisode = useRef(new MediaFailureEpisode());
  const unloadRegistration = useRef(new RuntimeUnloadRegistration()).current;
  const subject = session?.user.id ?? null;
  const accessToken = session?.access_token ?? null;
  const enabled = visible && mediaAppActive && !mark.secret && mark.type !== "text" && mark.id !== "preview";

  const identity = useMemo<MediaCacheIdentity | null>(() => subject && sessionGeneration > 0 ? ({
    subject,
    sessionGeneration,
    markId: mark.id,
  }) : null, [mark.id, sessionGeneration, subject]);

  const unload = useCallback(() => {
    unloadRegistration.invoke();
    if (mounted.current) setPlayingState(false);
  }, [unloadRegistration]);

  const acceptUnavailable = useCallback(() => {
    if (!mounted.current) return;
    setManifest(null);
    setPhase("unavailable");
  }, []);

  const load = useCallback(async (force: boolean, permitHttpRefresh: boolean): Promise<boolean> => {
    if (!identity || !accessToken || !enabled) return false;
    const currentOperation = ++operation.current;
    setPhase((current) => current === "ready" && force ? current : "loading");
    try {
      const next = await protectedMediaCache.read(
        identity,
        () => requestProtectedMedia(mark.id, accessToken),
        force,
      );
      if (next.items[0]?.media_type !== mark.type) throw new MarkMediaReadError(false);
      if (!mounted.current || currentOperation !== operation.current) return false;
      setManifest(next);
      setPhase("ready");
      return true;
    } catch (cause) {
      if (!mounted.current || currentOperation !== operation.current) return false;
      const episode = failureEpisode.current;
      const retryDecision = permitHttpRefresh && cause instanceof MarkMediaReadError && cause.refreshable
        ? episode.begin()
        : "ignore";
      if (retryDecision === "refresh") {
        try {
          const next = await protectedMediaCache.read(
            identity,
            () => requestProtectedMedia(mark.id, accessToken),
            true,
          );
          if (next.items[0]?.media_type !== mark.type) throw new MarkMediaReadError(false);
          if (!mounted.current || currentOperation !== operation.current) return false;
          setManifest(next);
          setPhase("ready");
          episode.complete(true);
          return true;
        } catch {
          episode.complete(false);
        }
      }
      protectedMediaCache.clear(identity);
      unload();
      acceptUnavailable();
      return false;
    }
  }, [acceptUnavailable, accessToken, enabled, identity, mark.id, mark.type, unload]);

  useEffect(() => {
    mounted.current = true;
    operation.current += 1;
    failureEpisode.current = new MediaFailureEpisode();
    setManifest(null);
    setPhase(enabled ? "loading" : "idle");
    if (enabled) void load(false, true);
    return () => {
      mounted.current = false;
      operation.current += 1;
      unload();
    };
  }, [enabled, identity, load, unload]);

  useEffect(() => () => unloadRegistration.clear(), [unloadRegistration]);

  useEffect(() => {
    if (!enabled) return;
    return protectedMediaCache.onClear(() => {
      operation.current += 1;
      setManifest(null);
      setPhase("idle");
      unload();
    });
  }, [enabled, unload]);

  useEffect(() => {
    if (!manifest || (!visible && !playing) || mark.id === "preview") return;
    const refreshAt = Date.parse(manifest.expires_at) - 15_000;
    const delay = Math.max(0, refreshAt - Date.now());
    const timer = setTimeout(() => void load(true, false), delay);
    return () => clearTimeout(timer);
  }, [load, manifest, mark.id, playing, visible]);

  const reportMediaFailure = useCallback(() => {
    if (!identity || !enabled) return;
    const episode = failureEpisode.current;
    const decision = episode.begin();
    if (decision === "ignore") return;
    unload();
    protectedMediaCache.clear(identity);
    if (decision === "terminal") {
      operation.current += 1;
      acceptUnavailable();
      return;
    }
    void load(true, false).then((succeeded) => episode.complete(succeeded));
  }, [acceptUnavailable, enabled, identity, load, unload]);

  const registerUnload = useCallback((callback: (() => void | Promise<void>) | null) => {
    unloadRegistration.set(callback);
  }, [unloadRegistration]);

  return {
    phase,
    items: manifest?.items ?? [],
    reportMediaFailure,
    setPlaying: setPlayingState,
    registerUnload,
  };
}
