import type { Entitlement, SubscriptionStatus } from "@/lib/types";

export function getEntitlement(status: SubscriptionStatus | null | undefined): Entitlement {
  const normalized = status ?? "free";
  const isPaid = normalized === "active" || normalized === "trialing";

  return {
    isPaid,
    searchItemLimitPerDay: isPaid ? 100 : 3,
    optionsPerItem: isPaid ? 10 : 5,
    canSaveLists: isPaid,
    canTrackBought: isPaid,
    canUseDietModes: isPaid,
    subscriptionStatus: normalized
  };
}
