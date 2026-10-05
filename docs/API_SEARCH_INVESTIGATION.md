# Cereal search API investigation

The screenshot's unrelated products and mismatched photo were reproduced directly against Open Food Facts, independently of the UI. Counts and order below describe the observed responses; the public catalog changes over time.

## Requests and findings

All search requests used `https://world.openfoodfacts.org/cgi/search.pl`, `api_version=3.4`, `lc=en`, `action=process`, `json=1`, `page_size=50`, `page=1`, and the US criterion `tagtype_0=countries&tag_contains_0=contains&tag_0=united-states`. No `sort_by` was specified.

| Request | Observed response |
| --- | --- |
| `search_terms=cereal&search_simple=1` | HTTP 200; 31,767 matches. First records: White Ciabattin (`5025125000006`), SPICY CHICKEN & 'NDUJA PIZZA (`13356194`), JASON'S SOURDOUGH (`5025125000129`). Only 19 of the first 50 had `en:breakfast-cereals`; none were Kashi. |
| `search_terms=kashi&search_simple=1` | HTTP 200; 343 matches. First record was Kashi organic cinnamon harvest (`0018627116011`), Nutri-Score A. |
| Replace keywords with `tagtype_1=categories&tag_contains_1=contains&tag_1=en:breakfast-cereals` | HTTP 200; 3,840 matches. Breakfast products replaced bread/pizza; Kashi organic cinnamon harvest appeared at position 37. The reported pizza was absent. |
| `https://world.openfoodfacts.org/api/v2/product/13356194.json` | HTTP 200; the same source record has an English pizza name, German `Kalamata Oliven`, French `Frozen Salmon Fillets`, Dutch `Havervlokken Grof`, and the olive-jar front image shown in the screenshot. This is inconsistent upstream identity data, not a UI image/title join. |
| `https://prices.openfoodfacts.org/api/v1/prices?product_code=13356194&currency=USD&order_by=-date&date__gte=2026-09-05&size=100&page=1` (also tested `0018627116011`) | HTTP 200 for both; zero observations. Unknown prices are expected for these products in the tested window. This does not establish the cause of every price warning. |

Open Food Facts' [healthy cereal search guide](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/finding-healthy-cereals/) recommends searching its breakfast-cereal category. Its [legacy search implementation](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/cgi/search.pl) uses a keyword index for text searches, so a keyword search is not equivalent to a breakfast-cereal category filter.

## Change and verification

Plain cereal aliases now request the native breakfast-cereal category without a text keyword. Brand and qualified searches retain their keywords. Mandatory preferences remain additional native criteria, and the existing eligibility checks and source ordering are preserved. The catalog cache namespace is bumped to prevent older broad results from being reused.

The actual `discoverNutritionProducts('cereal')` adapter was also called against the live API, with the application's complete field list and provider retry logic, using an isolated development cache. The retry succeeded after an HTTP 503. Open Food Facts also returned intermittent 503s on other attempts; the 120-second timeout is unchanged, and a longer timeout does not prevent these immediate server errors.

Regression tests cover category aliases, qualified/brand keywords, coexistence with mandatory filters, and preservation of API order even when a later result has a better nutrition grade. The full automated suite passed (302 tests, one opt-in live test skipped), as did type checking and the production build.

This change does not repair the conflicting upstream barcode record or guarantee that Kashi appears among the first ten displayed products. Native categories and US-market tags can themselves be imperfect. Preserving API order means a product at position 37 is not promoted based on its grade. No upstream catalog records were edited.
