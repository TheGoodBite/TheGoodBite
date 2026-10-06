import { z } from "zod";
import { ApiError } from "@/lib/api";
import { requireAdminSupabase } from "@/lib/supabase";
import { reviewSchema, snapshotSchema, shareTokenSchema, type ListSnapshot, type SelectedProduct, type ListUnit } from "@/lib/listSharing";

export const LIST_COLUMNS = "id, name, created_at, updated_at, grocery_list_items(id, query, sort_order, is_active, quantity, unit, selected_product)";
export type SavedItem = { id: string; query: string; sort_order: number; is_active: boolean; quantity: number; unit: ListUnit; selected_product: SelectedProduct | null };
export type SavedList = { id: string; name: string; updated_at: string; grocery_list_items: SavedItem[] };
export async function ownedList(userId: string, listId: string): Promise<SavedList> {
  z.string().uuid().parse(listId);
  const { data, error } = await requireAdminSupabase().from("grocery_lists")
    .select(LIST_COLUMNS).eq("id", listId).eq("user_id", userId).eq("is_deleted", false).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError("List not found.", 404);
  return data as unknown as SavedList;
}
export async function reviewedSnapshot(userId: string, listId: string, input: unknown): Promise<ListSnapshot> {
  const review = reviewSchema.parse(input);
  const list = await ownedList(userId, listId);
  if (list.updated_at !== review.revision) throw new ApiError("This list changed. Reopen the review and try again.", 409);
  const active = list.grocery_list_items.filter(item => item.is_active);
  if (review.itemIds.some(id => !active.some(item => item.id === id))) throw new ApiError("An item is no longer in this list. Review it again.", 409);
  return snapshotSchema.parse({ name: list.name, items: active
    .filter(item => review.itemIds.includes(item.id)).sort((a, b) => a.sort_order - b.sort_order)
    .map(item => ({ query: item.query, quantity: item.quantity, unit: item.unit, selectedProduct: item.selected_product })) });
}
export async function sharedSnapshot(token: string) {
  if (!shareTokenSchema.safeParse(token).success) throw new ApiError("This shared list is unavailable.", 404);
  const db = requireAdminSupabase();
  const { data, error } = await db.from("grocery_list_shares")
    .select("id, list_id, snapshot, created_at").eq("token", token).is("revoked_at", null).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError("This shared list is unavailable.", 404);
  const { data: parent, error: parentError } = await db.from("grocery_lists").select("id")
    .eq("id", data.list_id).eq("is_deleted", false).maybeSingle();
  if (parentError) throw parentError;
  if (!parent) throw new ApiError("This shared list is unavailable.", 404);
  return { id: data.id as string, createdAt: data.created_at as string, snapshot: snapshotSchema.parse(data.snapshot) };
}
export function listWriteError(error: { code?: string } | null) {
  if (error?.code === "42501") throw new ApiError("List or item not found.", 404);
  if (error?.code === "22023" || error?.code === "22P02" || error?.code === "23514") throw new ApiError("Invalid list update.", 400);
  if (error) throw error;
}
