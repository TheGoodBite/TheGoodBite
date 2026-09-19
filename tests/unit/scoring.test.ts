import { describe, expect, it } from "vitest";
import { rankProducts, scoreRelevance } from "@/lib/scoring";
import { UNKNOWN_HEALTH } from "@/lib/health";
import type { HealthInfo, ProductCandidate } from "@/lib/types";

function makeCandidate(overrides: Partial<ProductCandidate> & { id?: string }): ProductCandidate {
  const id = overrides.id ?? "test-id";
  return {
    provider: "mock",
    providerProductId: id,
    title: overrides.title ?? "Test Product",
    brand: overrides.brand,
    imageUrl: overrides.imageUrl,
    estimatedPrice: overrides.estimatedPrice ?? 2.99,
    productUrl: overrides.productUrl,
    seller: overrides.seller
  };
}

function healthMap(candidates: ProductCandidate[], health: HealthInfo = UNKNOWN_HEALTH): Map<string, HealthInfo> {
  return new Map(candidates.map((c) => [c.providerProductId, health]));
}

describe("scoreRelevance", () => {
  it("returns 100 for exact match", () => {
    const candidate = makeCandidate({ title: "Mac and Cheese" });
    expect(scoreRelevance("mac and cheese", candidate)).toBe(100);
  });

  it("returns 0 for completely irrelevant product", () => {
    const candidate = makeCandidate({ title: "Orange Juice" });
    expect(scoreRelevance("mac and cheese", candidate)).toBe(0);
  });

  it("returns partial score for partial match", () => {
    const candidate = makeCandidate({ title: "Mac and Beef Stew" });
    const score = scoreRelevance("mac and cheese", candidate);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it("is case-insensitive", () => {
    const candidate = makeCandidate({ title: "GREEK YOGURT" });
    expect(scoreRelevance("Greek Yogurt", candidate)).toBe(100);
  });

  it("includes brand in relevance matching", () => {
    const candidate = makeCandidate({ title: "Original Oats", brand: "Quaker" });
    expect(scoreRelevance("quaker oats", candidate)).toBeGreaterThan(50);
  });
});

describe("rankProducts", () => {
  it("sorts by overallScore descending", () => {
    const cheapHealthy = makeCandidate({ id: "a", title: "Greek yogurt", estimatedPrice: 2.49 });
    const expensiveUnhealthy = makeCandidate({ id: "b", title: "Greek yogurt", estimatedPrice: 6.99 });

    const healthById = new Map<string, HealthInfo>([
      ["a", { ...UNKNOWN_HEALTH, nutriScore: "a", novaGroup: 1, classification: "strict" }],
      ["b", { ...UNKNOWN_HEALTH, nutriScore: "e", novaGroup: 4, classification: "unhealthy" }]
    ]);

    const ranked = rankProducts({
      query: "greek yogurt",
      candidates: [expensiveUnhealthy, cheapHealthy],
      healthById,
      dietModes: [],
      limit: 10
    });

    expect(ranked[0].providerProductId).toBe("a");
    expect(ranked[0].overallScore).toBeGreaterThan(ranked[1].overallScore);
  });

  it("respects limit parameter", () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      makeCandidate({ id: `product-${i}`, title: "Potato Chips" })
    );

    const ranked = rankProducts({
      query: "potato chips",
      candidates,
      healthById: healthMap(candidates),
      dietModes: [],
      limit: 5
    });

    expect(ranked).toHaveLength(5);
  });

  it("clamps overallScore to 0-100", () => {
    const candidate = makeCandidate({ id: "extreme", title: "Extreme Product" });
    const extremeHealth: HealthInfo = {
      ...UNKNOWN_HEALTH,
      nutriScore: "a",
      novaGroup: 1,
      classification: "strict"
    };

    const ranked = rankProducts({
      query: "extreme product",
      candidates: [candidate],
      healthById: new Map([["extreme", extremeHealth]]),
      dietModes: [],
      limit: 1
    });

    expect(ranked[0].overallScore).toBeGreaterThanOrEqual(0);
    expect(ranked[0].overallScore).toBeLessThanOrEqual(100);
  });

  it("gives history bonus for previously bought products", () => {
    const candidate = makeCandidate({ id: "bought", title: "Yogurt" });

    const withHistory = rankProducts({
      query: "yogurt",
      candidates: [candidate],
      healthById: healthMap([candidate]),
      dietModes: [],
      boughtProductIds: new Set(["bought"]),
      limit: 1
    });

    const withoutHistory = rankProducts({
      query: "yogurt",
      candidates: [candidate],
      healthById: healthMap([candidate]),
      dietModes: [],
      boughtProductIds: new Set(),
      limit: 1
    });

    expect(withHistory[0].overallScore).toBeGreaterThan(withoutHistory[0].overallScore);
  });

  it("returns scoreParts on each product", () => {
    const candidate = makeCandidate({ id: "parts", title: "Chips" });
    const ranked = rankProducts({
      query: "chips",
      candidates: [candidate],
      healthById: healthMap([candidate]),
      dietModes: [],
      limit: 1
    });
    const { scoreParts } = ranked[0];
    expect(scoreParts).toHaveProperty("relevance");
    expect(scoreParts).toHaveProperty("price");
    expect(scoreParts).toHaveProperty("health");
    expect(scoreParts).toHaveProperty("diet");
    expect(scoreParts).toHaveProperty("history");
  });

  it("includes explanation string on each product", () => {
    const candidate = makeCandidate({ id: "explain", title: "Milk" });
    const ranked = rankProducts({
      query: "milk",
      candidates: [candidate],
      healthById: healthMap([candidate]),
      dietModes: [],
      limit: 1
    });
    expect(typeof ranked[0].explanation).toBe("string");
    expect(ranked[0].explanation.length).toBeGreaterThan(0);
  });

  it("handles single-candidate price normalization without NaN", () => {
    const candidate = makeCandidate({ id: "solo", title: "Solo Item", estimatedPrice: 3.5 });
    const ranked = rankProducts({
      query: "solo item",
      candidates: [candidate],
      healthById: healthMap([candidate]),
      dietModes: [],
      limit: 1
    });
    expect(ranked[0].overallScore).not.toBeNaN();
  });
});
