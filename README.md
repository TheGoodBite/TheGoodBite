# Meezany

**Better groceries, without the homework.**

**Mission:** Help people make healthy choices at the grocery store.

**How:** Convert a grocery list into healthy product options, comparable by price and filterable by personal preferences. Inputs can be as vague as "chips" or as specific as a brand and product.

**Principles:** Cheap, low-input, fast, helpful.

This README preserves the full product vision alongside current implementation status. See the [Look & Feel guide](BRAND_GUIDELINES.md) for the visual system and reference designs. Vision features are not all implemented.

## Full Product Vision

### Inputs

- USA ZIP code, grocery list, and preferences. ZIP is optional today; exact local pricing and inventory are later work.
- Saveable lists with drag and drop, keyboard input, comma-separated text, or bullet points. Eventually accept photos and other list-like input.
- Mark purchased products. Share a final list, send it as an image, or export to Instacart when a suitable integration exists.
- Quick lookup without creating a full list.
- Optional autocomplete; later, smart suggestions for what else to add.

### Preferences

- Allergies, with clear notice that product data may be inaccurate or incomplete and users must verify packaging. A disclaimer does not turn uncertain data into a safety guarantee.
- Bulk versus singles, servings per container, and price range.
- Vegan and other dietary needs; high protein, low sugar, low sodium, low calorie, low fat, and no sweeteners.
- Organic preference; unprocessed, processed, or ultra-processed preferences.
- FODMAP, with transparent evidence and uncertainty.
- Apply preferences to a whole list or make exceptions for individual items.

### Outputs

For every grocery item: product photos, health/nutrition information, useful facts such as spicy, organic, sweeteners, or bulk, estimated prices, servings, and size. Absence of an organic tag is not evidence that a product is non-organic.

Support cheapest-first and healthiest-first sorting. The long-term health score should be relative to the product category: cheese should be meaningfully compared with other cheeses. Keep the overall match score separate, because price and relevance are not nutrition.

Click a card for expanded tags, full nutrition with favorable/less favorable signals, ingredients, and price per serving when supported by real serving information. Never invent missing values or assume a package count is a serving count.

### Recipes And Meal Planning

Recipe ideas combine items from the grocery list and suggest additional ingredients, with an add-all-missing-ingredients action. Support substitutions and ingredients already in the pantry.

A later recipe-first mode accepts meals for each day and number of people, then builds a grocery list. Share ingredients across meals to reduce waste and unnecessary purchases. Add a meal calendar once the recipe/list workflow is reliable.

### Voice, Photos, And Social

Explore local voice models for spoken list entry. Speech transcription is separate from a text model such as Qwen, which can turn transcripts into structured lists and eventually use recipe search tools to extract ingredients.

Later, people can share recipe photos with ingredient lists that others can add directly to their groceries. Photo import, scanning, social sharing, Instacart export, and share-as-image all require separate implementation.

## Current App

- Next.js web dashboard with list editing, quick lookup, optional ZIP, ranked options, and expanded product details.
- Google OAuth and email magic links via Supabase.
- Open Food Facts product discovery restricted to US-market catalog records with nutrition facts.
- Exact-barcode Open Prices observations, deterministic health/diet ranking, tags, allergen checks, and beta FODMAP signals. Shopping search is no longer used.
- Supabase saved-list and bought-product APIs; Stripe checkout/webhook scaffolding.
- Shared Upstash Redis caching and rolling request/provider budgets; Redis is required for production search.

The Meezany refresh adds compact grocery rows, a navigation rail, a desktop product-detail panel/mobile sheet, grouped preferences, and consistent brand assets. References live in `docs/design-reference/` and `public/brand/`.

**Current access behavior:** All users retain feature access, with a default budget of 100 searched items per rolling day. Subscription status reflects actual active/trialing subscriptions. Saved lists and bought history require authenticated users. See [Backend implementation](docs/BACKEND.md) for data contracts, limits, migrations, and verification.

**Not shipped:** AI recipes; exact local inventory/prices; voice/photo/barcode entry; autocomplete; Instacart export; share-as-image; social posts; meal calendar; per-item preferences; calibrated category-relative health scores; and new preference types without ranking/data support.

## Paid Features

Earlier pricing was $3.99/month or $19/year with limited free searches and paid saved lists, history, and Diet Mode Packs. Stripe integration exists, but current entitlement code is permissive. Restore the intended commercial model deliberately before billing users.

1. **Zero-AI Diet Mode Packs:** Deterministic preferences influence ranking, with no model in product selection. Existing modes: high protein, low sugar, low carb, diabetes-conscious, low sodium, vegetarian, vegan, gluten-free, heart-conscious, weight-loss friendly, kid-friendly, and beta FODMAP. These are general food preferences, not medical advice.
2. **AI recipe ideas (later):** Use selected groceries, pantry items, and preferences to create recipes. Keep separate from search. A server-side OpenAI-compatible adapter can connect to an evaluated Qwen/GLM model through Ollama in development and usage-based hosting later. Select the actual model after checking hardware, license, structured-output quality, and hosting costs. Validate JSON, cap generation, check ingredients, and never invent nutrition or allergy safety. The current app needs no AI runtime.

Exact location/store pricing remains later work, not a requirement for useful discovery or the initial paid proposition.

## Stack And Data Flow

Next.js App Router, React, TypeScript, Tailwind CSS, Node.js route handlers, Supabase Auth/Postgres, Stripe, Upstash Redis, Open Food Facts, and Open Prices. The app is hosted on Netlify. No native app or separate backend service is required.

`POST /api/search-products` authenticates the bearer token, resolves entitlements, normalizes queries, checks usage, and searches at most four items concurrently, streaming completed items to the UI. Open Food Facts records are validated, deduplicated, and filtered by nutrition evidence, relevance, and preferences. Eligible products receive bounded Open Prices lookups before final ranking. Failed items return their own error; products without nutrition facts are hidden.

Open Food Facts country tags restrict discovery to products marked as sold in the US; they do not confirm local inventory or country of manufacture. Optional ZIP filters Open Prices observations. A price is shown only for an exact barcode with a recent USD observation at a US location, preferably ZIP-matched when supplied, otherwise matched to the same state. Otherwise it stays unknown. Catalog and price coverage are incomplete; no Shopping fallback is used.

`overallScore` blends relevance, price, nutrition, and preferences: label it Match score. See `lib/scoring.ts`, `lib/health.ts`, and `lib/dietModes.ts` for the actual algorithm. Design-example numbers are not scoring specifications.

## Local Setup

```sh
npm install
cp .env.example .env.local
npm run dev
```

Use `.env.example` as the authoritative variable list. Configure the site URL, public Supabase URL/anon key, server-only Supabase service-role key, Upstash credentials, and Stripe keys/price IDs as needed. Never expose service-role or provider secrets in the browser.

For a fresh database, apply all files in `supabase/migrations/` in order. Existing databases need only unapplied migrations. Enable Google/email auth in Supabase, configure the Google provider, and allow the app origin as a redirect. For billing, connect a test Stripe webhook to `/api/stripe/webhook`.

Open Food Facts and Open Prices require no paid Shopping API key. Production search requires Redis and fails closed if its budget service is unavailable. Development without Redis uses a bounded local budget; it does not provide cross-process enforcement. Provider cache read failures may fall back to a fresh lookup only if its budget reservation succeeds.

## APIs And Persistence

| Route | Purpose |
| --- | --- |
| `POST /api/search-products` | Ranked options and independent item errors |
| `GET /api/lists` | Read saved lists |
| `POST /api/lists` | Create list and items |
| `PATCH /api/lists/:listId` | Update name/items/order/active state |
| `DELETE /api/lists/:listId` | Soft-delete list |
| `POST /api/bought-products` | Record a bought product |
| `POST /api/stripe/checkout` | Subscription checkout |
| `POST /api/stripe/webhook` | Synchronize subscription state |

Supabase tables: `profiles`, `grocery_lists`, `grocery_list_items`, `bought_products`, `user_preferences`. The migration defines authoritative columns and ownership policies. Service-role routes must enforce ownership because they bypass RLS. Local UI preferences are not yet cross-device preference sync.

Redis caches provider/nutrition lookups. Ranking runs deterministically at request time. No recipe endpoint is implemented.

See [Testing](docs/TESTING.md) for offline integration tests, CI, optional live checks, and database verification.

## Verification And Next Work

```sh
npm run typecheck
npm test
npm run build
```

Read installed Next.js guides in `node_modules/next/dist/docs/` before changing framework APIs, per `AGENTS.md`.

The backend pass includes automated ownership, ranking, provider failure, and stream checks plus a live provider search. Before launch, recheck Google/email auth and Stripe webhooks with test accounts and monitor real provider coverage. Decide and restore the commercial access model. Add full-vision features incrementally after core discovery is reliable.
