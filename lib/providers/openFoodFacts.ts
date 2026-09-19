import { getOrSet } from "@/lib/cache";
import { classifyHealth, UNKNOWN_HEALTH } from "@/lib/health";
import type { HealthInfo, ProductCandidate } from "@/lib/types";
import { normalizeQuery, sha256 } from "@/lib/utils";

type OffProduct = {
  product_name?: string;
  brands?: string;
  nutriscore_grade?: string;
  nova_group?: number;
  nutriments?: Record<string, number>;
  ingredients_text?: string;
  labels_tags?: string[];
  categories_tags?: string[];
  allergens_tags?: string[];
};

export async function getHealthForProduct(candidate: ProductCandidate, query: string): Promise<HealthInfo> {
  if (candidate.upc) {
    const barcodeHealth = await getByBarcode(candidate.upc);
    if (barcodeHealth) return barcodeHealth;
  }

  return (await searchByText(candidate, query)) ?? UNKNOWN_HEALTH;
}

async function getByBarcode(upc: string) {
  const cacheKey = `off:barcode:${upc}`;
  return getOrSet<HealthInfo | null>(cacheKey, 60 * 60 * 24 * 60, async () => {
    const response = await fetch(`https://world.openfoodfacts.org/api/v3.6/product/${encodeURIComponent(upc)}.json`, {
      headers: { "User-Agent": userAgent() },
      next: { revalidate: 60 * 60 * 24 * 30 }
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { product?: OffProduct; status?: string | number };
    return data.product ? fromOffProduct(data.product, "high") : null;
  });
}

async function searchByText(candidate: ProductCandidate, query: string) {
  const search = [candidate.brand, candidate.title].filter(Boolean).join(" ").slice(0, 120);
  const cacheKey = `off:search:${await sha256(search)}`;

  return getOrSet<HealthInfo | null>(cacheKey, 60 * 60 * 24 * 14, async () => {
    const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    url.searchParams.set("search_terms", search);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "5");
    url.searchParams.set(
      "fields",
      [
        "product_name",
        "brands",
        "nutriscore_grade",
        "nova_group",
        "nutriments",
        "ingredients_text",
        "labels_tags",
        "categories_tags",
        "allergens_tags"
      ].join(",")
    );

    const response = await fetch(url, {
      headers: { "User-Agent": userAgent() },
      next: { revalidate: 60 * 60 * 24 * 7 }
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { products?: OffProduct[] };
    const best = (data.products ?? []).find((product) => matchConfidence(product, candidate, query) !== "low");
    if (!best) return null;

    return fromOffProduct(best, matchConfidence(best, candidate, query));
  });
}

function fromOffProduct(product: OffProduct, confidence: HealthInfo["confidence"]) {
  const n = product.nutriments ?? {};
  return classifyHealth({
    nutriScore: product.nutriscore_grade,
    novaGroup: product.nova_group,
    confidence,
    nutrition: {
      protein100g: n.proteins_100g,
      sugars100g: n.sugars_100g,
      sodium100g: n.sodium_100g,
      salt100g: n.salt_100g,
      fiber100g: n.fiber_100g,
      energyKcal100g: n["energy-kcal_100g"],
      saturatedFat100g: n["saturated-fat_100g"]
    },
    ingredientsText: product.ingredients_text,
    labelsTags: product.labels_tags,
    categoriesTags: product.categories_tags,
    allergensTags: product.allergens_tags
  });
}

function matchConfidence(product: OffProduct, candidate: ProductCandidate, query: string): HealthInfo["confidence"] {
  const haystack = normalizeQuery([product.product_name, product.brands].filter(Boolean).join(" "));
  const title = normalizeQuery(candidate.title);
  const queryTerms = normalizeQuery(query).split(" ");
  const queryHits = queryTerms.filter((term) => haystack.includes(term)).length;

  if (product.brands && candidate.brand && haystack.includes(normalizeQuery(candidate.brand))) return "high";
  if (title.split(" ").some((term) => term.length > 3 && haystack.includes(term)) && queryHits > 0) return "medium";
  return "low";
}

function userAgent() {
  return "OnlyGoodBites/0.1 (contact: support@onlygoodbites.local)";
}
