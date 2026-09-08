import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./config";

/**
 * Supabase client for The Wall — points at The Wall's own Supabase project
 * (Postgres/Auth/Storage/Realtime), configured via EXPO_PUBLIC_* env vars.
 *
 * Session persistence uses AsyncStorage (survives app restarts). `detectSession
 * InUrl` is off because native OAuth returns via a deep link handled explicitly
 * by expo-auth-session, not a browser URL.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl ?? "http://localhost", supabaseAnonKey ?? "public-anon-key", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
