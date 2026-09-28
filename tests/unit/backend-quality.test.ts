import { describe, expect, it } from "vitest";
import { UNKNOWN_HEALTH } from "@/lib/health";
import {
  parsePackage,
  deduplicateProducts,
  validBarcode,
  withUnitPrice,
} from "@/lib/products";
import {
  matchProduct,
  fromOffProduct,
  type OffProduct,
} from "@/lib/providers/openFoodFacts";
import {
  selectOpenPrice,
  type OpenPriceItem,
} from "@/lib/providers/openPrices";
import { normalizeShoppingResult } from "@/lib/providers/googleShopping";
import { checkAllergens } from "@/lib/allergens";
import { evaluateFodmapFit } from "@/lib/fodmap";
import { scoreDietFit } from "@/lib/dietModes";
import { rankProducts } from "@/lib/scoring";
import { stateForZip, postalZip } from "@/lib/zipState";
import { buildShoppingQuery } from "@/lib/searchPreferences";
import type { ProductCandidate } from "@/lib/types";
const candidate = (
  title = "Fage Plain Greek Yogurt 6 oz",
  overrides: Partial<ProductCandidate> = {},
): ProductCandidate => ({
  title,
  provider: "test",
  providerProductId: title,
  estimatedPrice: 3,
  ...overrides,
});
const off: OffProduct = {
  code: "012345678905",
  brands: "Fage",
  product_name: "Plain Greek Yogurt",
  quantity: "170 g",
  countries_tags: ["en:united-states"],
  nutriments: { proteins_100g: 10, carbohydrates_100g: 4 },
};

describe("product identity and currency", () => {
  it("validates barcode check digits", () => {
    expect(validBarcode("012345678905")).toBeDefined();
    expect(validBarcode("012345678906")).toBeUndefined();
  });
  it("preserves multipack denominators", () => {
    const p = parsePackage("6 x 12 oz sparkling water");
    expect(p.count).toBe(6);
    expect(p.bulk).toBe(true);
    expect(p.quantity).toBeCloseTo(2041.1657);
  });
  it("does not guess denominators with two sizes", () => {
    expect(parsePackage("6 oz (170g)").ambiguous).toBe(true);
    expect(
      withUnitPrice(
        candidate("6 oz (170g)", { package: parsePackage("6 oz (170g)") }),
      ).unitPrice,
    ).toBeUndefined();
  });
  it("groups reordered identical titles and retains seller offers", () => {
    const a = candidate("Fage Plain Greek Yogurt 6 oz", {
      offers: [
        {
          source: "shopping",
          seller: "A",
          amount: 3,
          currency: "USD",
          observedAt: "2026-09-27",
        },
      ],
    });
    const b = candidate("Plain Greek Yogurt Fage 6 oz", {
      estimatedPrice: 2,
      offers: [
        {
          source: "shopping",
          seller: "B",
          amount: 2,
          currency: "USD",
          observedAt: "2026-09-27",
        },
      ],
    });
    const result = deduplicateProducts([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].offers).toHaveLength(2);
    expect(result[0].estimatedPrice).toBe(2);
  });
  it.each([
    ["6 oz", "12 oz"],
    ["6 oz pack of 2", "6 oz pack of 6"],
    ["Eggs 6 ct", "Eggs 12 ct"],
    ["Plain 6 oz", "Vanilla 6 oz"],
  ])("keeps distinct %s versus %s", (a, b) => {
    expect(deduplicateProducts([candidate(a), candidate(b)])).toHaveLength(2);
  });
  it.each(["€3.00", "£3.00", "CA$3.00", "A$3.00", "NZ$3.00"])(
    "rejects non-US price %s",
    (price) => {
      expect(
        normalizeShoppingResult({ title: "Yogurt", price, extracted_price: 3 }),
      ).toBeNull();
    },
  );
  it("does not assume an unlabelled price is USD", () => {
    expect(
      normalizeShoppingResult({
        title: "Yogurt",
        price: "3.00",
        extracted_price: 3,
      })?.estimatedPrice,
    ).toBeNull();
  });
  it("accepts USD and captures price provenance", () => {
    expect(
      normalizeShoppingResult({
        title: "Yogurt",
        price: "US $3.00",
        extracted_price: 3,
      })?.priceObservation?.currency,
    ).toBe("USD");
  });
});

describe("nutrition identity and evidence", () => {
  it("accepts brand, name and region agreement", () =>
    expect(matchProduct(off, candidate())).toBe(true));
  it.each([
    { ...off, brands: "Chobani" },
    { ...off, product_name: "Vanilla Greek Yogurt" },
    { ...off, countries_tags: ["en:france"] },
    { ...off, product_name: "Greek Yogurt 0%" },
  ])("rejects another brand, variant, or market", (other) =>
    expect(matchProduct(other, candidate())).toBe(false),
  );
  it("preserves carbs and never treats per-serving data as per-100g", () => {
    const result = fromOffProduct(
      {
        ...off,
        nutriments: {
          carbohydrates_100g: 4,
          proteins_serving: 20,
          proteins: 20,
          sodium_100g: -2,
        },
      },
      "text",
    );
    expect(result.nutrition.carbohydrates100g).toBe(4);
    expect(result.nutrition.protein100g).toBeUndefined();
    expect(result.nutrition.sodium100g).toBeUndefined();
    expect(result.source?.match).toBe("text");
  });
  it("missing nutrition is unknown rather than high sugar", () => {
    const fit = scoreDietFit(UNKNOWN_HEALTH, ["low_sugar"]);
    expect(fit.evidence?.low_sugar).toBe("unknown");
    expect(fit.warnings).not.toContain("Higher sugar");
  });
  it("unknown vegetarian data never matches", () =>
    expect(scoreDietFit(UNKNOWN_HEALTH, ["vegetarian"]).matchedModes).toEqual(
      [],
    ));
  it("missing ingredients never pass the FODMAP screen", () =>
    expect(evaluateFodmapFit(UNKNOWN_HEALTH, "Rice").status).toBe("unknown"));
  it("does not confuse pineapple or Applegate with apple", () =>
    expect(
      evaluateFodmapFit(UNKNOWN_HEALTH, "Applegate pineapple")
        .detectedHighFodmap,
    ).not.toContain("apple"));
  it("uses explicit FODMAP labels as evidence", () =>
    expect(
      evaluateFodmapFit(
        { ...UNKNOWN_HEALTH, labelsTags: ["en:low-fodmap"] },
        "Rice",
      ).status,
    ).toBe("match"));
  it("does not treat eggplant as egg or milk-free as milk", () =>
    expect(
      checkAllergens(UNKNOWN_HEALTH, "Eggplant milk-free snack", [
        "eggs",
        "dairy",
      ]),
    ).toEqual([]));
  it("does not let free claims override contrary ingredient evidence", () =>
    expect(
      checkAllergens(
        { ...UNKNOWN_HEALTH, ingredientsText: "milk powder" },
        "Dairy-free snack",
        ["dairy"],
      ),
    ).toEqual(["dairy"]));
  it("does not confuse almond milk with dairy", () =>
    expect(checkAllergens(UNKNOWN_HEALTH, "Almond milk", ["dairy"])).toEqual(
      [],
    ));
  it("excludes an allergy conflict rather than merely subtracting points", () => {
    const c = candidate("Peanut butter");
    expect(
      rankProducts({
        query: "peanut butter",
        candidates: [c],
        healthById: new Map([[c.providerProductId, UNKNOWN_HEALTH]]),
        allergies: ["peanuts"],
        dietModes: [],
        limit: 10,
      }),
    ).toEqual([]);
  });
  it("nutrition preferences still rank products without Nutri-Score", () => {
    const a = candidate("Yogurt", { providerProductId: "a" }),
      b = candidate("Yogurt", { providerProductId: "b" });
    const out = rankProducts({
      query: "yogurt",
      candidates: [a, b],
      healthById: new Map([
        ["a", { ...UNKNOWN_HEALTH, nutrition: { protein100g: 1 } }],
        ["b", { ...UNKNOWN_HEALTH, nutrition: { protein100g: 20 } }],
      ]),
      dietModes: ["high_protein"],
      limit: 2,
    });
    expect(out[0].providerProductId).toBe("b");
  });
  it("search expansion includes preferences with a bounded number of hints", () => {
    const q = buildShoppingQuery(
      "crackers",
      ["fodmap", "high_protein", "low_sugar"],
      ["dairy"],
      "bulk",
    );
    expect(q).toBe("crackers dairy free low FODMAP bulk multipack");
  });
});

describe("Open Prices observations", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  const price: OpenPriceItem = {
    id: 1,
    product_code: "012345678905",
    price: 3,
    currency: "USD",
    date: "2026-09-25",
    price_per: "UNIT",
    location: {
      osm_name: "Test",
      osm_address_country_code: "US",
      osm_address_postcode: "01752",
    },
  };
  it("accepts recent matching US observations and retains date", () =>
    expect(
      selectOpenPrice([price], price.product_code!, "01752", now)?.observedAt,
    ).toBe(price.date));
  it.each([
    { currency: "EUR" },
    { date: "2025-01-01" },
    { date: "2027-01-01" },
    { price_is_discounted: true },
    { price_per: "KILOGRAM" },
    { product_code: "000000000000" },
    { location: { osm_address_country_code: "FR" } },
    {
      location: {
        osm_address_country_code: "US",
        osm_address_postcode: "90210",
      },
    },
  ])("rejects irrelevant observation", (changes) =>
    expect(
      selectOpenPrice(
        [{ ...price, ...changes }],
        price.product_code!,
        "01752",
        now,
      ),
    ).toBeNull(),
  );
  it("falls back to another ZIP in the same state with explicit provenance", () => {
    const result = selectOpenPrice([price], price.product_code!, "01602", now);
    expect(result).toMatchObject({
      amount: 3, locationMatch: "state", state: "MA",
      postalCode: "01752", requestedPostalCode: "01602",
    });
  });
  it("prefers an older exact-ZIP observation over a newer cheaper state observation", () => {
    const exact = { ...price, id: 2, price: 5, date: "2026-09-20",
      location: { ...price.location, osm_address_postcode: "01602-1234" } };
    expect(selectOpenPrice([price, exact], price.product_code!, "01602", now))
      .toMatchObject({ amount: 5, locationMatch: "zip", postalCode: "01602" });
  });
  it("uses recency then price within the state fallback", () => {
    expect(selectOpenPrice([
      { ...price, date: "2026-09-20", price: 1 },
      { ...price, price: 4 }, price,
    ], price.product_code!, "01602", now)?.amount).toBe(3);
  });
  it("does not broaden an unknown requested ZIP or missing observation postcode", () => {
    expect(selectOpenPrice([price], price.product_code!, "99999", now)).toBeNull();
    expect(selectOpenPrice([{ ...price, location: { osm_address_country_code: "US" } }],
      price.product_code!, "01602", now)).toBeNull();
  });
  it("labels unlocalized US observations as country-level", () => {
    expect(selectOpenPrice([price], price.product_code!, undefined, now)?.locationMatch)
      .toBe("country");
  });
  it("chooses newest valid observation rather than array order", () =>
    expect(
      selectOpenPrice(
        [{ ...price, id: 2, date: "2026-09-20", price: 1 }, price],
        price.product_code!,
        undefined,
        now,
      )?.amount,
    ).toBe(3));
});

describe("ZIP state membership", () => {
  it("resolves leading zeros and ZIP+4 without confusing neighboring states", () => {
    expect(stateForZip("01602")).toBe("MA");
    expect(stateForZip("01752-1234")).toBe("MA");
    expect(stateForZip("02860")).toBe("RI");
    expect(stateForZip("06390")).toBe("NY"); // Fishers Island exception
    expect(stateForZip("90210")).toBe("CA");
    expect(stateForZip("20001")).toBe("DC");
  });
  it("rejects missing, malformed, or unassigned postcodes rather than guessing", () => {
    for (const zip of [undefined, "00000", "99999", "01602foo", "1602", "01602-12"])
      expect(stateForZip(zip)).toBeUndefined();
    expect(postalZip(" 01602-1234 ")).toBe("01602");
  });
});
