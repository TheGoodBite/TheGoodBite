import type { ProductCandidate } from "@/lib/types";

type PricedProduct = Pick<ProductCandidate, "estimatedPrice">;

export function hasProductPrice(product: PricedProduct): boolean {
  return typeof product.estimatedPrice === "number" &&
    Number.isFinite(product.estimatedPrice) && product.estimatedPrice > 0;
}

// "Lowest price" compares package prices, not unlike unit-price measurements.
// Equal or missing prices retain the existing recommendation order.
export function compareProductPrices(a: PricedProduct, b: PricedProduct): number {
  const aKnown = hasProductPrice(a);
  const bKnown = hasProductPrice(b);
  if (aKnown !== bKnown) return aKnown ? -1 : 1;
  return aKnown ? a.estimatedPrice! - b.estimatedPrice! : 0;
}
