import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client for The Wall — points at The Wall's own Supabase project
 * (Postgres/Auth/Storage/Realtime), configured via EXPO_PUBLIC_* env vars.
 *
 * Session persistence uses AsyncStorage (survives app restarts). `detectSession
 * InUrl` is off because native OAuth returns via a deep link handled explicitly
 * by expo-auth-session, not a browser URL.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url ?? "http://localhost", anonKey ?? "public-anon-key", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
