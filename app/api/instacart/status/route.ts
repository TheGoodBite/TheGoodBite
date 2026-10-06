import { instacartEnabled } from "@/lib/instacart";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ enabled: instacartEnabled() }, { headers: { "Cache-Control": "no-store" } });
}
