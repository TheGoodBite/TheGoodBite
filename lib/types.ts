export const DIET_MODES = [
  "high_protein",
  "low_sugar",
  "diabetes_conscious",
  "low_sodium",
  "vegetarian",
  "vegan",
  "gluten_free",
  "heart_conscious",
  "weight_loss_friendly",
  "kid_friendly"
] as const;

export type DietMode = (typeof DIET_MODES)[number];

export type SubscriptionStatus =
  | "free"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid";

export type Entitlement = {
  isPaid: boolean;
  searchItemLimitPerDay: number;
  optionsPerItem: number;
  canSaveLists: boolean;
  canTrackBought: boolean;
  canUseDietModes: boolean;
  subscriptionStatus: SubscriptionStatus;
};

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
    sodium100g?: number;
    salt100g?: number;
    fiber100g?: number;
    energyKcal100g?: number;
    saturatedFat100g?: number;
  };
  ingredientsText?: string;
  labelsTags: string[];
  categoriesTags: string[];
  allergensTags: string[];
};

export type DietFit = {
  score: number;
  matchedModes: DietMode[];
  warnings: string[];
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
};

export type SearchProductsRequest = {
  items: string[];
  dietModes?: DietMode[];
  limitPerItem?: number;
};

export type SearchProductsResponse = {
  items: Array<{
    query: string;
    options: RankedProduct[];
    error?: string;
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
