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
};

export type DietFit = {
  score: number;
  matchedModes: DietMode[];
  warnings: string[];
  evidence?: Partial<Record<DietMode, EvidenceState>>;
};

export type RankedProduct = ProductCandidate & {
  overallScore: number;
  scoreParts: {
    relevance: number;
    price: number;
    health: number;
    diet: number;
    history: number;
  };
  health: HealthInfo;
  dietFit: DietFit;
  explanation: string;
  allergyStatus?: "conflict" | "unknown" | "not_detected";
};

export type SearchProductsRequest = {
  items: string[];
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
