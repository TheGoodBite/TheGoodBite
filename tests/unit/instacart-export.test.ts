import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const { db, cached, update, claim, reserveBudget } = vi.hoisted(() => {
  const cached = vi.fn(), update = vi.fn(), claim = vi.fn(), reserveBudget = vi.fn();
  const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: cached, update, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) };
  chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); update.mockReturnValue(chain);
  return { db: { from: vi.fn(() => chain), rpc: claim }, cached, update, claim, reserveBudget };
});
vi.mock("@/lib/supabase", () => ({ requireAdminSupabase: () => db }));
vi.mock("@/lib/providerRuntime", () => ({ reserveBudget, setting: (_key: string, fallback: number) => fallback }));
import { exportInstacart, instacartEnabled, validInstacartUrl } from "@/lib/instacart";
const snapshot = { name: "Weekly", items: [{ query: "Onion", quantity: 3, unit: "each" as const, selectedProduct: null }] };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("INSTACART_ENABLED", "true"); vi.stubEnv("INSTACART_ENVIRONMENT", "development"); vi.stubEnv("INSTACART_API_KEY", "test-key");
  cached.mockResolvedValue({ data: null, error: null }); claim.mockResolvedValue({ data: true, error: null }); reserveBudget.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ products_link_url: "https://www.instacart.com/store/shopping_lists/test" })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Instacart export", () => {
  it("is disabled until explicitly configured", async () => {
    vi.stubEnv("INSTACART_ENABLED", "false");
    expect(instacartEnabled()).toBe(false);
    await expect(exportInstacart(snapshot, "owner:a", "https://meezany.com/")).rejects.toMatchObject({ status: 503 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses the development endpoint, measurements, expiration and server key", async () => {
    const result = await exportInstacart(snapshot, "owner:a", "https://meezany.com/");
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://connect.dev.instacart.tools/idp/v1/products/products_link");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-key" });
    expect(JSON.parse(init?.body as string)).toMatchObject({ link_type: "shopping_list", expires_in: 30, line_items: [{ name: "Onion", line_item_measurements: [{ quantity: 3, unit: "each" }] }] });
    expect(result.url).toBe("https://www.instacart.com/store/shopping_lists/test");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ url: result.url }));
  });
  it("reuses an unexpired URL without consuming a provider budget", async () => {
    cached.mockResolvedValue({ data: { url: "https://www.instacart.com/test", expires_at: new Date(Date.now() + 86400000).toISOString() } });
    expect((await exportInstacart(snapshot, "owner:a", "https://meezany.com/")).url).toBe("https://www.instacart.com/test");
    expect(fetch).not.toHaveBeenCalled(); expect(reserveBudget).not.toHaveBeenCalled();
  });
  it("renews an expired URL and separates payload revisions", async () => {
    cached.mockResolvedValue({ data: { url: "https://www.instacart.com/old", expires_at: "2020-01-01" } });
    await exportInstacart(snapshot, "owner:a", "https://meezany.com/");
    const first = claim.mock.calls[0][1].p_key;
    await exportInstacart({ ...snapshot, name: "Changed" }, "owner:a", "https://meezany.com/");
    expect(claim.mock.calls[1][1].p_key).not.toBe(first);
  });
  it("does not call the provider while another worker owns the lease", async () => {
    claim.mockResolvedValue({ data: false, error: null });
    await expect(exportInstacart(snapshot, "share:a", "https://meezany.com/")).rejects.toMatchObject({ status: 409 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("releases the lease on timeout and allows a later retry", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
    await expect(exportInstacart(snapshot, "owner:a", "https://meezany.com/")).rejects.toMatchObject({ status: 503 });
    expect(update).toHaveBeenLastCalledWith({ lease_id: null, lease_until: null });
    await expect(exportInstacart(snapshot, "owner:a", "https://meezany.com/")).resolves.toHaveProperty("url");
  });
  it("does not expose provider response bodies or credentials on failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("private-provider-body", { status: 429 }));
    await expect(exportInstacart(snapshot, "owner:a", "https://meezany.com/")).rejects.toMatchObject({ status: 429, message: "Instacart is busy. Please try again shortly." });
  });
  it("fails before the provider call when the shared budget is unavailable", async () => {
    reserveBudget.mockRejectedValueOnce(new Error("unavailable"));
    await expect(exportInstacart(snapshot, "owner:a", "https://meezany.com/")).rejects.toMatchObject({ status: 503 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["https://instacart.com.evil.example/", "javascript:alert(1)", "http://instacart.com/", "https://evil@instacart.com/", "https://instacart.tools/"])("rejects unsafe production return URL %s", value => {
    expect(validInstacartUrl(value, "production")).toBe(false);
  });
  it("rejects a malicious returned URL instead of storing it", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ products_link_url: "https://evil.example" }));
    await expect(exportInstacart(snapshot, "owner:a", "https://meezany.com/")).rejects.toMatchObject({ status: 502 });
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ url: expect.any(String) }));
  });
});
