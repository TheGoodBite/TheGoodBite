import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasVerifiedNutritionFacts, UNKNOWN_HEALTH } from "@/lib/health";
import type { HealthInfo } from "@/lib/types";
const mocks = vi.hoisted(() => ({ catalog: vi.fn(), prices: vi.fn() }));
vi.mock("@/lib/providers/openFoodFacts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/providers/openFoodFacts")>()),
  searchCatalog: mocks.catalog,
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
    mocks.catalog.mockResolvedValue([
      {
        code: "012345678905",
        product_name: "Plain yogurt",
        brands: "Acme",
        countries_tags: ["en:united-states"],
        nutriments: { proteins_100g: 10 },
      },
      {
        code: "4006381333931",
        product_name: "Other yogurt",
        brands: "Acme",
        countries_tags: ["en:united-states"],
        nutriments: {},
      },
    ]);
    mocks.prices.mockResolvedValue(null);
    const result = await searchItem(
      "yogurt",
      { items: ["yogurt"] },
      AbortSignal.timeout(1000),
    );
    expect(result.options.map((p) => p.providerProductId)).toEqual([
      "012345678905",
    ]);
    expect(mocks.prices).toHaveBeenCalledTimes(1);
    expect(result.options[0].health.nutrition.protein100g).toBe(10);
  });
  it.each(["no_match", "unavailable"] as const)(
    "explains empty results for %s",
    async (availability) => {
      if (availability === "unavailable")
        mocks.catalog.mockRejectedValue(new Error("upstream unavailable"));
      else mocks.catalog.mockResolvedValue([]);
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
