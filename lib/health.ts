import type { HealthInfo } from "@/lib/types";

export const UNKNOWN_HEALTH: HealthInfo = {
  nutriScore: "unknown",
  novaGroup: null,
  classification: "unknown",
  confidence: "low",
  nutrition: {},
  labelsTags: [],
  categoriesTags: [],
  allergensTags: []
};

export function classifyHealth(input: {
  nutriScore?: string | null;
  novaGroup?: number | null;
  confidence: HealthInfo["confidence"];
  nutrition?: HealthInfo["nutrition"];
  ingredientsText?: string;
  labelsTags?: string[];
  categoriesTags?: string[];
  allergensTags?: string[];
}): HealthInfo {
  const nutriScore = normalizeNutriScore(input.nutriScore);
  const novaGroup = typeof input.novaGroup === "number" ? input.novaGroup : null;

  let classification: HealthInfo["classification"] = "unknown";
  if (nutriScore === "a" || nutriScore === "b") {
    classification = novaGroup === null || novaGroup <= 3 ? "strict" : "fallback";
  } else if (nutriScore === "c") {
    classification = "fallback";
  } else if (nutriScore === "d" || nutriScore === "e" || novaGroup === 4) {
    classification = "unhealthy";
  }

  return {
    nutriScore,
    novaGroup,
    classification,
    confidence: input.confidence,
    nutrition: input.nutrition ?? {},
    ingredientsText: input.ingredientsText,
    labelsTags: input.labelsTags ?? [],
    categoriesTags: input.categoriesTags ?? [],
    allergensTags: input.allergensTags ?? []
  };
}

export function scoreHealth(health: HealthInfo) {
  let score = 0;

  if (health.nutriScore === "a") score += 40;
  if (health.nutriScore === "b") score += 30;
  if (health.nutriScore === "c") score += 10;
  if (health.nutriScore === "d" || health.nutriScore === "e") score -= 20;

  if (health.novaGroup !== null && health.novaGroup <= 3) score += 20;
  if (health.novaGroup === 4) score -= 30;

  return score;
}

function normalizeNutriScore(value: string | null | undefined): HealthInfo["nutriScore"] {
  const normalized = value?.toLowerCase();
  return normalized === "a" ||
    normalized === "b" ||
    normalized === "c" ||
    normalized === "d" ||
    normalized === "e"
    ? normalized
    : "unknown";
}
