import { describe, expect, it } from "vitest";
import { parseMoney, normalizeQuery, uniqueStrings, clamp } from "@/lib/utils";

describe("parseMoney", () => {
  it("returns number directly if already a number", () => {
    expect(parseMoney(3.99)).toBe(3.99);
  });

  it("parses dollar-sign strings", () => {
    expect(parseMoney("$3.99")).toBe(3.99);
    expect(parseMoney("$ 3.99")).toBe(3.99);
  });

  it("parses strings without dollar sign", () => {
    expect(parseMoney("2.49")).toBe(2.49);
  });

  it("handles comma-separated thousands", () => {
    expect(parseMoney("$1,299.99")).toBe(1299.99);
  });

  it("returns null for non-numeric strings", () => {
    expect(parseMoney("free")).toBeNull();
    expect(parseMoney("")).toBeNull();
  });

  it("returns null for null/undefined/object", () => {
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney(undefined)).toBeNull();
    expect(parseMoney({})).toBeNull();
  });

  it("returns null for Infinity", () => {
    expect(parseMoney(Infinity)).toBeNull();
  });
});

describe("normalizeQuery", () => {
  it("trims whitespace", () => {
    expect(normalizeQuery("  mac and cheese  ")).toBe("mac and cheese");
  });

  it("lowercases", () => {
    expect(normalizeQuery("Greek Yogurt")).toBe("greek yogurt");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeQuery("potato   chips")).toBe("potato chips");
  });
});

describe("uniqueStrings", () => {
  it("deduplicates strings", () => {
    expect(uniqueStrings(["a", "b", "a", "c"])).toEqual(["a", "b", "c"]);
  });

  it("trims each string", () => {
    expect(uniqueStrings([" milk ", "eggs", " milk"])).toEqual(["milk", "eggs"]);
  });

  it("filters empty strings", () => {
    expect(uniqueStrings(["", "milk", "  "])).toEqual(["milk"]);
  });

  it("returns empty array for all-empty input", () => {
    expect(uniqueStrings(["", "  "])).toEqual([]);
  });
});

describe("clamp", () => {
  it("clamps to min", () => {
    expect(clamp(-10, 0, 100)).toBe(0);
  });

  it("clamps to max", () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it("passes through value within range", () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it("handles boundary values", () => {
    expect(clamp(0, 0, 100)).toBe(0);
    expect(clamp(100, 0, 100)).toBe(100);
  });
});
