# Meezany backend implementation

Updated September 27, 2026. This describes shipped behavior; the full product vision remains in the README and visual direction in BRAND_GUIDELINES.md.

## Search and product identity

The authenticated search route validates supported preferences, ZIP, and list size before spending provider credits. Each item expands its shopping query with up to two relevant preference hints, prioritizing allergies. Final evidence checks still run after retrieval: search wording alone cannot establish compatibility.

SerpAPI uses US country/language/domain settings and a canonical US location resolved from the optional ZIP. This biases discovery, but cannot guarantee domestic origin, local stock, or shelf prices. Foreign currencies are rejected and unqualified prices remain unknown. No missing-key mock fallback exists.

Products are deduplicated before enrichment and again after barcode resolution. Identity uses validated GTINs or normalized variant-preserving titles plus package quantities/counts. Different flavors, fat percentages, sizes, and multipacks stay separate. Seller offers are grouped; the cheaper equivalent offer becomes primary. Conservative matching can leave duplicates when source identity is incomplete.

Package parsing supports weight, volume, and multipacks. Ambiguous multiple measurements or total/net-weight multipack descriptions do not get an inferred unit price. Ranking compares compatible price units where possible. Bulk preference affects retrieval/ranking; an explicit bulk query takes precedence. Package count is never treated as servings.

## Nutrition and preference evidence

Open Food Facts uses one shared US catalog lookup per grocery query, not one text search per shopping result. Exact barcode lookup is preferred. Text matching requires brand and all variant words to agree; ambiguous matches stay unknown. A matching package can resolve a catalog barcode. There is no arbitrary first-result nutrition fallback.

Only explicit per-100g nutriments are mapped, including carbohydrates. Missing values stay missing. Product details expose the nutrition source and match method. The existing nutrition algorithm is not a calibrated category-relative score; the combined score is labeled Match score.

Diet evaluation distinguishes match, conflict, and unknown. Missing nutrient data does not count as meeting a nutrient goal. Selected allergen conflicts and categorical vegan/vegetarian/gluten-free/FODMAP conflicts are excluded. Unknown products remain visible with uncertainty; absence of an allergen mention is not proof of safety. Ingredients, traces, and labels are imperfect source data. FODMAP remains a beta signal dependent on portion and preparation; absence of a keyword is not a positive match.

## Prices and provenance

Open Prices is now connected to search. It is used only for validated exact barcodes and recent observations (30 days), in USD, at US locations, with matching ZIP when requested. Future, duplicate, discounted, and per-weight observations are rejected. Bulk candidates retain Shopping estimates to avoid substituting a single-unit receipt price for a case.

An eligible observation becomes the primary estimate, with source, date, locality, and link. Original Shopping offers remain available. Sparse Open Prices coverage means many products will still use Shopping prices. Neither source is a real-time inventory guarantee. Unit price is displayed only with a supported denominator; price per serving needs explicit serving count.

## Performance and cost control

- Four grocery items run concurrently; nutrition/price enrichment uses bounded workers.
- Completed items stream as NDJSON (`meta`, `item`, `done`); JSON remains supported. Failures are isolated per item and interrupted streams are visible as retryable errors.
- Request scheduling deadline is 45 seconds; route maximum duration is 60 seconds. In-flight shared cache lookups use their own bounded timeouts and can briefly outlive a disconnected request.
- Provider timeouts default to 6 seconds; Shopping uses 9 seconds and Open Prices 3.5 seconds. Redis uses a 1.5-second timeout with retries disabled.
- Identical in-process cache misses share one request. Empty/no-match answers are cached for at most five minutes; errors are not cached. Provider-specific positive cache lifetimes are in their modules.
- Rolling shared budgets: 10 search requests/minute/user; 100 items/day/user by default; 250 SerpAPI requests/day globally by default, including location requests; OFF catalog 10/minute, OFF barcode 15/minute, Open Prices 30/minute.
- `SEARCH_ITEMS_PER_DAY` and `SERPAPI_DAILY_REQUEST_LIMIT` configure the daily limits. Shared Redis enforcement is mandatory in production and fails closed on outage. Development without Redis has local-only limits.
- Structured search metrics include elapsed time and counts, excluding raw queries and user identifiers. No automatic paid quota expansion or billing change is included.

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

Opt-in real provider smoke test (uses configured credits and `.env.local`):

```sh
MEEZANY_LIVE_TESTS=1 npm test -- tests/integration/providers-live.test.ts
```

A live Greek yogurt search for ZIP 01752 passed during implementation. It confirms the provider path works, not complete catalog coverage or nutrition correctness for every product. Browser smoke checks use clearly isolated mocked API fixtures to avoid creating user purchases or lists.

## Remaining product work

Calibrated category-relative scoring, store inventory integrations, recipe generation, per-item preference exceptions, full preference synchronization, and the other vision features are separate work. Better recall should come from stronger product identifiers and verified catalog coverage, not looser nutrition matching. Tune ranking with representative real lists before making performance or nutrition-quality claims.
