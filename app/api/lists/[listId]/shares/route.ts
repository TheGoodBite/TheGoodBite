import { handleRouteError, requireUserAndEntitlement } from "@/lib/api";
import { ownedList, reviewedSnapshot } from "@/lib/listRepository";
import { requireAdminSupabase } from "@/lib/supabase";
import { PRIVATE_HEADERS } from "@/lib/listSharing";
import { reserveBudget } from "@/lib/providerRuntime";
import { siteUrl } from "@/lib/instacart";

type Context = { params: Promise<{ listId: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { user } = await requireUserAndEntitlement(request);
    const { listId } = await context.params;
    await ownedList(user.id, listId);
    const { data, error } = await requireAdminSupabase().from("grocery_list_shares")
      .select("id, token, created_at, revoked_at").eq("list_id", listId).eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ shares: data }, { headers: PRIVATE_HEADERS });
  } catch (error) { return handleRouteError(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const { user } = await requireUserAndEntitlement(request);
    const { listId } = await context.params;
    const snapshot = await reviewedSnapshot(user.id, listId, await request.json());
    await reserveBudget(`share:${user.id}`, 20, 60000);
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
    const url = siteUrl(`/share/${token}`);
    const { data, error } = await requireAdminSupabase().from("grocery_list_shares")
      .insert({ list_id: listId, user_id: user.id, token, snapshot }).select("id, token, created_at, revoked_at").single();
    if (error) throw error;
    return Response.json({ share: data, url }, { headers: PRIVATE_HEADERS });
  } catch (error) { return handleRouteError(error); }
}
