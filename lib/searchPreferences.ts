import type { Allergen, DietMode } from "@/lib/types";

export function buildShoppingQuery(
  query: string,
  modes: DietMode[],
  allergies: Allergen[],
  bulk: "everyday" | "bulk" | "any" = "everyday",
) {
  const hints: string[] = [];
  // Exclusion preferences take priority over nutrition goals. Bound expansion to avoid over-constraining discovery.
  const allergyHints: Partial<Record<Allergen, string>> = {
    dairy: "dairy free",
    peanuts: "peanut free",
    tree_nuts: "tree nut free",
    eggs: "egg free",
    wheat: "wheat free",
    soy: "soy free",
    sesame: "sesame free",
    fish: "fish free",
    shellfish: "shellfish free",
  };
  for (const allergy of allergies)
    if (allergyHints[allergy]) hints.push(allergyHints[allergy]!);
  const labels: Partial<Record<DietMode, string>> = {
    vegan: "vegan",
    vegetarian: "vegetarian",
    gluten_free: "gluten free",
    fodmap: "low FODMAP",
    high_protein: "high protein",
    low_sugar: "low sugar",
    low_carb: "low carb",
    low_sodium: "low sodium",
    diabetes_conscious: "low sugar",
  };
  for (const mode of modes) if (labels[mode]) hints.push(labels[mode]!);
  const base = query.toLowerCase().replace(/-/g, " ");
  const unique = [...new Set(hints)]
    .filter((hint) => !base.includes(hint.toLowerCase()))
    .slice(0, 2);
  return [
    query,
    ...unique,
    bulk === "bulk" && !/\b(bulk|pack|case)\b/i.test(query)
      ? "bulk multipack"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}
