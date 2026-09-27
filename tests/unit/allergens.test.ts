import { describe, expect, it } from "vitest";
import { checkAllergens } from "@/lib/allergens";
import type { HealthInfo } from "@/lib/types";

describe("checkAllergens", () => {
  const baseHealth: HealthInfo = {
    nutriScore: "b",
    novaGroup: 2,
    classification: "fallback",
    confidence: "high",
    nutrition: {},
    labelsTags: [],
    categoriesTags: [],
    allergensTags: ["en:peanuts", "en:milk"]
  };

  it("returns empty list if no allergies selected", () => {
    const matched = checkAllergens(baseHealth, "Peanut Butter Crunch", []);
    expect(matched).toEqual([]);
  });

  it("matches peanuts from OFF allergen tags", () => {
    const matched = checkAllergens(baseHealth, "Peanut Butter Crunch", ["peanuts", "wheat"]);
    expect(matched).toContain("peanuts");
    expect(matched).not.toContain("wheat");
  });

  it("matches dairy/milk from ingredients text or tags", () => {
    const matched = checkAllergens(baseHealth, "Milk Chocolate Bar", ["dairy"]);
    expect(matched).toContain("dairy");
  });

  it("matches tree nuts from title keywords", () => {
    const health: HealthInfo = { ...baseHealth, allergensTags: [] };
    const matched = checkAllergens(health, "Roasted Almonds & Cashews", ["tree_nuts"]);
    expect(matched).toContain("tree_nuts");
  });
});
