import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { getProfile } from "./profiles";
import type { Profile } from "./types";

WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  /** true until the initial session + profile lookup finishes. */
  loading: boolean;
  session: Session | null;
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
  const [profile, setProfile] = useState<Profile | null>(null);

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
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      await loadProfile(s);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
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
    await supabase.auth.signOut();
    setProfile(null);
  }

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      profile,
      needsProfile: Boolean(session?.user) && !profile,
      signInWithEmail,
      verifyEmailOtp,
      signInWithOAuth,
      refreshProfile,
      signOut,
    }),
    [loading, session, profile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
