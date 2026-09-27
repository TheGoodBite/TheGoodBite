import { z } from "zod";
import {
  ApiError,
  handleRouteError,
  requireUserAndEntitlement,
} from "@/lib/api";
import { requireAdminSupabase } from "@/lib/supabase";

const schema = z.object({
  listId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  query: z.string().trim().min(1).max(160),
  product: z.object({
    provider: z.string(),
    providerProductId: z.string(),
    upc: z.string().optional(),
    title: z.string(),
    brand: z.string().optional(),
    estimatedPrice: z.number().nonnegative().nullable(),
    imageUrl: z.string().optional(),
    productUrl: z.string().optional(),
  }),
});

export async function POST(request: Request) {
  try {
    const { user, entitlement } = await requireUserAndEntitlement(request);
    if (!entitlement.canTrackBought)
      throw new ApiError("Bought history is a paid feature.", 402);

    const body = schema.parse(await request.json());
    const supabase = requireAdminSupabase();
    const { error } = await supabase.rpc("record_grocery_purchase", {
      p_user_id: user.id,
      p_list_id: body.listId ?? null,
      p_item_id: body.itemId ?? null,
      p_query: body.query,
      p_product: body.product,
    });
    if (error?.code === "42501")
      throw new ApiError("List or item not found.", 404);
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
