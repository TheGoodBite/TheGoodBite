# List sharing and Instacart

Saved grocery lists support explicit quantities, units, and optional chosen products. Product details offer **Choose for this item** with a whole package count. Search results are never selected automatically. Renaming an item clears its chosen product. Browser drafts retain these fields across reloads; saving persists them to Supabase.

## Sharing

**Share list** opens a review; checked-off items start excluded. Submitting saves the list, then creates an immutable snapshot of the reviewed saved items. Links use 256-bit random tokens. Anyone with the link can view it without signing in. **Save a copy** requires authentication and creates an independent editable list; repeated requests return the same copy. Owners can stop sharing individual snapshots. Deleting the source list disables its links. Existing copies and external Instacart links remain independent.

Only list name, included grocery names, quantities, units, and chosen product metadata are shared. Account details, ZIP, preferences, prices, and scores are excluded. Shared pages use no-store, no-referrer, and noindex headers. Token possession grants access; noindex does not make a link private.

## Instacart setup

The integration is implemented but disabled by default. Obtain Developer Platform access and add these **server-side Worker runtime variables/secrets** in Cloudflare:

- `INSTACART_ENABLED=true`
- `INSTACART_ENVIRONMENT=development` for a development key, or `production` for an approved production key
- `INSTACART_API_KEY` as an encrypted secret
- Optional `INSTACART_LINKS_PER_MINUTE` (default 30 globally)

Keep `NEXT_PUBLIC_SITE_URL` set to the public HTTPS app origin at build time. Supabase service-role and Upstash Redis credentials must be configured at runtime. Never use a `NEXT_PUBLIC_` prefix for Instacart credentials. Enable production only after Instacart has approved access and the development flow has been exercised with a real key.

**Shop on Instacart** appears only when the flag, key, and explicit environment are present. The server calls `POST /idp/v1/products/products_link`. Generic groceries use names and measurements. Explicit product choices use valid normalized GTINs when available, otherwise product names. Repeated GTINs consolidate package counts; quantities embedded in grocery names are not parsed. A review shows the final shopping entries. Users choose their store and review product matches, substitutions, prices, and checkout on Instacart. Dietary preferences are not sent as guarantees or filters.

Identical exports reuse cached links for up to 30 days, scoped to the owner or shared snapshot. A database lease prevents duplicate concurrent provider calls. New exports have per-scope and global Redis budgets, a ten-second provider timeout, and HTTPS destination validation. Public exports use stored snapshots, never arbitrary request bodies. Credentials, tokens, and item data are omitted from export logs. Revocation blocks subsequent Meezany access; it cannot revoke an already-created Instacart URL.

Official references: [shopping lists](https://docs.instacart.com/developer_platform_api/guide/concepts/shopping_list), [create shopping list endpoint](https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page). The unmodified carrot asset in `public/brand/instacart-carrot.svg` comes from Instacart's official logo pack.

## Database and verification

Apply `supabase/migrations/20261005005233_list_sharing_instacart.sql` after earlier migrations. It extends the existing atomic list-save function and adds server-only share, copy, and export-cache tables and RPCs. All three tables enable RLS and revoke access from public, anon, and authenticated database roles; API handlers enforce ownership using the service role. Older clients retain existing quantities and choices when those fields are omitted.

Run `npm test`, `npm run typecheck`, and `npm run build:cloudflare`. SQL regression scripts `supabase/tests/backend_security.sql` and `supabase/tests/list_sharing.sql` use synthetic fixtures inside transactions that roll back. They cover ownership, legacy compatibility, independent/idempotent copying, revocation/deletion, leases, and database access grants. Unit tests cover snapshot privacy, quantities, UPC consolidation, stale revisions, URL validation, caching, concurrency, timeouts, provider failures, and disabled configuration. Live Instacart matching requires a real development key and is not covered by mocked provider tests.
