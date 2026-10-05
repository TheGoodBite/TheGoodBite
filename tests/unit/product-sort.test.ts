import { describe, expect, it } from "vitest";
import { compareProductPrices } from "@/lib/productSort";

describe("lowest package price", () => {
  it("moves known prices ahead of missing and invalid prices, regardless of ranking", () => {
    const products = [
      { id: "unknown", estimatedPrice: null },
      { id: "expensive", estimatedPrice: 6.99 },
      { id: "invalid", estimatedPrice: NaN },
      { id: "zero", estimatedPrice: 0 },
      { id: "negative", estimatedPrice: -1 },
      { id: "infinite", estimatedPrice: Infinity },
      { id: "cheap", estimatedPrice: 2.99 },
      { id: "same-price", estimatedPrice: 2.99 },
    ];
    expect(products.sort(compareProductPrices).map(p => p.id)).toEqual([
      "cheap", "same-price", "expensive", "unknown", "invalid", "zero", "negative", "infinite",
    ]);
  });

  it("preserves recommended order when every price is missing", () => {
    const products = [
      { id: "best", estimatedPrice: null }, { id: "next", estimatedPrice: null },
    ];
    expect(compareProductPrices(products[0], products[1])).toBe(0);
    expect([...products].sort(compareProductPrices)).toEqual(products);
  });

  it("compares package prices even when products have different units", () => {
    const products = [
      { estimatedPrice: 6, unitPrice: { amount: 0.6, unit: "100ml" } },
      { estimatedPrice: 3, unitPrice: { amount: 3, unit: "100g" } },
    ];
    expect(products.sort(compareProductPrices)[0].estimatedPrice).toBe(3);
  });
});
