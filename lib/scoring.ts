import { evaluateProductPreferences } from "@/lib/productPreferences";
import { restoreProductPreferences } from "@/lib/preferenceStorage";
import { scoreDietFit } from "@/lib/dietModes";
import { scoreHealth } from "@/lib/health";
import type {
  Allergen,
  DietMode,
  HealthInfo,
  ProductCandidate,
  ProductPreferences,
  RankedProduct,
} from "@/lib/types";
import { clamp } from "@/lib/utils";
import { words } from "@/lib/products";

export function rankProducts(input: {
  query: string;
  productPreferences?: ProductPreferences;
  unwantedIngredients?: string[];
  candidates: ProductCandidate[];
  healthById: Map<string, HealthInfo>;
  dietModes: DietMode[];
  allergies?: Allergen[];
  boughtProductIds?: Set<string>;
  limit: number;
  bulkPreference?: "everyday" | "bulk" | "any";
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
    .map(({ candidate, health, dietFit, preferenceFit }): RankedProduct => {
      const relevance = scoreRelevance(input.query, candidate);
      // Compare equivalent unit types, never dollars per bottle against dollars per case.
      const peers = prepared
        .map((p) => p.candidate)
        .filter((p) =>
          candidate.unitPrice
            ? p.unitPrice?.unit === candidate.unitPrice.unit
            : !p.unitPrice &&
              (p.package?.count ?? 1) === (candidate.package?.count ?? 1),
        );
      const amounts = peers
        .map((p) => p.unitPrice?.amount ?? p.estimatedPrice)
        .filter((n): n is number => n != null && Number.isFinite(n));
      const amount = candidate.unitPrice?.amount ?? candidate.estimatedPrice;
      const price =
        amount === null || !amounts.length
          ? 25
          : Math.min(...amounts) === Math.max(...amounts)
            ? 80
            : Math.round(
                (1 -
                  (amount - Math.min(...amounts)) /
                    (Math.max(...amounts) - Math.min(...amounts))) *
                  100,
              );
      const healthScore = scoreHealth(health);
      const healthKnown =
        health.nutriScore !== "unknown" || health.novaGroup != null;
      const diet = input.dietModes.length ? dietFit.score : 50;
      const history = input.boughtProductIds?.has(candidate.providerProductId)
        ? 10
        : 0;
      const bulkPreference = /\b(bulk|pack|case)\b/i.test(input.query)
        ? "any"
        : (input.bulkPreference ?? "everyday");
      const bulkPenalty =
        bulkPreference === "everyday" && candidate.package?.bulk
          ? 15
          : bulkPreference === "bulk" && !candidate.package?.bulk
            ? 10
            : 0;
      const score =
        relevance * 0.3 +
        price * 0.15 +
        diet * 0.2 +
        (healthKnown ? (clamp(healthScore, 0, 100) / 100) * 35 : 0) +
        history -
        bulkPenalty;
      const allergenAttributes = Object.keys(preferences).filter(id =>
        id.startsWith("allergens_no_") && preferences[id as keyof ProductPreferences] !== "not_important");
      const allergyStatus = allergenAttributes.length
        ? allergenAttributes.every(id => health.attributes?.[id as keyof ProductPreferences]?.status === "known" &&
            health.attributes?.[id as keyof ProductPreferences]?.match === 100)
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
      return {
        ...candidate,
        overallScore: clamp(Math.round(preferenceFit.active ? score * 0.7 + preferenceFit.score * 0.3 : score), 0, 100),
        preferenceFit: preferenceFit.active ? { score: preferenceFit.score, matches: preferenceFit.matches, unknown: preferenceFit.unknown, unmet: preferenceFit.unmet } : undefined,
        scoreParts: {
          relevance,
          price,
          health: healthScore,
          diet: dietFit.score,
          history,
        },
        health,
        dietFit: { ...dietFit, warnings },
        allergyStatus,
        explanation: healthKnown
          ? "Ranked using product relevance, available nutrition, price, and your preferences. This is not a category-relative health score."
          : "Nutrition scoring evidence is incomplete. Match score uses relevance, price, and any available preference evidence.",
      };
    })
    .sort(
      (a, b) =>
        b.overallScore - a.overallScore ||
        (a.estimatedPrice ?? Infinity) - (b.estimatedPrice ?? Infinity),
    )
    .slice(0, input.limit);
}
export function scoreRelevance(query: string, candidate: ProductCandidate) {
  const terms = words(query).filter(
    (t) => !["and", "the", "of", "a", "bulk", "pack", "case"].includes(t),
  );
  const haystack = words(
    [candidate.title, candidate.brand].filter(Boolean).join(" "),
  );
  const hits = terms.filter((term) =>
    haystack.some(
      (word) => word === term || word === `${term}s` || term === `${word}s`,
    ),
  ).length;
  return Math.round((hits / Math.max(terms.length, 1)) * 100);
}
