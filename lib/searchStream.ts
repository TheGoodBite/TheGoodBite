import type { SearchEvent, SearchProductsResponse } from "@/lib/types";

export async function consumeSearch(
  response: Response,
  onEvent: (event: SearchEvent) => void,
) {
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Search failed. Please try again.");
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
