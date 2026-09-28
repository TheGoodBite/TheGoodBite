import { ALLERGENS, DIET_MODES } from "@/lib/types";
import type { Allergen, DietMode, ProductPreferenceId, ProductPreferences } from "@/lib/types";
import { sanitizeProductPreferences } from "@/lib/productPreferences";

const allergenPreferences: Record<Allergen, ProductPreferenceId[]> = {
  peanuts: ["allergens_no_peanuts"], tree_nuts: ["allergens_no_nuts"],
  dairy: ["allergens_no_milk"], eggs: ["allergens_no_eggs"], wheat: ["allergens_no_gluten"],
  soy: ["allergens_no_soybeans"], shellfish: ["allergens_no_crustaceans", "allergens_no_molluscs"],
  fish: ["allergens_no_fish"], sesame: ["allergens_no_sesame_seeds"],
};
const overlappingModes: Partial<Record<DietMode, { id: ProductPreferenceId; importance: "important" | "mandatory" }>> = {
  low_sugar: { id: "low_sugars", importance: "important" },
  low_sodium: { id: "low_salt", importance: "important" },
  vegan: { id: "vegan", importance: "mandatory" },
  vegetarian: { id: "vegetarian", importance: "mandatory" },
  gluten_free: { id: "allergens_no_gluten", importance: "mandatory" },
};
export const EXTRA_DIET_MODES = DIET_MODES.filter(mode => !overlappingModes[mode]);

export function restoreProductPreferences(saved: {
  productPreferences?: unknown; allergies?: unknown; dietModes?: unknown;
} | null) {
  const preferences: ProductPreferences = sanitizeProductPreferences(saved?.productPreferences);
  const allergies = Array.isArray(saved?.allergies) ? saved.allergies : [];
  for (const allergen of allergies)
    if (ALLERGENS.includes(allergen))
      for (const id of allergenPreferences[allergen as Allergen])
        preferences[id] ??= "mandatory";
  const modes: DietMode[] = [];
  for (const mode of Array.isArray(saved?.dietModes) ? saved.dietModes : []) {
    if (!DIET_MODES.includes(mode)) continue;
    const replacement = overlappingModes[mode as DietMode];
    if (replacement) preferences[replacement.id] ??= replacement.importance;
    else if (!modes.includes(mode)) modes.push(mode);
  }
  return { preferences, modes };
}
