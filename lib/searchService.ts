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
    catalog = await discoverNutritionProducts(query, signal, preferences);
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
  const warnings = new Set<string>();
  const rank = (source: typeof catalog, limit: number) =>
    rankProducts({
      query,
      candidates: source.candidates,
      healthById: source.healthById,
      productPreferences: preferences.productPreferences,
      unwantedIngredients: preferences.unwantedIngredients,
      dietModes: preferences.dietModes ?? [],
      allergies: preferences.allergies ?? [],
      bulkPreference: preferences.bulkPreference,
      limit,
    });
  const preview = rank(catalog, 3);
  // Broad text searches can bury highly rated, relevant products after the first
  // OFF page. Fetch one additional page only when the first page has no A/B pick.
  const hasStrongGrade = preview.some(
    (product) => product.health.nutriScore === "a" || product.health.nutriScore === "b",
  );
  const hasLowerKnownGrade = preview.some((product) =>
    ["c", "d", "e"].includes(product.health.nutriScore),
  );
  if (hasLowerKnownGrade && !hasStrongGrade) {
    try {
      const nextPage = await discoverNutritionProducts(query, signal, preferences, 2);
      const seen = new Set(catalog.candidates.map((candidate) => candidate.providerProductId));
      catalog = {
        candidates: [...catalog.candidates, ...nextPage.candidates.filter((candidate) => !seen.has(candidate.providerProductId))],
        healthById: new Map([...catalog.healthById, ...nextPage.healthById]),
      };
    } catch {
      signal.throwIfAborted();
      warnings.add("A second Open Food Facts results page could not be checked.");
    }
  }
  if (!catalog.candidates.length)
    return {
      query,
      options: [],
      emptyReason: "nutrition_missing",
      warnings: [
        "Open Food Facts returned no US-market products with nutrition facts matching this search and its filters.",
      ],
    };
  const eligible = rank(catalog, catalog.candidates.length);
  const excludedCount = catalog.candidates.length - eligible.length;
  if (excludedCount)
    warnings.add(
      `${excludedCount} catalog option${excludedCount === 1 ? "" : "s"} excluded by Open Food Facts preference evidence or the FODMAP screen.`,
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
  const options = rank(
    { candidates: withPrices, healthById: catalog.healthById },
    preferences.limitPerItem ?? 10,
  );
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
