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
  serving_size?: string;
  serving_quantity?: number;
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
    const url = `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(upc)}.json`;
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent() },
      next: { revalidate: 60 * 60 * 24 * 30 }
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { product?: OffProduct; status?: string | number };
    return data.product ? fromOffProduct(data.product, "high") : null;
  });
}

async function searchByText(candidate: ProductCandidate, query: string) {
  const cleanTitle = candidate.title.replace(/[^\w\s]/gi, " ").trim();
  const searchTerms = [candidate.brand, cleanTitle, query].filter(Boolean).join(" ").slice(0, 80);
  const cacheKey = `off:search:${await sha256(searchTerms)}`;

  return getOrSet<HealthInfo | null>(cacheKey, 60 * 60 * 24 * 14, async () => {
    // Try US endpoint first for regional food match, then fallback to World endpoint
    const endpoints = [
      "https://us.openfoodfacts.org/cgi/search.pl",
      "https://world.openfoodfacts.org/cgi/search.pl"
    ];

    for (const endpoint of endpoints) {
      try {
        const url = new URL(endpoint);
        url.searchParams.set("search_terms", searchTerms);
        url.searchParams.set("search_simple", "1");
        url.searchParams.set("action", "process");
        url.searchParams.set("json", "1");
        url.searchParams.set("page_size", "8");
        url.searchParams.set(
          "fields",
          [
            "product_name",
            "brands",
            "nutriscore_grade",
            "nova_group",
            "nutriments",
            "serving_size",
            "serving_quantity",
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
        if (!response.ok) continue;

        const data = (await response.json()) as { products?: OffProduct[] };
        const products = data.products ?? [];
        if (products.length === 0) continue;

        // Rank candidates by term overlap
        const ranked = products
          .map((product) => ({
            product,
            confidence: matchConfidence(product, candidate, query)
          }))
          .sort((a, b) => {
            const confRank = { high: 3, medium: 2, low: 1 };
            return confRank[b.confidence] - confRank[a.confidence];
          });

        const best = ranked[0];
        if (best && best.confidence !== "low") {
          return fromOffProduct(best.product, best.confidence);
        }

        // Fallback: if there's any product returned with valid nutrition data, use it with fallback confidence
        const fallback = products.find(
          (p) => p.nutriments && (p.nutriments.proteins_100g !== undefined || p.nutriments.sugars_100g !== undefined || p.nutriscore_grade)
        );
        if (fallback) {
          return fromOffProduct(fallback, "low");
        }
      } catch {
        continue;
      }
    }

    return null;
  });
}

function fromOffProduct(product: OffProduct, confidence: HealthInfo["confidence"]) {
  const n = product.nutriments ?? {};
  return classifyHealth({
    nutriScore: product.nutriscore_grade,
    novaGroup: product.nova_group,
    confidence,
    nutrition: {
      protein100g: parseNutrient(n.proteins_100g ?? n.proteins),
      sugars100g: parseNutrient(n.sugars_100g ?? n.sugars),
      sodium100g: parseNutrient(n.sodium_100g ?? n.sodium),
      salt100g: parseNutrient(n.salt_100g ?? n.salt),
      fiber100g: parseNutrient(n.fiber_100g ?? n.fiber),
      energyKcal100g: parseNutrient(n["energy-kcal_100g"] ?? n["energy-kcal"]),
      saturatedFat100g: parseNutrient(n["saturated-fat_100g"] ?? n["saturated-fat"])
    },
    servingSize: product.serving_size,
    servingsPerContainer: product.serving_quantity ? null : undefined,
    ingredientsText: product.ingredients_text,
    labelsTags: product.labels_tags,
    categoriesTags: product.categories_tags,
    allergensTags: product.allergens_tags
  });
}

function parseNutrient(val: unknown): number | undefined {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") {
    const parsed = parseFloat(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function matchConfidence(product: OffProduct, candidate: ProductCandidate, query: string): HealthInfo["confidence"] {
  const productHaystack = normalizeQuery([product.product_name, product.brands].filter(Boolean).join(" "));
  const candidateTitle = normalizeQuery(candidate.title);
  const candidateBrand = candidate.brand ? normalizeQuery(candidate.brand) : "";
  const queryTerms = normalizeQuery(query).split(" ").filter((t) => t.length > 2);

  // Check brand overlap
  const brandMatch =
    candidateBrand &&
    productHaystack.split(" ").some((term) => term.length > 2 && candidateBrand.includes(term));

  // Count title term overlap
  const titleTerms = candidateTitle.split(" ").filter((t) => t.length > 2);
  const titleOverlapCount = titleTerms.filter((term) => productHaystack.includes(term)).length;
  const queryMatchCount = queryTerms.filter((term) => productHaystack.includes(term)).length;

  if (brandMatch && (titleOverlapCount > 0 || queryMatchCount > 0)) return "high";
  if (titleOverlapCount >= 2 || (titleOverlapCount >= 1 && queryMatchCount >= 1)) return "medium";
  if (titleOverlapCount >= 1 || queryMatchCount >= 1) return "low";

  return "low";
}

function userAgent() {
  return "TheGoodBite/1.0 (contact: support@thegoodbite.app)";
}
