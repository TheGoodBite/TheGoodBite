import { describe, expect, it } from "vitest";
import { snapshotSchema, shoppingLines, instacartBarcode, defaultItemDetails } from "@/lib/listSharing";
import { readGroceryDraft, writeGroceryDraft, EMPTY_GROCERY_DRAFT } from "@/lib/groceryDraft";
const product = { provider: "open_food_facts", providerProductId: "012345678905", title: "Chosen oats", upc: "012345678905" };
describe("shopping snapshots", () => {
  it("strips account, location, prices and personalized scoring from shares", () => {
    const result = snapshotSchema.parse({ name: "Weekly", email: "private@example.com", zipCode: "01602", dietModes: ["vegan"],
      items: [{ query: "Oats", quantity: 2, unit: "package", id: "private-id", selectedProduct: { ...product, estimatedPrice: 4, overallScore: 98 }, chosenPreferences: "private" }] });
    expect(result).toEqual({ name: "Weekly", items: [{ query: "Oats", quantity: 2, unit: "package", selectedProduct: product }] });
  });
  it("sends generic names and explicit measurements without inferred products", () => {
    expect(shoppingLines({ name: "Weekly", items: [{ query: "Yellow onions", quantity: 3, unit: "each", selectedProduct: null }] }))
      .toEqual([{ name: "Yellow onions", display_text: "Yellow onions", line_item_measurements: [{ quantity: 3, unit: "each" }] }]);
  });
  it("normalizes leading zeros and combines repeated UPC package counts", () => {
    const result = shoppingLines({ name: "Weekly", items: [
      { query: "Breakfast oats", quantity: 2, unit: "package", selectedProduct: product },
      { query: "Baking oats", quantity: 3, unit: "package", selectedProduct: { ...product, upc: "00012345678905" } },
    ] });
    expect(result).toHaveLength(1);
    expect(result[0].upcs).toEqual(["00012345678905"]);
    expect(result[0].line_item_measurements).toEqual([{ quantity: 5, unit: "package" }]);
  });
  it("falls back to chosen product name when its barcode is invalid", () => {
    const result = shoppingLines({ name: "Weekly", items: [{ query: "Oats", quantity: 1, unit: "package", selectedProduct: { ...product, upc: "012345678906" } }] });
    expect(result[0].upcs).toBeUndefined();
    expect(result[0].name).toBe("Chosen oats");
    expect(instacartBarcode("4006381333931")).toBe("04006381333931");
  });
  it.each([0, -1, Infinity, NaN, 10001])("rejects invalid quantity %s", quantity => {
    expect(snapshotSchema.safeParse({ name: "List", items: [{ query: "Oats", quantity }] }).success).toBe(false);
  });
  it("requires complete product identity and whole package counts", () => {
    for (const patch of [{ unit: "kg" }, { quantity: 1.5 }, { selectedProduct: { title: "Oats" } }])
      expect(snapshotSchema.safeParse({ name: "List", items: [{ query: "Oats", quantity: 1, unit: "package", selectedProduct: product, ...patch }] }).success).toBe(false);
  });
  it("rejects unsafe image protocols and empty snapshots", () => {
    expect(snapshotSchema.safeParse({ name: "List", items: [] }).success).toBe(false);
    expect(snapshotSchema.safeParse({ name: "List", items: [{ query: "Oats", quantity: 1, unit: "package", selectedProduct: { ...product, imageUrl: "javascript:alert(1)" } }] }).success).toBe(false);
  });
  it("persists product choices and stable client keys in account drafts", () => {
    const map = new Map<string, string>();
    const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); }, removeItem: (key: string) => { map.delete(key); } };
    const item = { ...defaultItemDetails(), quantity: 2, unit: "package" as const, selectedProduct: product, chosenPreferences: "preferences" };
    const draft = { ...EMPTY_GROCERY_DRAFT, items: ["Oats"], itemDetails: { oats: item } };
    writeGroceryDraft(storage, "account-a", draft);
    expect(readGroceryDraft(storage, "account-a").draft).toEqual(draft);
    expect(readGroceryDraft(storage, "account-b").draft).toBeNull();
  });
});
