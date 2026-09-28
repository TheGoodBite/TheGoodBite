import { searchGoogleShoppingProducts } from "@/lib/providers/googleShopping";
import { enrichProducts } from "@/lib/providers/openFoodFacts";
import { getOpenPricesForBarcode } from "@/lib/providers/openPrices";
import { deduplicateProducts, withUnitPrice } from "@/lib/products";
import { buildShoppingQuery } from "@/lib/searchPreferences";
import { hasVerifiedNutritionFacts } from "@/lib/health";
import { rankProducts } from "@/lib/scoring";
import { mapConcurrent } from "@/lib/providerRuntime";
import type {
  SearchProductsRequest,
  SearchProductsResponse,
} from "@/lib/types";

export async function searchItem(
  query: string,
  preferences: SearchProductsRequest,
  signal: AbortSignal,
): Promise<SearchProductsResponse["items"][number]> {
  const start = Date.now();
  signal.throwIfAborted();
  const shoppingQuery = buildShoppingQuery(
    query,
    preferences.dietModes ?? [],
    preferences.allergies ?? [],
    preferences.bulkPreference,
  );
  const raw = await searchGoogleShoppingProducts(
    shoppingQuery,
    15,
    preferences.zipCode,
    signal,
  );
  signal.throwIfAborted();
  const unique = deduplicateProducts(raw);
  const enriched = await enrichProducts(unique, query, signal);
  const warnings = new Set(enriched.warnings);
  const matched = deduplicateProducts(enriched.candidates);
  const supported = matched.filter((candidate) =>
    hasVerifiedNutritionFacts(
      enriched.healthById.get(candidate.providerProductId),
    ),
  );
  const missingNutritionCount = matched.length - supported.length;
  if (missingNutritionCount)
    warnings.add(
      `${missingNutritionCount} shopping listing${missingNutritionCount === 1 ? " was" : "s were"} hidden because matched nutrition facts are unavailable.`,
    );
  const candidates = await mapConcurrent(supported, 3, async (candidate) => {
    signal.throwIfAborted();
    if (!candidate.upc || candidate.package?.bulk)
      return withUnitPrice(candidate);
    try {
      const observed = await getOpenPricesForBarcode(
        candidate.upc,
        preferences.zipCode,
      );
      if (observed)
        return withUnitPrice({
          ...candidate,
          estimatedPrice: observed.amount,
          currency: "USD",
          priceSource: "open_prices",
          priceObservation: observed,
          offers: [...(candidate.offers ?? []), observed],
        });
    } catch {
      warnings.add(
        "Some Open Prices lookups were unavailable. Shopping price estimates are retained where available.",
      );
    }
    return withUnitPrice(candidate);
  });
  const all = rankProducts({
    query,
    candidates,
    healthById: enriched.healthById,
    dietModes: preferences.dietModes ?? [],
    allergies: preferences.allergies ?? [],
    bulkPreference: preferences.bulkPreference,
    limit: candidates.length,
  });
  const preferenceExcludedCount = candidates.length - all.length;
  const excludedCount = missingNutritionCount + preferenceExcludedCount;
  if (preferenceExcludedCount)
    warnings.add(
      `${preferenceExcludedCount} option${preferenceExcludedCount === 1 ? "" : "s"} excluded for relevance or preference conflicts.`,
    );
  console.info("meezany.search.item", {
    durationMs: Date.now() - start,
    candidates: raw.length,
    unique: unique.length,
    excluded: excludedCount,
    nutritionMatched: supported.length,
    missingNutrition: missingNutritionCount,
  });
  return {
    query,
    options: all.slice(0, preferences.limitPerItem ?? 10),
    warnings: [...warnings],
    excludedCount,
    ...(!all.length && missingNutritionCount
      ? {
          emptyReason: matched.some(
            (candidate) =>
              enriched.healthById.get(candidate.providerProductId)
                ?.availability === "unavailable",
          )
            ? ("nutrition_unavailable" as const)
            : ("nutrition_missing" as const),
        }
      : {}),
  };
}
