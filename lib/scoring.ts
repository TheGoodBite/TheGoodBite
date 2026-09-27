import { checkAllergens } from "@/lib/allergens";
import { scoreDietFit } from "@/lib/dietModes";
import { scoreHealth } from "@/lib/health";
import type { Allergen, DietMode, HealthInfo, ProductCandidate, RankedProduct } from "@/lib/types";
import { clamp, normalizeQuery } from "@/lib/utils";

export function rankProducts(input: {
  query: string;
  candidates: ProductCandidate[];
  healthById: Map<string, HealthInfo>;
  dietModes: DietMode[];
  allergies?: Allergen[];
  boughtProductIds?: Set<string>;
  limit: number;
}) {
  const priced = input.candidates.filter((candidate) => candidate.estimatedPrice !== null);
  const minPrice = Math.min(...priced.map((candidate) => candidate.estimatedPrice as number));
  const maxPrice = Math.max(...priced.map((candidate) => candidate.estimatedPrice as number));

  return input.candidates
    .map((candidate): RankedProduct => {
      const health = input.healthById.get(candidate.providerProductId);
      if (!health) throw new Error(`Missing health info for ${candidate.providerProductId}`);

      const relevance = scoreRelevance(input.query, candidate);
      const price = scorePrice(candidate.estimatedPrice, minPrice, maxPrice);
      const healthScore = scoreHealth(health);
      const dietFit = scoreDietFit(health, input.dietModes, candidate.title);
      const history = input.boughtProductIds?.has(candidate.providerProductId) ? 10 : 0;

      const matchedAllergens = checkAllergens(health, candidate.title, input.allergies ?? []);
      const allergenPenalty = matchedAllergens.length > 0 ? 50 : 0;
      if (matchedAllergens.length > 0) {
        dietFit.warnings.push(`Contains selected allergen: ${matchedAllergens.join(", ")}`);
      }

      // If health classification is unknown (OFF data missing), scale based on relevance and price instead of penalizing to 0
      const isHealthUnknown = health.classification === "unknown" && health.nutriScore === "unknown";
      const rawOverall = isHealthUnknown
        ? relevance * 0.5 + price * 0.4 + history
        : relevance * 0.25 + price * 0.2 + healthScore + dietFit.score * 0.25 + history;

      const overallScore = clamp(Math.round(rawOverall - allergenPenalty), 0, 100);

      return {
        ...candidate,
        overallScore,
        scoreParts: {
          relevance,
          price,
          health: healthScore,
          diet: dietFit.score,
          history
        },
        health,
        dietFit,
        explanation: buildExplanation(candidate, health, dietFit.score, price, matchedAllergens)
      };
    })
    .sort((a, b) => {
      if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
      return (a.estimatedPrice ?? Number.MAX_SAFE_INTEGER) - (b.estimatedPrice ?? Number.MAX_SAFE_INTEGER);
    })
    .slice(0, input.limit);
}

export function scoreRelevance(query: string, candidate: ProductCandidate) {
  const terms = normalizeQuery(query).split(" ");
  const haystack = normalizeQuery([candidate.title, candidate.brand].filter(Boolean).join(" "));
  const hits = terms.filter((term) => haystack.includes(term)).length;
  return Math.round((hits / Math.max(terms.length, 1)) * 100);
}

function scorePrice(price: number | null, min: number, max: number) {
  if (price === null || !Number.isFinite(min) || !Number.isFinite(max)) return 25;
  if (min === max) return 80;
  return Math.round((1 - (price - min) / (max - min)) * 100);
}

function buildExplanation(candidate: ProductCandidate, health: HealthInfo, dietScore: number, priceScore: number, matchedAllergens: Allergen[] = []) {
  if (matchedAllergens.length > 0) return `⚠️ Warning: May contain selected allergen (${matchedAllergens.join(", ")}).`;
  if (health.classification === "unknown" && health.nutriScore === "unknown") {
    return "ℹ️ Nutrition data unavailable in Open Food Facts database for this item. Score reflects search match & estimated price.";
  }
  if (dietScore >= 70) return "Strong diet fit with a reasonable estimated price.";
  if (health.classification === "strict") return "Better health score than most similar options.";
  if (priceScore >= 80) return "Low estimated price, but check the health badges.";
  return `${candidate.seller ? `${candidate.seller} result with` : "Product with"} balanced price and nutrition signals.`;
}
