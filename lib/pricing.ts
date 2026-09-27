export function computePricePerServing(
  estimatedPrice: number | null,
  servingSize?: string,
  servingsPerContainer?: number | null,
  title?: string
): { formatted: string; pricePerUnit: number } | null {
  if (estimatedPrice === null || estimatedPrice <= 0) return null;

  // 1. If explicit servings per container is known
  if (typeof servingsPerContainer === "number" && servingsPerContainer > 0) {
    const cost = estimatedPrice / servingsPerContainer;
    return { formatted: `$${cost.toFixed(2)} / serving`, pricePerUnit: cost };
  }

  // 2. Parse title or package size for count/pack info (e.g. "12 pack", "6 ct", "24 count", "12 x 1.5 oz")
  if (title) {
    const packMatch = title.match(/(\d+)\s*(?:pack|ct|count|pk|bars|cans|bottles|pouches|sachets|boxes)/i);
    if (packMatch) {
      const count = parseInt(packMatch[1], 10);
      if (count > 1) {
        const cost = estimatedPrice / count;
        return { formatted: `$${cost.toFixed(2)} / serving`, pricePerUnit: cost };
      }
    }
  }

  // 3. Try parsing serving size string if available (e.g., "30g", "250ml")
  if (servingSize) {
    const weightMatch = servingSize.match(/(\d+(?:\.\d+)?)\s*(g|ml|oz)/i);
    if (weightMatch) {
      // If we have price and title has total net weight or we estimate servings (~30g per serving default)
      const grams = parseFloat(weightMatch[1]);
      if (grams > 0) {
        // standard serving is ~30g or 240ml for liquids
        return { formatted: `~$${estimatedPrice.toFixed(2)} (${servingSize})`, pricePerUnit: estimatedPrice };
      }
    }
  }

  return null;
}
