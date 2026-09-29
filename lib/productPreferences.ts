import { PREFERENCE_GROUPS } from "@/lib/preferenceDefinitions";
import { PRODUCT_PREFERENCE_IDS, PREFERENCE_IMPORTANCE } from "@/lib/types";
import type { HealthInfo, ProductPreferenceId, ProductPreferences } from "@/lib/types";

const labels = Object.fromEntries(PREFERENCE_GROUPS.flatMap(g => g.attributes.map(a => [a.id, a.label])));
const importanceOrder = ["not_important", "important", "very_important", "mandatory"] as const;

export function sanitizeProductPreferences(value: unknown): ProductPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, importance]) =>
    PRODUCT_PREFERENCE_IDS.includes(id as ProductPreferenceId) &&
    PREFERENCE_IMPORTANCE.includes(importance as typeof PREFERENCE_IMPORTANCE[number]),
  )) as ProductPreferences;
}

export function evaluateProductPreferences(
  health: HealthInfo,
  preferences: ProductPreferences = {},
) {
  const matchesByImportance = Object.fromEntries(importanceOrder.map((level) => [level, 0])) as Record<(typeof importanceOrder)[number], number>;
  const matches: string[] = [], unknown: string[] = [], unmet: string[] = [], failedMandatory: string[] = [];
  for (const id of PRODUCT_PREFERENCE_IDS) {
    const importance = preferences[id] ?? "not_important";
    if (importance === "not_important") continue;
    const attribute = health.attributes?.[id];
    if (attribute?.status === "not-applicable") continue;
    const known = attribute?.status === "known" &&
      typeof attribute.match === "number" && Number.isFinite(attribute.match) &&
      attribute.match >= 0 && attribute.match <= 100;
    const score = known ? attribute.match! : 50;
    // OFF's own product-search.js classifies mandatory matches <=50 as
    // "may_not_match" or "does_not_match", irrespective of attribute type.
    const matchesRequirement = known && score > 50;
    if (!known) unknown.push(labels[id]);
    else if (matchesRequirement) {
      matches.push(labels[id]);
      matchesByImportance[importance] += 1;
    }
    else unmet.push(labels[id]);
    if (importance === "mandatory" && !matchesRequirement) failedMandatory.push(labels[id]);
  }
  return { active: matches.length + unknown.length + unmet.length > 0, matches, matchesByImportance, unknown, unmet, failedMandatory };
}
