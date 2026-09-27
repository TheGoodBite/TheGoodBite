// Package counts and serving weights are not serving counts. Never infer portions from them.
export function computePricePerServing(
  estimatedPrice: number | null,
  _servingSize?: string,
  servingsPerContainer?: number | null,
  _title?: string,
): { formatted: string; pricePerUnit: number } | null {
  if (
    estimatedPrice === null ||
    !Number.isFinite(estimatedPrice) ||
    estimatedPrice <= 0 ||
    servingsPerContainer == null ||
    !Number.isFinite(servingsPerContainer) ||
    servingsPerContainer <= 0
  )
    return null;
  const pricePerUnit = estimatedPrice / servingsPerContainer;
  return { formatted: `$${pricePerUnit.toFixed(2)} / serving`, pricePerUnit };
}
