import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../fixtures/search-providers.json";
import type { SearchEvent, SearchProductsResponse } from "@/lib/types";

// Only the Supabase network boundary is replaced. Real API validation,
// entitlements, provider adapters, cache, budgets, matching, scoring and stream
// decoding are exercised together. Every HTTP request is intercepted; no fallback.
vi.mock("@/lib/supabase", () => ({
  getUserFromRequest: vi.fn(async (request: Request) =>
    request.headers.get("authorization") === "Bearer fixture-token"
      ? { id: "fixture-user" }
      : null,
  ),
  ensureProfile: vi.fn(async () => ({ subscription_status: "free" })),
}));
let calls: URL[];
let unexpected: string[];
type Handler = (url: URL) => Promise<Response> | Response;
let override: Handler | undefined;
function providers(url: URL): Response {
  if (url.hostname === "serpapi.com" && url.pathname === "/search.json")
    return Response.json(fixture.shopping);
  if (url.hostname === "serpapi.com" && url.pathname === "/locations.json")
    return Response.json(fixture.location);
  if (
    url.hostname === "world.openfoodfacts.org" &&
    url.pathname === "/cgi/search.pl"
  )
    return Response.json(fixture.catalog);
  if (
    url.hostname === "prices.openfoodfacts.org" &&
    url.pathname === "/api/v1/prices"
  )
    return Response.json({
      items: [
        { ...fixture.price, date: new Date().toISOString().slice(0, 10) },
      ],
    });
  unexpected.push(`${url.hostname}${url.pathname}`);
  throw new Error("Unexpected external request: blocked by integration test");
}
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("SERPAPI_API_KEY", "fixture-key-not-real");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.stubEnv("SEARCH_ITEMS_PER_DAY", "100");
  vi.stubEnv("SERPAPI_DAILY_REQUEST_LIMIT", "250");
  vi.spyOn(console, "info").mockImplementation(() => {});
  calls = [];
  unexpected = [];
  override = undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      calls.push(url);
      return override ? override(url) : providers(url);
    }),
  );
});
afterEach(() => {
  const invalid = [...unexpected];
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  expect(
    invalid,
    "Every network request must stay inside the fixture harness",
  ).toEqual([]);
});
async function request(body: unknown, stream = false, authorized = true) {
  const { POST } = await import("@/app/api/search-products/route");
  return POST(
    new Request("http://fixture.local/api/search-products", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authorized ? { authorization: "Bearer fixture-token" } : {}),
        ...(stream ? { accept: "application/x-ndjson" } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}
async function json(body: unknown) {
  const response = await request(body);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  return response.json() as Promise<SearchProductsResponse>;
}
describe("search API and provider integration (no live calls)", () => {
  it("returns only matched facts, merges duplicate offers, and uses eligible local prices", async () => {
    const result = await json({
      items: ["Yogurt", " yogurt "],
      zipCode: "01752",
    });
    expect(result.items).toHaveLength(1);
    const row = result.items[0];
    expect(row.options).toHaveLength(1);
    const product = row.options[0];
    expect(product.title).toBe("Acme Plain Yogurt 6 oz");
    expect(product.health.nutrition).toMatchObject({
      protein100g: 17,
      carbohydrates100g: 5,
      sugars100g: 0,
    });
    expect(product.health.source).toMatchObject({
      provider: "open_food_facts",
      match: "text",
    });
    expect(product.priceSource).toBe("open_prices");
    expect(product.estimatedPrice).toBe(2.99);
    expect(product.priceObservation?.locality).toContain("01752");
    expect(
      product.offers?.filter((offer) => offer.source === "shopping"),
    ).toHaveLength(2);
    expect(row.excludedCount).toBe(1);
    expect(
      calls.filter(
        (url) =>
          url.hostname === "serpapi.com" && url.pathname === "/search.json",
      ),
    ).toHaveLength(1);
    expect(
      calls
        .find((url) => url.pathname === "/search.json")
        ?.searchParams.get("location"),
    ).toBe(fixture.location[0].canonical_name);
  });
  it("does not attach plain nutrition to another flavor and explains empty results", async () => {
    override = (url) =>
      url.pathname === "/search.json"
        ? Response.json({
            shopping_results: [fixture.shopping.shopping_results[2]],
          })
        : providers(url);
    const row = (await json({ items: ["vanilla yogurt"] })).items[0];
    expect(row.options).toEqual([]);
    expect(row.emptyReason).toBe("nutrition_missing");
    expect(
      calls.some((url) => url.hostname === "prices.openfoodfacts.org"),
    ).toBe(false);
  });
  it("hides listings when nutrition fails, even though Shopping and the route succeed", async () => {
    override = (url) =>
      url.hostname === "world.openfoodfacts.org"
        ? new Response("unavailable", { status: 503 })
        : providers(url);
    const row = (await json({ items: ["yogurt"] })).items[0];
    expect(row.options).toEqual([]);
    expect(row.emptyReason).toBe("nutrition_unavailable");
    expect(row.warnings?.join(" ")).toContain("hidden");
  });
  it("expands allergy search wording and excludes a matched dairy product", async () => {
    const row = (await json({ items: ["yogurt"], allergies: ["dairy"] }))
      .items[0];
    expect(
      calls
        .find((url) => url.pathname === "/search.json")
        ?.searchParams.get("q"),
    ).toContain("dairy free");
    expect(row.options).toEqual([]);
    expect(row.warnings?.join(" ")).toContain("preference conflicts");
  });
  it("falls back to a Shopping estimate when the price service fails", async () => {
    override = (url) =>
      url.hostname === "prices.openfoodfacts.org"
        ? new Response("unavailable", { status: 503 })
        : providers(url);
    const row = (await json({ items: ["yogurt"] })).items[0];
    expect(row.options[0].estimatedPrice).toBe(3.49);
    expect(row.options[0].priceSource).toBe("shopping");
    expect(row.options[0].health.nutrition.protein100g).toBe(17);
    expect(row.warnings?.join(" ")).toContain("Open Prices");
  });
  it("serves repeated provider lookups from cache without spending more calls", async () => {
    await json({ items: ["yogurt"] });
    const count = calls.length;
    await json({ items: ["yogurt"] });
    expect(calls).toHaveLength(count);
  });
  it("rejects unauthenticated and invalid requests before provider work", async () => {
    expect((await request({ items: ["yogurt"] }, false, false)).status).toBe(
      401,
    );
    expect(
      (await request({ items: ["yogurt"], allergies: ["not-an-allergy"] }))
        .status,
    ).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it("enforces real item budgets and fails closed in production without Redis", async () => {
    vi.stubEnv("SEARCH_ITEMS_PER_DAY", "1");
    await json({ items: ["yogurt"] });
    const count = calls.length;
    expect((await request({ items: ["oats"] })).status).toBe(429);
    expect(calls).toHaveLength(count);
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    expect((await request({ items: ["yogurt"] })).status).toBe(503);
    expect(calls).toHaveLength(count);
  });
  it("streams a completed item through the actual client decoder while another is pending", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    override = async (url) => {
      if (
        url.pathname === "/search.json" &&
        url.searchParams.get("q") === "slow"
      )
        await gate;
      return providers(url);
    };
    const response = await request({ items: ["slow", "yogurt"] }, true);
    const { consumeSearch } = await import("@/lib/searchStream");
    const events: SearchEvent[] = [];
    let first!: () => void;
    const completed = new Promise<void>((resolve) => {
      first = resolve;
    });
    const consumption = consumeSearch(response, (event) => {
      events.push(event);
      if (event.type === "item") first();
    });
    try {
      await completed;
      expect(events[0].type).toBe("meta");
      expect(
        events
          .filter((event) => event.type === "item")
          .map((event) => event.item.query),
      ).toEqual(["yogurt"]);
    } finally {
      release();
      await consumption;
    }
    expect(events.at(-1)?.type).toBe("done");
    expect(events.filter((event) => event.type === "item")).toHaveLength(2);
  });
});
