# Cloudflare hosting migration

Hosting only: retain Next.js, the UI, all API routes, Supabase, Upstash, Stripe,
and the existing food providers. No catalog import or database changes.
Netlify remains available for rollback until the Cloudflare deployment is verified.

## Build and deployment

Use Node 22 and `npm ci` (including dev dependencies). The lockfile pins the
adapter and tooling. `esbuild` is explicit because the adapter imports it directly.

| Cloudflare Workers Builds field | Value |
| --- | --- |
| Worker name | `meezany` |
| Root directory | `/` |
| Build command | `npm run build:cloudflare` |
| Deploy command | `npm run deploy:cloudflare` |
| Preview/version upload command | `npm run upload:cloudflare` |
| Initial branch | `codex/cloudflare-migration` |
| Preview builds | Off initially |
| API token | Cloudflare's automatically created token |

The equivalent `npx opennextjs-cloudflare build`, `deploy`, and `upload`
commands also work. Deploy/upload require a completed Cloudflare build.
`npm run build` and `npm start` continue to work for the existing Node host.
For a local Workers preview, use `npm run preview:cloudflare`.
No Cloudflare login is needed for a build or local preview.

`wrangler.jsonc` keeps dashboard runtime variables on subsequent deployments
with `keep_vars`. Secrets must stay in Cloudflare, never in repository files.
The Worker uses read-only static-asset caching for prerendered pages. API/provider
data caching remains in Redis; no R2 bucket or new account service is required.
If ISR/revalidation is introduced later, revisit the incremental cache choice.
The existing UI uses ordinary image elements, not Next image optimization.

## Variables

Cloudflare build variables and Worker runtime variables are separate settings.
The five `NEXT_PUBLIC_*` values below must be present at build time and match
the runtime settings. Changing them requires rebuilding, not just redeploying.

| Name | Build | Runtime | Value |
| --- | --- | --- | --- |
| `NODE_VERSION` | Yes | No | `22` |
| `NEXT_PUBLIC_SITE_URL` | Yes | Text | Actual test origin, then production origin at cutover |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Text | Existing project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Text | Existing public anon key |
| `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID` | Yes | Text | Price ID matching the Stripe mode |
| `NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID` | Yes | Text | Price ID matching the Stripe mode |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Secret | Existing server key |
| `UPSTASH_REDIS_REST_URL` | No | Text | Existing Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | No | Secret | Existing Redis token |
| `STRIPE_SECRET_KEY` | No | Secret | Matching Stripe mode |
| `STRIPE_WEBHOOK_SECRET` | No | Secret | Signing secret for this endpoint |
| `PROVIDER_CONTACT_EMAIL` | No | Text | Existing optional contact |
| `SEARCH_ITEMS_PER_DAY` | No | Text | Existing setting, default `100` |

Copy any other custom provider/budget overrides from Netlify unchanged.
Redis is required for production search; it intentionally fails closed without it.
Local preview secrets can go in ignored `.dev.vars`; build public values can go
in ignored `.env.local`. Never copy server secrets into `NEXT_PUBLIC_*` variables.

The test URL is `https://meezany.<account-subdomain>.workers.dev`; find the account
subdomain in Workers & Pages. Do not use a literal placeholder.

## Verify before switching traffic

1. Deploy this branch to the test Worker with runtime variables configured.
2. Add the exact test origin to Supabase Auth's allowed redirect URLs. The current
   Google login redirects to `window.location.origin`, not an `/auth/callback` route.
   Keep the existing production URL allowed. Do not change the Google-to-Supabase
   callback solely because the frontend host changed.
3. Verify Google login, logout, list create/edit/delete, purchase history,
   ownership restrictions, preferences, and streamed multi-item search results.
4. Use a dedicated test user for Stripe testing: webhook handlers update profiles
   in the configured Supabase database. Set test-mode prices and key together.
   Create a test webhook at `<test-origin>/api/stripe/webhook` for
   `checkout.session.completed`, `customer.subscription.updated`, and
   `customer.subscription.deleted`. Use that endpoint's signing secret.
5. Verify checkout and billing portal return URLs and subscription updates.
6. Verify product images, static files, error responses, and provider timeout behavior.

Local build/unit checks cannot verify external account credentials or live OAuth.

## Cutover and rollback

After acceptance, configure the production domain, production site URL and matching
live Stripe credentials/prices; rebuild. If the public domain stays the same,
the public webhook URL can stay the same. If it changes, configure the new live
webhook endpoint and its signing secret. Avoid enabling duplicate live endpoints
without accounting for duplicate event delivery.

Switch DNS/routing only when the Worker is ready. Verify HTTPS, login, search,
lists and payments on the final domain before retiring Netlify. Switch the build
branch to `main` after merging. Preserve the old Netlify deployment and its settings
for rollback; restore the previous routing and any changed auth/webhook settings
if needed. No database rollback is required because this PR changes no schema.
