import { getOrSet } from "@/lib/cache";
import { sha256 } from "@/lib/utils";

type OpenPriceItem = {
  id: number;
  price: number;
  currency: string;
  date?: string;
  product_code?: string;
  location?: {
    osm_name?: string;
    osm_address_city?: string;
    osm_address_country_code?: string;
  };
};

export async function getOpenPricesForBarcode(upc: string): Promise<{ price: number; currency: string; store?: string } | null> {
  const cacheKey = `openprices:barcode:${upc}`;
  return getOrSet(cacheKey, 60 * 60 * 24, async () => {
    try {
      const url = `https://prices.openfoodfacts.org/api/v1/prices?product_code=${encodeURIComponent(upc)}&page=1&size=5`;
      const res = await fetch(url, {
        headers: { "User-Agent": "TheGoodBite/1.0 (contact: support@thegoodbite.app)" },
        next: { revalidate: 60 * 60 * 12 }
      });
      if (!res.ok) return null;

      const data = (await res.json()) as { items?: OpenPriceItem[] };
      const valid = (data.items ?? []).filter((item) => typeof item.price === "number" && item.price > 0);
      if (valid.length === 0) return null;

      const latest = valid[0];
      return {
        price: latest.price,
        currency: latest.currency || "USD",
        store: latest.location?.osm_name ?? latest.location?.osm_address_city
      };
    } catch {
      return null;
    }
  });
}
