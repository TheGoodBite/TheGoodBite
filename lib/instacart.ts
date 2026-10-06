import { ApiError } from "@/lib/api";
import { requireAdminSupabase } from "@/lib/supabase";
import { reserveBudget, setting } from "@/lib/providerRuntime";
import { shoppingLines, type ListSnapshot } from "@/lib/listSharing";
import { sha256 } from "@/lib/utils";

export function instacartEnabled() {
  return process.env.INSTACART_ENABLED === "true" && !!process.env.INSTACART_API_KEY &&
    ["development", "production"].includes(process.env.INSTACART_ENVIRONMENT ?? "");
}
export function validInstacartUrl(value: unknown, environment: string): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      (url.hostname === "instacart.com" || url.hostname.endsWith(".instacart.com") ||
        (environment === "development" && (url.hostname === "instacart.tools" || url.hostname.endsWith(".instacart.tools"))));
  } catch { return false; }
}
export function siteUrl(path: string) {
  const base = new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
  if (process.env.NODE_ENV === "production" && (base.protocol !== "https:" || base.hostname === "localhost"))
    throw new ApiError("The app's public URL is not configured.", 503);
  return new URL(path, base.origin).href;
}

export async function exportInstacart(snapshot: ListSnapshot, scope: string, linkback: string) {
  if (!instacartEnabled()) throw new ApiError("Instacart shopping is not available yet.", 503);
  const environment = process.env.INSTACART_ENVIRONMENT!;
  const payload = { title: snapshot.name, link_type: "shopping_list", expires_in: 30,
    line_items: shoppingLines(snapshot), landing_page_configuration: { partner_linkback_url: linkback } };
  const cacheKey = await sha256(JSON.stringify({ version: 1, environment, scope, payload }));
  const db = requireAdminSupabase();
  const { data: cached, error: readError } = await db.from("instacart_exports").select("url, expires_at")
    .eq("cache_key", cacheKey).maybeSingle();
  if (readError) throw readError;
  if (cached?.url && Date.parse(cached.expires_at) > Date.now() + 60000 && validInstacartUrl(cached.url, environment))
    return { url: cached.url as string, expiresAt: cached.expires_at as string };
  const lease = crypto.randomUUID();
  const { data: claimed, error: claimError } = await db.rpc("claim_instacart_export", { p_key: cacheKey, p_lease: lease });
  if (claimError) throw claimError;
  if (!claimed) throw new ApiError("This shopping link is being prepared. Try again in a moment.", 409);
  const started = Date.now();
  try {
    await reserveBudget(`instacart:${scope}:minute`, 10, 60000);
    await reserveBudget(`instacart:${scope}:day`, 100, 86400000);
    await reserveBudget("instacart:global:minute", setting("INSTACART_LINKS_PER_MINUTE", 30), 60000);
    const host = environment === "production" ? "https://connect.instacart.com" : "https://connect.dev.instacart.tools";
    const response = await fetch(`${host}/idp/v1/products/products_link`, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${process.env.INSTACART_API_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new ApiError(response.status === 429 ? "Instacart is busy. Please try again shortly." : "Instacart could not prepare this list. Please try again.", response.status === 429 ? 429 : 502);
    const result = await response.json();
    if (!validInstacartUrl(result.products_link_url, environment)) throw new ApiError("Instacart returned an invalid shopping link. Please try again.", 502);
    // Expire early, measured from request start, rather than extending the provider's lifetime.
    const expiresAt = new Date(started + 30 * 86400000 - 60000).toISOString();
    const { error } = await db.from("instacart_exports").update({ url: result.products_link_url, expires_at: expiresAt, lease_id: null, lease_until: null })
      .eq("cache_key", cacheKey).eq("lease_id", lease);
    if (error) throw error;
    console.info("meezany.instacart", { outcome: "created", durationMs: Date.now() - started });
    return { url: result.products_link_url as string, expiresAt };
  } catch (error) {
    console.info("meezany.instacart", { outcome: "failed", durationMs: Date.now() - started });
    if (error instanceof ApiError || (error instanceof Error && error.name === "ProviderError")) throw error;
    throw new ApiError("The shopping link could not be prepared. Your list is saved; please try again.", 503);
  } finally {
    await db.from("instacart_exports").update({ lease_id: null, lease_until: null }).eq("cache_key", cacheKey).eq("lease_id", lease);
  }
}
