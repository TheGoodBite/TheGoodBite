import { z } from "zod";
import { ApiError, handleRouteError, requireUserAndEntitlement } from "@/lib/api";
import { incrementDailyCounterBy } from "@/lib/cache";
import { sanitizeDietModes } from "@/lib/dietModes";
import { UNKNOWN_HEALTH } from "@/lib/health";
import { getHealthForProduct } from "@/lib/providers/openFoodFacts";
import { searchGoogleShoppingProducts } from "@/lib/providers/googleShopping";
import { rankProducts } from "@/lib/scoring";
import type { HealthInfo, SearchProductsResponse } from "@/lib/types";
import { normalizeQuery, sha256, uniqueStrings } from "@/lib/utils";

const schema = z.object({
  items: z.array(z.string().min(1)).min(1).max(100),
  dietModes: z.array(z.string()).optional(),
  limitPerItem: z.number().int().min(1).max(20).optional()
});

export async function POST(request: Request) {
  try {
    const { user, entitlement } = await requireUserAndEntitlement(request);
    const body = schema.parse(await request.json());
    const items = uniqueStrings(body.items.map(normalizeQuery)).slice(0, entitlement.searchItemLimitPerDay);

    if (items.length === 0) throw new ApiError("Add at least one grocery item.", 400);

    await enforceDailyLimit(user.id, items.length, entitlement.searchItemLimitPerDay);

    const dietModes = entitlement.canUseDietModes ? sanitizeDietModes(body.dietModes) : [];
    const limit = Math.min(body.limitPerItem ?? entitlement.optionsPerItem, entitlement.optionsPerItem);

    const settled = await Promise.allSettled(
      items.map(async (item) => {
        const candidates = await searchGoogleShoppingProducts(item, Math.max(limit, 10));
        const healthEntries = await Promise.all(
          candidates.map(async (candidate) => {
            let health: HealthInfo = UNKNOWN_HEALTH;
            try {
              health = await getHealthForProduct(candidate, item);
            } catch {
              health = UNKNOWN_HEALTH;
            }
            return [candidate.providerProductId, health] as const;
          })
        );

        return {
          query: item,
          options: rankProducts({
            query: item,
            candidates,
            healthById: new Map(healthEntries),
            dietModes,
            limit
          })
        };
      })
    );

    const response: SearchProductsResponse = {
      items: settled.map((result, index) => {
        if (result.status === "fulfilled") return result.value;
        return {
          query: items[index],
          options: [],
          error: result.reason instanceof Error ? result.reason.message : "Search failed for this item."
        };
      }),
      entitlement: {
        isPaid: entitlement.isPaid,
        optionsPerItem: entitlement.optionsPerItem,
        canUseDietModes: entitlement.canUseDietModes,
        searchItemLimitPerDay: entitlement.searchItemLimitPerDay
      },
      disclaimer: "Prices are estimates from shopping results, not confirmed local shelf prices."
    };

    return Response.json(response);
  } catch (error) {
    return handleRouteError(error);
  }
}

async function enforceDailyLimit(userId: string, itemCount: number, limit: number) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `usage:search-items:${userId}:${day}`;
  const hash = await sha256(key);
  const count = await incrementDailyCounterBy(`usage:${hash}`, itemCount, 60 * 60 * 30);

  if (count !== null && count > limit) {
    throw new ApiError(`Daily search limit reached. Paid users get higher limits.`, 402);
  }
}
