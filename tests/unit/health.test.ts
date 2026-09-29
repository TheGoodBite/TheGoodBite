import { describe, expect, it } from "vitest";
import { scoreHealth, classifyHealth, hasNutritionInfo, UNKNOWN_HEALTH } from "@/lib/health";
import type { HealthInfo } from "@/lib/types";

function makeHealth(overrides: Partial<HealthInfo>): HealthInfo {
  return { ...UNKNOWN_HEALTH, ...overrides };
}

describe("scoreHealth", () => {
  it("gives 100 for nutri-score A", () => {
    expect(scoreHealth(makeHealth({ nutriScore: "a" }))).toBe(100);
  });

  it("gives 75 for nutri-score B", () => {
    expect(scoreHealth(makeHealth({ nutriScore: "b" }))).toBe(75);
  });

  it("gives 50 for nutri-score C", () => {
    expect(scoreHealth(makeHealth({ nutriScore: "c" }))).toBe(50);
  });

  it("gives 25 for nutri-score D", () => {
    expect(scoreHealth(makeHealth({ nutriScore: "d" }))).toBe(25);
  });

  it("gives 0 for nutri-score E", () => {
    expect(scoreHealth(makeHealth({ nutriScore: "e" }))).toBe(0);
  });

  it("gives 0 for unknown nutri-score", () => {
    expect(scoreHealth(makeHealth({ nutriScore: "unknown" }))).toBe(0);
  });

  it("keeps Nutri-Score as the primary signal and ranks NOVA 4 secondarily", () => {
    expect(scoreHealth(makeHealth({ nutriScore: "a", novaGroup: 1 }))).toBe(100);
    expect(scoreHealth(makeHealth({ nutriScore: "a", novaGroup: 4 }))).toBe(90);
    expect(scoreHealth(makeHealth({ nutriScore: "a", novaGroup: 4 }))).toBeGreaterThan(
      scoreHealth(makeHealth({ nutriScore: "b", novaGroup: 1 })),
    );
  });

  it("returns 0 for fully unknown health", () => {
    expect(scoreHealth(UNKNOWN_HEALTH)).toBe(0);
  });
});

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
