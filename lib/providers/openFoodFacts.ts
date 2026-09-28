import { offSearchParameters, type CatalogPreferences } from "@/lib/offSearchFilters";
import { getOrSet } from "@/lib/cache";
import { classifyHealth, UNKNOWN_HEALTH } from "@/lib/health";
import type { HealthInfo, ProductCandidate, ProductPreferenceId, ProductAttribute } from "@/lib/types";
import { PRODUCT_PREFERENCE_IDS } from "@/lib/types";
import { sha256, normalizeQuery } from "@/lib/utils";
import {
  parsePackage,
  productTokens,
  samePackage,
  validBarcode,
  words,
} from "@/lib/products";
import {
  ProviderError,
  mapConcurrent,
  providerJson,
  reserveBudget,
} from "@/lib/providerRuntime";

export type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  quantity?: string;
  countries_tags?: string[];
  nutriscore_grade?: string;
  nova_group?: number;
  nutriments?: Record<string, number | string>;
  serving_size?: string;
  image_front_url?: string;
  image_url?: string;
  ingredients_text?: string;
  labels_tags?: string[];
  categories_tags?: string[];
  allergens_tags?: string[];
  traces_tags?: string[];
  ingredients_tags?: string[];
  attribute_groups_en?: { attributes?: { id?: string; status?: string; match?: number; title?: string }[] }[];
};
const FIELDS =
  "code,product_name,brands,quantity,countries_tags,nutriscore_grade,nova_group,nutriments,serving_size,ingredients_text,labels_tags,categories_tags,allergens_tags,traces_tags,image_front_url,image_url,ingredients_tags,attribute_groups_en";
const unknown = (availability: "no_match" | "unavailable"): HealthInfo => ({
  ...UNKNOWN_HEALTH,
  availability,
});

// Normalize spelling and plural forms, never flavors, fat percentages, or ingredient claims.
function nutritionTokens(title: string) {
  return [
    ...new Set(
      productTokens(title).map(
        (token) =>
          ({
            yoghurts: "yogurt",
            yoghurt: "yogurt",
            yogurts: "yogurt",
            sausages: "sausage",
          })[token] ?? token,
      ),
    ),
  ].sort();
}
export function matchProduct(
  product: OffProduct,
  candidate: ProductCandidate,
): boolean {
  if (
    !product.countries_tags?.includes("en:united-states") ||
    !product.product_name ||
    !product.brands
  )
    return false;
  const title = nutritionTokens(candidate.title);
  const brands = product.brands.split(",").map((b) => words(b));
  const brand = brands.find(
    (tokens) => tokens.length && tokens.every((t) => title.includes(t)),
  );
  if (!brand) return false;
  if (
    candidate.brand &&
    !brands.some(
      (tokens) => tokens.join(" ") === words(candidate.brand!).join(" "),
    )
  )
    return false;
  const wanted = title.filter((t) => !brand.includes(t));
  const actual = nutritionTokens(product.product_name).filter(
    (t) => !brand.includes(t),
  );
  // All variant words must agree, including fat percentages, flavors, sweeteners, and preparation.
  return (
    wanted.length > 0 &&
    wanted.length === actual.length &&
    wanted.every((t) => actual.includes(t))
  );
}
export function fromOffProduct(
  product: OffProduct,
  match: "barcode" | "text" | "catalog",
): HealthInfo {
  const n = product.nutriments ?? {};
  const nutrient = (key: string) => {
    const raw = n[`${key}_100g`];
    const value =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && /^\d+(?:\.\d+)?$/.test(raw)
          ? Number(raw)
          : undefined;
    return value !== undefined && Number.isFinite(value) && value >= 0
      ? value
      : undefined;
  };
  const health = classifyHealth({
    nutriScore: product.nutriscore_grade,
    novaGroup: product.nova_group,
    confidence: match === "text" ? "medium" : "high",
    nutrition: {
      protein100g: nutrient("proteins"),
      sugars100g: nutrient("sugars"),
      carbohydrates100g: nutrient("carbohydrates"),
      sodium100g: nutrient("sodium"),
      salt100g: nutrient("salt"),
      fiber100g: nutrient("fiber"),
      energyKcal100g: nutrient("energy-kcal"),
      saturatedFat100g: nutrient("saturated-fat"),
      fat100g: nutrient("fat"),
    },
    servingSize: product.serving_size,
    ingredientsText: product.ingredients_text,
    labelsTags: product.labels_tags,
    categoriesTags: product.categories_tags,
    allergensTags: [
      ...(product.allergens_tags ?? []),
      ...(product.traces_tags ?? []),
    ],
  });
  const barcode = validBarcode(product.code);
  return {
    ...health,
    attributes: Object.fromEntries((product.attribute_groups_en ?? []).flatMap(group =>
      (group.attributes ?? []).filter(attribute =>
        PRODUCT_PREFERENCE_IDS.includes(attribute.id as ProductPreferenceId) &&
        ["known", "unknown", "not-applicable"].includes(attribute.status ?? ""),
      ).map(attribute => [attribute.id, {
        status: attribute.status as ProductAttribute["status"],
        match: attribute.match, title: attribute.title,
      }]),
    )),
    ingredientsTags: product.ingredients_tags,
    availability: "matched",
    source: {
      provider: "open_food_facts",
      barcode,
      productName: product.product_name ?? "Barcode match",
      match,
      fetchedAt: new Date().toISOString(),
      url: barcode
        ? `https://world.openfoodfacts.org/product/${barcode}`
        : undefined,
    },
  };
}
async function getByBarcode(code: string) {
  return getOrSet<OffProduct | null>(
    `off:v4:barcode:${code}`,
    86400 * 7,
    async () => {
      await reserveBudget("off:barcode", 15, 60000);
      const url = new URL(
        `https://world.openfoodfacts.org/api/v3/product/${code}.json`,
      );
      url.searchParams.set("fields", FIELDS);
      try {
        const data = await providerJson<{ product?: OffProduct }>(
          url,
          "Nutrition lookup",
        );
        return data.product &&
          validBarcode(data.product.code)?.padStart(14, "0") ===
            code.padStart(14, "0")
          ? data.product
          : null;
      } catch (error) {
        if (error instanceof ProviderError && error.status === 404) return null;
        throw error;
      }
    },
  );
}
export async function searchCatalog(query: string, preferences: CatalogPreferences = {}) {
  const filters = offSearchParameters(preferences);
  const queryHash = await sha256(JSON.stringify([normalizeQuery(query), filters.toString()]));
  return getOrSet<OffProduct[]>(
    `off:v6:us-search:${queryHash}`,
    86400,
    async () => {
      await reserveBudget("off:search", 10, 60000);
      const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
      for (const [key, value] of Object.entries({
        search_terms: query,
        search_simple: "1",
        api_version: "3.4",
        lc: "en",
        action: "process",
        json: "1",
        page_size: "50",
        tagtype_0: "countries",
        tag_contains_0: "contains",
        tag_0: "united-states",
        fields: FIELDS,
      }))
        url.searchParams.set(key, value);
      for (const [key, value] of filters) url.searchParams.set(key, value);
      const data = await providerJson<{ products?: OffProduct[] }>(
        url,
        "Nutrition search",
      );
      return (data.products ?? []).filter((p) =>
        p.countries_tags?.includes("en:united-states"),
      );
    },
  );
}
export async function enrichProducts(
  candidates: ProductCandidate[],
  query: string,
  signal?: AbortSignal,
): Promise<{
  candidates: ProductCandidate[];
  healthById: Map<string, HealthInfo>;
  warnings: string[];
}> {
  const warnings = new Set<string>();
  let catalog: OffProduct[] = [];
  let catalogUnavailable = false;
  if (candidates.some((c) => !validBarcode(c.upc))) {
    try {
      signal?.throwIfAborted();
      catalog = await searchCatalog(query);
    } catch {
      signal?.throwIfAborted();
      catalogUnavailable = true;
      warnings.add(
        "Nutrition lookup is temporarily unavailable for some products; no missing data has been inferred.",
      );
    }
  }
  const pairs = await mapConcurrent(candidates, 3, async (candidate, index) => {
    signal?.throwIfAborted();
    let matched: OffProduct | undefined;
    let method: "barcode" | "text" = "text";
    let lookupAvailable = !catalogUnavailable;
    try {
      if (validBarcode(candidate.upc)) {
        matched = (await getByBarcode(candidate.upc!)) ?? undefined;
        method = "barcode";
        lookupAvailable = true;
      } else {
        let matches = catalog.filter((product) =>
          matchProduct(product, candidate),
        );
        // A broad category's first page often omits the exact brand. Recover only
        // the first three candidates, sharing the same cache and global search budget.
        if (!matches.length && index < 3) {
          const targetedQuery = productTokens(candidate.title).join(" ");
          if (normalizeQuery(targetedQuery) !== normalizeQuery(query)) {
            const targeted = await searchCatalog(targetedQuery);
            lookupAvailable = true;
            matches = targeted.filter((product) =>
              matchProduct(product, candidate),
            );
          }
        }
        const sameSize = matches.filter((product) =>
          samePackage(
            candidate.package ?? parsePackage(candidate.title),
            parsePackage(product.quantity ?? ""),
          ),
        );
        // Ambiguous matches are not evidence. Exact package matching can resolve a catalog barcode.
        matched =
          sameSize.length === 1
            ? sameSize[0]
            : matches.length === 1
              ? matches[0]
              : undefined;
        if (matched && sameSize.length === 1 && validBarcode(matched.code))
          candidate = { ...candidate, upc: matched.code };
      }
      return {
        candidate,
        health: matched
          ? fromOffProduct(matched, method)
          : unknown(lookupAvailable ? "no_match" : "unavailable"),
      };
    } catch {
      signal?.throwIfAborted();
      warnings.add(
        "Some nutrition lookups were unavailable. Check the package for missing information.",
      );
      return { candidate, health: unknown("unavailable") };
    }
  });
  return {
    candidates: pairs.map((p) => p.candidate),
    healthById: new Map(
      pairs.map((p) => [p.candidate.providerProductId, p.health]),
    ),
    warnings: [...warnings],
  };
}
export async function getHealthForProduct(
  candidate: ProductCandidate,
  query: string,
) {
  return (await enrichProducts([candidate], query)).healthById.get(
    candidate.providerProductId,
  )!;
}
