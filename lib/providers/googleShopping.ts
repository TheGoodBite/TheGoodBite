import { getOrSet } from "@/lib/cache";
import type { ProductCandidate } from "@/lib/types";
import { sha256 } from "@/lib/utils";
import { parsePackage, validBarcode } from "@/lib/products";
import {
  providerJson,
  ProviderError,
  reserveBudget,
  setting,
} from "@/lib/providerRuntime";

type ShoppingResult = {
  product_id?: string;
  title?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  currency?: string;
  thumbnail?: string;
  link?: string;
  product_link?: string;
  brand?: string;
  gtin?: string;
  upc?: string;
};
type Location = {
  canonical_name: string;
  country_code: string;
  target_type?: string;
  name?: string;
};
export async function resolveLocation(zip?: string): Promise<string> {
  if (!zip) return "United States";
  return getOrSet(`serp:location:${zip}`, 86400 * 30, async () => {
    await reserveBudget("locations", 60, 60000);
    const url = new URL("https://serpapi.com/locations.json");
    url.searchParams.set("q", zip);
    url.searchParams.set("limit", "10");
    const locations = await providerJson<Location[]>(url, "Location lookup");
    const location = locations.find(
      (l) =>
        l.country_code === "US" &&
        l.canonical_name?.split(",").some((part) => part.trim() === zip),
    );
    if (!location)
      throw new ProviderError(
        "That ZIP code could not be resolved to a US search location.",
        400,
      );
    return location.canonical_name;
  });
}
export async function searchGoogleShoppingProducts(
  query: string,
  limit: number,
  zip?: string,
  signal?: AbortSignal,
) {
  if (!process.env.SERPAPI_API_KEY)
    throw new ProviderError(
      "Product search is not configured. A SerpAPI key is required.",
    );
  const location = await resolveLocation(zip);
  return getOrSet(
    `serp:v3:${await sha256(JSON.stringify({ query, limit, location }))}`,
    1800,
    async () => {
      signal?.throwIfAborted();
      await reserveBudget(
        "serp:daily",
        setting("SERPAPI_DAILY_REQUEST_LIMIT", 250),
        86400000,
      );
      const url = new URL("https://serpapi.com/search.json");
      for (const [key, value] of Object.entries({
        engine: "google_shopping",
        q: query,
        gl: "us",
        hl: "en",
        location,
        google_domain: "google.com",
        api_key: process.env.SERPAPI_API_KEY!,
      }))
        url.searchParams.set(key, value);
      // Shared cache work has its own deadline; cancellation stops scheduling subsequent work, not another user's identical lookup.
      const data = await providerJson<{
        shopping_results?: ShoppingResult[];
        error?: string;
      }>(url, "Shopping search", undefined, 9000);
      if (data.error)
        throw new ProviderError(
          "Shopping search could not complete this query. Please try again.",
        );
      return (data.shopping_results ?? [])
        .map(normalizeShoppingResult)
        .filter((p): p is ProductCandidate => p !== null)
        .slice(0, limit);
    },
  );
}
export function normalizeShoppingResult(
  result: ShoppingResult,
): ProductCandidate | null {
  if (!result.title) return null;
  // A country-biased search is not proof of currency or local availability.
  const currency = result.currency?.toUpperCase();
  const priceText = result.price?.trim() ?? "";
  if (currency && currency !== "USD") return null;
  if (
    /(?:[€£¥₹]|\b(?:CAD|AUD|NZD|EUR|GBP|INR)\b|(?:CA|AU|NZ|C|A)\$)/i.test(
      priceText,
    )
  )
    return null;
  const usd =
    currency === "USD" ||
    /^(?:US\s*)?\$\s*\d/.test(priceText) ||
    /\bUSD\b/i.test(priceText);
  const amount =
    typeof result.extracted_price === "number"
      ? result.extracted_price
      : Number(priceText.replace(/(?:USD|US|\$|,)/g, "").trim());
  const price = usd && Number.isFinite(amount) && amount > 0 ? amount : null;
  const productUrl = [result.product_link, result.link].find(
    (u) => u && /^https?:\/\//i.test(u),
  );
  const pack = parsePackage(result.title);
  const observation =
    price === null
      ? undefined
      : {
          source: "shopping" as const,
          amount: price,
          currency: "USD" as const,
          observedAt: new Date().toISOString(),
          seller: result.source,
          url: productUrl,
        };
  return {
    provider: "serpapi_google_shopping",
    providerProductId: result.product_id ?? `${result.source}:${result.title}`,
    title: result.title,
    brand: result.brand,
    imageUrl: result.thumbnail,
    estimatedPrice: price,
    currency: usd ? "USD" : undefined,
    market: "US-search",
    package: pack,
    packageSize: pack.size,
    upc: validBarcode(result.gtin ?? result.upc),
    productUrl,
    seller: result.source,
    offers: observation ? [observation] : [],
    priceSource: observation?.source,
    priceObservation: observation,
  };
}
