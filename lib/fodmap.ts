import { containsTerm, withoutFreeClaims } from "@/lib/foodEvidence";
import type { HealthInfo } from "@/lib/types";

// Potential FODMAP ingredient signals; not a validated serving-size database.
export const HIGH_FODMAP_TERMS = {
  fructans_gos: [
    "garlic",
    "onion",
    "shallot",
    "leek",
    "scallion",
    "wheat",
    "rye",
    "barley",
    "inulin",
    "chicory",
    "cashew",
    "pistachio",
    "chamomile",
    "artichoke",
    "asparagus",
    "beetroot",
    "brussels sprout",
    "cabbage",
    "fennel",
    "snow pea",
    "kidney bean",
    "black bean",
    "chickpea",
    "lentil",
    "soybean",
    "baked bean",
  ],
  fructose: [
    "high fructose corn syrup",
    "hfcs",
    "honey",
    "agave",
    "apple",
    "pear",
    "mango",
    "watermelon",
    "fig",
    "cherry",
    "blackberry",
    "sugar snap pea",
  ],
  polyols: [
    "sorbitol",
    "mannitol",
    "xylitol",
    "maltitol",
    "erythritol",
    "isomalt",
    "avocado",
    "cauliflower",
    "mushroom",
    "peach",
    "plum",
    "prune",
    "apricot",
    "nectarine",
  ],
  lactose: [
    "milk",
    "condensed milk",
    "evaporated milk",
    "ice cream",
    "soft cheese",
    "cottage cheese",
    "ricotta",
    "yogurt",
    "custard",
  ],
};

// A keyword screen identifies possible conflicts, never serving-level clinical suitability.
export function evaluateFodmapFit(health: HealthInfo, title: string) {
  const labels = health.labelsTags.join(" ");
  const certified = /\blow[- ]fodmap\b/i.test(labels);
  const text = withoutFreeClaims(
    [title, health.ingredientsText ?? ""].join(" "),
    Object.values(HIGH_FODMAP_TERMS).flat(),
  );
  const lactoseFree = /\blactose[- ]free\b/i.test(
    [title, labels, health.ingredientsText].join(" "),
  );
  const detected = Object.entries(HIGH_FODMAP_TERMS).flatMap(
    ([group, terms]) =>
      group === "lactose" && lactoseFree
        ? []
        : terms.filter((term) => containsTerm(text, term)),
  );
  const uniqueDetected = [...new Set(detected)];
  const status = uniqueDetected.length
    ? ("conflict" as const)
    : certified
      ? ("match" as const)
      : ("unknown" as const);
  return {
    status,
    score: status === "conflict" ? 10 : status === "match" ? 90 : 45,
    match: status === "match",
    detectedHighFodmap: uniqueDetected,
    warnings:
      status === "conflict"
        ? [
            `Possible high-FODMAP ingredients (${uniqueDetected.slice(0, 3).join(", ")}); suitability depends on serving size and preparation.`,
          ]
        : status === "match"
          ? ["Low-FODMAP label found; check the package and serving guidance."]
          : [
              "FODMAP suitability unknown. Ingredient screening alone cannot establish a low-FODMAP serving.",
            ],
  };
}
