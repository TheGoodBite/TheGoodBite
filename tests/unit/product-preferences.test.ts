import { describe, it, expect } from "vitest";
import { evaluateProductPreferences, sanitizeProductPreferences } from "@/lib/productPreferences";
import { restoreProductPreferences } from "@/lib/preferenceStorage";
import { fromOffProduct } from "@/lib/providers/openFoodFacts";
import { PRODUCT_PREFERENCE_IDS } from "@/lib/types";
import type { HealthInfo } from "@/lib/types";
import { UNKNOWN_HEALTH } from "@/lib/health";

const health = (attributes: HealthInfo["attributes"]): HealthInfo => ({ ...UNKNOWN_HEALTH, attributes });

describe("product attribute importance", () => {
  it.each(PRODUCT_PREFERENCE_IDS.filter(id => id !== "unwanted_ingredients"))(
    "%s accepts explicit matches and rejects unknown or conflicting mandatory evidence", id => {
      expect(evaluateProductPreferences(health({ [id]: { status: "known", match: 100 } }), { [id]: "mandatory" }).failedMandatory).toEqual([]);
      for (const attribute of [undefined, { status: "unknown" as const, match: 100 }, { status: "known" as const, match: 0 }]) {
        expect(evaluateProductPreferences(health({ [id]: attribute }), { [id]: "mandatory" }).failedMandatory).toHaveLength(1);
      }
    },
  );
  it("weights very important twice as much without silently excluding soft conflicts", () => {
    const h = health({ nutriscore: { status: "known", match: 100 }, nova: { status: "known", match: 0 } });
    const important = evaluateProductPreferences(h, { nutriscore: "important", nova: "important" });
    const very = evaluateProductPreferences(h, { nutriscore: "very_important", nova: "important" });
    expect(important.score).toBe(50);
    expect(very.score).toBe(67);
    expect(very.failedMandatory).toEqual([]);
  });
  it("requires full absence evidence for allergens; traces never meet mandatory", () => {
    expect(evaluateProductPreferences(health({ allergens_no_milk: { status: "known", match: 20 } }), { allergens_no_milk: "mandatory" }).failedMandatory).toHaveLength(1);
  });
  it("mandatory quality admits A/B-level matches but not middling evidence", () => {
    expect(evaluateProductPreferences(health({ nutriscore: { status: "known", match: 80 } }), { nutriscore: "mandatory" }).failedMandatory).toEqual([]);
    expect(evaluateProductPreferences(health({ nutriscore: { status: "known", match: 60 } }), { nutriscore: "mandatory" }).failedMandatory).toHaveLength(1);
  });
  it("ignores not-important and not-applicable attributes", () => {
    expect(evaluateProductPreferences(health({ nutriscore: { status: "not-applicable" } }), { nutriscore: "mandatory", nova: "not_important" }).active).toBe(false);
  });
  it.each([NaN, Infinity, -1, 101])("rejects invalid match scores %s as missing evidence", match => {
    const fit = evaluateProductPreferences(health({ nova: { status: "known", match } }), { nova: "mandatory" });
    expect(fit.unknown).toHaveLength(1);
    expect(fit.failedMandatory).toHaveLength(1);
  });
  it("maps provider attributes including fat and ingredient tags", () => {
    const mapped = fromOffProduct({ code: "012345678905", product_name: "Fixture",
      nutriments: { fat_100g: 3 }, ingredients_tags: ["en:salt"],
      attribute_groups_en: [{ attributes: [{ id: "low_fat", status: "known", match: 100 }, { id: "unexpected", status: "known", match: 100 }] }],
    }, "catalog");
    expect(mapped.nutrition.fat100g).toBe(3);
    expect(mapped.ingredientsTags).toEqual(["en:salt"]);
    expect(mapped.attributes).toEqual({ low_fat: { status: "known", match: 100 } });
  });
});

describe("unwanted ingredients", () => {
  it("rejects named ingredients and plurals without substring false positives", () => {
    const h: HealthInfo = { ...UNKNOWN_HEALTH, ingredientsText: "Garlic, onions, salt", ingredientsTags: ["en:garlic", "en:onion", "en:salt"] };
    expect(evaluateProductPreferences(h, { unwanted_ingredients: "mandatory" }, ["onion"]).failedMandatory).toHaveLength(1);
    expect(evaluateProductPreferences(h, { unwanted_ingredients: "mandatory" }, ["lic"]).failedMandatory).toEqual([]);
  });
  it("requires ingredient analysis and configured terms before claiming absence", () => {
    for (const h of [UNKNOWN_HEALTH, { ...UNKNOWN_HEALTH, ingredientsText: "Water" }])
      expect(evaluateProductPreferences(h, { unwanted_ingredients: "mandatory" }, ["garlic"]).unknown).toHaveLength(1);
    expect(evaluateProductPreferences({ ...UNKNOWN_HEALTH, ingredientsTags: ["en:water"] }, { unwanted_ingredients: "mandatory" }, []).unknown).toHaveLength(1);
  });
  it("recognizes canonical ingredient tags when the text is missing", () => {
    const h = { ...UNKNOWN_HEALTH, ingredientsTags: ["en:palm-oil"] };
    expect(evaluateProductPreferences(h, { unwanted_ingredients: "mandatory" }, ["palm oil"]).failedMandatory).toHaveLength(1);
  });
});

describe("preference persistence migration", () => {
  it("preserves existing allergies as mandatory and removes duplicate legacy controls", () => {
    const restored = restoreProductPreferences({ allergies: ["dairy", "shellfish"], dietModes: ["low_sugar", "vegan", "high_protein"] });
    expect(restored.preferences).toMatchObject({ allergens_no_milk: "mandatory", allergens_no_crustaceans: "mandatory", allergens_no_molluscs: "mandatory", low_sugars: "important", vegan: "mandatory" });
    expect(restored.modes).toEqual(["high_protein"]);
  });
  it("honors explicitly changed importance and ignores invalid persisted values", () => {
    const restored = restoreProductPreferences({ allergies: ["dairy"], productPreferences: { allergens_no_milk: "not_important", nova: "very_important", invalid: "mandatory", low_salt: "typo" } });
    expect(restored.preferences).toEqual({ allergens_no_milk: "not_important", nova: "very_important" });
    expect(sanitizeProductPreferences(null)).toEqual({});
  });
});
