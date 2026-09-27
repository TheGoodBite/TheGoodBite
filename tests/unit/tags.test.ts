import { describe, expect, it } from "vitest";
import { extractTags } from "@/lib/tags";
import type { HealthInfo } from "@/lib/types";

describe("extractTags", () => {
  const baseHealth: HealthInfo = {
    nutriScore: "a",
    novaGroup: 1,
    classification: "strict",
    confidence: "high",
    nutrition: {
      protein100g: 12,
      sugars100g: 2,
      sodium100g: 0.1
    },
    labelsTags: ["en:organic", "en:vegan"],
    categoriesTags: [],
    allergensTags: []
  };

  it("extracts organic, vegan, and high protein tags correctly", () => {
    const tags = extractTags(baseHealth, "Organic Whole Almond Milk");
    const tagIds = tags.map((t) => t.id);
    expect(tagIds).toContain("organic");
    expect(tagIds).toContain("vegan");
    expect(tagIds).toContain("high_protein");
  });

  it("detects artificial sweeteners and high sugar", () => {
    const health: HealthInfo = {
      ...baseHealth,
      nutrition: { sugars100g: 20 },
      ingredientsText: "Water, sucralose, artificial flavor, sugar"
    };
    const tags = extractTags(health, "Sweet Soda Drink");
    const tagIds = tags.map((t) => t.id);
    expect(tagIds).toContain("sweeteners");
    expect(tagIds).toContain("high_sugar");
  });

  it("detects NOVA 4 ultra-processed food", () => {
    const health: HealthInfo = {
      ...baseHealth,
      novaGroup: 4
    };
    const tags = extractTags(health, "Potato Chips");
    const tagIds = tags.map((t) => t.id);
    expect(tagIds).toContain("nova4");
  });
});
