import { expect, it } from "vitest";

// Explicit opt-in only: one nutrition catalog lookup and bounded Open Prices enrichment.
it.skipIf(process.env.MEEZANY_LIVE_TESTS !== "1")(
  "checks the configured US discovery pipeline",
  async () => {
    process.loadEnvFile(".env.local");
    const { searchItem } = await import("@/lib/searchService");
    const result = await searchItem(
      "Greek yogurt",
      {
        items: ["Greek yogurt"],
        zipCode: "01752",
        dietModes: ["high_protein"],
        limitPerItem: 3,
      },
      AbortSignal.timeout(30000),
    );
    console.info("live provider check", {
      options: result.options.length,
      warnings: result.warnings,
      prices: result.options.filter((o) => o.estimatedPrice !== null).length,
      nutritionMatches: result.options.filter((o) => o.health.source).length,
      sources: result.options.map((o) => o.priceSource),
    });
    // Missing nutrition now yields an explained empty result, never unsupported options.
    if (!result.options.length && result.excludedCount)
      expect(result.warnings?.length).toBeGreaterThan(0);
    const { hasVerifiedNutritionFacts } = await import("@/lib/health");
    for (const product of result.options) {
      expect(hasVerifiedNutritionFacts(product.health)).toBe(true);
      expect(product.provider).toBe("open_food_facts");
      expect(product.market).toBe("US-catalog");
      if (product.estimatedPrice !== null) expect(product.currency).toBe("USD");
    }
  },
  40000,
);
