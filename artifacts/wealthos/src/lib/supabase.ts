import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  interface Window {
    __wealthos_supabase?: SupabaseClient;
  }
}

export function initSupabase(url: string, anonKey: string): void {
  if (window.__wealthos_supabase) return; // already initialized (HMR-safe)
  window.__wealthos_supabase = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "wealthos-auth",
    },
  });
}

export function getSupabase(): SupabaseClient {
  if (!window.__wealthos_supabase) {
    throw new Error("Supabase not initialized — call initSupabase() first");
  }
  return window.__wealthos_supabase;
}
