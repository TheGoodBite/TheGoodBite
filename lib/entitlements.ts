import type { Entitlement, SubscriptionStatus } from "@/lib/types";

export function getEntitlement(status: SubscriptionStatus | null | undefined): Entitlement {
  const normalized = status ?? "free";
  const isPaid = normalized === "active" || normalized === "trialing";

  return {
    isPaid,
    searchItemLimitPerDay: 999999, // Unlimited searches
    optionsPerItem: isPaid ? 10 : 10, // 10 options per item
    canSaveLists: isPaid,
    canTrackBought: isPaid,
    canUseDietModes: isPaid,
    subscriptionStatus: normalized
  };
}
