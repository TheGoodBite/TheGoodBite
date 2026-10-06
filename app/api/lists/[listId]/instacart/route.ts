import { handleRouteError, requireUserAndEntitlement } from "@/lib/api";
import { reviewedSnapshot } from "@/lib/listRepository";
import { exportInstacart, siteUrl } from "@/lib/instacart";
import { PRIVATE_HEADERS } from "@/lib/listSharing";
export async function POST(request: Request, context: { params: Promise<{ listId: string }> }) {
  try {
    const { user } = await requireUserAndEntitlement(request);
    const { listId } = await context.params;
    const snapshot = await reviewedSnapshot(user.id, listId, await request.json());
    return Response.json(await exportInstacart(snapshot, `owner:${user.id}`, siteUrl(`/?list=${listId}`)), { headers: PRIVATE_HEADERS });
  } catch (error) { return handleRouteError(error); }
}
