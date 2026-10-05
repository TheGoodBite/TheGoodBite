# Testing Meezany

## Routine checks: no live service costs

```sh
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

`npm test` runs both offline suites and skips the live test unless explicitly opted in. The GitHub Actions workflow runs unit tests, integration tests, type checking, and a production build for main pushes and pull requests. It requires no service credentials. It consumes runner minutes under the repository's existing GitHub plan, not provider credits.

The integration suite runs the real search route through request validation, entitlements, rolling local budgets, provider adapters, catalog product identity, nutrition evidence, exclusion rules, cache, price enrichment, provider-order preservation, and the actual client stream decoder. It covers:

- Deduplicated queries and US-market catalog records with exact barcode identity.
- Sourced nutrition with explicit units, carbohydrate values, and valid zero values.
- Wrong-flavor suggestions rejected; records without nutrition facts hidden.
- Catalog outages returning explained empty results with no Shopping fallback.
- Allergy conflicts excluded before price lookups; preferences rank the catalog directly.
- Open Prices failure retaining nutrition products with unknown prices.
- Foreign, stale, wrong-barcode, and other-state price observations rejected; same-state fallback and exact-ZIP priority preserved.
- Repeated requests served from provider caches.
- Authentication/validation rejection before provider calls.
- Item budgets and production failure when shared Redis is unconfigured.
- Progressive results while another item is still pending.
- The exact reported sausage/high-protein/dairy/01602 request returning eligible nutrition products.
- Only Open Food Facts and Open Prices HTTP destinations allowed in the search pipeline.

Provider responses are synthetic fixtures in `tests/fixtures/search-providers.json`, designed to represent actual response schemas. They are not real product labels or receipts. HTTP calls are intercepted and unexpected destinations fail the test. Supabase authentication/profile lookup is replaced at its network boundary; all downstream application logic is real.

These tests detect regressions in our code. They cannot prove current provider availability, Google OAuth configuration, deployed Netlify behavior, real Redis enforcement across servers, or catalog coverage. Schema changes at a provider require updating the fixtures after verifying their live contract.

## Optional live provider smoke test

```sh
npm run test:live
```

Requires `.env.local` with configured provider/cache credentials. This is deliberately excluded from CI. It searches Greek yogurt with ZIP 01752 and a high-protein preference through the real pipeline, using one catalog lookup and bounded exact-barcode price enrichment. Cached results may reduce calls. No Shopping credits are used; live requests count toward provider and Redis budgets. It verifies returned products have matched nutrition facts; an explained empty result is allowed because the catalog may lack a valid match.

Run this deliberately after provider configuration changes or before a release. It is not a broad coverage benchmark, and is not reliable enough to block every commit. No automatic schedule is configured.

## Database integration checks

`supabase/tests/backend_security.sql` already exercises the real database functions, ownership policies, cross-account item rejection, atomic rollback, purchases, and profile privileges. It inserts random QA fixtures inside a transaction and rolls them back. Run against a disposable/local or designated development Supabase database with migrations applied; do not add production credentials to routine CI. It is not part of the offline fixture suite.

## Browser checks

The offline integration suite operates on real Request/Response objects rather than launching a browser or hosted server. Desktop/mobile UI behavior still needs browser checks. Existing tests cover the stream decoder but do not test browser hydration, Google sign-in, or external storefronts.

## Attribute preferences

The offline suite exercises every supported native attribute's mandatory match/conflict/unknown handling, weighting, allergen traces, quality thresholds, invalid match values, ingredient conflicts and missing analysis, and persistence migration. Route integration tests prove mandatory exclusions happen before price calls and reject unsupported IDs/levels or oversized ingredient lists. Manual browser checks cover all controls, request payloads, saved values, and mobile layout. A real product response confirmed the native `attribute_groups_en` schema; this is not a guarantee that every catalog product has each attribute.
