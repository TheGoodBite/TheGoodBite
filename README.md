# OnlyGoodBites

OnlyGoodBites is a grocery decision app that helps users turn a simple grocery list into ranked product options with estimated prices, nutrition scores, diet-fit scores, and a lightweight "bought it" history.

The app should not start as a native iOS or Android app. Build it as a mobile-first web app/PWA so it is cheaper, faster, easier for AI to build, and easier to deploy.

## Product Direction

The original idea was to find the single cheapest healthy product at a user's exact local grocery store. That is useful, but it creates a lot of API complexity and may not be valuable enough to justify the implementation pain.

The better MVP is:

```txt
User enters grocery items -> app shows top ranked product options for each item -> user chooses what they bought -> list is saved for next time.
```

Example:

```txt
Grocery list:
1. Mac and cheese
2. Potato chips
3. Greek yogurt

Result:
Mac and cheese -> horizontal carousel with 10 options, estimated prices, health scores, diet-fit tags, and "Bought this" buttons.
Potato chips -> horizontal carousel with 10 options, estimated prices, health scores, diet-fit tags, and "Bought this" buttons.
Greek yogurt -> horizontal carousel with 10 options, estimated prices, health scores, diet-fit tags, and "Bought this" buttons.
```

This is easier to monetize because users are paying for better grocery decisions, not just exact local inventory lookup.

## Recommended Stack

### Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Optional: `shadcn/ui` for form, card, drawer, badge, tabs, and loading components
- Mobile-first responsive web UI
- PWA later if users want an app-like phone experience

### Backend

- Next.js Route Handlers
- Node.js serverless runtime on Vercel
- Main product endpoint: `POST /api/search-products`
- Saved lists endpoint: `GET/POST/PATCH /api/lists`
- AI recipe endpoint: `POST /api/ai/recipe-ideas`

### Deployment

- Vercel for the Next.js app
- Supabase for auth and saved user data
- Upstash Redis for cache
- Optional hosted LLM provider later for paid AI recipes

## Monetization Strategy

It is reasonable to monetize the core product search. The core value is not "we found the exact store shelf price." The core value is "we helped you choose better products faster."

Suggested pricing:

- Free preview: limited searches, for example 3 grocery items/day or 1 saved list
- Paid plan: unlimited ranked product searches, saved lists, bought history, diet mode packs, and AI recipe ideas
- Suggested starting price: `$3.99/month` or `$19/year`

Keep the paid promise simple:

```txt
Build smarter grocery lists, compare common product options, and remember what you actually buy.
```

## MVP Features

### 1. Grocery List Builder

Users can:

- Add grocery items one at a time
- Paste comma-separated items
- Paste newline-separated items
- Reorder items
- Remove items
- Save the list for next time

Example request:

```json
{
  "listId": "optional-existing-list-id",
  "items": ["Mac and cheese", "Potato chips", "Greek yogurt"],
  "dietModes": ["high_protein", "low_sugar"]
}
```

ZIP code should be optional in the MVP. If provided, use it only for rough regional context or future provider support.

### 2. Product Option Carousels

For each grocery item, show a horizontal carousel of product cards.

Each product card should include:

- Product image
- Product title
- Brand
- Estimated price
- Package size when available
- Health score
- Diet-fit score
- Nutri-Score badge when available
- NOVA group when available
- Simple explanation
- `Bought this` button

Example card:

```txt
Kraft Original Mac & Cheese
$1.79 estimated
Score: 62/100
Diet fit: Not low sugar
Nutri-Score: C
NOVA: 4
[Bought this]
```

### 3. Product Scoring

Do not try to pick one "perfect" product at first. Show options and score them.

Score each product from `0-100` using:

- Estimated price
- Product relevance to the user's search
- Nutri-Score
- NOVA group
- Protein, sugar, sodium, fiber, saturated fat when available
- Diet mode fit
- User's past bought/not-bought behavior later

Example scoring breakdown:

```txt
overallScore = relevanceScore
             + priceScore
             + healthScore
             + dietFitScore
             + historyScore
```

The UI should show the overall score but also explain it in plain language:

```txt
Cheapest option found, but lower health score.
Good high-protein fit.
Lower sugar than most similar products.
Highly processed, but cheapest in this category.
```

### 4. Bought History

Each product card should have:

```txt
Bought this
```

When clicked, store:

- User ID
- Grocery list ID
- Grocery item text
- Product ID or UPC
- Product title
- Estimated price at time of selection
- Timestamp

Use this later to:

- Preselect products the user often buys
- Show "Bought last time"
- Build a repeat grocery list
- Avoid recommending items the user consistently ignores

### 5. Saved Grocery Lists

Saved lists should be part of the MVP. This means the app is no longer fully database-less.

Users should be able to:

- Create a grocery list
- Save it
- Reopen it later
- Duplicate it
- Mark items bought
- Keep a history of bought products

Use Supabase Auth and Supabase Postgres for this because they are fast to build with, cheap to start, and easy for AI coding agents to understand.

### 6. Diet Mode Packs

Diet Mode Packs are a paid feature and should use zero AI.

The user chooses diet preferences, and the product scoring system changes. The app still shows multiple product options, but the ranking changes.

Example diet modes:

- High protein
- Low sugar
- Diabetes-conscious
- Low sodium
- Vegetarian
- Vegan
- Gluten-free
- Heart-conscious
- Weight-loss friendly
- Kid-friendly

Important wording:

- Use phrases like `diabetes-conscious`, `heart-conscious`, and `low sugar`.
- Do not claim to treat, prevent, or manage disease.
- Include a short disclaimer that diet modes are general food-preference filters, not medical advice.

Example behavior:

- `Greek yogurt` + `high protein`: rank higher-protein yogurt above cheaper but lower-protein options.
- `Greek yogurt` + `diabetes-conscious`: rank lower-sugar options higher.
- `Potato chips` + `low sodium`: rank lower-sodium options higher.
- `Mac and cheese` + `kid-friendly`: prefer simpler recognizable products, then price.

### 7. AI Recipe Ideas

AI Recipe Ideas are a paid feature.

After users build a list or mark products bought, they can click:

```txt
Generate recipe ideas
```

The app sends selected products, diet modes, household size, and optional pantry items to an LLM. The LLM returns simple recipe ideas using the items.

This should be separate from product search. The product search should work without AI.

## Later Features

Exact local grocery-store search should move to later.

Do not build these in the first MVP:

- Exact local store inventory
- Exact live local store prices
- Multi-store comparison
- Route optimization
- In-app checkout
- Barcode scanner
- Receipt scanning
- Push notifications

Later, add:

- Optional ZIP-based local pricing
- Kroger location-specific product search
- Target provider adapter if a reliable API/wrapper is available
- Walmart provider adapter if a reliable API/wrapper is available
- Price history
- Household shared lists

## APIs To Use

### 1. Product Search Provider

For the MVP, start with one product data provider and keep it behind an adapter.

Preferred first provider:

- Kroger Developer API, if product search and price estimates work well enough without forcing exact store behavior

Alternative or later providers:

- SerpAPI or another Google Shopping/search wrapper for broad product discovery
- Target wrapper only later
- Walmart wrapper only later

Provider adapter goal:

```ts
type ProductSearchProvider = {
  searchProducts(input: {
    query: string;
    zipCode?: string;
    limit: number;
  }): Promise<ProductCandidate[]>;
};
```

Normalized product candidate:

```ts
type ProductCandidate = {
  provider: string;
  providerProductId: string;
  title: string;
  brand?: string;
  imageUrl?: string;
  estimatedPrice: number | null;
  packageSize?: string;
  upc?: string;
  productUrl?: string;
  raw: unknown;
};
```

The UI should label prices as estimated unless we have confirmed store-specific pricing.

### 2. Open Food Facts API

Use Open Food Facts for nutrition and health classification.

Primary lookup:

```txt
https://world.openfoodfacts.org/api/v3.6/product/{barcode}.json
```

Fields to parse:

- `nutriscore_grade`
- `nova_group`
- `product_name`
- `brands`
- `image_front_url`
- `nutriments.proteins_100g`
- `nutriments.sugars_100g`
- `nutriments.salt_100g`
- `nutriments.sodium_100g`
- `nutriments.fiber_100g`
- `nutriments.energy-kcal_100g`
- `nutriments.saturated-fat_100g`
- `ingredients_text`
- `labels_tags`
- `categories_tags`
- `allergens_tags`

Implementation notes:

- Prefer barcode lookup using UPC.
- If no UPC is available, optionally use text search as a fallback.
- If Open Food Facts has no match, classify health as `unknown`.
- Use a custom `User-Agent`.
- Cache responses aggressively because health data changes slowly.

### 3. AI Model Provider

Use an OpenAI-compatible client interface from day one.

Local development:

```txt
Ollama running locally at http://localhost:11434
```

Environment variables:

```txt
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama
AI_MODEL=qwen2.5:7b-instruct
```

Good local model choices:

- `qwen2.5:7b-instruct`
- `qwen2.5:14b-instruct` if the laptop can run it comfortably
- `llama3.1:8b-instruct`
- `gemma2:9b-instruct`

GLM note:

- Keep GLM as an optional model, not a hard dependency.
- Many strong GLM models are too large for normal laptop hosting.
- If a small Ollama-compatible GLM instruct model runs well, set `AI_MODEL` to that model.

Production:

- Do not use a personal laptop for real paying users.
- A laptop server is acceptable for private demos or a tiny beta.
- For production, switch the same OpenAI-compatible client to a hosted provider or small rented GPU server.

## Database

Use Supabase Postgres for saved lists and purchase history.

Suggested tables:

### `profiles`

```txt
id uuid primary key
email text
created_at timestamptz
```

### `grocery_lists`

```txt
id uuid primary key
user_id uuid references profiles(id)
name text
created_at timestamptz
updated_at timestamptz
```

### `grocery_list_items`

```txt
id uuid primary key
list_id uuid references grocery_lists(id)
query text
sort_order int
is_active boolean
created_at timestamptz
updated_at timestamptz
```

### `bought_products`

```txt
id uuid primary key
user_id uuid references profiles(id)
list_id uuid references grocery_lists(id)
item_id uuid references grocery_list_items(id)
query text
provider text
provider_product_id text
upc text
title text
brand text
estimated_price numeric
image_url text
bought_at timestamptz
```

### `user_preferences`

```txt
user_id uuid primary key references profiles(id)
diet_modes text[]
zip_code text
created_at timestamptz
updated_at timestamptz
```

## Cache

Use Upstash Redis for provider responses and AI responses.

Suggested cache keys:

```txt
products:{provider}:{normalizedQuery}:{zipOrNational}:{limit}
off:barcode:{upc}
off:search:{normalizedTitle}
ranked:{hashOfQueryDietModesAndProviderResults}
ai:recipes:{hashOfProductsDietModesPantryHouseholdSize}
```

Suggested TTLs:

- Product search: 15-60 minutes
- Open Food Facts barcode lookup: 30-90 days
- Ranked product result: 15-60 minutes
- AI recipe response: 1-7 days

The app should still work if Redis is unavailable. It will just be slower and more expensive.

## Backend Endpoints

### `POST /api/search-products`

Input:

```json
{
  "items": ["Mac and cheese", "Potato chips"],
  "dietModes": ["low_sugar"],
  "zipCode": "01604",
  "limitPerItem": 10
}
```

Output:

```json
{
  "items": [
    {
      "query": "Mac and cheese",
      "options": [
        {
          "title": "Kraft Original Mac & Cheese",
          "brand": "Kraft",
          "estimatedPrice": 1.79,
          "imageUrl": "https://example.com/image.jpg",
          "upc": "000000000000",
          "overallScore": 62,
          "health": {
            "nutriScore": "c",
            "novaGroup": 4,
            "classification": "fallback"
          },
          "dietFit": {
            "score": 34,
            "matchedModes": [],
            "warnings": ["Higher sodium", "Highly processed"]
          },
          "explanation": "Low estimated price, but weaker health score."
        }
      ]
    }
  ],
  "disclaimer": "Prices are estimates unless marked as confirmed local prices."
}
```

### `POST /api/lists`

Create a saved grocery list.

### `GET /api/lists`

Return the user's saved grocery lists.

### `PATCH /api/lists/:listId`

Update list name, items, order, or active status.

### `POST /api/bought-products`

Store that the user bought a product.

Input:

```json
{
  "listId": "list-id",
  "itemId": "item-id",
  "query": "Mac and cheese",
  "product": {
    "provider": "kroger",
    "providerProductId": "abc123",
    "upc": "000000000000",
    "title": "Kraft Original Mac & Cheese",
    "brand": "Kraft",
    "estimatedPrice": 1.79,
    "imageUrl": "https://example.com/image.jpg"
  }
}
```

### `POST /api/ai/recipe-ideas`

Generate paid AI recipe ideas from selected products.

Input:

```json
{
  "householdSize": 2,
  "dietModes": ["high_protein", "low_sugar"],
  "pantryItems": ["rice", "eggs", "cinnamon"],
  "products": [
    {
      "query": "Greek yogurt",
      "title": "Plain Greek Yogurt",
      "estimatedPrice": 4.19,
      "nutriScore": "a",
      "novaGroup": 3,
      "nutrition": {
        "protein_100g": 10,
        "sugars_100g": 3.5
      }
    }
  ]
}
```

Output:

```json
{
  "recipes": [
    {
      "title": "High-Protein Yogurt Oat Bowl",
      "usesProducts": ["Plain Greek Yogurt", "Old Fashioned Oats"],
      "dietFit": ["high_protein", "low_sugar"],
      "estimatedCostPerServing": 1.4,
      "prepTimeMinutes": 5,
      "steps": [
        "Add yogurt to a bowl.",
        "Stir in oats.",
        "Add cinnamon if available."
      ],
      "tips": ["Use unsweetened yogurt to keep sugar lower."]
    }
  ],
  "disclaimer": "Recipe ideas are general food suggestions, not medical advice."
}
```

## Suggested Project Structure

```txt
app/
  page.tsx
  api/
    search-products/
      route.ts
    lists/
      route.ts
    bought-products/
      route.ts
    ai/
      recipe-ideas/
        route.ts
components/
  GroceryListEditor.tsx
  ProductCarousel.tsx
  ProductCard.tsx
  ScoreBadge.tsx
  DietModePicker.tsx
  BoughtButton.tsx
  SavedListsDrawer.tsx
lib/
  ai.ts
  cache.ts
  dietModes.ts
  health.ts
  pricing.ts
  scoring.ts
  supabase.ts
  types.ts
  providers/
    productSearch.ts
    kroger.ts
    openFoodFacts.ts
```

## Product Scoring Details

### Health Score

```txt
Nutri-Score A: +40
Nutri-Score B: +30
Nutri-Score C: +10
Nutri-Score D/E: -20
Unknown: 0
NOVA 1-3: +20
NOVA 4: -30
```

### Diet Mode Score

```txt
high_protein:
  reward higher proteins_100g

low_sugar:
  penalize higher sugars_100g

diabetes_conscious:
  heavily penalize high sugars_100g
  reward fiber when available

low_sodium:
  penalize high sodium_100g

vegetarian:
  exclude obvious meat/fish products when confidence is high

vegan:
  exclude meat, fish, milk, egg, honey, and animal-derived products when confidence is high

gluten_free:
  prefer gluten-free labels
  penalize wheat, barley, and rye ingredients

heart_conscious:
  penalize high sodium and high saturated fat

weight_loss_friendly:
  reward protein and fiber
  penalize high kcal density

kid_friendly:
  prefer simple staples
  penalize high sugar and high sodium
```

### Price Score

Use relative price within the result set for that grocery item.

```txt
cheapest option: highest price score
most expensive option: lowest price score
unknown price: low confidence, but still show if product data is useful
```

## AI Recipe Prompting Rules

The AI recipe feature should:

- Use only provided products and pantry items.
- Avoid inventing exact nutrition facts.
- Avoid medical claims.
- Return JSON matching the response schema.
- Include simple recipes with common ingredients.
- Include a disclaimer.
- Keep recipes short and practical.

Do not let the AI choose products. Product ranking should remain deterministic and explainable.

## Frontend UX

Main page:

- App header
- Saved list selector
- Grocery list editor
- Diet mode picker
- Search/refresh button
- One product carousel per grocery item
- Bought history indicators
- Recipe ideas CTA for paid users

Product carousel card:

- Image at top
- Product title
- Estimated price
- Overall score
- Health/diet badges
- One-line explanation
- `Bought this` button

This should feel closer to a useful grocery search dashboard than a strict cart optimizer.

## Build Order

1. Create Next.js app with TypeScript and Tailwind.
2. Build static UI with fake product carousel data.
3. Add Supabase Auth.
4. Add saved grocery lists in Supabase.
5. Add `POST /api/search-products` with mocked provider data.
6. Add product search provider adapter.
7. Add Kroger or first product provider.
8. Add Open Food Facts lookup.
9. Add scoring system.
10. Add diet mode scoring.
11. Add `Bought this` tracking.
12. Add Upstash Redis cache.
13. Add paid access checks.
14. Add AI recipe ideas with Ollama/OpenAI-compatible client.
15. Deploy to Vercel.

## Non-Goals For MVP

Do not build these initially:

- Native iOS app
- Native Android app
- Exact local store inventory
- Exact live local store prices
- Multi-store optimization
- Route optimization
- Barcode scanner
- Receipt scanning
- In-app checkout

## Summary Recommendation

Build the MVP with:

```txt
Next.js + TypeScript + Tailwind + Vercel + Supabase + Upstash Redis + Open Food Facts + one product search provider
```

The new core product is ranked grocery product discovery with saved lists and bought history. Exact local grocery-store pricing should be a later feature, not the initial product promise.
