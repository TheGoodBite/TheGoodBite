import { handleRouteError } from "@/lib/api";
import { sharedSnapshot } from "@/lib/listRepository";
import { exportInstacart, siteUrl } from "@/lib/instacart";
import { PRIVATE_HEADERS } from "@/lib/listSharing";
export async function POST(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const shared = await sharedSnapshot(token);
    return Response.json(await exportInstacart(shared.snapshot, `share:${shared.id}`, siteUrl(`/share/${token}`)), { headers: PRIVATE_HEADERS });
  } catch (error) { return handleRouteError(error); }
}
