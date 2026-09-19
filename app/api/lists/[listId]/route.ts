import { z } from "zod";
import { ApiError, handleRouteError, requireUserAndEntitlement } from "@/lib/api";
import { requireAdminSupabase } from "@/lib/supabase";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  items: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        query: z.string().min(1).max(160),
        sort_order: z.number().int().nonnegative(),
        is_active: z.boolean().optional()
      })
    )
    .optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await context.params;
    const { user, entitlement } = await requireUserAndEntitlement(request);
    if (!entitlement.canSaveLists) throw new ApiError("Saved lists are a paid feature.", 402);

    const body = updateSchema.parse(await request.json());
    const supabase = requireAdminSupabase();
    await assertOwnsList(supabase, user.id, listId);

    if (body.name) {
      const { error } = await supabase
        .from("grocery_lists")
        .update({ name: body.name, updated_at: new Date().toISOString() })
        .eq("id", listId);
      if (error) throw error;
    }

    if (body.items) {
      const rows = body.items.map((item) => ({
        id: item.id,
        list_id: listId,
        query: item.query,
        sort_order: item.sort_order,
        is_active: item.is_active ?? true
      }));
      const { error } = await supabase.from("grocery_list_items").upsert(rows);
      if (error) throw error;
    }

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await context.params;
    const { user, entitlement } = await requireUserAndEntitlement(request);
    if (!entitlement.canSaveLists) throw new ApiError("Saved lists are a paid feature.", 402);

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

async function assertOwnsList(supabase: ReturnType<typeof requireAdminSupabase>, userId: string, listId: string) {
  const { data, error } = await supabase
    .from("grocery_lists")
    .select("id")
    .eq("id", listId)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .single();

  if (error || !data) throw new ApiError("List not found.", 404);
}
