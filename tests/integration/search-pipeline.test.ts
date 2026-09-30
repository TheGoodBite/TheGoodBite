import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../fixtures/search-providers.json";
import type { SearchEvent, SearchProductsResponse } from "@/lib/types";

// The real route, catalog, cache, budgets, pricing, ranking and stream decoder
// run together. Only external HTTP and the Supabase network boundary are replaced.
vi.mock("@/lib/supabase", () => ({
  getUserFromRequest: vi.fn(async (request: Request) =>
    request.headers.get("authorization") === "Bearer fixture-token"
      ? { id: "fixture-user" }
      : null,
  ),
  ensureProfile: vi.fn(async () => ({ subscription_status: "free" })),
}));
let calls: URL[], unexpected: string[];
type Handler = (url: URL) => Promise<Response> | Response;
let override: Handler | undefined;
function providers(url: URL): Response {
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
  vi.stubEnv("SERPAPI_API_KEY", "");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.stubEnv("SEARCH_ITEMS_PER_DAY", "100");
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
  expect(
    calls.every((url) =>
      ["world.openfoodfacts.org", "prices.openfoodfacts.org"].includes(
        url.hostname,
      ),
    ),
  ).toBe(true);
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
describe("Open Food Facts and Open Prices integration (no live calls)", () => {
  it("returns catalog nutrition, deduplicates queries and uses eligible local observations", async () => {
    const row = (
      await json({ items: ["Yogurt", " yogurt "], zipCode: "01752" })
    ).items[0];
    expect(row.options).toHaveLength(1);
    const product = row.options[0];
    expect(product.title).toBe("Acme Plain Yogurt");
    expect(product.health.nutrition).toMatchObject({
      protein100g: 17,
      carbohydrates100g: 5,
      sugars100g: 0,
    });
    expect(product.health.source).toMatchObject({
      provider: "open_food_facts",
      match: "catalog",
    });
    expect(product.priceSource).toBe("open_prices");
    expect(product.estimatedPrice).toBe(2.99);
    expect(product.priceObservation?.locality).toContain("01752");
    expect(
      calls.filter((url) => url.hostname === "world.openfoodfacts.org"),
    ).toHaveLength(1);
    expect(
      calls.filter((url) => url.hostname === "prices.openfoodfacts.org"),
    ).toHaveLength(1);
  });
  it("sends the complete text query to OFF without a second local title filter", async () => {
    override = url => url.hostname === "world.openfoodfacts.org"
      ? Response.json({ products: [] }) : providers(url);
    const row = (await json({ items: ["vanilla yogurt"] })).items[0];
    expect(row.options).toEqual([]);
    expect(row.emptyReason).toBe("nutrition_missing");
    expect(calls[0].searchParams.get("search_terms")).toBe("vanilla yogurt");
    expect(
      calls.some((url) => url.hostname === "prices.openfoodfacts.org"),
    ).toBe(false);
  });
  it("explains nutrition service failure without any Shopping fallback", async () => {
    override = (url) =>
      url.hostname === "world.openfoodfacts.org"
        ? new Response("unavailable", { status: 503 })
        : providers(url);
    const row = (await json({ items: ["yogurt"] })).items[0];
    expect(row.options).toEqual([]);
    expect(row.emptyReason).toBe("nutrition_unavailable");
    expect(calls).toHaveLength(2);
  });
  it("recovers one transient catalog failure without a user clicking again", async () => {
    let attempts = 0;
    override = (url) => url.hostname === "world.openfoodfacts.org" && ++attempts === 1
      ? new Response("temporary failure", { status: 503 }) : providers(url);
    const row = (await json({ items: ["yogurt"] })).items[0];
    expect(row.options).toHaveLength(1);
    expect(attempts).toBe(2);
  });
  it("does not retry upstream rate limits", async () => {
    override = () => new Response("limited", { status: 429 });
    const row = (await json({ items: ["yogurt"] })).items[0];
    expect(row.emptyReason).toBe("nutrition_unavailable");
    expect(calls).toHaveLength(1);
  });
  it("excludes dairy conflicts before any price requests", async () => {
    const row = (await json({ items: ["yogurt"], allergies: ["dairy"] }))
      .items[0];
    expect(row.options).toEqual([]);
    expect(row.warnings?.join(" ")).toContain("Open Food Facts preference evidence");
    expect(
      calls.some((url) => url.hostname === "prices.openfoodfacts.org"),
    ).toBe(false);
  });
  it("retrieves dairy-free yogurt with provider filters and does not reject its name", async () => {
    override = url => url.hostname === "world.openfoodfacts.org"
      ? Response.json({ products: [{ ...fixture.catalog.products[0],
          product_name: "Coconut milk yogurt", ingredients_text: "Coconut milk, cultures",
          allergens_tags: [],
          attribute_groups_en: [{ attributes: [{ id: "allergens_no_milk", status: "known", match: 100 }] }],
        }] }) : providers(url);
    const row = (await json({ items: ["yogurt"], productPreferences: { allergens_no_milk: "mandatory" },
      dietModes: ["high_protein"] })).items[0];
    expect(row.options).toHaveLength(1);
    expect(row.excludedCount).toBe(0);
    expect(row.options[0].title).toBe("Acme Coconut milk yogurt");
    expect(row.options[0].allergyStatus).toBe("not_detected");
    expect(calls[0].searchParams.get("tagtype_1")).toBe("allergens");
    expect(calls[0].searchParams.get("tag_contains_1")).toBe("does_not_contain");
    expect(calls[0].searchParams.get("tag_1")).toBe("en:milk");
    expect(calls[0].searchParams.get("tagtype_2")).toBe("traces");
    expect(calls[0].searchParams.get("tag_2")).toBe("en:milk");
    expect(calls[0].searchParams.get("api_version")).toBe("3.4");
  });
  it("trusts OFF text matching when the product name uses a different category term", async () => {
    override = url => url.hostname === "world.openfoodfacts.org"
      ? Response.json({ products: [{ ...fixture.catalog.products[0], product_name: "Vanilla cultured coconut" }] })
      : providers(url);
    expect((await json({ items: ["yogurt"] })).items[0].options).toHaveLength(1);
  });
  it("isolates restricted searches from unrestricted and parameterized ingredient caches", async () => {
    await json({ items: ["yogurt"] });
    await json({ items: ["yogurt"], allergies: ["dairy"] });
    await json({ items: ["yogurt"], unwantedIngredients: ["onion"], productPreferences: { unwanted_ingredients: "important" } });
    await json({ items: ["yogurt"], unwantedIngredients: ["garlic"], productPreferences: { unwanted_ingredients: "important" } });
    expect(calls.filter(url => url.hostname === "world.openfoodfacts.org")).toHaveLength(4);
    const count = calls.length;
    await json({ items: ["yogurt"], productPreferences: { allergens_no_milk: "mandatory" } });
    expect(calls).toHaveLength(count);
  });
  it("keeps FODMAP as a local screen before pricing", async () => {
    override = url => url.hostname === "world.openfoodfacts.org"
      ? Response.json({ products: [{ ...fixture.catalog.products[0],
          product_name: "Garlic yogurt", ingredients_text: "Garlic, cultures",
        }] }) : providers(url);
    const row = (await json({ items: ["yogurt"], dietModes: ["fodmap"] })).items[0];
    expect(row.options).toEqual([]);
    expect(row.excludedCount).toBe(1);
    expect(row.warnings?.join(" ")).toContain("FODMAP");
    expect(calls).toHaveLength(1);
  });
  it("keeps nutrition when the price service fails", async () => {
    override = (url) =>
      url.hostname === "prices.openfoodfacts.org"
        ? new Response("unavailable", { status: 503 })
        : providers(url);
    const row = (await json({ items: ["yogurt"] })).items[0];
    expect(row.options).toHaveLength(1);
    expect(row.options[0].estimatedPrice).toBeNull();
    expect(row.options[0].health.nutrition.protein100g).toBe(17);
    expect(row.warnings?.join(" ")).toContain("Open Prices");
  });
  it("caches repeated catalog and price lookups", async () => {
    await json({ items: ["yogurt"] });
    const count = calls.length;
    await json({ items: ["yogurt"] });
    expect(calls).toHaveLength(count);
  });
  it("rejects authentication and validation errors before provider work", async () => {
    expect((await request({ items: ["yogurt"] }, false, false)).status).toBe(
      401,
    );
    expect(
      (await request({ items: ["yogurt"], allergies: ["invalid"] })).status,
    ).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it("enforces item budgets and fails closed in production without Redis", async () => {
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
  it("streams real results while another catalog lookup is pending", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    override = async (url) => {
      if (
        url.hostname === "world.openfoodfacts.org" &&
        url.searchParams.get("search_terms") === "slow"
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
  it("returns nutrition-backed US sausages for the exact reported payload", async () => {
    const base = fixture.catalog.products[0];
    override = (url) =>
      url.hostname === "world.openfoodfacts.org"
        ? Response.json({
            products: [
              {
                ...base,
                product_name: "Chicken Sausage",
                ingredients_text: "Chicken, salt, spices",
                attribute_groups_en: [{ attributes: [{ id: "allergens_no_milk", status: "known", match: 100 }] }],
                allergens_tags: [],
                image_front_url: "https://images.openfoodfacts.org/fixture.jpg",
              },
              {
                ...base,
                code: "4006381333931",
                product_name: "Cheese Sausage",
                ingredients_text: "Pork, milk",
                allergens_tags: ["en:milk"],
                attribute_groups_en: [{ attributes: [{ id: "allergens_no_milk", status: "known", match: 0 }] }],
              },
              {
                ...base,
                code: "96385074",
                product_name: "Pork Sausage",
                countries_tags: ["en:france"],
              },
            ],
          })
        : providers(url);
    const row = (
      await json({
        items: ["sausage"],
        dietModes: ["high_protein"],
        allergies: ["dairy"],
        bulkPreference: "everyday",
        zipCode: "01602",
        limitPerItem: 10,
      })
    ).items[0];
    expect(row.options).toHaveLength(1);
    const p = row.options[0];
    expect(p.title).toBe("Acme Chicken Sausage");
    expect(p.health.nutrition.protein100g).toBe(17);
    expect(p.health.source?.match).toBe("catalog");
    expect(p.market).toBe("US-catalog");
    expect(p.estimatedPrice).toBe(2.99);
    expect(p.priceObservation).toMatchObject({
      locationMatch: "state", state: "MA", postalCode: "01752", requestedPostalCode: "01602",
    });
    expect(p.imageUrl).toContain("images.openfoodfacts.org");
    expect(calls).toHaveLength(2);
  });
  it("preserves exact ZIP priority and fallback provenance through the route", async () => {
    override = (url) => url.hostname === "prices.openfoodfacts.org"
      ? Response.json({ items: [
          { ...fixture.price, price: 1, date: new Date().toISOString().slice(0, 10) },
          { ...fixture.price, id: 43, price: 4, date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
            location: { ...fixture.price.location, osm_address_postcode: "01602" } },
        ] }) : providers(url);
    const product = (await json({ items: ["yogurt"], zipCode: "01602" })).items[0].options[0];
    expect(product.estimatedPrice).toBe(4);
    expect(product.priceObservation?.locationMatch).toBe("zip");
    expect(calls).toHaveLength(2);
  });
  it("filters mandatory evidence before pricing and preserves native preference explanations", async () => {
    const base = fixture.catalog.products[0];
    override = url => url.hostname === "world.openfoodfacts.org"
      ? Response.json({ products: [
          { ...base, attribute_groups_en: [{ attributes: [{ id: "low_salt", status: "known", match: 100 }] }] },
          { ...base, code: "4006381333931", attribute_groups_en: [{ attributes: [{ id: "low_salt", status: "known", match: 0 }] }] },
          { ...base, code: "96385074" },
        ] }) : providers(url);
    const row = (await json({ items: ["yogurt"], productPreferences: { low_salt: "mandatory" } })).items[0];
    expect(row.options).toHaveLength(1);
    expect(row.excludedCount).toBe(2);
    expect(row.options[0].preferenceFit?.matches).toContain("Salt in low quantity");
    expect(calls.filter(url => url.hostname === "prices.openfoodfacts.org")).toHaveLength(1);
    expect(calls[0].searchParams.get("fields")).toContain("attribute_groups_en");
  });
  it("soft importance changes recommendation order while retaining conflicting options", async () => {
    const base = fixture.catalog.products[0];
    override = url => url.hostname === "world.openfoodfacts.org"
      ? Response.json({ products: [
          { ...base, attribute_groups_en: [{ attributes: [{ id: "labels_organic", status: "known", match: 0 }] }] },
          { ...base, code: "4006381333931", attribute_groups_en: [{ attributes: [{ id: "labels_organic", status: "known", match: 100 }] }] },
        ] }) : providers(url);
    const row = (await json({ items: ["yogurt"], productPreferences: { labels_organic: "very_important" } })).items[0];
    expect(row.options).toHaveLength(2);
    expect(row.options[0].upc).toBe("4006381333931");
    expect(row.options[1].preferenceFit?.unmet).toContain("Organic farming");
  });
  it("an older catalog cache cannot invent missing mandatory attribute evidence", async () => {
    const { setJson } = await import("@/lib/cache");
    const { sha256 } = await import("@/lib/utils");
    await setJson(`v2:off:v4:us-search:${await sha256("yogurt")}`, { value: fixture.catalog.products }, 3600);
    override = () => new Response("offline", { status: 503 });
    const row = (await json({ items: ["yogurt"], productPreferences: { low_fat: "mandatory" } })).items[0];
    expect(row.options).toEqual([]);
    expect(row.emptyReason).toBe("nutrition_unavailable");
    expect(calls).toHaveLength(2);
  });
  it("does not spend price calls when all mandatory evidence is missing", async () => {
    const row = (await json({ items: ["yogurt"], productPreferences: { forest_footprint: "mandatory" } })).items[0];
    expect(row.options).toEqual([]);
    expect(row.warnings?.join(" ")).toContain("Open Food Facts preference evidence");
    expect(calls).toHaveLength(1);
  });
  it.each([
    { productPreferences: { low_salt: "sometimes" } },
    { productPreferences: { invented_filter: "mandatory" } },
    { unwantedIngredients: Array(21).fill("onion") },
    { unwantedIngredients: ["a".repeat(81)] },
  ])("validates preference requests before provider calls", async extra => {
    expect((await request({ items: ["yogurt"], ...extra })).status).toBe(400);
    expect(calls).toEqual([]);
  });
  it.each(["foreign", "stale", "wrong-barcode", "other-state"])(
    "does not attach a %s receipt price",
    async (reason) => {
      override = (url) =>
        url.hostname === "prices.openfoodfacts.org"
          ? Response.json({
              items: [
                {
                  ...fixture.price,
                  date:
                    reason === "stale"
                      ? "2020-01-01"
                      : new Date().toISOString().slice(0, 10),
                  product_code:
                    reason === "wrong-barcode"
                      ? "4006381333931"
                      : fixture.price.product_code,
                  location: {
                    ...fixture.price.location,
                    osm_address_country_code:
                      reason === "foreign" ? "FR" : "US",
                    osm_address_postcode:
                      reason === "other-state" ? "90210" : "01752",
                  },
                },
              ],
            })
          : providers(url);
      const p = (await json({ items: ["yogurt"], zipCode: "01752" })).items[0]
        .options[0];
      expect(p.estimatedPrice).toBeNull();
      expect(p.offers).toEqual([]);
    },
  );
});
