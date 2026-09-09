import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { getProfile } from "./profiles";
import type { Profile } from "./types";
import { allocateMediaSessionGeneration, protectedMediaCache } from "./mark-media";
import { shouldResetProtectedResumeState } from "./mark-media-writer";
import { resetProtectedMediaUploads } from "./upload";
import { getCurrentAccountRoute } from "./account";
import { AccountRouteFence, type AccountRoute, type AccountRouteToken } from "./onboarding-contract";

WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  /** true until the initial session + profile lookup finishes. */
  loading: boolean;
  session: Session | null;
  /** Monotonic, process-local identity for protected-media cache isolation. */
  sessionGeneration: number;
  mediaAppActive: boolean;
  profile: Profile | null;
  /** Actor-bound bootstrap result. Null only while signed out or unresolved. */
  accountRoute: AccountRoute | null;
  signInWithEmail: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  signInWithOAuth: (provider: "google" | "apple") => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshAccountRoute: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const redirectTo = makeRedirectUri({ scheme: "thewall", path: "auth/callback" });

/**
 * Wraps the app and exposes auth + profile state. Keeps the Supabase session in
 * sync (via onAuthStateChange) and loads the matching profile so routing can
 * branch: signed out → onboarding, signed in w/o profile → setup, else → app.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionGeneration, setSessionGeneration] = useState(allocateMediaSessionGeneration);
  const [mediaAppActive, setMediaAppActive] = useState(AppState.currentState === "active");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accountRoute, setAccountRoute] = useState<AccountRoute | null>(null);
  const authSubjectRef = useRef<string | null | undefined>(undefined);
  const routeFence = useRef(new AccountRouteFence());

  const loadAccountState = useCallback(async (
    s: Session | null,
    existingToken?: AccountRouteToken,
  ) => {
    const subject = s?.user.id ?? null;
    const token = existingToken ?? routeFence.current.beginIfSubjectCurrent(
      subject,
      authSubjectRef.current ?? null,
    );
    if (!token) return;
    if (!routeFence.current.isCurrent(token, authSubjectRef.current ?? null)) return;
    if (!s?.user) {
      setAccountRoute(null);
      setProfile(null);
      return;
    }
    let route: AccountRoute;
    try {
      route = await getCurrentAccountRoute();
    } catch (cause) {
      if (routeFence.current.isCurrent(token, authSubjectRef.current ?? null)) {
        setAccountRoute("unavailable");
        setProfile(null);
      }
      throw cause;
    }
    if (!routeFence.current.isCurrent(token, authSubjectRef.current ?? null)) return;

    let nextProfile: Profile | null = null;
    if (route === "onboarding" || route === "walkthrough" || route === "ready") {
      nextProfile = await getProfile(s.user.id);
      if (!routeFence.current.isCurrent(token, authSubjectRef.current ?? null)) return;
    }
    setAccountRoute(route);
    setProfile(nextProfile);
  }, []);

  useEffect(() => {
    let active = true;
    const currentRouteFence = routeFence.current;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const initialSubject = data.session?.user.id ?? null;
      if (authSubjectRef.current === undefined) authSubjectRef.current = initialSubject;
      else if (authSubjectRef.current !== initialSubject) return;
      const initialToken = currentRouteFence.begin(initialSubject);
      setSession(data.session);
      try {
        await loadAccountState(data.session, initialToken);
      } catch {
        // `loadAccountState` applies unavailable only if this request is still current.
      } finally {
        if (active && currentRouteFence.isCurrent(initialToken, authSubjectRef.current ?? null)) {
          setLoading(false);
        }
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      const nextSubject = s?.user.id ?? null;
      const previousSubject = authSubjectRef.current;
      // Fence the old identity before any awaited cleanup can yield back to a stale load.
      authSubjectRef.current = nextSubject;
      const eventToken = currentRouteFence.begin(nextSubject);
      protectedMediaCache.clearAll();
      setSessionGeneration(allocateMediaSessionGeneration());
      setSession(s);
      setAccountRoute(null);
      setProfile(null);
      setLoading(true);
      if (shouldResetProtectedResumeState(event, previousSubject, nextSubject)) {
        try { await resetProtectedMediaUploads(); } catch { /* Identity is already fenced locally. */ }
      }
      if (!currentRouteFence.isCurrent(eventToken, authSubjectRef.current ?? null)) return;
      try {
        await loadAccountState(s, eventToken);
      } catch {
        // `loadAccountState` applies unavailable only if this request is still current.
      } finally {
        if (currentRouteFence.isCurrent(eventToken, authSubjectRef.current ?? null)) {
          setLoading(false);
        }
      }
    });
    return () => {
      active = false;
      currentRouteFence.invalidate(null);
      sub.subscription.unsubscribe();
    };
  }, [loadAccountState]);

  // One process-wide lifecycle boundary avoids one listener per rendered Mark.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      const active = state === "active";
      setMediaAppActive(active);
      if (!active) protectedMediaCache.clearAll();
    });
    return () => subscription.remove();
  }, []);

  // Passwordless: email a 6-digit code / magic link.
  async function signInWithEmail(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
  }

  async function verifyEmailOtp(email: string, token: string) {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) throw error;
  }

  // Native OAuth: open the provider in a browser tab, then set the session from
  // the deep-link the provider redirects back to.
  async function signInWithOAuth(provider: "google" | "apple") {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data?.url) return;

    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type !== "success" || !res.url) return;

    const url = new URL(res.url);
    const code = url.searchParams.get("code");
    if (code) {
      const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
      if (exErr) throw exErr;
    }
  }

  const refreshProfile = useCallback(async () => {
    await loadAccountState(session);
  }, [loadAccountState, session]);

  const refreshAccountRoute = useCallback(async () => {
    await loadAccountState(session);
  }, [loadAccountState, session]);

  async function signOut() {
    protectedMediaCache.clearAll();
    try { await resetProtectedMediaUploads(); } catch { /* Supabase sign-out must still proceed. */ }
    await supabase.auth.signOut();
    routeFence.current.invalidate(null);
    setAccountRoute(null);
    setProfile(null);
  }

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      sessionGeneration,
      mediaAppActive,
      profile,
      accountRoute,
      signInWithEmail,
      verifyEmailOtp,
      signInWithOAuth,
      refreshProfile,
      refreshAccountRoute,
      signOut,
    }),
    [loading, session, sessionGeneration, mediaAppActive, profile, accountRoute, refreshProfile, refreshAccountRoute],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
