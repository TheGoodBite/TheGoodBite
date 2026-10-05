import { describe, expect, it } from "vitest";
import { classifyHealth, hasNutritionInfo, UNKNOWN_HEALTH } from "@/lib/health";
import type { HealthInfo } from "@/lib/types";

function makeHealth(overrides: Partial<HealthInfo>): HealthInfo {
  return { ...UNKNOWN_HEALTH, ...overrides };
}

describe("classifyHealth", () => {
  it("classifies as strict for A + NOVA <= 3", () => {
    const h = classifyHealth({ nutriScore: "a", novaGroup: 2, confidence: "high" });
    expect(h.classification).toBe("strict");
  });

  it("classifies as fallback for A + NOVA 4", () => {
    const h = classifyHealth({ nutriScore: "a", novaGroup: 4, confidence: "high" });
    expect(h.classification).toBe("fallback");
  });

  it("classifies as fallback for C", () => {
    const h = classifyHealth({ nutriScore: "c", novaGroup: null, confidence: "medium" });
    expect(h.classification).toBe("fallback");
  });

  it("classifies as unhealthy for D/E", () => {
    const d = classifyHealth({ nutriScore: "d", novaGroup: null, confidence: "medium" });
    const e = classifyHealth({ nutriScore: "e", novaGroup: null, confidence: "medium" });
    expect(d.classification).toBe("unhealthy");
    expect(e.classification).toBe("unhealthy");
  });

  it("classifies as unhealthy for NOVA 4 regardless of nutri-score", () => {
    const h = classifyHealth({ nutriScore: "unknown", novaGroup: 4, confidence: "low" });
    expect(h.classification).toBe("unhealthy");
  });

  it("normalizes nutri-score to lowercase", () => {
    const h = classifyHealth({ nutriScore: "A", novaGroup: null, confidence: "high" });
    expect(h.nutriScore).toBe("a");
  });

  it("returns unknown for null/undefined nutri-score", () => {
    const h = classifyHealth({ nutriScore: null, novaGroup: null, confidence: "low" });
    expect(h.nutriScore).toBe("unknown");
  });

  it("preserves nutrition fields", () => {
    const h = classifyHealth({
      nutriScore: "b",
      novaGroup: 2,
      confidence: "high",
      nutrition: { protein100g: 12, sugars100g: 4, sodium100g: 0.2 }
    });
    expect(h.nutrition.protein100g).toBe(12);
    expect(h.nutrition.sugars100g).toBe(4);
    expect(h.nutrition.sodium100g).toBe(0.2);
  });

  it("preserves Open Food Facts numeric Nutri-Score", () => {
    const h = classifyHealth({ nutriScore: "a", nutriScoreScore: -7, confidence: "high" });
    expect(h.nutriScoreScore).toBe(-7);
  });
});

describe("hasNutritionInfo", () => {
  it("returns true if nutriScore is present", () => {
    expect(hasNutritionInfo(makeHealth({ nutriScore: "a" }))).toBe(true);
  });

  it("returns true if novaGroup is present", () => {
    expect(hasNutritionInfo(makeHealth({ novaGroup: 1 }))).toBe(true);
  });

  it("returns true if any macro is present in nutrition object", () => {
    expect(hasNutritionInfo(makeHealth({ nutrition: { protein100g: 10 } }))).toBe(true);
  });

  it("returns false for UNKNOWN_HEALTH with no nutrition macros", () => {
    expect(hasNutritionInfo(UNKNOWN_HEALTH)).toBe(false);
  });
});
