import {
  createContext,
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

WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  /** true until the initial session + profile lookup finishes. */
  loading: boolean;
  session: Session | null;
  /** Monotonic, process-local identity for protected-media cache isolation. */
  sessionGeneration: number;
  mediaAppActive: boolean;
  profile: Profile | null;
  /** Signed in but hasn't completed profile setup yet. */
  needsProfile: boolean;
  signInWithEmail: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  signInWithOAuth: (provider: "google" | "apple") => Promise<void>;
  refreshProfile: () => Promise<void>;
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
  const authSubjectRef = useRef<string | null | undefined>(undefined);

  async function loadProfile(s: Session | null) {
    if (!s?.user) {
      setProfile(null);
      return;
    }
    setProfile(await getProfile(s.user.id));
  }

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (authSubjectRef.current === undefined) authSubjectRef.current = data.session?.user.id ?? null;
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      const nextSubject = s?.user.id ?? null;
      if (shouldResetProtectedResumeState(event, authSubjectRef.current, nextSubject)) {
        await resetProtectedMediaUploads();
      }
      authSubjectRef.current = nextSubject;
      protectedMediaCache.clearAll();
      setSessionGeneration(allocateMediaSessionGeneration());
      setSession(s);
      await loadProfile(s);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

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

  async function refreshProfile() {
    await loadProfile(session);
  }

  async function signOut() {
    protectedMediaCache.clearAll();
    try { await resetProtectedMediaUploads(); } catch { /* Supabase sign-out must still proceed. */ }
    await supabase.auth.signOut();
    setProfile(null);
  }

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      sessionGeneration,
      mediaAppActive,
      profile,
      needsProfile: Boolean(session?.user) && !profile,
      signInWithEmail,
      verifyEmailOtp,
      signInWithOAuth,
      refreshProfile,
      signOut,
    }),
    [loading, session, sessionGeneration, mediaAppActive, profile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
