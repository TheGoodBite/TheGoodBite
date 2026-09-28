import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasVerifiedNutritionFacts, UNKNOWN_HEALTH } from "@/lib/health";
import type { HealthInfo, ProductCandidate } from "@/lib/types";
const mocks = vi.hoisted(() => ({
  shopping: vi.fn(),
  enrich: vi.fn(),
  prices: vi.fn(),
}));
vi.mock("@/lib/providers/googleShopping", () => ({
  searchGoogleShoppingProducts: mocks.shopping,
}));
vi.mock("@/lib/providers/openFoodFacts", () => ({
  enrichProducts: mocks.enrich,
}));
vi.mock("@/lib/providers/openPrices", () => ({
  getOpenPricesForBarcode: mocks.prices,
}));
import { searchItem } from "@/lib/searchService";
const matched: HealthInfo = {
  ...UNKNOWN_HEALTH,
  availability: "matched",
  source: {
    provider: "open_food_facts",
    productName: "Plain yogurt",
    match: "barcode",
    fetchedAt: new Date().toISOString(),
  },
  nutrition: { protein100g: 10 },
};
const candidate = (id: string): ProductCandidate => ({
  provider: "test",
  providerProductId: id,
  title: `Plain yogurt ${id}`,
  estimatedPrice: 3,
  upc: "012345678905",
});
beforeEach(() => vi.resetAllMocks());
describe("nutrition visibility", () => {
  it.each([
    undefined,
    UNKNOWN_HEALTH,
    { ...matched, nutrition: {}, nutriScore: "a" as const, novaGroup: 1 },
    { ...matched, source: undefined },
    { ...matched, availability: "unavailable" as const },
    { ...matched, nutrition: { protein100g: NaN } },
    { ...matched, nutrition: { protein100g: -1 } },
  ])("does not qualify missing or unsupported facts", (health) =>
    expect(hasVerifiedNutritionFacts(health)).toBe(false),
  );
  it("accepts zero values and carbohydrate-only partial data", () => {
    expect(
      hasVerifiedNutritionFacts({ ...matched, nutrition: { sugars100g: 0 } }),
    ).toBe(true);
    expect(
      hasVerifiedNutritionFacts({
        ...matched,
        nutrition: { carbohydrates100g: 4 },
      }),
    ).toBe(true);
  });
  it("hides unsupported products before pricing and preserves a valid option", async () => {
    const products = [
      candidate("1"),
      { ...candidate("2"), title: "Other yogurt", upc: undefined },
    ];
    mocks.shopping.mockResolvedValue(products);
    mocks.enrich.mockResolvedValue({
      candidates: products,
      healthById: new Map([
        ["1", matched],
        ["2", UNKNOWN_HEALTH],
      ]),
      warnings: [],
    });
    mocks.prices.mockResolvedValue(null);
    const result = await searchItem(
      "yogurt",
      { items: ["yogurt"] },
      AbortSignal.timeout(1000),
    );
    expect(result.options.map((p) => p.providerProductId)).toEqual(["1"]);
    expect(mocks.prices).toHaveBeenCalledTimes(1);
    expect(result.excludedCount).toBe(1);
    expect(result.warnings?.join(" ")).toContain("hidden");
  });
  it.each(["no_match", "unavailable"] as const)(
    "explains empty results for %s",
    async (availability) => {
      const products = [candidate("1")];
      mocks.shopping.mockResolvedValue(products);
      mocks.enrich.mockResolvedValue({
        candidates: products,
        healthById: new Map([["1", { ...UNKNOWN_HEALTH, availability }]]),
        warnings: [],
      });
      const result = await searchItem(
        "yogurt",
        { items: ["yogurt"] },
        AbortSignal.timeout(1000),
      );
      expect(result.options).toEqual([]);
      expect(result.emptyReason).toBe(
        availability === "unavailable"
          ? "nutrition_unavailable"
          : "nutrition_missing",
      );
      expect(mocks.prices).not.toHaveBeenCalled();
    },
  );
});
