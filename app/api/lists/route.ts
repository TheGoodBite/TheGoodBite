import { z } from "zod";
import { ApiError, handleRouteError, requireUserAndEntitlement } from "@/lib/api";
import { requireAdminSupabase } from "@/lib/supabase";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  items: z.array(z.string().min(1).max(160)).min(1).max(100)
});

export async function GET(request: Request) {
  try {
    const { user, entitlement } = await requireUserAndEntitlement(request);
    if (!entitlement.canSaveLists) throw new ApiError("Saved lists are a paid feature.", 402);

    const supabase = requireAdminSupabase();
    const { data, error } = await supabase
      .from("grocery_lists")
      .select("id, name, created_at, updated_at, grocery_list_items(id, query, sort_order, is_active)")
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
    if (!entitlement.canSaveLists) throw new ApiError("Saved lists are a paid feature.", 402);

    const body = createSchema.parse(await request.json());
    const supabase = requireAdminSupabase();

    const { data: list, error } = await supabase
      .from("grocery_lists")
      .insert({ user_id: user.id, name: body.name })
      .select("id, name, created_at, updated_at")
      .single();

    if (error) throw error;

    const items = body.items.map((query, index) => ({
      list_id: list.id,
      query,
      sort_order: index
    }));
    const { error: itemError } = await supabase.from("grocery_list_items").insert(items);
    if (itemError) throw itemError;

    return Response.json({ list });
  } catch (error) {
    return handleRouteError(error);
  }
}
