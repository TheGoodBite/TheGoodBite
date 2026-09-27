import { describe, expect, it, vi, afterEach } from "vitest";
const { searchItem, reserveBudget } = vi.hoisted(() => ({
  searchItem: vi.fn(),
  reserveBudget: vi.fn(),
}));
vi.mock("@/lib/searchService", () => ({ searchItem }));
vi.mock("@/lib/providerRuntime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/providerRuntime")>()),
  reserveBudget,
}));
vi.mock("@/lib/supabase", () => ({
  getUserFromRequest: vi.fn(async () => ({ id: "qa-user" })),
  ensureProfile: vi.fn(async () => ({ subscription_status: "free" })),
}));
import { POST } from "@/app/api/search-products/route";
afterEach(() => vi.clearAllMocks());
function req(body: unknown, stream = false) {
  return new Request("http://localhost/api/search-products", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(stream ? { accept: "application/x-ndjson" } : {}),
    },
    body: JSON.stringify(body),
  });
}
describe("search route", () => {
  it("validates allergy enums and item counts before provider work", async () => {
    expect(
      (await POST(req({ items: ["milk"], allergies: ["invalid"] }))).status,
    ).toBe(400);
    expect(searchItem).not.toHaveBeenCalled();
  });
  it("returns item errors independently", async () => {
    searchItem.mockImplementation(async (query: string) => {
      if (query === "milk") throw new Error("bad");
      return { query, options: [] };
    });
    const response = await POST(req({ items: ["Milk", "Oats"] }));
    const data = await response.json();
    expect(data.items[0].error).toBeDefined();
    expect(data.items[1]).toEqual({ query: "oats", options: [] });
  });
  it("streams a fast item while another item is still pending", async () => {
    let release!: () => void;
    const slow = new Promise<void>((resolve) => {
      release = resolve;
    });
    searchItem.mockImplementation(async (query: string) => {
      if (query === "milk") await slow;
      return { query, options: [] };
    });
    const response = await POST(req({ items: ["Milk", "Oats"] }, true));
    expect(response.headers.get("content-type")).toBe("application/x-ndjson");
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let out = "";
    while (!out.includes('"query":"oats"')) {
      out += decoder.decode((await reader.read()).value);
    }
    expect(out).not.toContain('"query":"milk"');
    release();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      out += decoder.decode(chunk.value);
    }
    expect(out).toContain('"type":"done"');
  });
  it("forwards bulk and exclusion preferences", async () => {
    searchItem.mockResolvedValue({ query: "oats", options: [] });
    await POST(
      req({
        items: ["Oats"],
        allergies: ["dairy"],
        dietModes: ["fodmap"],
        bulkPreference: "bulk",
      }),
    );
    expect(searchItem.mock.calls[0][1]).toMatchObject({
      bulkPreference: "bulk",
      allergies: ["dairy"],
      dietModes: ["fodmap"],
    });
  });
});
