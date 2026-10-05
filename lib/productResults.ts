import { evaluateProductPreferences } from "@/lib/productPreferences";
import { restoreProductPreferences } from "@/lib/preferenceStorage";
import { scoreDietFit } from "@/lib/dietModes";
import type {
  Allergen,
  DietMode,
  HealthInfo,
  ProductCandidate,
  ProductPreferences,
  RankedProduct,
} from "@/lib/types";

export function prepareProducts(input: {
  productPreferences?: ProductPreferences;
  candidates: ProductCandidate[];
  healthById: Map<string, HealthInfo>;
  dietModes: DietMode[];
  allergies?: Allergen[];
  limit: number;
}) {
  const { preferences } = restoreProductPreferences(input);
  const prepared = input.candidates
    .map((candidate) => {
      const health = input.healthById.get(candidate.providerProductId);
      if (!health) throw new Error("Missing product nutrition state");
      return {
        candidate,
        health,
        preferenceFit: evaluateProductPreferences(health, preferences),
        dietFit: scoreDietFit(health, input.dietModes, candidate.title),
      };
    })
    .filter(
      ({ dietFit, preferenceFit }) =>
        !preferenceFit.failedMandatory.length &&
        !(input.dietModes.includes("fodmap") && dietFit.evidence?.fodmap === "conflict"),
    );

  return prepared
    .map(({ candidate, health, dietFit, preferenceFit }) => {
      const allergenAttributes = Object.keys(preferences).filter(
        (id) =>
          id.startsWith("allergens_no_") &&
          preferences[id as keyof ProductPreferences] !== "not_important",
      );
      const allergyStatus = allergenAttributes.length
        ? allergenAttributes.every(
            (id) =>
              health.attributes?.[id as keyof ProductPreferences]?.status === "known" &&
              health.attributes?.[id as keyof ProductPreferences]?.match === 100,
          )
          ? ("not_detected" as const)
          : ("unknown" as const)
        : undefined;
      const warnings = [...dietFit.warnings];
      if (preferenceFit.unknown.length)
        warnings.push(`Preference evidence missing: ${preferenceFit.unknown.join(", ")}.`);
      if (allergyStatus === "unknown")
        warnings.push("Allergen evidence is incomplete. Verify the package.");
      if (allergyStatus === "not_detected")
        warnings.push(
          "No selected allergen detected in available data. This does not establish allergy safety.",
        );

      const product: RankedProduct = {
        ...candidate,
        preferenceFit: preferenceFit.active
          ? {
              matches: preferenceFit.matches,
              unknown: preferenceFit.unknown,
              unmet: preferenceFit.unmet,
            }
          : undefined,
        health,
        dietFit: { ...dietFit, warnings },
        allergyStatus,
        explanation:
          "Shown in the order returned by Open Food Facts, after product eligibility and mandatory preference checks. Nutrition, preference matches, and prices do not change this order.",
      };
      return product;
    })
    .slice(0, input.limit);
}
