import { DIET_MODES, type DietMode, type HealthInfo } from "@/lib/types";

export function isDietMode(value: string): value is DietMode {
  return (DIET_MODES as readonly string[]).includes(value);
}

export function sanitizeDietModes(values: unknown): DietMode[] {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is DietMode => typeof value === "string" && isDietMode(value));
}

export function scoreDietFit(health: HealthInfo, modes: DietMode[]) {
  if (modes.length === 0) {
    return { score: 0, matchedModes: [] as DietMode[], warnings: [] as string[] };
  }

  const scoreParts = modes.map((mode) => scoreOneMode(health, mode));
  const score = Math.round(scoreParts.reduce((sum, part) => sum + part.score, 0) / modes.length);

  return {
    score,
    matchedModes: scoreParts.filter((part) => part.match).map((part) => part.mode),
    warnings: scoreParts.flatMap((part) => part.warnings).slice(0, 4)
  };
}

function scoreOneMode(health: HealthInfo, mode: DietMode) {
  const n = health.nutrition;
  const text = [health.ingredientsText, health.labelsTags.join(" "), health.categoriesTags.join(" ")]
    .join(" ")
    .toLowerCase();
  const warnings: string[] = [];
  let score = 50;
  let match = false;

  if (mode === "high_protein") {
    score = scoreNumber(n.protein100g, 5, 15, true);
    match = (n.protein100g ?? 0) >= 8;
    if (!match) warnings.push("Lower protein");
  }

  if (mode === "low_sugar" || mode === "diabetes_conscious") {
    score = scoreNumber(n.sugars100g, 2, mode === "diabetes_conscious" ? 8 : 12, false);
    match = (n.sugars100g ?? 99) <= (mode === "diabetes_conscious" ? 6 : 10);
    if (!match) warnings.push("Higher sugar");
  }

  if (mode === "low_sodium") {
    score = scoreNumber(n.sodium100g, 0.12, 0.5, false);
    match = (n.sodium100g ?? 99) <= 0.3;
    if (!match) warnings.push("Higher sodium");
  }

  if (mode === "heart_conscious") {
    const sodium = scoreNumber(n.sodium100g, 0.12, 0.5, false);
    const satFat = scoreNumber(n.saturatedFat100g, 1, 6, false);
    score = Math.round((sodium + satFat) / 2);
    match = sodium >= 60 && satFat >= 60;
    if (!match) warnings.push("Watch sodium or saturated fat");
  }

  if (mode === "weight_loss_friendly") {
    const protein = scoreNumber(n.protein100g, 4, 12, true);
    const fiber = scoreNumber(n.fiber100g, 2, 8, true);
    const calories = scoreNumber(n.energyKcal100g, 120, 420, false);
    score = Math.round((protein + fiber + calories) / 3);
    match = score >= 60;
    if (!match) warnings.push("Lower protein/fiber fit");
  }

  if (mode === "kid_friendly") {
    const sugar = scoreNumber(n.sugars100g, 4, 14, false);
    const sodium = scoreNumber(n.sodium100g, 0.15, 0.55, false);
    score = Math.round((sugar + sodium) / 2);
    match = score >= 60;
    if (!match) warnings.push("Less kid-friendly nutrition");
  }

  if (mode === "vegetarian" || mode === "vegan") {
    const animalTerms =
      mode === "vegan"
        ? ["beef", "chicken", "pork", "fish", "gelatin", "milk", "cheese", "egg", "honey", "whey", "casein"]
        : ["beef", "chicken", "pork", "fish", "gelatin"];
    const hasAnimalTerm = animalTerms.some((term) => text.includes(term));
    const hasPositiveLabel = text.includes(mode) || text.includes(`${mode}-`);
    score = hasAnimalTerm ? 0 : hasPositiveLabel ? 100 : 65;
    match = !hasAnimalTerm && (hasPositiveLabel || mode === "vegetarian");
    if (hasAnimalTerm) warnings.push(mode === "vegan" ? "Likely not vegan" : "Likely not vegetarian");
  }

  if (mode === "gluten_free") {
    const glutenTerms = ["wheat", "barley", "rye", "malt", "gluten"];
    const hasGluten = glutenTerms.some((term) => text.includes(term));
    const hasLabel = text.includes("gluten-free") || text.includes("gluten free");
    score = hasGluten && !hasLabel ? 0 : hasLabel ? 100 : 60;
    match = hasLabel;
    if (hasGluten && !hasLabel) warnings.push("Likely contains gluten");
  }

  return { mode, score, match, warnings };
}

function scoreNumber(value: number | undefined, good: number, bad: number, higherIsBetter: boolean) {
  if (value === undefined || !Number.isFinite(value)) return 45;
  const raw = higherIsBetter ? (value - good) / (bad - good) : (bad - value) / (bad - good);
  return Math.round(Math.max(0, Math.min(1, raw)) * 100);
}
