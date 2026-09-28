import type { Allergen, HealthInfo } from "@/lib/types";

export const ALLERGEN_DETAILS: Record<
  Allergen,
  { label: string; icon: string; tags: string[] }
> = {
  peanuts: {
    label: "Peanuts",
    icon: "🥜",
    tags: ["en:peanuts"],
  },
  tree_nuts: {
    label: "Tree Nuts",
    icon: "🌰",
    tags: [
      "en:nuts",
      "en:almonds",
      "en:cashews",
      "en:hazelnuts",
      "en:walnuts",
      "en:pistachios",
      "en:pecan-nuts",
    ],
  },
  dairy: {
    label: "Dairy / Milk",
    icon: "🥛",
    tags: ["en:milk", "en:lactose"],
  },
  eggs: {
    label: "Eggs",
    icon: "🥚",
    tags: ["en:eggs"],
  },
  wheat: {
    label: "Wheat",
    icon: "🌾",
    tags: ["en:gluten", "en:wheat"],
  },
  soy: {
    label: "Soy",
    icon: "🫘",
    tags: ["en:soybeans"],
  },
  shellfish: {
    label: "Shellfish",
    icon: "🦞",
    tags: ["en:crustaceans", "en:molluscs"],
  },
  fish: {
    label: "Fish",
    icon: "🐟",
    tags: ["en:fish"],
  },
  sesame: {
    label: "Sesame",
    icon: "🌱",
    tags: ["en:sesame-seeds"],
  },
};

export function checkAllergens(
  health: HealthInfo,
  _title: string,
  selectedAllergens: Allergen[],
): Allergen[] {
  if (!selectedAllergens || selectedAllergens.length === 0) return [];

  const matched: Allergen[] = [];
  for (const allergen of selectedAllergens) {
    const info = ALLERGEN_DETAILS[allergen];
    if (!info) continue;
    const tagMatch = info.tags.some(tag => health.allergensTags.some(t => t === tag));
    if (tagMatch) matched.push(allergen);
  }

  return matched;
}
