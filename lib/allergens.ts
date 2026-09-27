import type { Allergen, HealthInfo } from "@/lib/types";

export const ALLERGEN_DETAILS: Record<Allergen, { label: string; icon: string; keywords: string[]; tags: string[] }> = {
  peanuts: {
    label: "Peanuts",
    icon: "🥜",
    keywords: ["peanut", "groundnut", "arachis"],
    tags: ["en:peanuts"]
  },
  tree_nuts: {
    label: "Tree Nuts",
    icon: "🌰",
    keywords: ["almond", "cashew", "walnut", "pecan", "pistachio", "macadamia", "hazelnut", "brazil nut", "chestnut"],
    tags: ["en:nuts", "en:almonds", "en:cashews", "en:hazelnuts", "en:walnuts", "en:pistachios", "en:pecan-nuts"]
  },
  dairy: {
    label: "Dairy / Milk",
    icon: "🥛",
    keywords: ["milk", "dairy", "butter", "cheese", "cream", "whey", "casein", "lactose", "yogurt"],
    tags: ["en:milk", "en:lactose"]
  },
  eggs: {
    label: "Eggs",
    icon: "🥚",
    keywords: ["egg", "albumin", "yolk", "mayonnaise", "ovalbumin"],
    tags: ["en:eggs"]
  },
  wheat: {
    label: "Wheat",
    icon: "🌾",
    keywords: ["wheat", "gluten", "semolina", "spelt", "farro", "kamut", "flour"],
    tags: ["en:gluten", "en:wheat"]
  },
  soy: {
    label: "Soy",
    icon: "🫘",
    keywords: ["soy", "soya", "soybean", "tofu", "edamame", "lecithin"],
    tags: ["en:soybeans"]
  },
  shellfish: {
    label: "Shellfish",
    icon: "🦞",
    keywords: ["shrimp", "crab", "lobster", "prawn", "clam", "mussel", "oyster", "scallop", "crawfish"],
    tags: ["en:crustaceans", "en:molluscs"]
  },
  fish: {
    label: "Fish",
    icon: "🐟",
    keywords: ["fish", "salmon", "tuna", "cod", "anchovy", "sardine", "trout", "halibut", "tilapia", "haddock"],
    tags: ["en:fish"]
  },
  sesame: {
    label: "Sesame",
    icon: "🌱",
    keywords: ["sesame", "tahini", "benne"],
    tags: ["en:sesame-seeds"]
  }
};

export function checkAllergens(health: HealthInfo, title: string, selectedAllergens: Allergen[]): Allergen[] {
  if (!selectedAllergens || selectedAllergens.length === 0) return [];

  const matched: Allergen[] = [];
  const text = [title, health.ingredientsText ?? ""].join(" ").toLowerCase();
  const offTags = health.allergensTags ?? [];

  for (const allergen of selectedAllergens) {
    const info = ALLERGEN_DETAILS[allergen];
    if (!info) continue;

    // Check OFF tag matches
    const tagMatch = info.tags.some(tag => offTags.some(t => t.includes(tag.replace("en:", ""))));
    // Check keyword text matches in title or ingredient text
    const textMatch = info.keywords.some(kw => text.includes(kw));

    if (tagMatch || textMatch) {
      matched.push(allergen);
    }
  }

  return matched;
}
