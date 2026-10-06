import { beforeEach, describe, expect, it, vi } from "vitest";
const { result, eq } = vi.hoisted(() => {
  const result = vi.fn(), eq = vi.fn();
  return { result, eq };
});
vi.mock("@/lib/supabase", () => ({ requireAdminSupabase: () => {
  const chain = { select: () => chain, eq, is: () => chain, maybeSingle: result };
  eq.mockReturnValue(chain);
  return { from: () => chain };
} }));
import { ownedList, reviewedSnapshot, sharedSnapshot } from "@/lib/listRepository";
const id = "00000000-0000-4000-8000-000000000001";
const itemId = "00000000-0000-4000-8000-000000000002";
const list = { id, name: "Weekly", updated_at: "revision", grocery_list_items: [{ id: itemId, query: "Onion", sort_order: 0, is_active: true, quantity: 3, unit: "each", selected_product: null }] };
beforeEach(() => vi.clearAllMocks());
describe("list and snapshot access", () => {
  it("scopes private reads to the authenticated owner and active parent", async () => {
    result.mockResolvedValueOnce({ data: null });
    await expect(ownedList("owner", id)).rejects.toMatchObject({ status: 404 });
    expect(eq).toHaveBeenCalledWith("user_id", "owner"); expect(eq).toHaveBeenCalledWith("is_deleted", false);
  });
  it("rejects stale reviews and foreign item IDs", async () => {
    result.mockResolvedValue({ data: list });
    await expect(reviewedSnapshot("owner", id, { itemIds: [itemId], revision: "old" })).rejects.toMatchObject({ status: 409 });
    await expect(reviewedSnapshot("owner", id, { itemIds: [id], revision: "revision" })).rejects.toMatchObject({ status: 409 });
  });
  it("constructs snapshots from saved items, not client-supplied products", async () => {
    result.mockResolvedValue({ data: list });
    expect(await reviewedSnapshot("owner", id, { itemIds: [itemId], revision: "revision", items: [{ query: "Injected" }] }))
      .toEqual({ name: "Weekly", items: [{ query: "Onion", quantity: 3, unit: "each", selectedProduct: null }] });
  });
  it("rejects malformed and revoked share links", async () => {
    await expect(sharedSnapshot("guess")).rejects.toMatchObject({ status: 404 });
    expect(result).not.toHaveBeenCalled();
    result.mockResolvedValueOnce({ data: null });
    await expect(sharedSnapshot("a".repeat(64))).rejects.toMatchObject({ status: 404 });
  });
  it("rejects shares whose parent was deleted", async () => {
    result.mockResolvedValueOnce({ data: { id, list_id: id, snapshot: {} } }).mockResolvedValueOnce({ data: null });
    await expect(sharedSnapshot("a".repeat(64))).rejects.toMatchObject({ status: 404 });
  });
});
