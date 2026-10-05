import { describe, expect, it } from "vitest";
import { EMPTY_GROCERY_DRAFT, readGroceryDraft, writeGroceryDraft, type GroceryDraft } from "@/lib/groceryDraft";
const draft: GroceryDraft = { ...EMPTY_GROCERY_DRAFT, name: "Weekend shop", items: ["peanuts", "cereal", "chicken sausage"], checked: ["cereal"], input: "milk\neggs" };
function storage() {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); }, removeItem: (key: string) => { map.delete(key); } };
}
describe("grocery draft persistence", () => {
  it("restores order, checkoffs, list name and text not yet added after a reload", () => {
    const store = storage();
    expect(writeGroceryDraft(store, null, draft)).toBe(true);
    expect(readGroceryDraft(store, null).draft).toEqual(draft);
  });
  it("moves the current guest list into the signed-in account without restoring stale IDs", () => {
    const store = storage();
    writeGroceryDraft(store, "account-a", { ...draft, items: ["old groceries"] });
    writeGroceryDraft(store, null, draft);
    const restored = readGroceryDraft(store, "account-a");
    expect(restored.draft).toEqual(draft);
    expect(restored.adoptedGuest).toBe(true);
    writeGroceryDraft(store, "account-a", restored.draft!, restored.adoptedGuest);
    expect(readGroceryDraft(store, null).draft).toBeNull();
    expect(readGroceryDraft(store, "account-a").draft).toEqual(draft);
  });
  it("keeps separate account drafts and never shows them to a signed-out visitor", () => {
    const store = storage();
    writeGroceryDraft(store, "account-a", draft);
    expect(readGroceryDraft(store, "account-b").draft).toBeNull();
    expect(readGroceryDraft(store, null).draft).toBeNull();
    writeGroceryDraft(store, null, EMPTY_GROCERY_DRAFT);
    expect(readGroceryDraft(store, "account-a").draft).toEqual(draft);
  });
  it("retains saved-list identity only for the matching account", () => {
    const store = storage();
    const saved = { ...draft, activeListId: "12345678-1234-1234-1234-123456789abc", itemIds: { cereal: "12345678-1234-1234-1234-123456789def" } };
    writeGroceryDraft(store, "account-a", saved);
    expect(readGroceryDraft(store, "account-a").draft).toEqual(saved);
    writeGroceryDraft(store, null, saved);
    expect(readGroceryDraft(store, null).draft).toMatchObject({ activeListId: null, itemIds: {} });
  });
  it("preserves the guest draft if storage fails during sign-in", () => {
    const store = storage();
    writeGroceryDraft(store, null, draft);
    const failing = { ...store, setItem: () => { throw new Error("quota exceeded"); } };
    expect(writeGroceryDraft(failing, "account-a", draft, true)).toBe(false);
    expect(readGroceryDraft(store, null).draft).toEqual(draft);
  });
  it.each(["not-json", '{"version":99}', JSON.stringify({ version: 1, ...draft, items: [null] }), JSON.stringify({ version: 1, ...draft, items: Array(101).fill("cereal") })])("ignores invalid storage: %s", value => {
    const store = storage(); store.setItem("meezany_draft:v1:guest", value);
    expect(readGroceryDraft(store, null).draft).toBeNull();
  });
  it("handles blocked browser storage without throwing", () => {
    const blocked = { getItem: () => { throw new Error("disabled"); }, setItem: () => { throw new Error("disabled"); }, removeItem: () => {} };
    expect(readGroceryDraft(blocked, null).draft).toBeNull();
    expect(writeGroceryDraft(blocked, null, draft)).toBe(false);
  });
  it("persists intentional clearing when starting a new list", () => {
    const store = storage(); writeGroceryDraft(store, null, draft);
    writeGroceryDraft(store, null, { ...EMPTY_GROCERY_DRAFT, name: "My grocery list" });
    expect(readGroceryDraft(store, null).draft?.items).toEqual([]);
  });
});
