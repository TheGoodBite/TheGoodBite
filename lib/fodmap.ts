import type { HealthInfo } from "@/lib/types";

// High FODMAP terms derived from oseparovic/fodmap_list and Monash University guidelines
export const HIGH_FODMAP_TERMS = {
  fructans_gos: [
    "garlic", "onion", "shallot", "leek", "scallion", "wheat", "rye", "barley",
    "inulin", "chicory", "cashew", "pistachio", "chamomile", "artichoke", "asparagus",
    "beetroot", "brussels sprout", "cabbage", "fennel", "snow pea", "kidney bean",
    "black bean", "chickpea", "lentil", "soybean", "baked bean"
  ],
  fructose: [
    "high fructose corn syrup", "hfcs", "honey", "agave", "apple", "pear", "mango",
    "watermelon", "fig", "cherry", "blackberry", "sugar snap pea"
  ],
  polyols: [
    "sorbitol", "mannitol", "xylitol", "maltitol", "erythritol", "isomalt",
    "avocado", "cauliflower", "mushroom", "peach", "plum", "prune", "apricot", "nectarine"
  ],
  lactose: [
    "milk", "condensed milk", "evaporated milk", "ice cream", "soft cheese",
    "cottage cheese", "ricotta", "yogurt", "custard"
  ]
};

const ALL_HIGH_FODMAP_KEYWORDS = Object.values(HIGH_FODMAP_TERMS).flat();

export function evaluateFodmapFit(health: HealthInfo, title: string): {
  score: number;
  match: boolean;
  detectedHighFodmap: string[];
  warnings: string[];
} {
  const text = [
    title,
    health.ingredientsText ?? "",
    ...(health.categoriesTags ?? [])
  ].join(" ").toLowerCase();

  const detected: string[] = [];

  for (const term of ALL_HIGH_FODMAP_KEYWORDS) {
    if (text.includes(term)) {
      detected.push(term);
    }
  }

  // Deduplicate
  const uniqueDetected = Array.from(new Set(detected));

  const match = uniqueDetected.length === 0;
  const score = match ? 90 : Math.max(0, 80 - uniqueDetected.length * 25);
  const warnings: string[] = [];

  if (!match) {
    warnings.push(`Contains high-FODMAP ingredients (${uniqueDetected.slice(0, 3).join(", ")})`);
  } else {
    warnings.push("FODMAP evaluation is heuristic (β Beta). Always check label.");
  }

  return {
    score,
    match,
    detectedHighFodmap: uniqueDetected,
    warnings
  };
}
