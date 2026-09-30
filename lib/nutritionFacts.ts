import type { HealthInfo, NutritionAmounts } from "@/lib/types";

const nutrients = ["protein", "sugars", "carbohydrates", "sodium", "salt", "fiber", "energyKcal", "saturatedFat", "fat"] as const;
const valid = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

// Only use catalog serving nutrients or an explicit catalog serving quantity.
// Text such as "one bowl" is never interpreted as a guessed weight.
export function nutritionFacts(health: HealthInfo, basis: "serving" | "100g") {
  const per100g: NutritionAmounts = {};
  const perServing: NutritionAmounts = {};
  for (const nutrient of nutrients) {
    const value = health.nutrition[`${nutrient}100g`];
    if (valid(value)) per100g[nutrient] = value;
    const serving = health.nutritionPerServing?.[nutrient];
    if (valid(serving)) perServing[nutrient] = serving;
    else if (valid(value) && valid(health.servingQuantity) && health.servingQuantity > 0)
      perServing[nutrient] = value * health.servingQuantity / 100;
  }
  const servingAvailable = Object.keys(perServing).length > 0;
  return {
    values: basis === "serving" && servingAvailable ? perServing : per100g,
    servingAvailable,
    basis: basis === "serving" && servingAvailable ? "serving" as const : "100g" as const,
  };
}
