import { setting } from "@/lib/providerRuntime";
import type { Entitlement, SubscriptionStatus } from "@/lib/types";

export function getEntitlement(
  status: SubscriptionStatus | null | undefined,
): Entitlement {
  const normalized = status ?? "free";
  return {
    isPaid: normalized === "active" || normalized === "trialing",
    searchItemLimitPerDay: setting("SEARCH_ITEMS_PER_DAY", 100), // Operational protection, not a paywall.
    optionsPerItem: 10,
    canSaveLists: true,
    canTrackBought: true,
    canUseDietModes: true,
    subscriptionStatus: normalized,
  };
}
