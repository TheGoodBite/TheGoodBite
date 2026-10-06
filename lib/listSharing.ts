import { z } from "zod";
import type { RankedProduct } from "@/lib/types";
import { validBarcode } from "@/lib/products";

export const LIST_UNITS = ["each", "package", "g", "kg", "oz", "lb", "ml", "l"] as const;
export type ListUnit = (typeof LIST_UNITS)[number];
const text = (max: number) => z.string().trim().min(1).max(max);
const photo = z.string().max(2048).url().refine(value => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "Product photos must use HTTPS");
export const selectedProductSchema = z.object({
  provider: text(80), providerProductId: text(200), title: text(500),
  brand: text(200).optional(), imageUrl: photo.optional(), packageSize: text(200).optional(),
  upc: z.string().max(14).optional(),
});
export type SelectedProduct = z.infer<typeof selectedProductSchema>;
export const quantitySchema = z.number().finite().positive().max(10000);
export const listItemFields = {
  query: text(160), quantity: quantitySchema.default(1), unit: z.enum(LIST_UNITS).default("each"),
  selectedProduct: selectedProductSchema.nullable().default(null),
};
export const snapshotItemSchema = z.object(listItemFields).refine(
  item => !item.selectedProduct || (item.unit === "package" && Number.isInteger(item.quantity)),
  "Chosen products need a whole number of packages",
);
export type SnapshotItem = z.infer<typeof snapshotItemSchema>;
export const snapshotSchema = z.object({ name: text(120), items: z.array(snapshotItemSchema).min(1).max(100) });
export type ListSnapshot = z.infer<typeof snapshotSchema>;
export type ItemDetails = Omit<SnapshotItem, "query"> & { clientId: string; chosenPreferences?: string };
export function defaultItemDetails(): ItemDetails {
  return { clientId: crypto.randomUUID(), quantity: 1, unit: "each", selectedProduct: null };
}
export function pickProduct(product: RankedProduct): SelectedProduct {
  return selectedProductSchema.parse({
    provider: product.provider, providerProductId: product.providerProductId,
    title: product.title, brand: product.brand || undefined,
    imageUrl: product.imageUrl?.startsWith("https://") ? product.imageUrl : undefined,
    packageSize: product.packageSize || undefined, upc: product.upc,
  });
}
export function instacartBarcode(value?: string) {
  const valid = validBarcode(value);
  return valid ? valid.padStart(14, "0") : undefined;
}
export type ShoppingLine = {
  name: string; display_text: string; upcs?: string[];
  line_item_measurements: { quantity: number; unit: ListUnit }[];
};
export function shoppingLines(snapshot: ListSnapshot): ShoppingLine[] {
  const lines: ShoppingLine[] = [];
  const barcodes = new Map<string, ShoppingLine>();
  for (const item of snapshotSchema.parse(snapshot).items) {
    const upc = instacartBarcode(item.selectedProduct?.upc);
    const previous = upc ? barcodes.get(upc) : undefined;
    if (previous) {
      previous.line_item_measurements[0].quantity += item.quantity;
      continue;
    }
    const name = item.selectedProduct?.title ?? item.query;
    const line: ShoppingLine = {
      name, display_text: name,
      ...(upc ? { upcs: [upc] } : {}),
      line_item_measurements: [{ quantity: item.quantity, unit: item.unit }],
    };
    if (upc) barcodes.set(upc, line);
    lines.push(line);
  }
  return lines;
}
export const shareTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const reviewSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1).max(100).refine(ids => new Set(ids).size === ids.length),
  revision: z.string().min(1).max(80),
});
export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
export type ShareSummary = { id: string; token: string; created_at: string; revoked_at: string | null };
