import { describe, expect, it } from "vitest";
import { computePricePerServing } from "@/lib/pricing";

describe("computePricePerServing", () => {
  it("returns null when estimated price is missing or 0", () => {
    expect(computePricePerServing(null)).toBeNull();
    expect(computePricePerServing(0)).toBeNull();
  });

  it("calculates price per serving when servingsPerContainer is specified", () => {
    const result = computePricePerServing(4.00, undefined, 10);
    expect(result).not.toBeNull();
    expect(result?.formatted).toBe("$0.40 / serving");
    expect(result?.pricePerUnit).toBe(0.40);
  });

  it("calculates price per serving from title pack count", () => {
    const result = computePricePerServing(6.00, undefined, undefined, "Granola Protein Bars (12 pack)");
    expect(result).not.toBeNull();
    expect(result?.formatted).toBe("$0.50 / serving");
    expect(result?.pricePerUnit).toBe(0.50);
  });
});
