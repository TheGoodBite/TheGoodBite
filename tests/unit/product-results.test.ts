import { describe, expect, it } from "vitest";
import { prepareProducts } from "@/lib/productResults";
import { UNKNOWN_HEALTH } from "@/lib/health";
import type { HealthInfo, ProductCandidate } from "@/lib/types";

const candidates: ProductCandidate[] = [
  { provider: "open_food_facts", providerProductId: "kashi", title: "Kashi GO Original", estimatedPrice: 8, categoryTags: ["en:breakfast-cereals"] },
  { provider: "open_food_facts", providerProductId: "cereal", title: "Wholegrain Cereal", estimatedPrice: 1, categoryTags: ["en:breakfast-cereals"] },
  { provider: "open_food_facts", providerProductId: "other", title: "Alpha Crunch", estimatedPrice: null },
];

function healthMap(grades: HealthInfo["nutriScore"][]): Map<string, HealthInfo> {
  return new Map(candidates.map((candidate, i) => [
    candidate.providerProductId, { ...UNKNOWN_HEALTH, nutriScore: grades[i] },
  ]));
}

describe("Open Food Facts result order", () => {
  it.each([
    ["a", "c", "unknown"],
    ["e", "b", "a"],
  ] as HealthInfo["nutriScore"][][])("preserves order regardless of grades: %s %s %s", (...grades) => {
    const products = prepareProducts({ candidates, healthById: healthMap(grades), dietModes: [], limit: 3 });
    expect(products.map(p => p.providerProductId)).toEqual(["kashi", "cereal", "other"]);
    expect(products[0].explanation).toContain("order returned by Open Food Facts");
    expect(products[0]).not.toHaveProperty("overallScore");
  });

  it("retains any provider order, including price and alphabetical disagreements", () => {
    const products = prepareProducts({ candidates: [...candidates].reverse(), healthById: healthMap(["a", "c", "e"]), dietModes: [], limit: 3 });
    expect(products.map(p => p.providerProductId)).toEqual(["other", "cereal", "kashi"]);
  });

  it("annotates soft preference matches without promoting them", () => {
    const healthById = healthMap(["c", "a", "a"]);
    healthById.set("cereal", { ...UNKNOWN_HEALTH, nutriScore: "a", attributes: { labels_organic: { status: "known", match: 100 } } });
    const products = prepareProducts({ candidates, healthById, productPreferences: { labels_organic: "very_important" }, dietModes: [], limit: 3 });
    expect(products.map(p => p.providerProductId)).toEqual(["kashi", "cereal", "other"]);
    expect(products[1].preferenceFit?.matches).toContain("Organic farming");
  });

  it("filters mandatory conflicts before applying the limit, preserving survivor order", () => {
    const healthById = new Map<string, HealthInfo>(candidates.map((candidate, i) => [
      candidate.providerProductId, { ...UNKNOWN_HEALTH, attributes: { vegan: { status: "known", match: i === 0 ? 0 : 100 } } },
    ]));
    const products = prepareProducts({ candidates, healthById, productPreferences: { vegan: "mandatory" }, dietModes: [], limit: 1 });
    expect(products.map(p => p.providerProductId)).toEqual(["cereal"]);
  });

  it("applies the limit to the provider's first eligible results", () => {
    const products = prepareProducts({ candidates, healthById: healthMap(["e", "c", "a"]), dietModes: [], limit: 2 });
    expect(products.map(p => p.providerProductId)).toEqual(["kashi", "cereal"]);
  });
});
