import { describe, expect, it } from "vitest";
import { offSearchParameters } from "@/lib/offSearchFilters";

const criteria = (params: URLSearchParams) => {
  const result = [];
  for (let i = 1; params.has(`tagtype_${i}`); i++)
    result.push([params.get(`tagtype_${i}`), params.get(`tag_contains_${i}`), params.get(`tag_${i}`)]);
  return result;
};

describe("OFF search filters", () => {
  it("migrates legacy milk and shellfish restrictions to allergen and trace exclusions", () => {
    expect(criteria(offSearchParameters({ allergies: ["dairy", "shellfish"] }))).toEqual([
      ["allergens", "does_not_contain", "en:crustaceans"],
      ["traces", "does_not_contain", "en:crustaceans"],
      ["allergens", "does_not_contain", "en:milk"],
      ["traces", "does_not_contain", "en:milk"],
      ["allergens", "does_not_contain", "en:molluscs"],
      ["traces", "does_not_contain", "en:molluscs"],
    ]);
  });
  it("does not turn soft preferences or FODMAP into provider exclusions", () => {
    expect(offSearchParameters({ productPreferences: { allergens_no_milk: "important", vegan: "very_important" },
      dietModes: ["fodmap", "high_protein"] }).toString()).toBe("");
  });
  it("uses OFF taxonomies for ingredient analysis, labels, and nutrient levels", () => {
    expect(criteria(offSearchParameters({ productPreferences: {
      vegan: "mandatory", labels_organic: "mandatory", low_saturated_fat: "mandatory",
    } }))).toEqual([
      ["labels", "contains", "en:organic"],
      ["nutrient_levels", "contains", "en:saturated-fat-in-low-quantity"],
      ["ingredients_analysis", "contains", "en:vegan"],
    ]);
  });
  it("sends unwanted ingredients to OFF analysis for soft and mandatory preferences", () => {
    const input = { unwantedIngredients: ["Palm oil", "en:garlic", "palm oil"] };
    const soft = offSearchParameters({ ...input, productPreferences: { unwanted_ingredients: "important" } });
    expect(soft.get("attribute_unwanted_ingredients_tags")).toBe("en:garlic,en:palm-oil");
    expect(criteria(soft)).toEqual([]);
    expect(criteria(offSearchParameters({ ...input, productPreferences: { unwanted_ingredients: "mandatory" } }))).toEqual([
      ["ingredients", "does_not_contain", "en:garlic"],
      ["ingredients", "does_not_contain", "en:palm-oil"],
    ]);
  });
  it("normalizes legacy and current restrictions identically for cache isolation", () => {
    expect(offSearchParameters({ allergies: ["dairy"] }).toString()).toBe(
      offSearchParameters({ productPreferences: { allergens_no_milk: "mandatory" } }).toString());
  });
});
