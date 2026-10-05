import type { HealthInfo, ProductCandidate } from "@/lib/types";

type PricedProduct = Pick<ProductCandidate, "estimatedPrice">;

export function hasProductPrice(product: PricedProduct): boolean {
  return typeof product.estimatedPrice === "number" &&
    Number.isFinite(product.estimatedPrice) && product.estimatedPrice > 0;
}

// "Lowest price" compares package prices, not unlike unit-price measurements.
// Equal or missing prices retain the existing Open Food Facts order.
export function compareProductPrices(a: PricedProduct, b: PricedProduct): number {
  const aKnown = hasProductPrice(a);
  const bKnown = hasProductPrice(b);
  if (aKnown !== bKnown) return aKnown ? -1 : 1;
  return aKnown ? a.estimatedPrice! - b.estimatedPrice! : 0;
}

const NUTRI_SCORE_ORDER: Record<HealthInfo["nutriScore"], number> = {
  a: 0,
  b: 1,
  c: 2,
  d: 3,
  e: 4,
  unknown: 5,
};

export function compareNutriScore(a: HealthInfo, b: HealthInfo) {
  const gradeOrder = (NUTRI_SCORE_ORDER[a.nutriScore] ?? 5) - (NUTRI_SCORE_ORDER[b.nutriScore] ?? 5);
  if (gradeOrder) return gradeOrder;
  const aScore = a.nutriScoreScore;
  const bScore = b.nutriScoreScore;
  return Number.isFinite(aScore) && Number.isFinite(bScore) ? aScore! - bScore! : 0;
}
