import { createClient } from "@supabase/supabase-js";
import type { AuthUser, SubscriptionStatus } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function createBrowserSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

export function createServerSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  });
}

export function createAdminSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false }
  });
}

export async function getUserFromRequest(request: Request): Promise<AuthUser | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    if (process.env.NODE_ENV !== "production" && token === "dev-token") {
      return { id: "00000000-0000-4000-8000-000000000001", email: "dev@onlygoodbites.local" };
    }
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email ?? undefined };
}

export async function ensureProfile(user: AuthUser) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { subscription_status: "free" as SubscriptionStatus };

  const { data } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("id", user.id)
    .single();

  if (data) return data as { subscription_status: SubscriptionStatus };

  const { data: inserted } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email ?? null,
      subscription_status: "free"
    })
    .select("subscription_status")
    .single();

  return (inserted as { subscription_status: SubscriptionStatus } | null) ?? {
    subscription_status: "free"
  };
}

export type ProfileRow = {
  subscription_status: SubscriptionStatus;
  stripe_customer_id?: string | null;
};

export async function getCurrentProfile(user: AuthUser): Promise<ProfileRow> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { subscription_status: "free" as SubscriptionStatus };

  const { data } = await supabase
    .from("profiles")
    .select("subscription_status, stripe_customer_id")
    .eq("id", user.id)
    .single();

  return (data as ProfileRow | null) ?? (await ensureProfile(user));
}

export function requireAdminSupabase() {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase service role configuration is required for this route.");
  }
  return supabase;
}
