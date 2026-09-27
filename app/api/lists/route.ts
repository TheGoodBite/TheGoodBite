import { z } from "zod";
import {
  ApiError,
  handleRouteError,
  requireUserAndEntitlement,
} from "@/lib/api";
import { requireAdminSupabase } from "@/lib/supabase";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  items: z.array(z.string().min(1).max(160)).min(1).max(100),
});

export async function GET(request: Request) {
  try {
    const { user, entitlement } = await requireUserAndEntitlement(request);
    if (!entitlement.canSaveLists)
      throw new ApiError("Saved lists are a paid feature.", 402);

    const supabase = requireAdminSupabase();
    const { data, error } = await supabase
      .from("grocery_lists")
      .select(
        "id, name, created_at, updated_at, grocery_list_items(id, query, sort_order, is_active)",
      )
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return Response.json({ lists: data ?? [] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, entitlement } = await requireUserAndEntitlement(request);
    if (!entitlement.canSaveLists)
      throw new ApiError("Saved lists are a paid feature.", 402);

    const body = createSchema.parse(await request.json());
    const supabase = requireAdminSupabase();

    const { data: id, error } = await supabase.rpc("save_grocery_list", {
      p_user_id: user.id,
      p_list_id: null,
      p_name: body.name,
      p_items: body.items.map((query, sort_order) => ({ query, sort_order })),
    });
    if (error) throw error;
    const list = { id, name: body.name };
    return Response.json({ list });
  } catch (error) {
    return handleRouteError(error);
  }
}
