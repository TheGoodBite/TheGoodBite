import { words } from "@/lib/products";

// OFF text search can match an ingredient instead of the product being sought.
// Screen explicit milk-beverage conflicts without requiring complete category
// metadata or exact title words (e.g. "Silk Oat" is a valid catalog match).
const milkDerivatives = /\b(?:butters?|creamers?|half (?:and )?half|yoghurts?|yogurts?|cheeses?|ice creams?|(?:chocolate|candy|cereal|protein|almond|seed|granola|snack) bars?|cookies?|biscuits?|spreads?|milk chocolates?)\b/;

export function matchesCatalogProductType(
  query: string,
  product: { product_name?: string; categories_tags?: string[] },
): boolean {
  const wanted = words(query).join(" ");
  if (!/\bmilks?\b/.test(wanted) || milkDerivatives.test(wanted)) return true;

  const name = words(product.product_name ?? "").join(" ");
  if (milkDerivatives.test(name)) return false;

  return !(product.categories_tags ?? []).some((tag) => {
    // Restrict this small English rule to English taxonomy tags.
    if (!tag.startsWith("en:")) return false;
    const category = words(tag.slice(3)).join(" ");
    return milkDerivatives.test(category) || /(?:^| )chocolates?$/.test(category);
  });
}
