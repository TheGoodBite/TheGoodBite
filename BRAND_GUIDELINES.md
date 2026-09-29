# Meezany Look And Feel

Updated September 27, 2026.

Design and implementation guide based on the supplied brand board and mobile/desktop references. Full product vision and technical status live in [README.md](README.md). A control pictured in a reference is not proof that its feature exists.

## Brand

**Meezany. Better groceries, without the homework.**

Simple, warm, clever, confident, useful, and food-first. The app should feel like a practical grocery companion: little input, fast comparisons, clear explanations. Avoid moral judgments about food and promises of medically safe choices.

Use familiar language: My grocery list, See options, See why, Bought this, Preferences. "Meez it" is optional campaign language, not a replacement for recognizable controls. Product names, prices, and nutrition take priority over slogans.

## Logo And References

The mark is a continuous ribbon or peel forming a lowercase M. Black is the primary UI mark; white reverses onto black. The orange peel is a secondary expressive asset, not a reason to make the app orange.

- [Brand board](docs/design-reference/brand-board.png)
- [Black app icon](public/brand/meezany-icon.png)
- [Orange peel asset](public/brand/meezany-peel.png)
- [Mobile designs](docs/design-reference/mobile-screens.png)
- [Desktop design](docs/design-reference/desktop-workspace.png)

Original supplied PNGs are preserved unchanged. `components/MeezanyLogo.tsx` and `public/brand/meezany-mark.svg` provide a provisional code-native ribbon silhouette. Replace with the designer's final vector export when available; this is not an exact trace. The broccoli mark is retired from active UI.

Keep breathing room around the mark. UI width: 40-48px, never below 24px. Wordmark: semibold system sans. Do not stretch or add shadows, leaves, shopping carts, or medical symbols to the brand. Familiar functional icons remain appropriate for actual controls.

## Visual Tokens

| Role | Value | Use |
| --- | --- | --- |
| Meezany black | `#111111` | Text, primary actions, selected switches |
| White | `#FFFFFF` | Workspace, product images |
| Warm canvas | `#F7F6F2` | Small secondary areas |
| Soft gray | `#EEEEEC` | Dividers, muted controls |
| Secondary text | `#70706C` | Metadata |
| Peel red | `#D9362B` | Sparse accent, destructive actions |
| Nutrition green | `#18683B` on `#E8F3EB` | Favorable measured signals |
| Nutrition amber | `#865700` on `#FFF3D6` | Mixed signals |
| Nutrition red | `#A33229` on `#FBECE9` | Less favorable signals |

White dominates. Color comes mostly from product photography. No decorative gradients, green page washes, floating glass panels, or nested cards. Lists and sections sit directly on the page with hairline dividers. Product tiles have thin borders and an 8px radius. Rounded sheets are appropriate; shadows are reserved for overlays.

## Type And Spacing

Native system sans: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. This follows the SF Pro direction on Apple devices without bundling a licensed font or requiring remote font downloads.

- Page title: 28-32px, 600-700 weight.
- Section/detail title: 20-22px, 600 weight.
- Product/body: 15-17px, 400-600 weight.
- Metadata: 12-14px; avoid tiny essential information.
- Prices/scores: tabular numerals in the same font family.
- Letter spacing: zero; never use viewport-width font sizing.
- Spacing: 4, 8, 12, 16, 24, 32px.
- Interactive targets: aim for 44px, with visible keyboard focus.

## Responsive Layout

Desktop: 208px navigation rail, flexible grocery list, 360px product-detail panel. The rail contains the brand, list, quick lookup, preferences, and saved lists. Keep selected rows subtly highlighted. The detail panel stays visible while browsing products.

List title, item count, input, search, and save actions sit above compact rows. Each row shows the original query, best option summary, product thumbnails/prices, and access to all options. Editing controls are secondary.

Mobile: compact brand header and bottom navigation, full-width list, horizontal thumbnail strips within rows, and product-detail/preferences/saved-list sheets. At intermediate widths use the same sheets instead of squeezing the desktop panel. The page itself must never scroll sideways. Mobile inputs use at least 16px text.

## Core Surfaces

### Grocery List

The first screen is the usable list. Accept typed items, comma/newline lists, and common bullet/number prefixes. Keep move-up/down buttons alongside drag reorder. Switching lists clears stale selections. Results follow list order. Quick lookup accepts one query without creating a list.

Show loading per searched row. Distinguish not searched, no results, and provider failure. Preference changes require another search; don't imply old results reflect new preferences.

### Product Options

Stable image dimensions with `object-fit: contain`; never crop labels. Use a neutral missing-image state. Sort by best match, lowest comparable unit price, or Open Food Facts Nutri-Score. Unknown prices and grades stay explicitly unknown.

Show title, known package size, estimated price, Open Food Facts Nutri-Score grade, factual preference matches, and a detail action. Do not invent or display a combined 0–100 score. Explain the sort order: category fit, Nutri-Score grade and numeric score, product name/brand match, selected preferences, bulk preference, then comparable price.

### Product Detail

Large image, Nutri-Score, title, package size, estimated price, seller link, tags, bought action. Tabs: Nutrition, Ingredients, About. Current nutrition data is per 100g, so label it that way. Show price per serving only when both price and a real serving count exist. Unknown is never zero.

Use text alongside colors. Show source/confidence and missing data. Do not imply an allergy match establishes safety; users must verify packaging. Keep FODMAP explicitly beta. A strong Nutri-Score does not establish complete nutrition or ingredient evidence.

### Preferences

Grouped switch rows: Diet & goals, Allergies & avoid, Location, with an implemented bulk shopping preference. Selected switches are black. Preserve supported modes and allergy controls. ZIP remains optional and USA-only; prices remain estimates. New preference types stay in the vision until supported by data and ranking logic.

### Account And Lists

Google OAuth primary, email magic link secondary. Saved lists need loading, empty, success, and error states. Bought confirmation follows API success. Keep current account/entitlement behavior aligned with the backend, not mockup badges.

## Accessibility And Motion

Short 120-180ms transitions; respect reduced motion. Lucide functional icons with accessible names and hover titles. Dialogs trap focus, close on Escape, and restore focus. Status messages use live regions. Tabs/navigation expose selected state. Never rely on color alone.

## Full Vision Versus Release

References show scan, recipes, ZIP/store lookup, sharing, and a meal prompt. Those belong to the README vision. Don't add dead navigation, invented inventory, or fabricated nutrition to match a screenshot. This refresh changes branding and existing discovery surfaces; later capabilities require their own implementation.

## Acceptance

- Meezany across header, browser metadata, manifest, and current docs.
- No active broccoli branding or green gradients.
- Search, quick lookup, preferences, saved lists, and bought actions remain usable.
- Desktop list/detail browsing and mobile sheets work with keyboard focus.
- Long titles, missing photos/prices, unknown health, empty lists, and failed searches fit at 390px and 1440px.
- Scores, estimated prices, units, and uncertainty are accurately labeled.
- Full vision preserved without presenting planned features as released.

## Implemented Refresh

The current app uses this system in `components/Dashboard.tsx`, `components/ProductDetail.tsx`, and `app/globals.css`.

- Desktop: navigation rail, editable grocery workspace, and a sticky, independently scrollable product-detail panel.
- Mobile: compact header, bottom navigation, horizontally browsable option cards, and native dialog sheets.
- Existing discovery flows: list search, quick lookup, diet/allergen preferences, optional ZIP, product details, Google/email sign-in, saved-list snapshots, and purchase recording.
- List entry accepts commas, newlines, bullets, and numbered lists, with case-insensitive duplicates removed. Reorder with drag handles or move buttons in Edit list. Checkoffs are local UI state; Bought this records a product only after the API succeeds.
- Product options sort by best match, comparable unit price, or Open Food Facts Nutri-Score. Missing values stay unknown; no combined 0–100 score is shown.
- Recipes, scan, social, export, and meal-calendar navigation are deferred until those flows exist.

The original reference assets are retained. The SVG ribbon is a provisional interpretation; final production vector artwork is still needed for an exact logo match.

Verification for this refresh: TypeScript, 92 unit tests, production build, and desktop/mobile browser checks. Browser integration checks use controlled fixtures for product, list, and purchase responses; live OAuth, provider data, and account persistence require an authenticated staging check.

Backend behavior and evidence requirements are documented in [Backend implementation](docs/BACKEND.md). Show progressive item results, explicit unknown nutrition, observed price source/date, and comparable unit prices when supported.
