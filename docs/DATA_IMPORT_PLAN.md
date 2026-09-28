# Bulk catalog and price imports — deferred

No import job, resource provisioning, or schedule is implemented in this change. Search continues to use the cached APIs. Bulk imports are a sensible next step for broader recall, predictable latency, and resilience to upstream outages; they cannot create missing nutrition or local price observations.

## Verified sources

- [Open Food Facts data](https://world.openfoodfacts.org/data) and its [export service](https://github.com/openfoodfacts/openfoodfacts-exports): daily exports, including JSONL and Parquet. Use a streaming reader, not a full-file load into a Netlify function.
- [Open Prices data guide](https://openfoodfacts.github.io/open-prices/guides/data/): daily gzipped JSONL exports of prices, locations, and proofs, plus a Parquet dataset. Import prices and locations together so country, state, postcode, discount, duplicate, and per-unit eligibility remain enforceable.
- [OFF product attributes](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/explain-product-attributes/): computed match values with known/unknown/not-applicable status. A raw product dump is not automatically equivalent to this API response. Inspect exported columns before choosing whether to materialize compatible attribute evaluations from raw fields or obtain computed attributes in a controlled enrichment job. Preserve unknown states and version the evaluator.

## Proposed design

1. A bounded background worker streams exports into staging tables. Filter to US-market products with valid barcodes and usable nutrition. Retain names, brands, variants, packages, ingredient analysis, allergens/traces, nutrition, attribute inputs, photos, source links, and source modification timestamps.
2. Store catalog and price records in an indexed database, not an entire dump in Redis or the web deployment. Start with Postgres title search and barcode indexes, then evaluate a separate search index only if measured latency or relevance requires it. Redis remains a small query/result cache.
3. Join observed prices by exact barcode and location; prefer ZIP matches and then same-state matches. Keep the original observation date, source ID, quantity basis, currency, discounts, and duplicate status. Continue rejecting stale prices at query time even if ingestion stops.
4. Validate each import against counts, schema, barcode uniqueness, country coverage, and representative searches before atomically activating its version. Failed imports retain the last good snapshot. Keep ingestion checkpoints, error metrics, and the ability to roll back.
5. Refresh products weekly to begin with, ideally daily once incremental updates are established. Refresh prices daily: a monthly cycle would miss recent contributions and let many observations expire under our existing 30-day price policy. Cadence is an operating recommendation, not a created automation.
6. Measure data volume, processing time, database storage, query latency, and hosting limits with a US subset before sizing the worker. Large exports belong in a background environment suited to streaming and longer jobs. Do not promise a cost before measuring those inputs.

## Licensing and privacy

Preserve Open Food Facts/Open Prices attribution and source identifiers. Their database reuse is subject to ODbL; review redistribution/share-alike requirements before publishing an adapted catalog. Product image rights are separate. Keep user lists and preferences separate from the public source dataset. Import public price/location records; do not mirror receipt images or user-related proof metadata without a specific need.

## Acceptance checks for later

- Sausage and other representative US queries retain known eligible products without any live catalog dependency.
- Attribute filters behave like the current evaluator, including unknown mandatory evidence and traces.
- Exact ZIP beats same-state receipts; other states, old observations, and multipack mismatches remain excluded.
- Freshness and failed-import status are observable; partially imported data never becomes active.
- Benchmarked searches meet an agreed latency target and measured storage/worker costs fit the chosen plan.
