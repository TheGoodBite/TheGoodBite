import { describe, expect, it } from "vitest";
import { getEntitlement } from "@/lib/entitlements";

describe("getEntitlement", () => {
  it("returns full features for null status (no paywall)", () => {
    const e = getEntitlement(null);
    expect(e.isPaid).toBe(true);
    expect(e.searchItemLimitPerDay).toBe(999999);
    expect(e.optionsPerItem).toBe(10);
    expect(e.canSaveLists).toBe(true);
    expect(e.canTrackBought).toBe(true);
    expect(e.canUseDietModes).toBe(true);
  });

  it("returns full features for 'free' status", () => {
    const e = getEntitlement("free");
    expect(e.isPaid).toBe(true);
    expect(e.searchItemLimitPerDay).toBe(999999);
    expect(e.optionsPerItem).toBe(10);
  });

  it("returns full features for 'active' status", () => {
    const e = getEntitlement("active");
    expect(e.isPaid).toBe(true);
    expect(e.searchItemLimitPerDay).toBe(999999);
    expect(e.optionsPerItem).toBe(10);
    expect(e.canSaveLists).toBe(true);
    expect(e.canTrackBought).toBe(true);
    expect(e.canUseDietModes).toBe(true);
  });

  it("returns full features for 'trialing' status", () => {
    const e = getEntitlement("trialing");
    expect(e.isPaid).toBe(true);
    expect(e.canSaveLists).toBe(true);
  });

  it("returns full features for 'past_due' status", () => {
    const e = getEntitlement("past_due");
    expect(e.isPaid).toBe(true);
    expect(e.canSaveLists).toBe(true);
  });

  it("returns full features for 'canceled' status", () => {
    const e = getEntitlement("canceled");
    expect(e.isPaid).toBe(true);
  });

  it("returns full features for 'unpaid' status", () => {
    const e = getEntitlement("unpaid");
    expect(e.isPaid).toBe(true);
  });

  it("returns subscription_status in result", () => {
    expect(getEntitlement("active").subscriptionStatus).toBe("active");
    expect(getEntitlement("free").subscriptionStatus).toBe("free");
    expect(getEntitlement(null).subscriptionStatus).toBe("free");
  });
});
