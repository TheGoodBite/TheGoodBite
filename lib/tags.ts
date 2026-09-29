import type { HealthInfo } from "@/lib/types";

export type ProductTag = {
  id: string;
  label: string;
  icon: string;
  color: "green" | "amber" | "red" | "blue" | "purple";
};

export const TAG_EXPLANATIONS: Record<string, string> = {
  organic: "An organic claim appears in the product name, ingredients, or catalog labels. Check the package for certification details.",
  vegan: "The catalog labels or product description identify this as vegan. This describes dietary suitability; it does not measure overall nutritional quality.",
  vegetarian: "The catalog labels identify this as vegetarian. Check the ingredients for your dietary requirements.",
  gluten_free: "A gluten-free claim appears in the catalog labels or product description. Check the package for allergen and cross-contact information.",
  non_gmo: "A non-GMO claim appears in the catalog labels or product description. This claim does not measure nutritional quality or processing level.",
  high_protein: "The catalog lists at least 10 g of protein per 100 g. The amount in your serving depends on the portion size.",
  sweeteners: "The ingredients list includes a sweetener or sugar substitute. Open the Ingredients tab to see which ones are listed.",
  nova4: "The catalog assigns NOVA group 4, the ultra-processed category. NOVA describes the extent and purpose of food processing, separately from Nutri-Score.",
  high_sugar: "The catalog lists more than 15 g of sugars per 100 g. This is the app’s flag threshold; check the serving size to understand your portion.",
  high_sodium: "The catalog lists more than 500 mg of sodium per 100 g. This is the app’s flag threshold; the amount in your serving depends on the portion size.",
  spicy: "The name, ingredients, or catalog categories mention a spicy ingredient or flavor. This is a flavor attribute.",
  bulk: "The product name suggests a pack or multiple items. Check the package size and unit price when comparing options.",
};

const ARTIFICIAL_SWEETENERS = [
  "sucralose",
  "aspartame",
  "acesulfame",
  "saccharin",
  "stevia",
  "monk fruit",
  "erythritol",
  "xylitol",
  "sorbitol",
  "maltitol",
  "mannitol"
];

const SPICY_TERMS = ["spicy", "chili", "chilli", "jalapeño", "jalapeno", "habanero", "sriracha", "hot sauce", "cayenne", "tabasco", "chipotle"];

export function extractTags(health: HealthInfo, title: string): ProductTag[] {
  const tags: ProductTag[] = [];
  const text = [
    title,
    health.ingredientsText ?? "",
    ...(health.labelsTags ?? []),
    ...(health.categoriesTags ?? [])
  ].join(" ").toLowerCase();

  // 1. Organic
  if ((/\borganic\b/.test(text) && !/\bnon[- ]organic\b/.test(text)) || (health.labelsTags ?? []).some(t => ["en:organic", "en:eu-organic", "en:usda-organic"].includes(t))) {
    tags.push({ id: "organic", label: "Organic", icon: "🌿", color: "green" });
  }

  // 2. Vegan / Vegetarian
  if ((health.labelsTags ?? []).some(t => t.includes("vegan")) || text.includes("100% vegan")) {
    tags.push({ id: "vegan", label: "Vegan", icon: "🌱", color: "green" });
  } else if ((health.labelsTags ?? []).some(t => t.includes("vegetarian"))) {
    tags.push({ id: "vegetarian", label: "Vegetarian", icon: "🥦", color: "green" });
  }

  // 3. Gluten-Free
  if (text.includes("gluten-free") || text.includes("gluten free") || (health.labelsTags ?? []).some(t => t.includes("gluten-free"))) {
    tags.push({ id: "gluten_free", label: "Gluten-Free", icon: "🌾", color: "green" });
  }

  // 4. Non-GMO
  if (text.includes("non-gmo") || text.includes("gmo free") || (health.labelsTags ?? []).some(t => ["en:non-gmo", "en:no-gmos", "en:non-gmo-project"].includes(t))) {
    tags.push({ id: "non_gmo", label: "Non-GMO", icon: "🧬", color: "blue" });
  }

  // 5. High Protein
  if ((health.nutrition?.protein100g ?? 0) >= 10) {
    tags.push({ id: "high_protein", label: "High Protein", icon: "💪", color: "green" });
  }

  // 6. Artificial Sweeteners / Sugar-free substitutes
  if (ARTIFICIAL_SWEETENERS.some(sw => text.includes(sw))) {
    tags.push({ id: "sweeteners", label: "Sweeteners", icon: "🍬", color: "amber" });
  }

  // 7. Ultra-Processed (NOVA 4)
  if (health.novaGroup === 4) {
    tags.push({ id: "nova4", label: "Ultra-Processed", icon: "⚠️", color: "red" });
  }

  // 8. High Sugar
  if ((health.nutrition?.sugars100g ?? 0) > 15) {
    tags.push({ id: "high_sugar", label: "High Sugar", icon: "🍭", color: "red" });
  }

  // 9. High Sodium
  if ((health.nutrition?.sodium100g ?? 0) > 0.5) {
    tags.push({ id: "high_sodium", label: "High Sodium", icon: "🧂", color: "amber" });
  }

  // 10. Spicy
  if (SPICY_TERMS.some(term => text.includes(term))) {
    tags.push({ id: "spicy", label: "Spicy", icon: "🌶️", color: "amber" });
  }

  // 11. Bulk / Multi-pack
  if (/(\d+)\s*(?:pack|ct|count|pk|bars|cans)/i.test(title)) {
    tags.push({ id: "bulk", label: "Bulk Pack", icon: "📦", color: "purple" });
  }

  return tags;
}
