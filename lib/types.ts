export const DIET_MODES = [
  "high_protein",
  "low_sugar",
  "low_carb",
  "diabetes_conscious",
  "low_sodium",
  "vegetarian",
  "vegan",
  "gluten_free",
  "heart_conscious",
  "weight_loss_friendly",
  "kid_friendly",
  "fodmap",
] as const;

export type DietMode = (typeof DIET_MODES)[number];

export const ALLERGENS = [
  "peanuts",
  "tree_nuts",
  "dairy",
  "eggs",
  "wheat",
  "soy",
  "shellfish",
  "fish",
  "sesame",
] as const;

export type Allergen = (typeof ALLERGENS)[number];

export const PRODUCT_PREFERENCE_IDS = [
  "nutriscore",
  "low_salt",
  "low_sugars",
  "low_fat",
  "low_saturated_fat",
  "nova",
  "additives",
  "allergens_no_gluten",
  "allergens_no_milk",
  "allergens_no_eggs",
  "allergens_no_nuts",
  "allergens_no_peanuts",
  "allergens_no_sesame_seeds",
  "allergens_no_soybeans",
  "allergens_no_celery",
  "allergens_no_mustard",
  "allergens_no_lupin",
  "allergens_no_fish",
  "allergens_no_crustaceans",
  "allergens_no_molluscs",
  "allergens_no_sulphur_dioxide_and_sulphites",
  "vegan",
  "vegetarian",
  "palm_oil_free",
  "labels_organic",
  "labels_fair_trade",
  "ecoscore",
  "forest_footprint",
  "unwanted_ingredients"
] as const;
export type ProductPreferenceId = (typeof PRODUCT_PREFERENCE_IDS)[number];
export const PREFERENCE_IMPORTANCE = ["not_important", "important", "very_important", "mandatory"] as const;
export type PreferenceImportance = (typeof PREFERENCE_IMPORTANCE)[number];
export type ProductPreferences = Partial<Record<ProductPreferenceId, PreferenceImportance>>;
export type ProductAttribute = {
  status: "known" | "unknown" | "not-applicable";
  match?: number;
  title?: string;
};

export type SubscriptionStatus =
  "free" | "active" | "trialing" | "past_due" | "canceled" | "unpaid";

export type Entitlement = {
  isPaid: boolean;
  searchItemLimitPerDay: number;
  optionsPerItem: number;
  canSaveLists: boolean;
  canTrackBought: boolean;
  canUseDietModes: boolean;
  subscriptionStatus: SubscriptionStatus;
};

export type PriceObservation = {
  source: "shopping" | "open_prices";
  amount: number;
  currency: "USD";
  observedAt: string;
  seller?: string;
  url?: string;
  country?: "US";
  locality?: string;
  locationMatch?: "zip" | "state" | "country";
  state?: string;
  postalCode?: string;
  requestedPostalCode?: string;
};
export type PackageInfo = {
  size?: string;
  count?: number;
  quantity?: number;
  unit?: "g" | "ml";
  bulk: boolean;
  ambiguous?: boolean;
};
export type EvidenceState = "match" | "conflict" | "unknown";
export type ProductCandidate = {
  provider: string;
  providerProductId: string;
  title: string;
  brand?: string;
  categoryTags?: string[];
  imageUrl?: string;
  estimatedPrice: number | null;
  packageSize?: string;
  upc?: string;
  productUrl?: string;
  seller?: string;
  currency?: "USD";
  market?: "US-search" | "US-catalog";
  package?: PackageInfo;
  offers?: PriceObservation[];
  priceSource?: "shopping" | "open_prices";
  priceObservation?: PriceObservation;
  unitPrice?: { amount: number; unit: "100g" | "100ml" };
  raw?: unknown;
};

export type HealthInfo = {
  nutriScore: "a" | "b" | "c" | "d" | "e" | "unknown";
  nutriScoreScore?: number;
  novaGroup: number | null;
  classification: "strict" | "fallback" | "unknown" | "unhealthy";
  confidence: "high" | "medium" | "low";
  nutrition: {
    protein100g?: number;
    sugars100g?: number;
    carbohydrates100g?: number;
    sodium100g?: number;
    salt100g?: number;
    fiber100g?: number;
    energyKcal100g?: number;
    saturatedFat100g?: number;
    fat100g?: number;
  };
  source?: {
    provider: "open_food_facts";
    barcode?: string;
    productName: string;
    url?: string;
    match: "barcode" | "text" | "catalog";
    fetchedAt: string;
  };
  availability?: "matched" | "no_match" | "unavailable";
  servingSize?: string;
  servingsPerContainer?: number | null;
  ingredientsText?: string;
  labelsTags: string[];
  categoriesTags: string[];
  allergensTags: string[];
  attributes?: Partial<Record<ProductPreferenceId, ProductAttribute>>;
  ingredientsTags?: string[];
};

export type DietFit = {
  score: number;
  matchedModes: DietMode[];
  warnings: string[];
  evidence?: Partial<Record<DietMode, EvidenceState>>;
};

export type RankedProduct = ProductCandidate & {
  health: HealthInfo;
  dietFit: DietFit;
  explanation: string;
  allergyStatus?: "conflict" | "unknown" | "not_detected";
  preferenceFit?: { matches: string[]; unknown: string[]; unmet?: string[] };
};

export type SearchProductsRequest = {
  items: string[];
  productPreferences?: ProductPreferences;
  unwantedIngredients?: string[];
  dietModes?: DietMode[];
  allergies?: Allergen[];
  zipCode?: string;
  limitPerItem?: number;
  bulkPreference?: "everyday" | "bulk" | "any";
};

export type SearchProductsResponse = {
  items: Array<{
    query: string;
    options: RankedProduct[];
    error?: string;
    warnings?: string[];
    excludedCount?: number;
    emptyReason?: "nutrition_unavailable" | "nutrition_missing";
  }>;
  entitlement: Pick<
    Entitlement,
    "isPaid" | "optionsPerItem" | "canUseDietModes" | "searchItemLimitPerDay"
  >;
  disclaimer: string;
};

export type AuthUser = {
  id: string;
  email?: string;
};

export type SearchEvent =
  | {
      type: "meta";
      entitlement: SearchProductsResponse["entitlement"];
      disclaimer: string;
    }
  | { type: "item"; item: SearchProductsResponse["items"][number] }
  | { type: "done" }
  | { type: "error"; error: string };
