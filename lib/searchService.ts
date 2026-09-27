import { searchGoogleShoppingProducts } from "@/lib/providers/googleShopping";
import { enrichProducts } from "@/lib/providers/openFoodFacts";
import { getOpenPricesForBarcode } from "@/lib/providers/openPrices";
import { deduplicateProducts, withUnitPrice } from "@/lib/products";
import { buildShoppingQuery } from "@/lib/searchPreferences";
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
  const candidates = await mapConcurrent(
    deduplicateProducts(enriched.candidates),
    3,
    async (candidate) => {
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
    },
  );
  const all = rankProducts({
    query,
    candidates,
    healthById: enriched.healthById,
    dietModes: preferences.dietModes ?? [],
    allergies: preferences.allergies ?? [],
    bulkPreference: preferences.bulkPreference,
    limit: candidates.length,
  });
  const excludedCount = candidates.length - all.length;
  if (excludedCount)
    warnings.add(
      `${excludedCount} option${excludedCount === 1 ? "" : "s"} excluded for relevance or preference conflicts.`,
    );
  console.info("meezany.search.item", {
    durationMs: Date.now() - start,
    candidates: raw.length,
    unique: unique.length,
    excluded: excludedCount,
    nutritionMatched: candidates.filter(
      (c) => enriched.healthById.get(c.providerProductId)?.source,
    ).length,
  });
  return {
    query,
    options: all.slice(0, preferences.limitPerItem ?? 10),
    warnings: [...warnings],
    excludedCount,
  };
}
