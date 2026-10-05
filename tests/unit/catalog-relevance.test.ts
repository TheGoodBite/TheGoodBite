import { describe, expect, it } from "vitest";
import { matchesCatalogProductType } from "@/lib/catalogRelevance";

describe("milk beverage relevance", () => {
  it.each([
    "Miyoko's Creamery Oat Milk Butter",
    "Blue Stripes Whole Cacao Milk Chocolate Bar Oat Milk",
    "Oatly Sweet and creamy oat milk creamer",
    "Silk Half & Half Alternative",
    "Marks & Spencers Five Seed Almond Bars / Semi Oat",
    "Oat milk ice cream",
  ])("excludes the unrelated product %s", (product_name) => {
    expect(matchesCatalogProductType("oat milk", { product_name })).toBe(false);
  });

  it.each([
    "Mooala simple oat milk", "Silk oat", "Oat drink", "Chocolate oat milk",
    "Vanilla almond milk", "Whole milk", "Powdered milk",
  ])("keeps milk variants and alternate catalog names: %s", (product_name) => {
    expect(matchesCatalogProductType("milk", { product_name })).toBe(true);
  });

  it.each(["en:plant-based-butters", "en:milk-chocolates", "en:coffee-creamers"])(
    "uses an explicit incompatible category when the name is ambiguous: %s",
    (category) => {
      expect(matchesCatalogProductType("oat milk", {
        product_name: "Oat delight", categories_tags: [category],
      })).toBe(false);
    },
  );

  it("allows chocolate milk categories and missing taxonomy", () => {
    expect(matchesCatalogProductType("milk", {
      product_name: "Chocolate drink", categories_tags: ["en:chocolate-milks"],
    })).toBe(true);
    expect(matchesCatalogProductType("oat milk", { product_name: "Silk Oat" })).toBe(true);
  });

  it.each(["oat milk butter", "milk chocolate bar", "oat milk creamer", "milk chocolate", "oat milk ice cream"])(
    "does not block an explicitly requested derivative: %s", (query) => {
      expect(matchesCatalogProductType(query, { product_name: query })).toBe(true);
    },
  );

  it("leaves other catalog queries unchanged", () => {
    expect(matchesCatalogProductType("yogurt", { product_name: "Vanilla cultured coconut" })).toBe(true);
  });
});
