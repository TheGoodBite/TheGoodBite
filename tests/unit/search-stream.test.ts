import { expect, it, vi } from "vitest";
import { consumeSearch } from "@/lib/searchStream";
import type { SearchEvent } from "@/lib/types";
const meta: SearchEvent = {
  type: "meta",
  entitlement: {
    isPaid: false,
    optionsPerItem: 10,
    canUseDietModes: true,
    searchItemLimitPerDay: 100,
  },
  disclaimer: "Test",
};
it("renders completed items before the full search finishes, including split UTF-8 chunks", async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const seen: SearchEvent[] = [];
  const consuming = consumeSearch(
    new Response(stream, {
      headers: { "content-type": "application/x-ndjson" },
    }),
    (e) => seen.push(e),
  );
  const bytes = new TextEncoder().encode(
    JSON.stringify(meta) +
      "\n" +
      JSON.stringify({
        type: "item",
        item: { query: "jalapeño", options: [] },
      }) +
      "\n",
  );
  const boundary = bytes.indexOf(0xc3) + 1;
  controller.enqueue(bytes.slice(0, boundary));
  controller.enqueue(bytes.slice(boundary));
  await vi.waitFor(() => expect(seen).toHaveLength(2));
  expect(seen[1]).toMatchObject({ item: { query: "jalapeño" } });
  controller.enqueue(new TextEncoder().encode('{"type":"done"}\n'));
  controller.close();
  await consuming;
  expect(seen.at(-1)?.type).toBe("done");
});
it("reports interrupted streams without discarding completed items", async () => {
  const fn = vi.fn();
  const stream = new Response(JSON.stringify(meta) + "\n", {
    headers: { "content-type": "application/x-ndjson" },
  });
  await expect(consumeSearch(stream, fn)).rejects.toThrow("interrupted");
  expect(fn).toHaveBeenCalledTimes(1);
});
it("retains JSON compatibility", async () => {
  const fn = vi.fn();
  await consumeSearch(
    Response.json({
      items: [{ query: "milk", options: [] }],
      entitlement: meta.entitlement,
      disclaimer: "Test",
    }),
    fn,
  );
  expect(fn).toHaveBeenCalledTimes(3);
});
