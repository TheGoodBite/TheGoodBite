import { getOrSet } from "@/lib/cache";
import { postalZip, stateForZip } from "@/lib/zipState";
import { validBarcode } from "@/lib/products";
import { providerJson, reserveBudget } from "@/lib/providerRuntime";
import type { PriceObservation } from "@/lib/types";

export type OpenPriceItem = {
  id: number;
  price: number;
  currency: string;
  date?: string;
  product_code?: string;
  price_per?: string | null;
  price_is_discounted?: boolean;
  duplicate_of?: number | null;
  location?: {
    osm_name?: string;
    osm_address_city?: string;
    osm_address_country_code?: string;
    osm_address_postcode?: string;
  };
};
export function selectOpenPrice(
  items: OpenPriceItem[],
  barcode: string,
  zip?: string,
  now = new Date(),
): PriceObservation | null {
  const requestedZip = postalZip(zip);
  // An unresolvable ZIP permits exact observations only; never guess the state.
  if (zip && !requestedZip) return null;
  const requestedState = stateForZip(requestedZip);
  const localityRank = (item: OpenPriceItem) => {
    if (!requestedZip) return 0;
    const observedZip = postalZip(item.location?.osm_address_postcode);
    if (observedZip === requestedZip) return 0;
    return requestedState && stateForZip(observedZip) === requestedState ? 1 : 2;
  };
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const valid = items.filter(
    (item) =>
      item.product_code?.padStart(14, "0") === barcode.padStart(14, "0") &&
      item.currency === "USD" &&
      item.location?.osm_address_country_code?.toUpperCase() === "US" &&
      localityRank(item) < 2 &&
      typeof item.price === "number" &&
      Number.isFinite(item.price) &&
      item.price > 0 &&
      !item.price_is_discounted &&
      !item.duplicate_of &&
      (!item.price_per || item.price_per === "UNIT") &&
      !!item.date &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
      item.date >= start &&
      item.date <= end,
  );
  const best = valid.sort(
    (a, b) =>
      localityRank(a) - localityRank(b) ||
      b.date!.localeCompare(a.date!) ||
      a.price - b.price,
  )[0];
  return best
    ? {
        source: "open_prices",
        amount: best.price,
        currency: "USD",
        observedAt: best.date!,
        seller: best.location?.osm_name,
        country: "US",
        locationMatch: requestedZip
          ? localityRank(best) === 0
            ? "zip"
            : "state"
          : "country",
        state: stateForZip(best.location?.osm_address_postcode),
        postalCode: postalZip(best.location?.osm_address_postcode),
        requestedPostalCode: requestedZip,
        locality: [
          best.location?.osm_address_city,
          best.location?.osm_address_postcode,
        ]
          .filter(Boolean)
          .join(", "),
        url: `https://prices.openfoodfacts.org/prices/${best.id}`,
      }
    : null;
}
export async function getOpenPricesForBarcode(
  barcode: string,
  zip?: string,
): Promise<PriceObservation | null> {
  if (!validBarcode(barcode)) return null;
  // Day in key prevents a cached observation from remaining fresh after the 30-day cutoff.
  return getOrSet(
    `openprices:v4:${barcode}:${zip ?? "US"}:${new Date().toISOString().slice(0, 10)}`,
    3600,
    async () => {
      await reserveBudget("openprices:minute", 30, 60000);
      const url = new URL("https://prices.openfoodfacts.org/api/v1/prices");
      for (const [key, value] of Object.entries({
        product_code: barcode,
        currency: "USD",
        order_by: "-date",
        date__gte: new Date(Date.now() - 30 * 86400000)
          .toISOString()
          .slice(0, 10),
        size: "100",
        page: "1",
      }))
        url.searchParams.set(key, value);
      const data = await providerJson<{ items?: OpenPriceItem[] }>(
        url,
        "Price lookup",
        undefined,
        3500,
      );
      return selectOpenPrice(data.items ?? [], barcode, zip);
    },
  );
}
