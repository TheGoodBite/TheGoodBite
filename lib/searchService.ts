import { discoverNutritionProducts } from "@/lib/catalogDiscovery";
import { getOpenPricesForBarcode } from "@/lib/providers/openPrices";
import { withUnitPrice } from "@/lib/products";
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
  let catalog: Awaited<ReturnType<typeof discoverNutritionProducts>>;
  try {
    catalog = await discoverNutritionProducts(query, signal);
  } catch {
    signal.throwIfAborted();
    return {
      query,
      options: [],
      emptyReason: "nutrition_unavailable",
      warnings: [
        "Nutrition catalog lookup is temporarily unavailable. Please try again shortly.",
      ],
    };
  }
  if (!catalog.candidates.length)
    return {
      query,
      options: [],
      emptyReason: "nutrition_missing",
      warnings: [
        "No relevant US-market products with nutrition facts were found.",
      ],
    };
  const warnings = new Set<string>();
  const rank = (candidates: typeof catalog.candidates, limit: number) =>
    rankProducts({
      query,
      candidates,
      healthById: catalog.healthById,
      productPreferences: preferences.productPreferences,
      unwantedIngredients: preferences.unwantedIngredients,
      dietModes: preferences.dietModes ?? [],
      allergies: preferences.allergies ?? [],
      bulkPreference: preferences.bulkPreference,
      limit,
    });
  const eligible = rank(catalog.candidates, catalog.candidates.length);
  const excludedCount = catalog.candidates.length - eligible.length;
  if (excludedCount)
    warnings.add(
      `${excludedCount} catalog option${excludedCount === 1 ? "" : "s"} excluded for relevance, preference conflicts, or missing mandatory evidence.`,
    );
  const selected = eligible.slice(
    0,
    Math.min(preferences.limitPerItem ?? 10, 20),
  );
  const withPrices = await mapConcurrent(selected, 3, async (product) => {
    signal.throwIfAborted();
    let candidate: typeof product = product;
    if (candidate.upc && !candidate.package?.bulk) {
      try {
        const observed = await getOpenPricesForBarcode(
          candidate.upc,
          preferences.zipCode,
        );
        if (observed)
          candidate = {
            ...candidate,
            estimatedPrice: observed.amount,
            currency: "USD",
            priceSource: "open_prices",
            priceObservation: observed,
            offers: [...(candidate.offers ?? []), observed],
          };
      } catch {
        warnings.add(
          "Some Open Prices lookups were unavailable. Missing prices remain unknown.",
        );
      }
    }
    return withUnitPrice(candidate);
  });
  const options = rank(withPrices, preferences.limitPerItem ?? 10);
  if (options.some((product) => product.estimatedPrice === null))
    warnings.add(
      "Some products have nutrition facts but no verified local price. Availability is not confirmed.",
    );
  console.info("meezany.search.item", {
    durationMs: Date.now() - start,
    discovery: "nutrition_catalog",
    nutritionMatched: catalog.candidates.length,
    excluded: excludedCount,
    options: options.length,
  });
  return { query, options, warnings: [...warnings], excludedCount };
}
