import { expect, it } from "vitest";

// Explicit opt-in only: one shopping request, one catalog lookup, and bounded price enrichment.
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
    expect(result.options.length).toBeGreaterThan(0);
    for (const product of result.options) {
      expect(product.provider).toBe("serpapi_google_shopping");
      expect(product.market).toBe("US-search");
      if (product.estimatedPrice !== null) expect(product.currency).toBe("USD");
    }
  },
  40000,
);
