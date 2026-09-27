export function containsTerm(text: string, term: string): boolean {
  const escaped = term
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "[\\s-]+");
  return new RegExp(`\\b${escaped}(?:s|es)?\\b`, "i").test(text);
}
export function withoutFreeClaims(text: string, terms: string[]) {
  let result = text.toLowerCase();
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(
        `\\b(?:no|without|free[ -]from)\\s+${escaped}\\b|\\b${escaped}[ -]free\\b`,
        "gi",
      ),
      " ",
    );
  }
  return result;
}
