// Server-side only (also used by the background worker, so no "server-only" import).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, serverEnv } from "@/lib/env";

let admin: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses RLS, so it must only be used on the server
 * after the caller has been authenticated and authorised.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    const key = serverEnv().serviceRoleKey;
    if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    admin = createClient(env.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}
