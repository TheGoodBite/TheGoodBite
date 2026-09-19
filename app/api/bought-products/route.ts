import { z } from "zod";
import { ApiError, handleRouteError, requireUserAndEntitlement } from "@/lib/api";
import { requireAdminSupabase } from "@/lib/supabase";

const schema = z.object({
  listId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  query: z.string().min(1),
  product: z.object({
    provider: z.string(),
    providerProductId: z.string(),
    upc: z.string().optional(),
    title: z.string(),
    brand: z.string().optional(),
    estimatedPrice: z.number().nullable(),
    imageUrl: z.string().optional(),
    productUrl: z.string().optional()
  })
});

export async function POST(request: Request) {
  try {
    const { user, entitlement } = await requireUserAndEntitlement(request);
    if (!entitlement.canTrackBought) throw new ApiError("Bought history is a paid feature.", 402);

    const body = schema.parse(await request.json());
    const supabase = requireAdminSupabase();
    const { error } = await supabase.from("bought_products").insert({
      user_id: user.id,
      list_id: body.listId ?? null,
      item_id: body.itemId ?? null,
      query: body.query,
      provider: body.product.provider,
      provider_product_id: body.product.providerProductId,
      upc: body.product.upc ?? null,
      title: body.product.title,
      brand: body.product.brand ?? null,
      estimated_price: body.product.estimatedPrice,
      image_url: body.product.imageUrl ?? null,
      product_url: body.product.productUrl ?? null
    });

    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
