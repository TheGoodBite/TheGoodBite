# Meezany backend implementation

Updated September 28, 2026. This describes shipped behavior; the full product vision remains in the README and visual direction in BRAND_GUIDELINES.md.

## Search and product identity

The authenticated search route validates supported preferences, ZIP, and list size before provider requests. Product discovery uses only Open Food Facts; prices use only Open Prices. There are no active Shopping or SerpAPI calls, location-resolution requests, or retailer-title nutrition matching steps.

One shared, cached US catalog search retrieves up to 50 records per grocery query, preserving the order of the first response page. Each visible product requires a valid GTIN, product name, explicit `en:united-states` country tag, and nutrition evidence from its own record. Text matching is delegated to Open Food Facts, allowing alternate product names, without locally reordering by category, title, or brand. A targeted milk-beverage screen excludes explicit derivative products (such as butter, creamers, chocolate bars, and ice cream) identified by product names or English category tags, unless the query explicitly requests those derivatives. Missing categories alone do not exclude products. Discovery is bounded rather than exhaustive; specific queries can miss products. US-market tags describe where a product is sold, not its origin or current local availability.

Products are deduplicated by validated GTIN or variant-preserving title and package identity. Different flavors, sizes, and multipacks stay separate. Package parsing supports weight, volume, and multipacks. Ambiguous measurements do not receive inferred unit prices. Package count is never treated as servings. The legacy bulk-preference request field remains accepted but does not reorder results.

Plain `cereal`, `cereals`, `breakfast cereal`, and `breakfast cereals` queries use OFF's native `en:breakfast-cereals` category criterion instead of full-text keywords. OFF's keyword index can also match bread and pizza through broad cereal categories. Brand and qualified queries keep their original keywords. Category searches preserve OFF order and the US-market and mandatory-preference criteria; no local nutrition ranking is added. See [API investigation](API_SEARCH_INVESTIGATION.md) for live evidence and source-data limitations.

## Nutrition and preference evidence

Nutrition is mapped directly from the selected Open Food Facts catalog record, including its Nutri-Score grade and numeric score when supplied. Explicit standard-basis and per-serving nutriments are mapped; an explicit serving quantity can scale standard-basis facts, but serving text is never parsed into a guessed weight; missing values stay missing. Details expose the source record and catalog match method. Products display the provider's A–E Nutri-Score; Meezany does not calculate or display a combined 0–100 match score.

Products need a nutrition source and at least one finite, nonnegative nutrient displayed in the nutrition panel. Scores, ingredients, and title tags alone do not qualify; zero values do. Unsupported products are hidden. Empty results distinguish catalog outages from missing eligible nutrition. Partial nutrition remains visible with missing fields marked unknown.

Diet evaluation distinguishes match, conflict, and unknown. Preferences are evaluated over catalog records before selecting and pricing recommendations. Known allergen conflicts and categorical vegan/vegetarian/gluten-free/FODMAP conflicts are excluded. Nutrient goals annotate product details without changing order; missing data does not establish a match. Absence of an allergen mention is not proof of safety. Ingredients, traces, and labels are imperfect source data. FODMAP remains a beta signal dependent on portion and preparation.

## Prices and provenance

Open Prices is queried only for selected eligible products with validated exact barcodes. Observations must be within 30 days, in USD, at US locations, preferring an exact ZIP when requested, then falling back to another known ZIP in the same state. Exact-ZIP observations take priority over newer or cheaper state observations. State matches carry the requested ZIP, observed ZIP, state, and match scope in their provenance; the UI labels them with a state price badge and explanatory tooltip. Other-state observations remain ineligible. A bundled GeoNames ZIP membership lookup avoids new runtime network calls; unknown ZIP memberships permit exact matches only. Future, duplicate, discounted, and per-weight observations are rejected. Bulk candidates skip pricing to avoid substituting a single-unit receipt price for a case.

An eligible observation includes its source, date, locality, and link. Products without an eligible observation remain visible with nutrition and an unknown price. No Shopping estimates are substituted. Sparse price coverage, even after the same-state fallback, is expected. These observations do not establish real-time inventory or shelf prices. Unit prices require supported denominators; price per serving requires an explicit serving count.

The options panel's Lowest price sort compares positive, finite package prices, ascending. Missing or invalid prices appear last, retaining Open Food Facts order among ties. The panel explains when no price comparison is possible; it never compares unlike unit-price measurements.

## Performance and cost control

- Four grocery items run concurrently; each uses one shared catalog query followed by up to three concurrent price lookups for its selected recommendations (default 10, maximum 20).
- Completed items stream as NDJSON (`meta`, `item`, `done`); JSON remains supported. Failures are isolated per item and interrupted streams are visible as retryable errors.
- Request scheduling deadline and route maximum duration are 180 seconds, allowing a full catalog lookup plus price enrichment. Deployment platform limits must also permit that duration. Shared cache lookups have their own bounded timeouts and can outlive a disconnected request.
- Provider timeouts default to 120 seconds, including catalog searches; optional Open Prices enrichment uses 3.5 seconds. Redis uses a 1.5-second timeout with retries disabled. Catalog errors preserve provider timeout, rate-limit, and budget messages rather than reporting every failure as an outage.
- Identical in-process cache misses share one request. Catalog records are cached for a day and price lookups for an hour. Empty/no-match answers are cached for at most five minutes; errors are not cached. Catalog records cached before photo fields were added can lack photos until refreshed.
- Rolling shared budgets: 10 search requests/minute/user; 100 items/day/user by default; OFF catalog 10/minute, OFF barcode 15/minute for legacy helpers, Open Prices 30/minute. The active pipeline does not require separate barcode enrichment.
- `SEARCH_ITEMS_PER_DAY` configures the daily item limit. Shared Redis enforcement is mandatory in production and fails closed on outage. Development without Redis has local-only limits.
- Structured search metrics include elapsed time and counts, excluding raw queries and user identifiers. No paid Shopping quota is consumed.

## Persistence and database security

List creation/update uses the service-only `save_grocery_list` transaction. It verifies parent and item ownership, rejects foreign supplied item IDs, preserves ordering, and deactivates omitted items rather than deleting purchase history. Partial writes roll back. Purchase recording uses `record_grocery_purchase`, which validates the account/list/item relationship. Direct authenticated purchase inserts also have ownership policies.

Authenticated users can update only their profile email, not subscription or Stripe fields. Internal trigger functions cannot be invoked as public RPCs. Service credentials remain server-side. Existing OAuth redirects are unchanged.

Applied to the configured Supabase project (`mykpmyxrgtrxzmcccdrc`):

- `20260927185455_secure_list_writes.sql`
- `20260927185717_restrict_internal_trigger_functions.sql`

Both are saved locally for other environments. The existing project predates migration tracking for `0001_initial_schema.sql`; do not blindly replay that baseline against the existing schema. A fresh project needs the baseline followed by these migrations. The transactional security test in `supabase/tests/backend_security.sql` rolls all fixtures back.

The security advisor still reports the pre-existing disabled leaked-password-protection setting. This pass does not change the working OAuth/magic-link configuration or the subscription plan. Provider budgets are operational limits, not a new commercial entitlement model.

## Verification

Run `npm run typecheck`, `npm test`, and `npm run build`. Unit/route tests cover provider normalization, matching, evidence, duplicate/package identity, price eligibility, budgets, caching, streaming, and errors. Database SQL checks exercise cross-account list/item/purchase rejection, rollback, purchase history, and privilege boundaries.

Opt-in real provider smoke test (uses provider budgets and `.env.local`):

```sh
MEEZANY_LIVE_TESTS=1 npm test -- tests/integration/providers-live.test.ts
```

The reported sausage request (high protein, dairy avoidance, everyday packs, ZIP 01602, limit 10) returned 10 products with sourced nutrition in approximately 2 seconds with a cached catalog. All 10 had unknown local prices. Only Open Prices HTTP calls were made after the catalog cache hit. This confirms the provider path works, not complete coverage or independent verification of every source nutrient. Browser smoke checks use clearly isolated mocked API fixtures to avoid creating user purchases or lists.

## Remaining product work

Calibrated category-relative scoring, store inventory integrations, recipe generation, per-item preference exceptions, full preference synchronization, and the other vision features are separate work. Better recall should come from catalog query coverage and pagination while preserving product identity. Provider order is not a claim that the first result has the highest nutrition grade.

## Product attributes and importance

Search accepts `productPreferences`, a partial mapping of the supported OFF attribute IDs to `not_important`, `important`, `very_important`, or `mandatory`, plus up to 20 `unwantedIngredients` strings (80 characters each). The UI offers all 29 requested settings in six groups. Additional existing nutrient/FODMAP goals remain separate. Legacy allergy selections migrate to mandatory attributes; overlapping legacy diet controls migrate without duplicate scoring. Old API payloads remain supported. Preferences stay local to the browser; changing them marks current results stale until searching again.

Catalog requests include `attribute_groups_en`, category tags, and `ingredients_tags`. Native OFF match/status evidence is retained in nutrition records. Match values outside 0–100 or unknown status are treated as unknown, not matches. Default order is the order returned by Open Food Facts. Eligibility and mandatory-preference checks remove products without reordering survivors. Soft preference matches, diet-mode matches, prices, package size, and nutrition grades do not influence default order. Price enrichment preserves the same order even when network requests finish out of order. Grade-based second-page discovery has been removed. Users can explicitly select Lowest price or Nutri-Score in the options panel; the latter uses the provider's grade and numeric score, preserving provider order on ties.

Mandatory attributes require known evidence with at least 80% match. Allergen absence, vegan/vegetarian, palm-oil-free, label claims, and unwanted ingredient absence require 100%; allergen traces cannot pass. Not-applicable attributes are omitted. Missing mandatory evidence hides the product before pricing. Known below-threshold soft preferences remain visible with an explanation; unknown soft preferences remain visible and are identified in the detail panel. Allergen data is not a safety guarantee.

Unwanted ingredient matching is local and conservative: ingredient text or canonical tags can identify a named conflict; ingredient analysis tags are needed to establish absence. Missing terms or analysis produce unknown. Synonyms, translations, completeness, and composition changes are limitations shown in the UI. This is not OFF's parameterized canonical-ingredient API algorithm.

Catalog cache schema uses `off:v9:us-search` with the native category criteria and page included in the cache key; numeric Nutri-Score data is retained for the user-selected Nutri-Score sort. A cache failure does not weaken mandatory rules. See [Bulk import plan](DATA_IMPORT_PLAN.md) for the deferred snapshot/worker proposal.

Catalog requests use a 120-second timeout and one retry for transient failures or incomplete responses. Each HTTP attempt reserves the shared provider budget; 429s and budget failures are not retried. A valid empty catalog response is not an outage. The browser recovers interrupted streams once, requesting only unfinished items and preserving all completed rows, including genuine empty results.
