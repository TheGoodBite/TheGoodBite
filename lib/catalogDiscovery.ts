import { searchCatalog, fromOffProduct } from "@/lib/providers/openFoodFacts";
import { hasVerifiedNutritionFacts } from "@/lib/health";
import {
  deduplicateProducts,
  parsePackage,
  validBarcode,
  words,
} from "@/lib/products";
import type { CatalogPreferences } from "@/lib/offSearchFilters";
import type { HealthInfo, ProductCandidate } from "@/lib/types";

export async function discoverNutritionProducts(
  query: string,
  signal: AbortSignal,
  preferences: CatalogPreferences = {},
) {
  signal.throwIfAborted();
  const products = await searchCatalog(query, preferences);
  signal.throwIfAborted();
  const healthById = new Map<string, HealthInfo>();
  const candidates: ProductCandidate[] = [];
  for (const product of products) {
    const barcode = validBarcode(product.code);
    if (
      !barcode ||
      !product.product_name?.trim() ||
      !product.countries_tags?.includes("en:united-states")
    )
      continue;
    const health = fromOffProduct(product, "catalog");
    if (!hasVerifiedNutritionFacts(health)) continue;
    const brand = product.brands?.split(",")[0]?.trim();
    const branded =
      brand &&
      !words(brand).every((token) =>
        words(product.product_name!).includes(token),
      );
    const pack = parsePackage(product.quantity ?? "");
    const candidate: ProductCandidate = {
      provider: "open_food_facts",
      providerProductId: barcode,
      title: [branded ? brand : "", product.product_name]
        .filter(Boolean)
        .join(" "),
      brand,
      upc: barcode,
      market: "US-catalog",
      estimatedPrice: null,
      package: pack,
      packageSize: product.quantity,
      imageUrl: [product.image_front_url, product.image_url].find(
        (url) => url && /^https:\/\//i.test(url),
      ),
      offers: [],
    };
    candidates.push(candidate);
    healthById.set(barcode, health);
  }
  return { candidates: deduplicateProducts(candidates), healthById };
}
