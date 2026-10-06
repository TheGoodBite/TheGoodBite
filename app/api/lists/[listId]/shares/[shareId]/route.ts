import { z } from "zod";
import { ApiError, handleRouteError, requireUserAndEntitlement } from "@/lib/api";
import { ownedList } from "@/lib/listRepository";
import { requireAdminSupabase } from "@/lib/supabase";
import { PRIVATE_HEADERS } from "@/lib/listSharing";
export async function DELETE(request: Request, context: { params: Promise<{ listId: string; shareId: string }> }) {
  try {
    const { user } = await requireUserAndEntitlement(request);
    const { listId, shareId } = await context.params;
    z.string().uuid().parse(shareId);
    await ownedList(user.id, listId);
    const { data, error } = await requireAdminSupabase().from("grocery_list_shares")
      .update({ revoked_at: new Date().toISOString() }).eq("id", shareId).eq("list_id", listId).eq("user_id", user.id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError("Share not found.", 404);
    return Response.json({ ok: true }, { headers: PRIVATE_HEADERS });
  } catch (error) { return handleRouteError(error); }
}
