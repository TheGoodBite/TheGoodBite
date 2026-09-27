import { z } from "zod";
import {
  ApiError,
  handleRouteError,
  requireUserAndEntitlement,
} from "@/lib/api";
import { requireAdminSupabase } from "@/lib/supabase";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  items: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        query: z.string().min(1).max(160),
        sort_order: z.number().int().nonnegative(),
        is_active: z.boolean().optional(),
      }),
    )
    .max(100)
    .optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  try {
    const { listId } = z
      .object({ listId: z.string().uuid() })
      .parse(await context.params);
    const { user, entitlement } = await requireUserAndEntitlement(request);
    if (!entitlement.canSaveLists)
      throw new ApiError("Saved lists are a paid feature.", 402);

    const body = updateSchema.parse(await request.json());
    const supabase = requireAdminSupabase();
    const { error } = await supabase.rpc("save_grocery_list", {
      p_user_id: user.id,
      p_list_id: listId,
      p_name: body.name ?? null,
      p_items: body.items ?? null,
    });
    if (error?.code === "42501")
      throw new ApiError("List or item not found.", 404);
    if (error?.code === "22023" || error?.code === "22P02")
      throw new ApiError("Invalid list update.", 400);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ listId: string }> },
) {
  try {
    const { listId } = z
      .object({ listId: z.string().uuid() })
      .parse(await context.params);
    const { user, entitlement } = await requireUserAndEntitlement(request);
    if (!entitlement.canSaveLists)
      throw new ApiError("Saved lists are a paid feature.", 402);

    const supabase = requireAdminSupabase();
    await assertOwnsList(supabase, user.id, listId);

    const { error } = await supabase
      .from("grocery_lists")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("id", listId);
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function assertOwnsList(
  supabase: ReturnType<typeof requireAdminSupabase>,
  userId: string,
  listId: string,
) {
  const { data, error } = await supabase
    .from("grocery_lists")
    .select("id")
    .eq("id", listId)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .single();

  if (error || !data) throw new ApiError("List not found.", 404);
}
