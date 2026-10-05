import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});
describe("provider timeouts", () => {
  it("uses the 120-second timeout on the actual catalog search path", async () => {
    await isolatedCache();
    vi.stubEnv("NODE_ENV", "development");
    const timeout = vi.spyOn(AbortSignal, "timeout");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ products: [] })));
    const { searchCatalog } = await import("@/lib/providers/openFoodFacts");
    await searchCatalog("cereal");
    expect(timeout).toHaveBeenCalledWith(120000);
    expect(timeout).not.toHaveBeenCalledWith(10000);
  });

  it("allows slow responses and aborts at 120 seconds", async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), ms);
      return controller.signal;
    });
    let signal!: AbortSignal;
    vi.stubGlobal("fetch", vi.fn((_url, init) => {
      signal = init.signal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }));
    const { providerJson } = await import("@/lib/providerRuntime");
    const result = providerJson("https://example.test/catalog", "Nutrition search").catch(error => error);
    await vi.advanceTimersByTimeAsync(119999);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    expect(await result).toMatchObject({
      message: expect.stringContaining("did not respond in time"),
    });
  });

  it("still cancels immediately when the caller aborts", async () => {
    vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    })));
    const { providerJson } = await import("@/lib/providerRuntime");
    const controller = new AbortController();
    const result = providerJson("https://example.test/catalog", "Nutrition search", controller.signal);
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });
});
async function isolatedCache() {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  return import("@/lib/cache");
}
describe("cache and budgets", () => {
  it("coalesces simultaneous cache misses including null results", async () => {
    const { getOrSet } = await isolatedCache();
    const fetcher = vi.fn(async () => null);
    expect(
      await Promise.all([
        getOrSet("same", 60, fetcher),
        getOrSet("same", 60, fetcher),
      ]),
    ).toEqual([null, null]);
    await getOrSet("same", 60, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not cache failures as missing data", async () => {
    const { getOrSet } = await isolatedCache();
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ ok: true });
    await expect(getOrSet("error", 60, fetcher)).rejects.toThrow();
    expect(await getOrSet("error", 60, fetcher)).toEqual({ ok: true });
  });
  it("refuses production requests when shared budgets are missing", async () => {
    await isolatedCache();
    vi.stubEnv("NODE_ENV", "production");
    const { reserveBudget } = await import("@/lib/providerRuntime");
    await expect(reserveBudget("test", 1, 60000)).rejects.toThrow(
      "shared request-budget",
    );
  });
  it("enforces rolling development budgets", async () => {
    await isolatedCache();
    vi.stubEnv("NODE_ENV", "development");
    const { reserveBudget } = await import("@/lib/providerRuntime");
    await reserveBudget("test", 2, 60000, 2);
    await expect(reserveBudget("test", 2, 60000)).rejects.toThrow(
      "budget reached",
    );
  });
  it("does not serve fabricated products without a provider key", async () => {
    await isolatedCache();
    vi.stubEnv("SERPAPI_API_KEY", "");
    const { searchGoogleShoppingProducts } =
      await import("@/lib/providers/googleShopping");
    await expect(searchGoogleShoppingProducts("milk", 10)).rejects.toThrow(
      "not configured",
    );
  });
  it("uses one shared catalog query and bounds targeted recovery to top candidates", async () => {
    await isolatedCache();
    vi.stubEnv("NODE_ENV", "development");
    const fetcher = vi.fn(async (_input: RequestInfo | URL) =>
      Response.json({
        products: [
          {
            code: "012345678905",
            product_name: "Plain Greek Yogurt",
            brands: "Fage",
            quantity: "170 g",
            countries_tags: ["en:united-states"],
            nutriments: { proteins_100g: 10 },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const { enrichProducts } = await import("@/lib/providers/openFoodFacts");
    const candidates = Array.from({ length: 15 }, (_, i) => ({
      provider: "test",
      providerProductId: String(i),
      title:
        i === 0 ? "Fage Plain Greek Yogurt 6 oz" : `Other brand yogurt ${i}`,
      estimatedPrice: 3,
    }));
    const result = await enrichProducts(candidates, "Greek yogurt");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(
      fetcher.mock.calls.filter(
        (call) =>
          new URL(String(call[0])).searchParams.get("search_terms") ===
          "Greek yogurt",
      ),
    ).toHaveLength(1);
    expect(result.healthById.get("0")?.source?.productName).toBe(
      "Plain Greek Yogurt",
    );
    expect(result.healthById.get("1")?.source).toBeUndefined();
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("tag_0=united-states");
  });
  it("reports a failed catalog request without fabricating evidence", async () => {
    await isolatedCache();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("limited", { status: 429 })),
    );
    const { enrichProducts } = await import("@/lib/providers/openFoodFacts");
    const result = await enrichProducts(
      [
        {
          provider: "test",
          providerProductId: "a",
          title: "Milk",
          estimatedPrice: 3,
        },
      ],
      "milk",
    );
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.healthById.get("a")?.availability).toBe("unavailable");
  });
  it.each(["missing", "mismatched"])(
    "keeps a %s barcode unknown and caches the no-match",
    async (kind) => {
      await isolatedCache();
      vi.stubEnv("NODE_ENV", "development");
      const fetcher = vi.fn(async () =>
        kind === "missing"
          ? new Response("not found", { status: 404 })
          : Response.json({
              product: {
                code: "4006381333931",
                product_name: "Different item",
              },
            }),
      );
      vi.stubGlobal("fetch", fetcher);
      const { enrichProducts } = await import("@/lib/providers/openFoodFacts");
      const candidates = [
        {
          provider: "test",
          providerProductId: "barcode",
          title: "Yogurt",
          upc: "012345678905",
          estimatedPrice: 3,
        },
      ];
      const result = await enrichProducts(candidates, "yogurt");
      await enrichProducts(candidates, "yogurt");
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result.healthById.get("barcode")?.availability).toBe("no_match");
      expect(result.healthById.get("barcode")?.source).toBeUndefined();
      expect(result.warnings).toEqual([]);
    },
  );
  it("recovers an exact product omitted from the broad catalog page", async () => {
    await isolatedCache();
    vi.stubEnv("NODE_ENV", "development");
    const fetcher = vi.fn(async (input: RequestInfo | URL) =>
      Response.json({
        products:
          new URL(String(input)).searchParams.get("search_terms") ===
          "chicken sausage"
            ? []
            : [
                {
                  code: "012345678905",
                  brands: "Boar's Head",
                  product_name: "Robust Italian Chicken Sausage",
                  countries_tags: ["en:united-states"],
                  nutriments: { proteins_100g: 18 },
                },
              ],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const { enrichProducts } = await import("@/lib/providers/openFoodFacts");
    const result = await enrichProducts(
      [
        {
          provider: "test",
          providerProductId: "a",
          title: "Boar's Head Chicken Sausage Robust Italian",
          estimatedPrice: 5,
        },
      ],
      "chicken sausage",
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.healthById.get("a")?.nutrition.protein100g).toBe(18);
    expect(result.healthById.get("a")?.source?.match).toBe("text");
  });
});
