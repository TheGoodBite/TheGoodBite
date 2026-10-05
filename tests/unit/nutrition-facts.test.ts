import { describe, expect, it } from "vitest";
import { nutritionFacts } from "@/lib/nutritionFacts";
import { hasVerifiedNutritionFacts, UNKNOWN_HEALTH } from "@/lib/health";
import { fromOffProduct } from "@/lib/providers/openFoodFacts";

describe("serving facts", () => {
  it("uses explicit OFF serving nutrients, including zero", () => {
    const health = fromOffProduct({ serving_size: "2 links (85 g)", serving_quantity: 85,
      nutriments: { proteins_100g: 20, proteins_serving: 17, sugars_serving: 0, sodium_serving: 0.4 } }, "catalog");
    expect(nutritionFacts(health, "serving")).toMatchObject({ basis: "serving", values: { protein: 17, sugars: 0, sodium: 0.4 } });
    expect(nutritionFacts(health, "100g").values.protein).toBe(20);
  });
  it("scales only an explicit serving quantity, never guesses from portion text", () => {
    const health = { ...UNKNOWN_HEALTH, servingSize: "one bowl", nutrition: { protein100g: 10 } };
    expect(nutritionFacts(health, "serving")).toMatchObject({ basis: "100g", servingAvailable: false });
    expect(nutritionFacts({ ...health, servingQuantity: 30 }, "serving").values.protein).toBe(3);
  });
  it("accepts a catalog record with serving-only facts", () => {
    expect(hasVerifiedNutritionFacts(fromOffProduct({ product_name: "Peanuts", nutriments: { proteins_serving: 7 } }, "catalog"))).toBe(true);
  });
  it("does not render invalid data or treat it as zero", () => {
    expect(nutritionFacts({ ...UNKNOWN_HEALTH, servingQuantity: NaN, nutrition: { protein100g: Infinity, sugars100g: -1 }, nutritionPerServing: { sodium: NaN } }, "serving").values).toEqual({});
  });
});
