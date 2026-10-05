import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ProductDetail } from "@/components/ProductDetail";
import { NutriScoreBadge, priceLabel } from "@/components/ProductPresentation";
import { UNKNOWN_HEALTH } from "@/lib/health";
import type { RankedProduct } from "@/lib/types";
const product: RankedProduct = { provider: "open_food_facts", providerProductId: "test", title: "Wholegrain cereal", estimatedPrice: null, health: { ...UNKNOWN_HEALTH, nutriScore: "a", nutrition: { protein100g: 10 }, servingSize: "40 g", servingQuantity: 40 }, dietFit: { score: 0, matchedModes: [], warnings: [] }, explanation: "Category fit, then Nutri-Score" };
it("renders the nutrition grade and serving facts without a composite score", () => {
  const html = renderToStaticMarkup(createElement(ProductDetail, { product, allergies: [], bought: false, busy: false, onBought: () => {}, onOptions: () => {} }));
  expect(html).toContain("Nutri-Score A");
  expect(html).toContain("Per serving");
  expect(html).toContain("4g");
  expect(html).toContain("How is this nutrition grade calculated?");
  expect(html).not.toContain("NaN");
  expect(html).not.toContain("/100");
  expect(html).not.toContain("Match score");
});
it("shows unknown prices and grades for malformed legacy fields", () => {
  const legacy = { ...product, estimatedPrice: NaN, health: { ...product.health, nutriScore: undefined } } as unknown as RankedProduct;
  expect(priceLabel(legacy)).toBe("Price unknown");
  const html = renderToStaticMarkup(createElement(NutriScoreBadge, { product: legacy }));
  expect(html).toContain("Nutri-Score unavailable");
  expect(html).not.toContain("NaN");
});
