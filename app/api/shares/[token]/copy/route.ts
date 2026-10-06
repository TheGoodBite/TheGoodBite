import { handleRouteError, requireUserAndEntitlement } from "@/lib/api";
import { sharedSnapshot, listWriteError } from "@/lib/listRepository";
import { requireAdminSupabase } from "@/lib/supabase";
import { PRIVATE_HEADERS } from "@/lib/listSharing";
import { reserveBudget } from "@/lib/providerRuntime";
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { user } = await requireUserAndEntitlement(request);
    const { token } = await context.params;
    await sharedSnapshot(token);
    await reserveBudget(`copy:${user.id}`, 20, 60000);
    const { data: listId, error } = await requireAdminSupabase().rpc("copy_shared_grocery_list", { p_user_id: user.id, p_token: token });
    listWriteError(error);
    return Response.json({ listId }, { headers: PRIVATE_HEADERS });
  } catch (error) { return handleRouteError(error); }
}
