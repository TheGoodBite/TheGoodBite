import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

const { admin } = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ requireAdminSupabase: admin }));
import { headers } from "next/headers";
import { POST } from "@/app/api/stripe/webhook/route";

const secret = "whsec_migration_test_only";
const payload = JSON.stringify({ id: "evt_test", type: "unhandled.test", data: { object: {} } });

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_migration_only");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Worker-compatible Stripe webhook verification", () => {
  it("accepts a valid signature using Web Crypto", async () => {
    const stripe = new Stripe("sk_test_migration_only");
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    vi.mocked(headers).mockResolvedValue(new Headers({ "stripe-signature": signature }) as Awaited<ReturnType<typeof headers>>);
    const response = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(admin).not.toHaveBeenCalled();
  });

  it("rejects a tampered body before touching subscription data", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const stripe = new Stripe("sk_test_migration_only");
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    vi.mocked(headers).mockResolvedValue(new Headers({ "stripe-signature": signature }) as Awaited<ReturnType<typeof headers>>);
    const response = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload + " " }));
    expect(response.ok).toBe(false);
    expect(admin).not.toHaveBeenCalled();
  });
});
