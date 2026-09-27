import type {
  PackageInfo,
  ProductCandidate,
  PriceObservation,
} from "@/lib/types";

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}
export function validBarcode(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)
  )
    return undefined;
  const digits = [...value].map(Number);
  const check = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce((n, d, i) => n + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check ? value : undefined;
}
export function parsePackage(title: string): PackageInfo {
  const text = title.toLowerCase();
  const unitPattern =
    /(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|fluid ounces?|ounces?|oz|pounds?|lbs?|kilograms?|kg|grams?|g|millilit(?:er|re)s?|ml|lit(?:er|re)s?|l)\b/g;
  const sizes = [...text.matchAll(unitPattern)];
  const pack =
    text.match(/\b(?:pack|case)\s+of\s+(\d+)\b/) ??
    text.match(/\b(\d+)\s*[- ]?(?:pack|pk)\b/) ??
    text.match(/\b(\d+)\s*[x×]\s*\d/);
  const count = pack ? Number(pack[1]) : undefined;
  const bulk = (count ?? 1) > 1 || /\b(bulk|wholesale|case of)\b/.test(text);
  if (!sizes.length) return { count, bulk };
  // Multiple measurements can be per-pack or total. Avoid guessing the denominator.
  if (sizes.length > 1 || (count && /\b(total|net weight)\b/.test(text)))
    return {
      count,
      bulk,
      size: sizes.map((s) => s[0]).join(" / "),
      ambiguous: true,
    };
  const [, amount, rawUnit] = sizes[0];
  const normalized = rawUnit.replace(/[.\s]/g, "");
  const volume = /^(fl|fluid|ml|millilit|l$|lit)/.test(normalized);
  const factor = /^(kg|kilogram)/.test(normalized)
    ? 1000
    : /^(lb|pound)/.test(normalized)
      ? 453.59237
      : /^(oz|ounce)/.test(normalized)
        ? 28.349523125
        : /^(fl|fluid)/.test(normalized)
          ? 29.5735295625
          : /^(l$|lit)/.test(normalized)
            ? 1000
            : 1;
  return {
    size: sizes[0][0],
    count,
    bulk,
    quantity: Number(amount) * factor * (count ?? 1),
    unit: volume ? "ml" : "g",
  };
}
export function productTokens(title: string): string[] {
  const cleaned = title
    .toLowerCase()
    .replace(/\b(?:pack|case)\s+of\s+\d+\b/g, " ")
    .replace(/\b\d+\s*[- ]?(?:pack|pk)\b/g, " ")
    .replace(/\b\d+\s*[x×]\s*(?=\d)/g, " ")
    .replace(
      /\b\d+(?:\.\d+)?\s*(?:fl\.?\s*oz|fluid ounces?|ounces?|oz|pounds?|lbs?|kilograms?|kg|grams?|g|milliliters?|ml|liters?|l)\b/g,
      " ",
    );
  return [...new Set(words(cleaned))].sort();
}
export function samePackage(a: PackageInfo, b: PackageInfo) {
  return (
    !a.ambiguous &&
    !b.ambiguous &&
    !!a.quantity &&
    !!b.quantity &&
    a.unit === b.unit &&
    Math.abs(a.quantity - b.quantity) / a.quantity < 0.015 &&
    (a.count ?? 1) === (b.count ?? 1)
  );
}
export function deduplicateProducts(
  products: ProductCandidate[],
): ProductCandidate[] {
  const groups = new Map<string, ProductCandidate>();
  for (const item of products) {
    const pack = item.package ?? parsePackage(item.packageSize || item.title);
    const identity = validBarcode(item.upc)
      ? `gtin:${item.upc!.padStart(14, "0")}:${pack.count ?? 1}:${pack.quantity ?? "unknown"}:${pack.unit ?? ""}`
      : `title:${productTokens(item.title).join(" ")}:${pack.ambiguous ? pack.size : pack.quantity ? `${pack.unit}:${Math.round(pack.quantity * 10) / 10}` : "unknown"}:${pack.count ?? 1}`;
    // A count such as '12 eggs' remains in the title, so it cannot merge with '6 eggs'.
    const previous = groups.get(identity);
    const offers = uniqueOffers([
      ...(previous?.offers ?? []),
      ...(item.offers ?? []),
    ]);
    if (
      !previous ||
      (item.estimatedPrice ?? Infinity) < (previous.estimatedPrice ?? Infinity)
    )
      groups.set(identity, { ...item, package: pack, offers });
    else groups.set(identity, { ...previous, offers });
  }
  return [...groups.values()];
}
function uniqueOffers(offers: PriceObservation[]) {
  return [
    ...new Map(
      offers.map((o) => [`${o.source}:${o.seller}:${o.amount}:${o.url}`, o]),
    ).values(),
  ];
}
export function withUnitPrice(product: ProductCandidate): ProductCandidate {
  const pack = product.package;
  if (
    !pack?.quantity ||
    pack.ambiguous ||
    !pack.unit ||
    product.estimatedPrice === null
  )
    return product;
  return {
    ...product,
    unitPrice: {
      amount: (product.estimatedPrice / pack.quantity) * 100,
      unit: pack.unit === "g" ? "100g" : "100ml",
    },
  };
}
