import type { SearchEvent, SearchProductsResponse } from "@/lib/types";

export class SearchResponseError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function consumeSearch(
  response: Response,
  onEvent: (event: SearchEvent) => void,
) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new SearchResponseError(data.error || "Search failed. Please try again.", response.status);
  }
  if (!response.headers.get("content-type")?.includes("application/x-ndjson")) {
    const data: SearchProductsResponse = await response.json();
    onEvent({
      type: "meta",
      entitlement: data.entitlement,
      disclaimer: data.disclaimer,
    });
    data.items.forEach((item) => onEvent({ type: "item", item }));
    onEvent({ type: "done" });
    return;
  }
  if (!response.body) throw new Error("Search response was empty.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let completed = false;
  const parse = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as SearchEvent;
    if (event.type === "error") throw new Error(event.error);
    if (event.type === "done") completed = true;
    onEvent(event);
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      let boundary: number;
      while ((boundary = pending.indexOf("\n")) >= 0) {
        parse(pending.slice(0, boundary));
        pending = pending.slice(boundary + 1);
      }
    }
    pending += decoder.decode();
    if (pending.trim()) parse(pending);
    if (!completed)
      throw new Error("Search was interrupted. Retry unfinished items.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// Recover one interrupted stream without refetching successful or genuinely empty items.
export async function searchWithRecovery(input: {
  queries: string[];
  signal: AbortSignal;
  request: (queries: string[]) => Promise<Response>;
  onEvent: (event: SearchEvent) => void;
  onRetry?: () => void;
}) {
  let remaining = [...input.queries];
  for (let attempt = 0; ; attempt++) {
    input.signal.throwIfAborted();
    const completed = new Set<string>();
    try {
      await consumeSearch(await input.request(remaining), (event) => {
        if (event.type === "item") completed.add(event.item.query);
        input.onEvent(event);
      });
      // A done marker without an item is also an incomplete response.
      if (remaining.some((query) => !completed.has(query)))
        throw new Error("Search did not finish for every item.");
      return;
    } catch (error) {
      input.signal.throwIfAborted();
      remaining = remaining.filter((query) => !completed.has(query));
      if (!remaining.length) return;
      if (attempt || (error instanceof SearchResponseError && error.status < 500)) throw error;
      input.onRetry?.();
    }
  }
}
