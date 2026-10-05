import { PRODUCT_PREFERENCE_IDS, PREFERENCE_IMPORTANCE } from "@/lib/types";
import { z } from "zod";
import { handleRouteError, requireUserAndEntitlement } from "@/lib/api";
import {
  ALLERGENS,
  DIET_MODES,
  type SearchEvent,
  type SearchProductsResponse,
} from "@/lib/types";
import { normalizeQuery, sha256, uniqueStrings } from "@/lib/utils";
import {
  mapConcurrent,
  ProviderError,
  reserveBudget,
} from "@/lib/providerRuntime";
import { searchItem } from "@/lib/searchService";

export const runtime = "nodejs";
export const maxDuration = 180;
const searchSchema = z.object({
  productPreferences: z.partialRecord(z.enum(PRODUCT_PREFERENCE_IDS), z.enum(PREFERENCE_IMPORTANCE)).default({}),
  unwantedIngredients: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  items: z.array(z.string().trim().min(1).max(160)).min(1).max(100),
  dietModes: z.array(z.enum(DIET_MODES)).max(DIET_MODES.length).default([]),
  allergies: z.array(z.enum(ALLERGENS)).max(ALLERGENS.length).default([]),
  zipCode: z
    .string()
    .regex(/^\d{5}$/)
    .optional()
    .or(z.literal("")),
  bulkPreference: z.enum(["everyday", "bulk", "any"]).default("everyday"),
  limitPerItem: z.number().int().min(1).max(20).default(10),
});
const disclaimer =
  "Prices are estimates or dated observations, not confirmed local shelf prices. Verify ingredients and allergens on the package.";
export async function POST(request: Request) {
  try {
    const { user, entitlement } = await requireUserAndEntitlement(request);
    const body = searchSchema.parse(await request.json());
    const items = uniqueStrings(body.items.map(normalizeQuery));
    const userKey = await sha256(user.id);
    await reserveBudget(`user:burst:${userKey}`, 10, 60000);
    await reserveBudget(
      `user:daily:${userKey}`,
      entitlement.searchItemLimitPerDay,
      86400000,
      items.length,
    );
    const abort = new AbortController();
    const signal = AbortSignal.any([
      request.signal,
      abort.signal,
      // Allow a full 120-second catalog lookup, then price enrichment.
      AbortSignal.timeout(180000),
    ]);
    const meta: SearchProductsResponse["entitlement"] = {
      isPaid: entitlement.isPaid,
      optionsPerItem: entitlement.optionsPerItem,
      canUseDietModes: entitlement.canUseDietModes,
      searchItemLimitPerDay: entitlement.searchItemLimitPerDay,
    };
    const run = (emit?: (event: SearchEvent) => void) =>
      mapConcurrent(items, 4, async (query) => {
        let item: SearchProductsResponse["items"][number];
        try {
          item = await searchItem(
            query,
            {
              ...body,
              zipCode: body.zipCode || undefined,
              limitPerItem: Math.min(
                body.limitPerItem,
                entitlement.optionsPerItem,
              ),
            },
            signal,
          );
        } catch (error) {
          item = {
            query,
            options: [],
            error: signal.aborted
              ? "Search timed out or was canceled. Retry this item."
              : error instanceof ProviderError
                ? error.message
                : "This item could not be searched. Please try again.",
          };
        }
        emit?.({ type: "item", item });
        return item;
      });
    if (!request.headers.get("accept")?.includes("application/x-ndjson"))
      return Response.json(
        { items: await run(), entitlement: meta, disclaimer },
        { headers: { "Cache-Control": "no-store" } },
      );
    const encoder = new TextEncoder();
    let closed = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: SearchEvent) => {
          if (!closed && !request.signal.aborted)
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        };
        try {
          emit({ type: "meta", entitlement: meta, disclaimer });
          await run(emit);
          emit({ type: "done" });
        } catch {
          emit({
            type: "error",
            error: "Search stopped unexpectedly. Retry unfinished items.",
          });
        } finally {
          if (!closed) {
            closed = true;
            controller.close();
          }
        }
      },
      cancel() {
        closed = true;
        abort.abort();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
