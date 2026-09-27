import type { Entitlement, SubscriptionStatus } from "@/lib/types";

export function getEntitlement(status: SubscriptionStatus | null | undefined): Entitlement {
  const normalized = status ?? "free";
  return {
    isPaid: true,
    searchItemLimitPerDay: 999999, // Unlimited searches
    optionsPerItem: 10,
    canSaveLists: true,
    canTrackBought: true,
    canUseDietModes: true,
    subscriptionStatus: normalized
  };
}
