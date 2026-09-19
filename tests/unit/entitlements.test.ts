import { describe, expect, it } from "vitest";
import { getEntitlement } from "@/lib/entitlements";

describe("getEntitlement", () => {
  it("returns free tier for null status", () => {
    const e = getEntitlement(null);
    expect(e.isPaid).toBe(false);
    expect(e.searchItemLimitPerDay).toBe(3);
    expect(e.optionsPerItem).toBe(5);
    expect(e.canSaveLists).toBe(false);
    expect(e.canTrackBought).toBe(false);
    expect(e.canUseDietModes).toBe(false);
  });

  it("returns free tier for 'free' status", () => {
    const e = getEntitlement("free");
    expect(e.isPaid).toBe(false);
    expect(e.searchItemLimitPerDay).toBe(3);
    expect(e.optionsPerItem).toBe(5);
  });

  it("returns paid tier for 'active' status", () => {
    const e = getEntitlement("active");
    expect(e.isPaid).toBe(true);
    expect(e.searchItemLimitPerDay).toBe(100);
    expect(e.optionsPerItem).toBe(10);
    expect(e.canSaveLists).toBe(true);
    expect(e.canTrackBought).toBe(true);
    expect(e.canUseDietModes).toBe(true);
  });

  it("returns paid tier for 'trialing' status", () => {
    const e = getEntitlement("trialing");
    expect(e.isPaid).toBe(true);
    expect(e.canSaveLists).toBe(true);
  });

  it("returns free tier for 'past_due' status", () => {
    const e = getEntitlement("past_due");
    expect(e.isPaid).toBe(false);
    expect(e.canSaveLists).toBe(false);
  });

  it("returns free tier for 'canceled' status", () => {
    const e = getEntitlement("canceled");
    expect(e.isPaid).toBe(false);
  });

  it("returns free tier for 'unpaid' status", () => {
    const e = getEntitlement("unpaid");
    expect(e.isPaid).toBe(false);
  });

  it("returns subscription_status in result", () => {
    expect(getEntitlement("active").subscriptionStatus).toBe("active");
    expect(getEntitlement("free").subscriptionStatus).toBe("free");
    expect(getEntitlement(null).subscriptionStatus).toBe("free");
  });
});
