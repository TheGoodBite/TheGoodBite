import { describe, expect, it } from "vitest";
import { compareNutriScore, comparePrice, rankProducts, scoreRelevance } from "@/lib/scoring";
import { UNKNOWN_HEALTH } from "@/lib/health";
import type { HealthInfo, ProductCandidate } from "@/lib/types";

function makeCandidate(overrides: Partial<ProductCandidate> & { id?: string }): ProductCandidate {
  const id = overrides.id ?? "test-id";
  return {
    provider: "open_food_facts",
    providerProductId: id,
    title: overrides.title ?? "Test Product",
    brand: overrides.brand,
    categoryTags: overrides.categoryTags,
    imageUrl: overrides.imageUrl,
    estimatedPrice: overrides.estimatedPrice ?? 2.99,
    package: overrides.package,
    unitPrice: overrides.unitPrice,
    productUrl: overrides.productUrl,
    seller: overrides.seller,
  };
}

function healthMap(candidates: ProductCandidate[], health: HealthInfo = UNKNOWN_HEALTH) {
  return new Map(candidates.map((candidate) => [candidate.providerProductId, health]));
}

describe("scoreRelevance", () => {
  it("matches product title and brand", () => {
    const candidate = makeCandidate({
      title: "Organic Cinnamon Harvest",
      brand: "Kashi",
      categoryTags: ["en:breakfast-cereals"],
    });
    expect(scoreRelevance("cereal", candidate)).toBe(0);
  });

  it("does not let broad category tags turn an unrelated product into an exact match", () => {
    const candidate = makeCandidate({
      title: "Peanut Butter Protein Bar",
      categoryTags: ["en:cereal-grains"],
    });
    expect(scoreRelevance("cereal", candidate)).toBe(0);
  });

  it("distinguishes partial from unrelated matches", () => {
    expect(scoreRelevance("mac and cheese", makeCandidate({ title: "Mac Beef Stew" }))).toBeGreaterThan(0);
    expect(scoreRelevance("mac and cheese", makeCandidate({ title: "Orange Juice" }))).toBe(0);
  });

  it("includes the brand in a multiword query", () => {
    const candidate = makeCandidate({ title: "Original Oats", brand: "Quaker" });
    expect(scoreRelevance("quaker oats", candidate)).toBe(100);
  });
});

describe("transparent product ordering", () => {
  it("uses category fit, then Nutri-Score grade and OFF numeric score", () => {
    const cerealA = makeCandidate({ id: "a", title: "Organic Cinnamon Harvest", categoryTags: ["en:breakfast-cereals"] });
    const cerealC = makeCandidate({ id: "c", title: "Cereal", estimatedPrice: 1 });
    const irrelevantA = makeCandidate({ id: "irrelevant", title: "Orange Juice" });
    const ranked = rankProducts({
      query: "cereal",
      candidates: [cerealC, irrelevantA, cerealA],
      healthById: new Map([
        ["a", { ...UNKNOWN_HEALTH, nutriScore: "a", nutriScoreScore: -2 }],
        ["c", { ...UNKNOWN_HEALTH, nutriScore: "c", nutriScoreScore: 12 }],
        ["irrelevant", { ...UNKNOWN_HEALTH, nutriScore: "a", nutriScoreScore: -8 }],
      ]),
      dietModes: [],
      limit: 3,
    });
    expect(ranked.map((product) => product.providerProductId)).toEqual(["a", "c", "irrelevant"]);
    expect(ranked[0]).not.toHaveProperty("overallScore");
  });

  it("uses Open Food Facts categories to keep combination meals below the queried food", () => {
    const sausage = makeCandidate({
      id: "sausage",
      title: "Chicken Sausage Links",
      categoryTags: ["en:chicken-sausages"],
    });
    const bowl = makeCandidate({
      id: "bowl",
      title: "Power Bowl Cajun Chicken and Sausage",
      categoryTags: ["en:frozen-ready-made-meals", "en:combination-meals"],
    });
    const ranked = rankProducts({
      query: "chicken sausage",
      candidates: [bowl, sausage],
      healthById: new Map([
        ["sausage", { ...UNKNOWN_HEALTH, nutriScore: "c" }],
        ["bowl", { ...UNKNOWN_HEALTH, nutriScore: "a" }],
      ]),
      dietModes: [],
      limit: 2,
    });
    expect(ranked.map((product) => product.providerProductId)).toEqual(["sausage", "bowl"]);
  });

  it("uses the category head to separate breakfast cereals from cereal grains", () => {
    const breakfastCereal = makeCandidate({
      id: "breakfast-cereal",
      title: "Organic Cinnamon Harvest",
      categoryTags: ["en:breakfasts", "en:breakfast-cereals"],
    });
    const cerealGrain = makeCandidate({
      id: "grain",
      title: "Organic Quinoa",
      categoryTags: ["en:cereals-and-their-products", "en:cereal-grains"],
    });
    const ranked = rankProducts({
      query: "cereal",
      candidates: [cerealGrain, breakfastCereal],
      healthById: new Map([
        ["breakfast-cereal", { ...UNKNOWN_HEALTH, nutriScore: "c" }],
        ["grain", { ...UNKNOWN_HEALTH, nutriScore: "a" }],
      ]),
      dietModes: [],
      limit: 2,
    });
    expect(ranked.map((product) => product.providerProductId)).toEqual([
      "breakfast-cereal",
      "grain",
    ]);
  });

  it("keeps a named cereal above oats in the same broad category", () => {
    const oats = makeCandidate({ id: "oats", title: "Rolled Oats", categoryTags: ["en:breakfast-cereals"] });
    const cereal = makeCandidate({ id: "cereal", title: "Wholegrain Cereal", categoryTags: ["en:breakfast-cereals"] });
    const ranked = rankProducts({ query: "cereal", candidates: [oats, cereal], healthById: new Map([
      ["oats", { ...UNKNOWN_HEALTH, nutriScore: "a" }], ["cereal", { ...UNKNOWN_HEALTH, nutriScore: "b" }],
    ]), dietModes: [], limit: 2 });
    expect(ranked[0].providerProductId).toBe("cereal");
  });

  it("prefers peanuts to peanut powder despite an inherited peanuts category", () => {
    const peanuts = makeCandidate({ id: "nuts", title: "Salted Peanuts", categoryTags: ["en:peanuts"] });
    const powder = makeCandidate({ id: "powder", title: "Peanut Powder", categoryTags: ["en:peanuts", "en:peanut-butter-powder"] });
    expect(rankProducts({ query: "peanuts", candidates: [powder, peanuts], healthById: new Map([
      ["nuts", { ...UNKNOWN_HEALTH, nutriScore: "c" }], ["powder", { ...UNKNOWN_HEALTH, nutriScore: "a" }],
    ]), dietModes: [], limit: 2 })[0].providerProductId).toBe("nuts");
  });

  it("uses Nutri-Score before soft preferences and filters failed mandatory preferences", () => {
    const veganC = makeCandidate({ id: "vegan-c", title: "Cereal" });
    const nonVeganA = makeCandidate({ id: "not-vegan-a", title: "Cereal" });
    const ranked = rankProducts({
      query: "cereal",
      candidates: [nonVeganA, veganC],
      healthById: new Map([
        ["vegan-c", { ...UNKNOWN_HEALTH, nutriScore: "c", attributes: { vegan: { status: "known", match: 100 } } }],
        ["not-vegan-a", { ...UNKNOWN_HEALTH, nutriScore: "a", attributes: { vegan: { status: "known", match: 0 } } }],
      ]),
      productPreferences: { vegan: "important" },
      dietModes: [],
      limit: 2,
    });
    expect(ranked[0].providerProductId).toBe("not-vegan-a");

    const mandatory = rankProducts({
      query: "cereal",
      candidates: [nonVeganA, veganC],
      healthById: new Map([
        ["vegan-c", { ...UNKNOWN_HEALTH, nutriScore: "c", attributes: { vegan: { status: "known", match: 100 } } }],
        ["not-vegan-a", { ...UNKNOWN_HEALTH, nutriScore: "a", attributes: { vegan: { status: "known", match: 0 } } }],
      ]),
      productPreferences: { vegan: "mandatory" },
      dietModes: [],
      limit: 2,
    });
    expect(mandatory.map((product) => product.providerProductId)).toEqual(["vegan-c"]);
  });

  it("orders missing Nutri-Score after known grades", () => {
    const known: HealthInfo = { ...UNKNOWN_HEALTH, nutriScore: "e" };
    expect(compareNutriScore(known, UNKNOWN_HEALTH)).toBeLessThan(0);
  });

  it("uses the Open Food Facts numeric score within the same grade", () => {
    const strongerA: HealthInfo = {
      ...UNKNOWN_HEALTH,
      nutriScore: "a",
      nutriScoreScore: -8,
    };
    const lowerA: HealthInfo = {
      ...UNKNOWN_HEALTH,
      nutriScore: "a",
      nutriScoreScore: -1,
    };
    expect(compareNutriScore(strongerA, lowerA)).toBeLessThan(0);
  });

  it("compares only compatible unit prices and leaves unknown prices last", () => {
    const cheaper = makeCandidate({ id: "cheap", unitPrice: { amount: 1.2, unit: "100g" } });
    const costlier = makeCandidate({ id: "costly", unitPrice: { amount: 2.1, unit: "100g" } });
    const unknown = makeCandidate({ id: "unknown", estimatedPrice: null });
    expect(comparePrice(cheaper, costlier)).toBeLessThan(0);
    expect(comparePrice(cheaper, unknown)).toBe(0);
  });

  it("respects limit and explains ordering without a composite score", () => {
    const candidates = Array.from({ length: 10 }, (_, index) =>
      makeCandidate({ id: `item-${index}`, title: "Peanuts" }),
    );
    const ranked = rankProducts({
      query: "peanuts",
      candidates,
      healthById: healthMap(candidates),
      dietModes: [],
      limit: 3,
    });
    expect(ranked).toHaveLength(3);
    expect(ranked[0].explanation).toContain("Nutri-Score");
  });
});
