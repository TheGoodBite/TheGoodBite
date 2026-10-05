import { restoreProductPreferences } from "@/lib/preferenceStorage";
import type { SearchProductsRequest } from "@/lib/types";

export type CatalogPreferences = Pick<SearchProductsRequest,
  "allergies" | "dietModes" | "productPreferences" | "unwantedIngredients">;

// These are Open Food Facts taxonomy IDs, not ingredient/title heuristics.
// Keep soft preferences out of the query: they annotate product details without changing eligibility or order.
export function offSearchParameters(preferences: CatalogPreferences = {}) {
  const { preferences: attributes } = restoreProductPreferences(preferences);
  const params = new URLSearchParams();
  let index = 1; // country is criterion 0
  const tag = (type: string, value: string, exclude = false) => {
    params.set(`tagtype_${index}`, type);
    params.set(`tag_contains_${index}`, exclude ? "does_not_contain" : "contains");
    params.set(`tag_${index++}`, value);
  };
  for (const [id, importance] of Object.entries(attributes).sort()) {
    if (importance !== "mandatory") continue;
    if (id.startsWith("allergens_no_")) {
      const allergen = `en:${id.slice("allergens_no_".length).replaceAll("_", "-")}`;
      tag("allergens", allergen, true);
      tag("traces", allergen, true);
    } else if (["vegan", "vegetarian", "palm_oil_free"].includes(id)) {
      tag("ingredients_analysis", `en:${id.replaceAll("_", "-")}`);
    } else if (id === "labels_organic") {
      tag("labels", "en:organic");
    } else if (id === "labels_fair_trade") {
      tag("labels", "en:fair-trade");
    } else if (["low_salt", "low_sugars", "low_fat", "low_saturated_fat"].includes(id)) {
      tag("nutrient_levels", `en:${id.slice(4).replaceAll("_", "-")}-in-low-quantity`);
    }
  }
  const unwanted = [...new Set((preferences.unwantedIngredients ?? [])
    .map(value => value.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter(Boolean).map(value => value.includes(":") ? value : `en:${value}`))].sort();
  if (unwanted.length) {
    params.set("attribute_unwanted_ingredients_tags", unwanted.join(","));
    if (attributes.unwanted_ingredients === "mandatory")
      for (const ingredient of unwanted) tag("ingredients", ingredient, true);
  }
  return params;
}
