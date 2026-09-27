import type { HealthInfo } from "@/lib/types";

export type ProductTag = {
  id: string;
  label: string;
  icon: string;
  color: "green" | "amber" | "red" | "blue" | "purple";
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
