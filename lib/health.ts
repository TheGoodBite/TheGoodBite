import type { HealthInfo } from "@/lib/types";

export const UNKNOWN_HEALTH: HealthInfo = {
  nutriScore: "unknown",
  novaGroup: null,
  classification: "unknown",
  confidence: "low",
  nutrition: {},
  labelsTags: [],
  categoriesTags: [],
  allergensTags: [],
};

export function classifyHealth(input: {
  nutriScore?: string | null;
  nutriScoreScore?: number | null;
  novaGroup?: number | null;
  confidence: HealthInfo["confidence"];
  nutrition?: HealthInfo["nutrition"];
  servingSize?: string;
  servingsPerContainer?: number | null;
  ingredientsText?: string;
  labelsTags?: string[];
  categoriesTags?: string[];
  allergensTags?: string[];
}): HealthInfo {
  const nutriScore = normalizeNutriScore(input.nutriScore);
  const novaGroup =
    typeof input.novaGroup === "number" ? input.novaGroup : null;

  let classification: HealthInfo["classification"] = "unknown";
  if (nutriScore === "a" || nutriScore === "b") {
    classification =
      novaGroup === null || novaGroup <= 3 ? "strict" : "fallback";
  } else if (nutriScore === "c") {
    classification = "fallback";
  } else if (nutriScore === "d" || nutriScore === "e" || novaGroup === 4) {
    classification = "unhealthy";
  }

  return {
    nutriScore,
    nutriScoreScore: Number.isFinite(input.nutriScoreScore)
      ? input.nutriScoreScore ?? undefined
      : undefined,
    novaGroup,
    classification,
    confidence: input.confidence,
    nutrition: input.nutrition ?? {},
    servingSize: input.servingSize,
    servingsPerContainer: input.servingsPerContainer,
    ingredientsText: input.ingredientsText,
    labelsTags: input.labelsTags ?? [],
    categoriesTags: input.categoriesTags ?? [],
    allergensTags: input.allergensTags ?? [],
  };
}

export function hasNutritionInfo(health?: HealthInfo | null): boolean {
  if (!health) return false;
  if (health.nutriScore !== "unknown" || health.novaGroup !== null) {
    return true;
  }
  const n = health.nutrition;
  if (!n) return false;
  return (
    n.protein100g !== undefined ||
    n.sugars100g !== undefined ||
    n.energyKcal100g !== undefined ||
    n.sodium100g !== undefined ||
    n.saturatedFat100g !== undefined ||
    n.fiber100g !== undefined ||
    n.salt100g !== undefined
  );
}

function normalizeNutriScore(
  value: string | null | undefined,
): HealthInfo["nutriScore"] {
  const normalized = value?.toLowerCase();
  return normalized === "a" ||
    normalized === "b" ||
    normalized === "c" ||
    normalized === "d" ||
    normalized === "e"
    ? normalized
    : "unknown";
}

// A score, processing category, ingredient list, or title tag is not a nutrition facts panel.
export function hasVerifiedNutritionFacts(health?: HealthInfo | null): boolean {
  if (!health?.source || health.availability !== "matched") return false;
  const n = health.nutrition;
  return [
    n.energyKcal100g,
    n.protein100g,
    n.carbohydrates100g,
    n.sugars100g,
    n.saturatedFat100g,
    n.sodium100g,
    n.fiber100g,
  ].some(
    (value) =>
      typeof value === "number" && Number.isFinite(value) && value >= 0,
  );
}
