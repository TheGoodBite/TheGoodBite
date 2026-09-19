import { getOrSet } from "@/lib/cache";
import type { ProductCandidate } from "@/lib/types";
import { parseMoney, sha256 } from "@/lib/utils";

type SerpApiShoppingResult = {
  product_id?: string;
  position?: number;
  title?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  thumbnail?: string;
  link?: string;
  product_link?: string;
};

export async function searchGoogleShoppingProducts(query: string, limit: number) {
  const cacheKey = `products:serpapi:${await sha256(JSON.stringify({ query, limit }))}`;
  return getOrSet(cacheKey, 60 * 30, async () => {
    if (!process.env.SERPAPI_API_KEY) {
      return mockShoppingResults(query, limit);
    }

    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_shopping");
    url.searchParams.set("q", query);
    url.searchParams.set("gl", "us");
    url.searchParams.set("hl", "en");
    url.searchParams.set("api_key", process.env.SERPAPI_API_KEY);

    const response = await fetch(url, { next: { revalidate: 1800 } });
    if (!response.ok) {
      throw new Error(`SerpAPI request failed with ${response.status}`);
    }

    const data = (await response.json()) as { shopping_results?: SerpApiShoppingResult[] };
    return (data.shopping_results ?? [])
      .slice(0, Math.max(limit, 10))
      .map((result, index) => normalizeSerpApiResult(result, index))
      .filter((candidate): candidate is ProductCandidate => Boolean(candidate));
  });
}

function normalizeSerpApiResult(result: SerpApiShoppingResult, index: number): ProductCandidate | null {
  if (!result.title) return null;

  const estimatedPrice =
    typeof result.extracted_price === "number" ? result.extracted_price : parseMoney(result.price);

  return {
    provider: "serpapi_google_shopping",
    providerProductId: result.product_id ?? `${result.title}-${index}`,
    title: result.title,
    brand: inferBrand(result.title),
    imageUrl: result.thumbnail,
    estimatedPrice,
    productUrl: result.product_link ?? result.link,
    seller: result.source,
    raw: result
  };
}

function inferBrand(title: string) {
  const firstChunk = title.split(/[-:,|]/)[0]?.trim();
  if (!firstChunk) return undefined;
  const words = firstChunk.split(/\s+/).slice(0, 3).join(" ");
  return words.length > 2 ? words : undefined;
}

function mockShoppingResults(query: string, limit: number): ProductCandidate[] {
  const base = [
    { title: `Good & Gather ${query}`, price: 3.29, seller: "Target" },
    { title: `Kroger ${query}`, price: 2.79, seller: "Kroger" },
    { title: `Great Value ${query}`, price: 2.48, seller: "Walmart" },
    { title: `Annie's Organic ${query}`, price: 4.19, seller: "Instacart" },
    { title: `365 by Whole Foods ${query}`, price: 3.99, seller: "Amazon" },
    { title: `Simple Truth ${query}`, price: 3.49, seller: "Kroger" },
    { title: `Signature Select ${query}`, price: 2.99, seller: "Albertsons" },
    { title: `Market Pantry ${query}`, price: 2.69, seller: "Target" },
    { title: `Nature's Promise ${query}`, price: 4.49, seller: "Giant" },
    { title: `Store Brand ${query}`, price: 1.99, seller: "Local grocer" }
  ];

  return base.slice(0, limit).map((item, index) => ({
    provider: "mock_google_shopping",
    providerProductId: `${query.toLowerCase().replace(/\W+/g, "-")}-${index}`,
    title: item.title,
    brand: inferBrand(item.title),
    imageUrl: `https://placehold.co/480x360/f4f7f0/1d2a22?text=${encodeURIComponent(query)}`,
    estimatedPrice: item.price,
    seller: item.seller,
    productUrl: "https://shopping.google.com/",
    raw: item
  }));
}
