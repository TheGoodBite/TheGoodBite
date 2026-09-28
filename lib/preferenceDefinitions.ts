import type { ProductPreferenceId } from "@/lib/types";

export const PREFERENCE_GROUPS: { id: string; label: string; attributes: {id: ProductPreferenceId; label: string}[] }[] = [
  {
    "id": "nutritional_quality",
    "label": "Nutritional quality",
    "attributes": [
      {
        "id": "nutriscore",
        "label": "Good nutritional quality (Nutri-Score)"
      },
      {
        "id": "low_salt",
        "label": "Salt in low quantity"
      },
      {
        "id": "low_sugars",
        "label": "Sugars in low quantity"
      },
      {
        "id": "low_fat",
        "label": "Fat in low quantity"
      },
      {
        "id": "low_saturated_fat",
        "label": "Saturated fat in low quantity"
      }
    ]
  },
  {
    "id": "processing",
    "label": "Food processing",
    "attributes": [
      {
        "id": "nova",
        "label": "No or little food processing (NOVA group)"
      },
      {
        "id": "additives",
        "label": "No or few additives"
      }
    ]
  },
  {
    "id": "allergens",
    "label": "Allergens",
    "attributes": [
      {
        "id": "allergens_no_gluten",
        "label": "Without gluten"
      },
      {
        "id": "allergens_no_milk",
        "label": "Without milk"
      },
      {
        "id": "allergens_no_eggs",
        "label": "Without eggs"
      },
      {
        "id": "allergens_no_nuts",
        "label": "Without nuts"
      },
      {
        "id": "allergens_no_peanuts",
        "label": "Without peanuts"
      },
      {
        "id": "allergens_no_sesame_seeds",
        "label": "Without sesame seeds"
      },
      {
        "id": "allergens_no_soybeans",
        "label": "Without soybeans"
      },
      {
        "id": "allergens_no_celery",
        "label": "Without celery"
      },
      {
        "id": "allergens_no_mustard",
        "label": "Without mustard"
      },
      {
        "id": "allergens_no_lupin",
        "label": "Without lupin"
      },
      {
        "id": "allergens_no_fish",
        "label": "Without fish"
      },
      {
        "id": "allergens_no_crustaceans",
        "label": "Without crustaceans"
      },
      {
        "id": "allergens_no_molluscs",
        "label": "Without molluscs"
      },
      {
        "id": "allergens_no_sulphur_dioxide_and_sulphites",
        "label": "Without sulphur dioxide and sulphites"
      }
    ]
  },
  {
    "id": "ingredients_analysis",
    "label": "Ingredients",
    "attributes": [
      {
        "id": "vegan",
        "label": "Vegan"
      },
      {
        "id": "vegetarian",
        "label": "Vegetarian"
      },
      {
        "id": "palm_oil_free",
        "label": "Palm oil free"
      },
      {
        "id": "unwanted_ingredients",
        "label": "Unwanted ingredients"
      }
    ]
  },
  {
    "id": "labels",
    "label": "Labels",
    "attributes": [
      {
        "id": "labels_organic",
        "label": "Organic farming"
      },
      {
        "id": "labels_fair_trade",
        "label": "Fair trade"
      }
    ]
  },
  {
    "id": "environment",
    "label": "Environment",
    "attributes": [
      {
        "id": "ecoscore",
        "label": "Low environmental impact (Green-Score)"
      },
      {
        "id": "forest_footprint",
        "label": "Low risk of deforestation (Forest Footprint)"
      }
    ]
  }
];

export const IMPORTANCE_LABELS = {
  not_important: "Not important", important: "Important", very_important: "Very important", mandatory: "Mandatory",
} as const;
