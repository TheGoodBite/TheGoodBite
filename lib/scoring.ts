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
import { words } from "@/lib/products";

const NUTRI_SCORE_ORDER: Record<HealthInfo["nutriScore"], number> = {
  a: 0,
  b: 1,
  c: 2,
  d: 3,
  e: 4,
  unknown: 5,
};

export function rankProducts(input: {
  query: string;
  productPreferences?: ProductPreferences;
  unwantedIngredients?: string[];
  candidates: ProductCandidate[];
  healthById: Map<string, HealthInfo>;
  dietModes: DietMode[];
  allergies?: Allergen[];
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

      const ranked: RankedProduct = {
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
          "Ordered by Open Food Facts category fit and product name/brand match, then Nutri-Score, selected preferences and diet modes, bulk preference, then comparable unit price. No combined match score is calculated.",
      };
      return {
        ranked,
        relevance: scoreRelevance(input.query, candidate),
        nameHeadMatch: sameWord(words(input.query).at(-1), words(candidate.title).at(-1)),
        categoryRelevance: scoreCategoryRelevance(input.query, candidate.categoryTags),
        preferenceFit,
        dietFit,
        bulkPreference: /\b(bulk|pack|case)\b/i.test(input.query)
          ? "any"
          : (input.bulkPreference ?? "everyday"),
      };
    })
    .sort((a, b) => {
      const preferenceActive = a.preferenceFit.active || b.preferenceFit.active;
      const preferenceOrder = preferenceActive
        ? b.preferenceFit.matchesByImportance.very_important -
            a.preferenceFit.matchesByImportance.very_important ||
          b.preferenceFit.matchesByImportance.important -
            a.preferenceFit.matchesByImportance.important ||
          b.preferenceFit.matches.length - a.preferenceFit.matches.length ||
          a.preferenceFit.unmet.length - b.preferenceFit.unmet.length ||
          a.preferenceFit.unknown.length - b.preferenceFit.unknown.length
        : 0;
      const dietOrder =
        b.dietFit.matchedModes.length - a.dietFit.matchedModes.length;
      const bulkOrder = a.bulkPreference === "any" ? 0
        : a.bulkPreference === "bulk"
          ? Number(!!b.ranked.package?.bulk) - Number(!!a.ranked.package?.bulk)
          : Number(!!a.ranked.package?.bulk) - Number(!!b.ranked.package?.bulk);
      const categoryOrder = compareCategoryRelevance(
        a.categoryRelevance,
        b.categoryRelevance,
      );
      const matchTier = (item: typeof a) =>
        item.categoryRelevance?.headMatch || item.relevance === 100 ? 2
          : item.categoryRelevance || item.relevance > 0 ? 1 : 0;
      return (
        matchTier(b) - matchTier(a) ||
        categoryOrder ||
        b.relevance - a.relevance ||
        Number(b.nameHeadMatch) - Number(a.nameHeadMatch) ||
        compareNutriScore(a.ranked.health, b.ranked.health) ||
        preferenceOrder ||
        dietOrder ||
        bulkOrder ||
        comparePrice(a.ranked, b.ranked) ||
        a.ranked.title.localeCompare(b.ranked.title)
      );
    })
    .slice(0, input.limit)
    .map(({ ranked }) => ranked);
}

function sameWord(a?: string, b?: string) {
  return !!a && !!b && (a === b || a === `${b}s` || b === `${a}s`);
}

function compareCategoryRelevance(
  a: ReturnType<typeof scoreCategoryRelevance>,
  b: ReturnType<typeof scoreCategoryRelevance>,
) {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return Number(b.headMatch) - Number(a.headMatch) || b.coverage - a.coverage;
}

export function scoreRelevance(query: string, candidate: ProductCandidate) {
  const terms = words(query).filter(
    (term) => !["and", "the", "of", "a", "bulk", "pack", "case"].includes(term),
  );
  // Name and brand establish the primary match. OFF category labels are a
  // separate, weaker tie-breaker because broad taxonomy tags can be misleading.
  const haystack = words([candidate.title, candidate.brand].filter(Boolean).join(" "));
  const hits = terms.filter((term) =>
    haystack.some(
      (word) => word === term || word === `${term}s` || term === `${word}s`,
    ),
  ).length;
  return Math.round((hits / Math.max(terms.length, 1)) * 100);
}

function scoreCategoryRelevance(query: string, categoryTags?: string[]) {
  if (!categoryTags?.length) return undefined;
  const terms = words(query).filter(
    (term) => !["and", "the", "of", "a", "bulk", "pack", "case"].includes(term),
  );
  if (!terms.length) return undefined;
  const categories = categoryTags.map((tag) => {
    const category = words(tag).filter((word) => word !== "en");
    const hits = terms.filter((term) =>
      category.some(
        (word) => word === term || word === `${term}s` || term === `${word}s`,
      ),
    ).length;
    return {
      headMatch: !!terms.length && category.length > 0 &&
        (category.at(-1) === terms.at(-1) ||
          category.at(-1) === `${terms.at(-1)}s` ||
          terms.at(-1) === `${category.at(-1)}s`),
      coverage: hits / Math.max(terms.length, category.length),
    };
  });
  return categories.filter((category) => category.coverage > 0).sort(
    (a, b) => Number(b.headMatch) - Number(a.headMatch) || b.coverage - a.coverage,
  )[0];
}

export function compareNutriScore(a: HealthInfo, b: HealthInfo) {
  const gradeOrder = (NUTRI_SCORE_ORDER[a.nutriScore] ?? 5) - (NUTRI_SCORE_ORDER[b.nutriScore] ?? 5);
  if (gradeOrder) return gradeOrder;
  const aScore = a.nutriScoreScore;
  const bScore = b.nutriScoreScore;
  return Number.isFinite(aScore) && Number.isFinite(bScore) ? aScore! - bScore! : 0;
}

export function comparePrice(a: ProductCandidate, b: ProductCandidate) {
  if (a.unitPrice && b.unitPrice && a.unitPrice.unit === b.unitPrice.unit)
    return a.unitPrice.amount - b.unitPrice.amount;
  if (a.unitPrice || b.unitPrice) return 0;
  if ((a.package?.count ?? 1) !== (b.package?.count ?? 1)) return 0;
  const aPrice = a.estimatedPrice;
  const bPrice = b.estimatedPrice;
  if (aPrice == null || bPrice == null)
    return aPrice == null ? (bPrice == null ? 0 : 1) : -1;
  return aPrice - bPrice;
}
