import { containsTerm } from "@/lib/foodEvidence";
import { PREFERENCE_GROUPS } from "@/lib/preferenceDefinitions";
import { PRODUCT_PREFERENCE_IDS, PREFERENCE_IMPORTANCE } from "@/lib/types";
import type { HealthInfo, ProductAttribute, ProductPreferenceId, ProductPreferences } from "@/lib/types";

const labels = Object.fromEntries(PREFERENCE_GROUPS.flatMap(g => g.attributes.map(a => [a.id, a.label])));
const weights = { not_important: 0, important: 1, very_important: 2, mandatory: 4 };

export function sanitizeProductPreferences(value: unknown): ProductPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, importance]) =>
    PRODUCT_PREFERENCE_IDS.includes(id as ProductPreferenceId) &&
    PREFERENCE_IMPORTANCE.includes(importance as typeof PREFERENCE_IMPORTANCE[number]),
  )) as ProductPreferences;
}

function unwantedEvidence(health: HealthInfo, terms: string[]): ProductAttribute {
  if (!terms.length) return { status: "unknown" };
  const text = [health.ingredientsText, ...(health.ingredientsTags ?? []).filter(t => t.startsWith("en:")).map(t => t.slice(3).replaceAll("-", " "))].filter(Boolean).join(" ");
  if (!text.trim()) return { status: "unknown" };
  if (terms.some(term => containsTerm(text, term))) return { status: "known", match: 0 };
  // Missing ingredient analysis cannot establish absence, especially for translations/synonyms.
  if (!health.ingredientsTags?.length) return { status: "unknown" };
  return { status: "known", match: 100 };
}

export function evaluateProductPreferences(
  health: HealthInfo,
  preferences: ProductPreferences = {},
  unwantedIngredients: string[] = [],
) {
  let sum = 0, total = 0;
  const matches: string[] = [], unknown: string[] = [], unmet: string[] = [], failedMandatory: string[] = [];
  for (const id of PRODUCT_PREFERENCE_IDS) {
    const importance = preferences[id] ?? "not_important";
    const weight = weights[importance];
    if (!weight) continue;
    const attribute = id === "unwanted_ingredients"
      ? unwantedEvidence(health, unwantedIngredients)
      : health.attributes?.[id];
    if (attribute?.status === "not-applicable") continue;
    const known = attribute?.status === "known" &&
      typeof attribute.match === "number" && Number.isFinite(attribute.match) &&
      attribute.match >= 0 && attribute.match <= 100;
    const score = known ? attribute.match! : 50;
    const threshold = id.startsWith("allergens_no_") ||
      ["vegan", "vegetarian", "palm_oil_free", "unwanted_ingredients", "labels_organic", "labels_fair_trade"].includes(id)
      ? 100 : 80;
    total += weight;
    sum += score * weight;
    if (!known) unknown.push(labels[id]);
    else if (score >= threshold) matches.push(labels[id]);
    else unmet.push(labels[id]);
    if (importance === "mandatory" && (!known || score < threshold)) failedMandatory.push(labels[id]);
  }
  return { active: total > 0, score: total ? Math.round(sum / total) : 50, matches, unknown, unmet, failedMandatory };
}
