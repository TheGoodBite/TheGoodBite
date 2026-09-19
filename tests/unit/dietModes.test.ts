import { describe, expect, it } from "vitest";
import { scoreDietFit, sanitizeDietModes, isDietMode } from "@/lib/dietModes";
import { UNKNOWN_HEALTH } from "@/lib/health";
import type { HealthInfo } from "@/lib/types";

function makeHealth(overrides: Partial<HealthInfo>): HealthInfo {
  return { ...UNKNOWN_HEALTH, ...overrides };
}

describe("isDietMode", () => {
  it("returns true for valid diet modes", () => {
    expect(isDietMode("high_protein")).toBe(true);
    expect(isDietMode("low_sugar")).toBe(true);
    expect(isDietMode("vegan")).toBe(true);
  });

  it("returns false for invalid strings", () => {
    expect(isDietMode("keto")).toBe(false);
    expect(isDietMode("")).toBe(false);
    expect(isDietMode("HIGH_PROTEIN")).toBe(false);
  });
});

describe("sanitizeDietModes", () => {
  it("filters valid modes only", () => {
    expect(sanitizeDietModes(["high_protein", "keto", "vegan"])).toEqual(["high_protein", "vegan"]);
  });

  it("returns empty array for non-array input", () => {
    expect(sanitizeDietModes(null)).toEqual([]);
    expect(sanitizeDietModes("high_protein")).toEqual([]);
    expect(sanitizeDietModes(undefined)).toEqual([]);
  });

  it("returns empty for all-invalid modes", () => {
    expect(sanitizeDietModes(["keto", "carnivore"])).toEqual([]);
  });
});

describe("scoreDietFit", () => {
  it("returns score 0 with no modes", () => {
    const result = scoreDietFit(UNKNOWN_HEALTH, []);
    expect(result.score).toBe(0);
    expect(result.matchedModes).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  describe("high_protein", () => {
    it("gives high score for protein-rich products", () => {
      const h = makeHealth({ nutrition: { protein100g: 20 } });
      const result = scoreDietFit(h, ["high_protein"]);
      expect(result.score).toBeGreaterThan(60);
      expect(result.matchedModes).toContain("high_protein");
    });

    it("penalizes low-protein products", () => {
      const h = makeHealth({ nutrition: { protein100g: 2 } });
      const result = scoreDietFit(h, ["high_protein"]);
      expect(result.score).toBeLessThan(40);
      expect(result.warnings).toContain("Lower protein");
    });

    it("returns 45 when protein is unknown", () => {
      const result = scoreDietFit(makeHealth({ nutrition: {} }), ["high_protein"]);
      expect(result.score).toBe(45);
    });
  });

  describe("low_sugar", () => {
    it("gives high score for low-sugar products", () => {
      const h = makeHealth({ nutrition: { sugars100g: 1 } });
      const result = scoreDietFit(h, ["low_sugar"]);
      expect(result.score).toBeGreaterThan(80);
      expect(result.matchedModes).toContain("low_sugar");
    });

    it("penalizes high-sugar products", () => {
      const h = makeHealth({ nutrition: { sugars100g: 25 } });
      const result = scoreDietFit(h, ["low_sugar"]);
      expect(result.score).toBe(0);
      expect(result.warnings).toContain("Higher sugar");
    });
  });

  describe("diabetes_conscious", () => {
    it("is stricter than low_sugar (lower threshold)", () => {
      const h = makeHealth({ nutrition: { sugars100g: 8 } });
      const lowSugar = scoreDietFit(h, ["low_sugar"]);
      const diabetes = scoreDietFit(h, ["diabetes_conscious"]);
      expect(diabetes.score).toBeLessThanOrEqual(lowSugar.score);
    });
  });

  describe("low_sodium", () => {
    it("penalizes high sodium", () => {
      const h = makeHealth({ nutrition: { sodium100g: 0.9 } });
      const result = scoreDietFit(h, ["low_sodium"]);
      expect(result.score).toBeLessThan(40);
      expect(result.warnings).toContain("Higher sodium");
    });

    it("rewards low sodium", () => {
      const h = makeHealth({ nutrition: { sodium100g: 0.05 } });
      const result = scoreDietFit(h, ["low_sodium"]);
      expect(result.score).toBeGreaterThan(80);
      expect(result.matchedModes).toContain("low_sodium");
    });
  });

  describe("vegetarian", () => {
    it("penalizes beef in ingredients", () => {
      const h = makeHealth({ ingredientsText: "beef, water, salt" });
      const result = scoreDietFit(h, ["vegetarian"]);
      expect(result.score).toBe(0);
      expect(result.warnings).toContain("Likely not vegetarian");
    });

    it("passes for products without animal terms", () => {
      const h = makeHealth({ ingredientsText: "oats, sugar, cinnamon" });
      const result = scoreDietFit(h, ["vegetarian"]);
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe("vegan", () => {
    it("penalizes egg in ingredients", () => {
      const h = makeHealth({ ingredientsText: "flour, egg, sugar" });
      const result = scoreDietFit(h, ["vegan"]);
      expect(result.score).toBe(0);
      expect(result.warnings).toContain("Likely not vegan");
    });

    it("rewards explicit vegan labels", () => {
      const h = makeHealth({ labelsTags: ["en:vegan"] });
      const result = scoreDietFit(h, ["vegan"]);
      expect(result.score).toBe(100);
    });
  });

  describe("gluten_free", () => {
    it("penalizes wheat in ingredients", () => {
      const h = makeHealth({ ingredientsText: "enriched wheat flour, salt" });
      const result = scoreDietFit(h, ["gluten_free"]);
      expect(result.score).toBe(0);
      expect(result.warnings).toContain("Likely contains gluten");
    });

    it("rewards gluten-free label", () => {
      const h = makeHealth({ labelsTags: ["en:gluten-free"] });
      const result = scoreDietFit(h, ["gluten_free"]);
      expect(result.score).toBe(100);
    });
  });

  describe("multiple modes averaging", () => {
    it("averages score across modes", () => {
      const h = makeHealth({ nutrition: { protein100g: 20, sugars100g: 20 } });
      const highProtein = scoreDietFit(h, ["high_protein"]);
      const lowSugar = scoreDietFit(h, ["low_sugar"]);
      const both = scoreDietFit(h, ["high_protein", "low_sugar"]);
      const expected = Math.round((highProtein.score + lowSugar.score) / 2);
      expect(both.score).toBe(expected);
    });
  });
});
