import { normalizeQuery } from "@/lib/utils";

export type GroceryDraft = {
  name: string;
  items: string[];
  input: string;
  checked: string[];
  activeListId: string | null;
  itemIds: Record<string, string>;
};
export const EMPTY_GROCERY_DRAFT: GroceryDraft = {
  name: "Weekly groceries", items: [], input: "", checked: [], activeListId: null, itemIds: {},
};
const key = (ownerId: string | null) => `meezany_draft:v1:${ownerId ?? "guest"}`;
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function parse(raw: string | null): GroceryDraft | null {
  try {
    const value = JSON.parse(raw || "null");
    if (value?.version !== 1 || typeof value.name !== "string" || !value.name.trim() || value.name.length > 120 ||
      !Array.isArray(value.items) || value.items.length > 100 ||
      value.items.some((item: unknown) => typeof item !== "string" || !item.trim() || item.length > 160) ||
      typeof value.input !== "string" || value.input.length > 20000 || !Array.isArray(value.checked) || value.checked.length > 100) return null;
    const seen = new Set<string>();
    const items: string[] = value.items.filter((item: string) => {
      const normalized = normalizeQuery(item);
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
    const activeListId = typeof value.activeListId === "string" && uuid.test(value.activeListId) ? value.activeListId : null;
    const itemIds = Object.fromEntries(Object.entries(value.itemIds ?? {}).filter(([query, id]) =>
      seen.has(query) && typeof id === "string" && uuid.test(id)));
    return { name: value.name, items, input: value.input,
      checked: [...new Set<string>(value.checked.filter((query: unknown) => typeof query === "string" && seen.has(query)))],
      activeListId, itemIds: activeListId ? itemIds as Record<string, string> : {},
    };
  } catch { return null; }
}

export function readGroceryDraft(storage: DraftStorage, ownerId: string | null) {
  try {
    const guest = ownerId ? parse(storage.getItem(key(null))) : null;
    // The list entered immediately before signing in takes precedence over an
    // older account draft. An empty guest screen must not replace an account list.
    if (guest && (guest.items.length || guest.input.trim()))
      return { draft: { ...guest, activeListId: null, itemIds: {} }, adoptedGuest: true };
    const own = parse(storage.getItem(key(ownerId)));
    return { draft: own ? ownerId ? own : { ...own, activeListId: null, itemIds: {} } : null, adoptedGuest: false };
  } catch { return { draft: null, adoptedGuest: false }; }
}

export function writeGroceryDraft(storage: DraftStorage, ownerId: string | null, draft: GroceryDraft, adoptedGuest = false) {
  try {
    storage.setItem(key(ownerId), JSON.stringify({ ...draft,
      ...(!ownerId ? { activeListId: null, itemIds: {} } : {}), version: 1 }));
    // Only remove the guest copy after its account copy was stored successfully.
    if (ownerId && adoptedGuest) storage.removeItem(key(null));
    return true;
  } catch { return false; }
}
