# Meezany backend implementation

Updated September 28, 2026. This describes shipped behavior; the full product vision remains in the README and visual direction in BRAND_GUIDELINES.md.

## Search and product identity

The authenticated search route validates supported preferences, ZIP, and list size before provider requests. Product discovery uses only Open Food Facts; prices use only Open Prices. There are no active Shopping or SerpAPI calls, location-resolution requests, or retailer-title nutrition matching steps.

One shared, cached US catalog search retrieves up to 50 records per grocery query. Each visible product requires a valid GTIN, product name, explicit `en:united-states` country tag, relevant title, and nutrition evidence from its own record. All requested title words must match after normalization, avoiding wrong-flavor suggestions. Catalog search is first-page discovery rather than exhaustive inventory; specific queries can miss products. US-market tags describe where a product is sold, not its origin or current local availability.

Products are deduplicated by validated GTIN or variant-preserving title and package identity. Different flavors, sizes, and multipacks stay separate. Package parsing supports weight, volume, and multipacks. Ambiguous measurements do not receive inferred unit prices. Bulk preference affects ranking; package count is never treated as servings.

## Nutrition and preference evidence

Nutrition is mapped directly from the selected Open Food Facts catalog record. This avoids the earlier failure where a retailer listing had no barcode and could not be matched to an otherwise available nutrition product. Only explicit per-100g nutriments are mapped, including carbohydrates; missing values stay missing. Details expose the source record and catalog match method. The existing nutrition algorithm is not a calibrated category-relative score; the combined score is labeled Match score.

Products need a nutrition source and at least one finite, nonnegative nutrient displayed in the nutrition panel. Scores, ingredients, and title tags alone do not qualify; zero values do. Unsupported products are hidden. Empty results distinguish catalog outages from missing eligible nutrition. Partial nutrition remains visible with missing fields marked unknown.

Diet evaluation distinguishes match, conflict, and unknown. Preferences are evaluated over catalog records before selecting and pricing recommendations. Known allergen conflicts and categorical vegan/vegetarian/gluten-free/FODMAP conflicts are excluded. Nutrient goals affect ranking; missing data does not establish a match. Absence of an allergen mention is not proof of safety. Ingredients, traces, and labels are imperfect source data. FODMAP remains a beta signal dependent on portion and preparation.

## Prices and provenance

Open Prices is queried only for selected eligible products with validated exact barcodes. Observations must be within 30 days, in USD, at US locations, with matching ZIP when requested. Future, duplicate, discounted, and per-weight observations are rejected. Bulk candidates skip pricing to avoid substituting a single-unit receipt price for a case.

An eligible observation includes its source, date, locality, and link. Products without an eligible observation remain visible with nutrition and an unknown price. No Shopping estimates are substituted. Sparse price coverage, especially at an exact ZIP, is expected. These observations do not establish real-time inventory or shelf prices. Unit prices require supported denominators; price per serving requires an explicit serving count.

## Performance and cost control

- Four grocery items run concurrently; each uses one shared catalog query followed by up to three concurrent price lookups for its selected recommendations (default 10, maximum 20).
- Completed items stream as NDJSON (`meta`, `item`, `done`); JSON remains supported. Failures are isolated per item and interrupted streams are visible as retryable errors.
- Request scheduling deadline is 45 seconds; route maximum duration is 60 seconds. Shared cache lookups have their own bounded timeouts and can briefly outlive a disconnected request.
- Provider timeouts default to 6 seconds; Open Prices uses 3.5 seconds. Redis uses a 1.5-second timeout with retries disabled.
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

Calibrated category-relative scoring, store inventory integrations, recipe generation, per-item preference exceptions, full preference synchronization, and the other vision features are separate work. Better recall should come from catalog query coverage and pagination while preserving product identity. Tune ranking with representative real lists before making performance or nutrition-quality claims.
